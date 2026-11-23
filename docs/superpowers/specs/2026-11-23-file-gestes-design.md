# File de gestes hors ligne : envoi en arrière-plan (#23) et quarantaine

Date : 23 novembre 2026. Branche : `claude/file-gestes-58e09c`.

Deux corrections sur la file IndexedDB des gestes de stock (`src/lib/offline/`) et son service worker :

1. l'issue #23 (R-3) : un « Bue » fait hors ligne ne part qu'à la réouverture de l'appli ;
2. le chantier n° 2 du conseil : un geste qui échoue sans fin bloque la file, sans rien afficher.

## 1. Issue #23 : envoi au retour du réseau, appli fermée

### Ce qui est établi

- Le geste demande bien le Background Sync. `sendStockOps` appelle `requestBackgroundSync()` dès que le geste reste en file (`src/lib/stock-client.ts:100`), et `startSyncLoop` le redemande à chaque ouverture si la file n'est pas vide.
- Le service worker écoute `sync` (tag `apogee-stock-sync`), lit l'utilisateur actif dans IndexedDB et appelle `syncNow` avec le même verrou que les onglets. Ce chemin ne dépend d'aucune fenêtre ouverte.
- Quand `syncNow` répond `retry` (erreur réseau, délai dépassé, 5xx) ou `offline`, `backgroundSync()` rejette sa promesse. Chrome reprogramme alors l'événement après un délai qui croît de façon exponentielle (`initial_retry_delay × retry_delay_factor^(n-1)`, de l'ordre de plusieurs minutes), avec un nombre limité de tentatives (`max_sync_attempts`). Source : [background_sync_parameters.h](https://chromium.googlesource.com/chromium/src/+/711ab9bc/content/public/browser/background_sync_parameters.h).
- Le serveur ne journalise pas les requêtes. La seule trace est `applied_ops.applied_at`, l'heure d'application.

### Cause retenue

Chrome déclenche `sync` dès qu'Android signale un réseau. À la sortie du mode avion, ce réseau n'est souvent pas encore utilisable (DNS, attribution d'adresse, validation par Android). Le premier envoi échoue, le service worker rejette, et Chrome ne réessaie que plusieurs minutes plus tard. L'utilisateur a rouvert l'appli au bout d'une minute environ : c'est l'onglet qui a envoyé le geste.

Le service worker n'a qu'une tentative par événement. Il confie tout nouvel essai au calendrier de Chrome, qui se compte en minutes.

Ce n'est pas prouvé sur le téléphone : il faudrait `chrome://inspect` pendant le test. Il reste possible qu'Android retarde lui-même le réveil de Chrome (économie de batterie). Dans ce cas, le correctif ci-dessous ne gêne pas et ne suffit pas.

### Correctif

Dans `backgroundSync()`, réessayer **pendant l'événement** au lieu de rejeter tout de suite :

- après un `retry`, un `offline` ou un `busy`, attendre puis relancer `syncNow` : 2 s, 4 s, 8 s, 15 s, 30 s, puis 60 s, soit à peu près deux minutes au total. Chrome coupe un événement `sync` au bout de quelques minutes ;
- s'arrêter dès `ok`, `idle` ou `unauthorized` ;
- après le dernier essai sans succès, rejeter comme aujourd'hui, pour garder les reprises de Chrome ;
- envoyer chaque résultat aux onglets ouverts, comme aujourd'hui.

La boucle d'attente sera une fonction pure, sans `$app/*`, testée avec une horloge simulée : `runWithRetries(syncOnce, delays, sleep)`.

### Vérification

- Vitest : la boucle (succès au 3e essai, arrêt sur `unauthorized`, rejet après le dernier délai).
- Chromium, par Playwright et CDP : geste mis en file, aucune fenêtre de l'appli ouverte, serveur coupé puis relancé quelques secondes plus tard, `ServiceWorker.dispatchSyncEvent`. Attendu : le geste est appliqué pendant le même événement.
- Après déploiement, refaire le test R-3 sur le téléphone et comparer `applied_ops.applied_at` à l'heure de sortie du mode avion.

## 2. Quarantaine des gestes qui échouent sans fin

### Problème

Un échec technique (5xx, erreur réseau, délai dépassé, réponse illisible) laisse le lot en tête de file, et `bumpAttempts` compte l'essai. Si un geste fait planter le serveur à chaque envoi, la file reste bloquée derrière lui. Les gestes suivants restent dans la surcouche optimiste, donc le stock affiché devient faux, et l'utilisateur ne voit rien d'autre que « N gestes en attente ».

### Règles

**Échec imputable.** Un échec compte contre un geste (« coup ») seulement si le serveur est joignable :

- une réponse HTTP en échec (500, par exemple) ou illisible est imputable, sauf 502, 503 et 504 ;
- après une erreur réseau, un délai dépassé, ou une réponse 502, 503 ou 504, on interroge `/healthz` (5 s). Un 502, 503 ou 504 vient souvent du proxy pendant un redémarrage de l'appli. Si `/healthz` répond 2xx, l'appli et sa base tournent, et l'échec est imputable. Sinon, l'appli ou le réseau est en cause : on attend sans compter de coup. Sans cette sonde, un déploiement ordinaire mettrait des gestes innocents en quarantaine, puisque le service worker réessaie plusieurs fois en une minute.

`attempts` garde son sens actuel (« peut-être appliqué ») et continue d'augmenter à chaque échec.

**Isoler le coupable.** Le serveur applique les gestes d'un lot un par un, chacun dans sa transaction. Un lot qui échoue a donc pu appliquer ceux qui précèdent le fautif, et leur renvoi est sans effet grâce à l'`opId`. Le coup va au **premier geste du lot**. Un geste en tête de file qui a déjà pris un coup part **seul**. Un geste innocent repart seul et réussit, ce qui fait avancer la file jusqu'au fautif.

**Quarantaine.** Après **5 coups**, le geste passe en quarantaine : la ligne IndexedDB reçoit `quarantinedAt`. Sans index, la version de la base ne change pas. Un geste en quarantaine :

- n'est plus envoyé, ni par les onglets ni par le service worker, et ne bloque plus ceux qui suivent ;
- sort de la surcouche optimiste et du compteur « gestes en attente ». L'écran affiche alors l'état du serveur, qui est le seul état sûr ;
- reste dans la file : la déconnexion le compte toujours parmi les gestes non synchronisés.

**Disjoncteur.** `/healthz` ne vérifie que la lecture de la base. Si toute écriture échoue (base en lecture seule, disque plein, migration cassée), chaque geste prendrait ses 5 coups l'un après l'autre et toute la file passerait en quarantaine. Le serveur est alors en panne : ce n'est la faute d'aucun geste. Règle : **un nouveau geste ne passe en quarantaine que si un envoi a réussi depuis la dernière mise en quarantaine.** Sinon il garde ses coups, reste en tête de file et bloque la suite, comme avant ce chantier, jusqu'à ce que le serveur réponde de nouveau. La date du dernier envoi réussi (`lastSentAt`) est gardée dans le magasin `meta` d'IndexedDB, partagé par les onglets et le service worker. Seul le premier geste touché pendant une panne générale finit donc en quarantaine, et « Réessayer » le renvoie une fois la panne réparée.

Les refus métier ne changent pas : un lot refusé en 400 est abandonné avec le toast `offline_op_failed`, et un geste `rejected` produit le toast habituel. Un `review` rejeté reste silencieux. La quarantaine ne concerne que les échecs techniques répétés.

**Gestes qui dépendent d'un geste en quarantaine.** Un `review` dont le `consumeOpId` vise un « Bue » en quarantaine serait refusé (`not_found`), puis supprimé en silence, et le verdict serait perdu. Il est donc **retenu avec son « Bue »** :

- il reste en file sans être envoyé tant que son « Bue » est en quarantaine. La règle est évaluée à chaque synchro et couvre aussi un verdict ajouté après la mise en quarantaine ;
- il s'affiche avec son « Bue », il n'a pas de ligne à lui et ne compte pas dans les gestes en attente ;
- « Réessayer » sur le « Bue » le libère : il repart juste après. « Abandonner » supprime les deux.

Les gestes sur un même lot (`adjust`, `move` après un `consume` en quarantaine) ne sont pas retenus. Le serveur les traite contre le stock réel. Renvoyé plus tard, le « Bue » peut être refusé (`empty_lot`) et afficher le toast habituel. C'est un refus métier normal.

Un `review` en échec technique alors que son « Bue » est passé suit la règle générale : il est mis en quarantaine et affiché. Seul son **rejet** reste silencieux.

### Interface

Dans `src/routes/app/+layout.svelte`, sous la ligne « N gestes en attente », un bloc apparaît s'il existe au moins un geste en quarantaine :

- un titre : « 1 geste n'a pas pu être envoyé » ou « N gestes n'ont pas pu être envoyés » ;
- une ligne par geste, avec un libellé par type et la date du geste : « Bouteille bue », « Stock ajusté », « Bouteille déplacée », « Bouteille remise en cave », « Verdict ». S'y ajoute « + verdict » quand un `review` est retenu avec le geste ;
- « Réessayer » : le geste quitte la quarantaine avec 4 coups, puis une synchro part tout de suite. Il est donc envoyé seul. Un nouvel échec imputable le remet en quarantaine, avec le toast « Toujours impossible à envoyer ». S'il n'y a pas de réseau, il redevient un geste en attente ordinaire ;
- « Abandonner » : une confirmation dans un `Sheet` (« Ce geste ne sera jamais envoyé. S'il a déjà été pris en compte, corrigez le stock à la main. »). Ensuite, la ligne et ses gestes retenus sont supprimés, puis les données sont rechargées.

Au moment d'une mise en quarantaine, par un onglet ou par le service worker, un toast « Un geste n'a pas pu être envoyé » s'affiche et les données sont rechargées.

Tous les textes existent en FR et en EN dans `messages/*.json`.

### Découpage du code

- `queue.ts` : champs `strikes?` et `quarantinedAt?`, plus `strike(opId)`, `quarantine(opId)` et `releaseQuarantine(opId, strikes)`. `listQueued` les renvoie.
- `sync.ts` : `serverReachable(fetch)` (copie autonome de `probeServer`, importable par le service worker), le coup en tête de lot, l'envoi seul, le filtrage des gestes en quarantaine et de ceux qu'ils retiennent, et `SyncOutcome.quarantined`.
- `pending.svelte.ts` : un état `quarantined` réactif lu par `refreshPending`, l'exclusion de la surcouche et du compteur, le toast, puis `retryQuarantined` et `abandonQuarantined` sous `withSyncLock`.
- `service-worker/index.ts` : la boucle d'essais (partie 1). Le message `sync-outcome` transmet `quarantined`, et les onglets qui ne le connaissent pas l'ignorent.
- Un composant `QuarantinePanel.svelte`.

### Tests

- Vitest (`fake-indexeddb`) : coup imputable ou non selon `/healthz`, coup au premier geste du lot, envoi seul après un coup, quarantaine au 5e coup, gestes suivants envoyés, `review` retenu puis libéré ou abandonné, refus métier inchangés, `review` rejeté toujours silencieux, retour de quarantaine.
- Navigateur au format téléphone, sur une base temporaire : un 500 forcé en mode dev sur un geste précis fait apparaître le bloc, puis « Réessayer » et « Abandonner » fonctionnent. Le mécanisme exact du 500 forcé sera défini dans le plan : un proxy de test, sans code de production.
