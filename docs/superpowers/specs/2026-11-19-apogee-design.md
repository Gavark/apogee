# Apogée — gestion de cave à vin auto-hébergée

*Document de conception — 2026-11-19*
*Nom de travail « Apogée » (dépôt `apogee`) : choix de Claude, modifiable.*

## 1. Intention

Le problème réel : **des bouteilles oubliées, bues trop tard**. L'application doit donc
avant tout *venir chercher* l'utilisateur au bon moment ; l'inventaire est un moyen, pas
une fin.

Elle s'utilise principalement sur téléphone (application web installable, comme
babysleep), dans un foyer qui partage une même cave répartie sur plusieurs lieux
(cave, casiers, cave électrique). La fenêtre de dégustation de chaque vin est estimée
par une IA à partir d'une photo de l'étiquette.

Le projet est auto-hébergé (Docker), pas un SaaS.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs (v1)**
- Ajouter un vin en photographiant l'étiquette : l'IA identifie le vin et propose une
  fenêtre de dégustation ; l'utilisateur valide ou corrige.
- Écran d'accueil « Quoi ouvrir » : bouteilles classées par urgence.
- Notifications push quand un vin change de phase (prêt, apogée, dernière année, passé),
  plus un **rappel mensuel** tant qu'il reste des bouteilles à boire vite.
- « Bue » et les +/− fonctionnent même avec un réseau intermittent et se resynchronisent
  (§6.7).
- Savoir **où** est chaque bouteille (lieu + précision libre).
- Noter « bue » en un geste pour garder un stock juste.
- Comptes rattachés à un foyer ; plusieurs foyers par instance.

**Non-objectifs (v1)**
- Vue en grille des casiers (case par case) — envisagée plus tard.
- Cotation, valeur de revente, marché, achat/vente.
- Partage public de cave, réseau social, accords mets-vins.
- Paiement, abonnements, facturation de l'usage IA.

**Anti-objectifs** (échecs même si « ça marche »)
- La saisie est assez pénible pour qu'on arrête de tenir le stock à jour → les alertes
  deviennent fausses et l'appli perd sa raison d'être. *Toute action courante (ajouter,
  marquer bue) doit tenir en quelques touches.*
- Les notifications deviennent du bruit (une alerte par bouteille, tous les jours) et
  finissent désactivées.
- Une fenêtre IA présentée comme une certitude alors qu'elle est une estimation.
- L'appli est inutilisable sans IA configurée.

## 3. Contraintes

- **Auto-hébergement** : une image Docker, SQLite sur un volume, Caddy en reverse proxy,
  comme babysleep. Aucune dépendance à un service tiers obligatoire hormis le
  fournisseur d'IA (optionnel).
- **Mobile d'abord**, installable (PWA : manifest + service worker), utilisable sur
  desktop.
- **FR/EN** dès la v1 (FR par défaut).
- **IA agnostique du fournisseur**, Claude par défaut. Projet personnel : les crédits API
  personnels de l'auteur peuvent être utilisés.
- **Design** : la skill `taste-skill:design-taste-frontend` doit être utilisée pour
  concevoir les écrans (demande explicite de l'utilisateur).

## 4. Approches envisagées

| | Approche | Compromis |
|---|---|---|
| A | Dupliquer le dépôt babysleep et remplacer le domaine bébé par la cave | Démarrage instantané, mais historique et résidus à nettoyer ; le modèle utilisateurs n'a pas de foyer, à refondre de toute façon |
| **B** ✅ | **Nouveau projet, même stack que babysleep, en transplantant les briques éprouvées** | Base propre, stack connue, modèle de données pensé foyer dès le départ ; quelques heures de plus pour transplanter |
| C | Autre stack (PocketBase, Next.js…) | Perd tout l'acquis de babysleep (push, PWA, déploiement) sans gain pour une appli de cette taille |

**Choix de l'utilisateur : B.**

## 5. Stack et briques reprises de babysleep

Stack identique à babysleep (`D:\Dev\Gavark\CalculateurSommeilBebe`) :
SvelteKit (Svelte 5) + `adapter-node`, SQLite via `better-sqlite3` + Drizzle ORM/Kit,
Paraglide (i18n), `@node-rs/argon2`, `web-push`, Vitest, Docker + Caddy.

Briques à **transplanter et adapter** (pas copier aveuglément) :

| Brique babysleep | Adaptation pour Apogée |
|---|---|
| `src/lib/server/auth/*` (sessions, mots de passe argon2, e-mail, invitations, bootstrap admin, locale) | Invitations rattachées à un foyer (voir §6.1) |
| `src/routes/setup`, `login`, `logout`, `signup`, `account`, `account/sessions` | `setup` crée aussi le premier foyer |
| `src/routes/admin/invitations` | Devient l'admin d'instance (foyers, invitations, état IA) |
| `src/lib/server/push/*` (VAPID, abonnement, envoi, scheduler) | Planification par phase de vin au lieu des siestes (§6.4) |
| `src/service-worker`, `static/manifest.webmanifest`, icônes | Nouvelle identité visuelle |
| `src/lib/server/rate-limit.ts` | Réutilisé pour login et pour les appels IA |
| `src/routes/healthz`, Dockerfile, docker-compose, Caddyfile, `docs/BACKUP.md`, `docs/UPGRADING.md` | Volume de données inclut aussi les photos |
| `src/lib/theme.ts`, `/api/theme`, `/api/locale` | Tel quel (clair/sombre, langue) |

## 6. Conception

### 6.1 Comptes, foyers, rôles

- Un **foyer** possède la cave. Tout utilisateur appartient à **exactement un** foyer.
- Rôles :
  - **Admin d'instance** (`users.is_admin`) : celui qui a installé l'appli. Crée des
    foyers, génère des invitations, voit l'état de la configuration IA.
  - **Membre de foyer** : accès complet en lecture/écriture à la cave du foyer, peut
    inviter d'autres membres *dans son foyer*.
  *(Choix de Claude : pas de rôle « propriétaire de foyer » distinct en v1 ; tous les
  membres sont égaux.)*
- **Retrait / suppression** *(choix de Claude)* : un membre ne peut pas retirer un autre
  membre. Seul l'admin d'instance supprime un compte. À la suppression, `wines.created_by`
  et `consumptions.user_id` passent à `NULL` (l'historique reste). Un foyer vidé de ses
  membres est conservé ; l'admin peut le supprimer explicitement (suppression en
  cascade de sa cave et de ses photos).
- **Création de foyer** : uniquement au setup (premier foyer) ou via une invitation
  « nouveau foyer » émise par l'admin d'instance. Pas d'écran séparé de création de foyer.
- **Inscription fermée par défaut** (`DISABLE_SIGNUP=true`) : on rejoint par invitation.
  Une invitation porte soit un `household_id` (rejoindre un foyer existant), soit rien
  (l'invité crée un nouveau foyer à l'inscription — seul l'admin d'instance peut émettre
  ce type).
- Premier lancement : le wizard `setup` (ou `ADMIN_EMAIL`/`ADMIN_PASSWORD` en
  variables d'env, comme babysleep) crée l'admin **et** son foyer.
- **Isolation stricte** : toute requête sur des données de cave filtre par le foyer de
  l'utilisateur de la session. Un admin d'instance ne voit pas le contenu des caves des
  autres foyers (seulement leur existence et leurs membres).

### 6.2 Modèle de données (esquisse)

Les tables d'auth (`users`, `sessions`, `invitations`), `app_config` et
`push_subscriptions` reprennent celles de babysleep, avec :
- `users.household_id` (FK, non nul) ;
- `invitations.household_id` (FK, nullable).

Nouvelles tables :

- **`households`** : `id`, `name`, `created_at`.
- **`locations`** (lieux) : `id`, `household_id`, `name` (« Cave », « Cave électrique »…),
  `sort_order`. Unicité `(household_id, name)`.
- **`wines`** (une référence = un vin d'un millésime donné) :
  - identité : `producer`, `cuvee`, `appellation`, `region`, `country`, `color`
    (`red|white|rose|sparkling|sweet|fortified`), `vintage` (nullable pour les non
    millésimés), `grapes` (texte libre), `format_cl` (75 par défaut) ;
  - `acquired_year` : année d'entrée en cave, **obligatoire si `vintage` est nul**
    (sert de référence à la fenêtre des non-millésimés), pré-remplie avec l'année
    courante ;
  - fenêtre, **en années absolues** : `drink_from`, `peak_from`, `peak_to`,
    `drink_until` — **toutes facultatives** : un vin peut être enregistré sans fenêtre
    (phase `unknown`, §6.3) *(choix de Claude)* ;
  - provenance de la fenêtre : `window_source` (`ai|manual`), `ai_confidence`
    (`low|medium|high`), `ai_rationale` (1–3 phrases), `ai_model`, `ai_analyzed_at` ;
  - `label_photo` (chemin relatif dans le volume de données), `notes`,
    `created_by`, `created_at`, `updated_at`.
- **`stock_lots`** : `id`, `wine_id`, `location_id`, `position` (texte libre : « casier 3,
  rangée 2 »), `quantity` (≥ 0). Unicité `(wine_id, location_id, position)`.
  Un vin peut avoir plusieurs lots répartis dans plusieurs lieux.
- **`consumptions`** (historique des bouteilles bues) : `id`, `wine_id`, `location_id`,
  `user_id`, `consumed_on` (date), `rating` (1–5, nullable), `note` (nullable).
- **`notification_log`** : `id`, `wine_id`, `phase`, `notified_at`. Unicité
  `(wine_id, phase)` → chaque changement de phase n'est notifié qu'une fois.

- **`applied_ops`** (idempotence de la resynchro, §6.7) : `op_id` (UUID généré côté
  client, clé primaire), `household_id`, `applied_at`, `result` (JSON court).

Un vin dont la somme des lots vaut 0 reste en base (historique), mais disparaît de
« Quoi ouvrir » et des notifications ; il apparaît dans un filtre « Bus ».

**Identité d'un vin (détection de doublon)** *(choix de Claude)* : producteur, cuvée,
appellation, couleur, millésime **et format** (un magnum est une fiche distincte d'une
bouteille 75 cl, car il vieillit différemment). Pour un non-millésimé, l'`acquired_year`
fait aussi partie de l'identité : deux achats du même champagne NV à des années
différentes donnent deux fiches avec leurs propres fenêtres.

### 6.3 Phases et urgence

Calculées à partir de l'année courante `Y` (fonction pure, testée) :

| Phase | Condition | Libellé |
|---|---|---|
| `too_young` | `Y < drink_from` | Patience |
| `ready` | `drink_from ≤ Y < peak_from` | Prêt |
| `peak` | `peak_from ≤ Y ≤ peak_to` | À l'apogée |
| `last_call` | `Y > peak_to` et `Y ≤ drink_until`, **ou** `Y == drink_until` | À boire vite |
| `past` | `Y > drink_until` | Passé |

Si `peak_from`/`peak_to` sont absents, `ready` couvre `drink_from..drink_until-1` et
`last_call` la dernière année.

Si `drink_from` ou `drink_until` manque : phase **`unknown`** (« À estimer »). Ces vins
apparaissent dans une section dédiée en bas de « Quoi ouvrir » avec un bouton
« Estimer avec l'IA » / « Saisir la fenêtre », ont leur filtre dans « Cave », et sont
**exclus des notifications**.

**Écran « Quoi ouvrir »** : sections dans l'ordre `past` (« Ne tardez plus ») →
`last_call` → `peak` → `ready` ; `too_young` replié en bas (« Patience », avec l'année
d'ouverture). Dans chaque section, tri par `drink_until` croissant, puis millésime.

### 6.4 Notifications

- Un job quotidien (même mécanique `setInterval` que babysleep dans
  `hooks.server.ts`) recalcule la phase de chaque vin en stock.
- Pour chaque vin dont la phase a changé vers `ready`, `peak`, `last_call` ou `past` et
  qui n'a pas d'entrée `notification_log` pour cette phase : on l'ajoute au **résumé**
  du foyer.
- **Un seul push par utilisateur et par jour au maximum**, regroupant tous les vins
  concernés (« 3 vins entrent à leur apogée, 1 est à boire vite »). Le clic ouvre
  « Quoi ouvrir ».
- Heure d'envoi : 18h dans le fuseau de l'utilisateur *(choix de Claude)*.
- **Rappel mensuel** : le 1er de chaque mois à 18h, si le foyer a au moins une
  bouteille en stock en phase `last_call` ou `past`, chaque membre reçoit un push
  « Ce mois-ci, N bouteilles à ne pas oublier » citant les 2–3 plus urgentes. Rien
  n'est envoyé si la liste est vide. Le même jour, le résumé de changement de phase et
  le rappel mensuel sont fusionnés en un seul push.
- Préférences par utilisateur dans `account/notifications` : changements de phase
  activés/désactivés, rappel mensuel activé/désactivé (les deux activés par défaut).
- Les changements d'année (1er janvier) produisent naturellement la majorité des
  transitions ; c'est attendu.
- À la création d'un vin, sa phase courante est enregistrée dans `notification_log`
  sans envoyer de push (on ne notifie que les *changements*).

### 6.5 Analyse IA de l'étiquette

**Flux** :
1. L'utilisateur prend ou choisit une photo (`<input type="file" accept="image/*"
   capture="environment">`).
2. Le client redimensionne (côté navigateur, ~1600 px de grand côté, JPEG ~0,8) puis
   envoie au serveur.
3. Le serveur stocke la photo dans le volume de données, appelle le fournisseur IA et
   renvoie un **brouillon** de fiche.
4. Écran de revue : tous les champs sont éditables ; la fenêtre est présentée comme une
   estimation avec sa confiance et sa justification. L'utilisateur choisit lieu,
   précision, quantité, puis valide.
5. Si un vin identique existe déjà dans le foyer (même producteur, cuvée, appellation,
   millésime, couleur — comparaison normalisée), l'appli propose d'**ajouter du stock**
   à la fiche existante plutôt que d'en créer une nouvelle.

**Sans IA configurée** ou en cas d'échec : formulaire manuel, mêmes champs. La photo
est quand même conservée. Un bouton « Ré-estimer avec l'IA » sur la fiche permet de
relancer plus tard.

**Contrat de sortie** (JSON, validé côté serveur) :
```json
{
  "producer": "string|null", "cuvee": "string|null", "appellation": "string|null",
  "region": "string|null", "country": "string|null",
  "color": "red|white|rose|sparkling|sweet|fortified|null",
  "vintage": 2018, "grapes": "string|null", "format_cl": 75,
  "window": { "drink_from": 2022, "peak_from": 2025, "peak_to": 2030, "drink_until": 2034 },
  "confidence": "low|medium|high",
  "rationale": "1–3 phrases dans la langue de l'utilisateur",
  "is_wine_label": true
}
```
`is_wine_label=false` → message « Ce n'est pas une étiquette de vin » et formulaire
manuel. Années incohérentes (ordre non croissant, avant le millésime — ou avant
l'année d'entrée en cave pour un non-millésimé) → la fenêtre est laissée vide pour
l'utilisateur. Pour un non-millésimé, le serveur transmet l'année d'entrée en cave à
l'IA, qui raisonne à partir de celle-ci (une fenêtre absolue est toujours renvoyée).

**Abstraction fournisseur** (`src/lib/server/ai/`) :
- Interface unique `analyzeLabel(image, mimeType, locale) → LabelAnalysis`.
- Connecteur `anthropic` (SDK officiel `@anthropic-ai/sdk`, sortie structurée via
  tool use / JSON schema) — **par défaut**.
- Connecteur `openai-compatible` (endpoint `/chat/completions` avec image, configurable
  par `AI_BASE_URL`) → couvre OpenAI, Mistral, OpenRouter, Ollama…
- Configuration par variables d'environnement : `AI_PROVIDER`
  (`anthropic|openai-compatible|none`), `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`.
  Modèle par défaut pour Anthropic : le Sonnet le plus récent (bon compromis lecture
  d'étiquette / connaissance œnologique / coût) *(choix de Claude)*.
- Limite anti-abus : `AI_DAILY_LIMIT_PER_HOUSEHOLD` (défaut 100, de quoi remplir une
  cave d'environ 100 bouteilles en une soirée).
- La page admin affiche le fournisseur/modèle actifs et propose un bouton « Tester ».
- La clé n'est jamais envoyée au client ni écrite dans les logs.

### 6.6 Écrans

Navigation basse sur mobile : **Quoi ouvrir · Cave · ＋ (ajouter) · Compte**.

- **Quoi ouvrir** (accueil) : sections par urgence (§6.3). Chaque ligne : vin, millésime,
  nombre de bouteilles, lieu(x) + précision, année limite. Action rapide « Bue ».
  ```
  ⚠ À boire vite
    Chinon 2016 · 2 btl · jusqu'à 2026
    Cave — casier 3
  ★ À l'apogée
    Gigondas 2018 · 3 btl
    Cave électrique — étagère 2
  ```
- **Cave** : liste complète, recherche texte, filtres par lieu, couleur, phase, « Bus ».
  Compteur total de bouteilles.
- **Ajouter** : photo → analyse → revue → enregistrement (§6.5). Accès direct au
  formulaire manuel. Après enregistrement, bouton principal « Ajouter une autre » qui
  rouvre directement l'appareil photo en conservant le dernier lieu choisi : c'est le
  mode « premier remplissage » (~100 bouteilles, pas d'inventaire existant, donc pas
  d'import CSV en v1).
- **Fiche vin** : photo, identité, frise de la fenêtre (année courante marquée),
  confiance/justification IA, lots par lieu avec +/−, déplacer entre lieux, historique
  des bouteilles bues, modifier, ré-estimer, supprimer.
- **« Bue »** : un geste. Si le vin est dans plusieurs lots, on demande lequel ; sinon
  décrément direct avec un toast « Annuler ». Note et commentaire facultatifs, proposés
  dans le toast mais jamais obligatoires.
- **Lieux** (dans Compte ou Cave) : créer, renommer, réordonner, supprimer (refusé si
  le lieu contient du stock).
- **Compte** : profil, langue, thème, sessions, notifications, membres du foyer,
  inviter un membre.
- **Admin d'instance** : foyers, invitations, état IA.

Le design visuel (typographie, palette, composants, états vides) est conçu avec la
skill `taste-skill:design-taste-frontend`, en clair et sombre, mobile d'abord.

### 6.7 Réseau intermittent et resynchronisation

Le réseau est normalement disponible à la cave, mais l'utilisateur veut que les gestes
courants survivent à une coupure.

- **Lecture hors ligne** : le service worker met en cache la dernière réponse de
  « Quoi ouvrir », de « Cave » et des fiches vin consultées (stratégie *network-first*,
  repli sur le cache). Un bandeau discret indique « Hors ligne — données du JJ/MM HH:mm ».
- **Écritures en file d'attente** — uniquement les mouvements de stock : « Bue »,
  +/− sur un lot, déplacement entre lieux. Chaque geste devient une opération avec un
  `op_id` (UUID), stockée dans IndexedDB, appliquée immédiatement à l'affichage
  (optimiste), puis envoyée au serveur dès que possible (au retour du réseau, au
  retour au premier plan, et via Background Sync quand le navigateur le permet).
- **Opérations exprimées en deltas** (« −1 sur le lot X », « déplacer 2 du lot X vers
  le lieu Y »), jamais en valeurs absolues : les gestes de deux membres du foyer se
  combinent sans conflit. Le serveur borne les quantités à 0 ; si une opération ne peut
  s'appliquer entièrement (lot déjà vide), il le signale et le client affiche un
  avertissement.
- **Idempotence** : le serveur enregistre chaque `op_id` appliqué dans `applied_ops` ;
  un renvoi est ignoré et renvoie le résultat initial.
- « Annuler » sur une opération encore en file la supprime de la file ; sur une
  opération déjà synchronisée, il envoie l'opération inverse.
- **Hors périmètre hors ligne** : ajout d'un vin (nécessite l'IA et l'envoi de photo),
  modification de fiche, gestion des lieux et des comptes. Ces écrans indiquent
  clairement qu'ils nécessitent le réseau.

### 6.8 Exploitation

- Volume de données unique contenant `apogee.db` et `photos/`. Les sauvegardes
  (doc reprise de babysleep) couvrent les deux.
- Migrations Drizzle exécutées au démarrage, comme babysleep.
- `healthz` repris tel quel.

## 7. Tests (attendus)

- Unitaires : calcul de phase (§6.3), regroupement des notifications, validation /
  normalisation de la réponse IA, détection de doublon.
- Connecteurs IA testés avec un client simulé (pas d'appel réseau en CI).
- File hors ligne : idempotence (`op_id` rejoué), combinaison de deltas de deux
  membres, borne à 0, annulation avant/après synchro.
- Rappel mensuel : envoyé seulement si la liste est non vide, fusionné avec un résumé
  de phase le même jour.
- Isolation des foyers : un utilisateur ne peut ni lire ni modifier le vin, le lot ou le
  lieu d'un autre foyer (tests sur les routes/API).
- Parcours principal vérifié dans un navigateur mobile (ajout par photo, « Bue »,
  notification).

## 8. Laissé au constructeur

- Arborescence exacte des routes et découpage des composants.
- Prompt exact envoyé à l'IA (dans le respect du contrat §6.5).
- Choix d'implémentation du redimensionnement d'image côté client.
- Format exact des identifiants de photo et stratégie de nettoyage des photos orphelines.
- Licence (babysleep est en AGPL-3.0 ; reprendre la même par défaut).
- Emplacement du nouveau dépôt (proposition : `D:\Dev\Gavark\apogee`).
