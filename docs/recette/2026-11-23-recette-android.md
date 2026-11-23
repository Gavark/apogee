# Recette en conditions réelles : Android et sauvegardes (23 novembre 2026)

Instance : https://apogee.gavark.fr (conteneur `apogee`, image `ghcr.io/gavark/apogee:latest` du 23/11, migrations 0000 à 0005).
Cave au moment de la recette : 12 vins, 1 utilisateur, 1 foyer, 1 abonnement push (Chrome Android, créé le 20/11).
Hôte : Windows, fuseau UTC-4 (`SA Western Standard Time`). Conteneurs : `TZ=Europe/Paris`.

| # | Vérification | Résultat |
|---|---|---|
| 1 | Notification de changement de phase sur le téléphone | OK, mais à 13 h locale (ticket R-2) |
| 2 | Démarrage hors ligne depuis l'icône | OK ; envoi en arrière-plan non constaté (ticket R-3) |
| 3 | Copie des sauvegardes vers Drive | OK |
| 4 | Restauration à blanc | Sauvegarde OK ; procédure Windows en échec (ticket R-1) |

## 1. Notification de changement de phase

### Fonctionnement relevé dans le code

- `src/hooks.server.ts` lance `runNotificationTick` toutes les 10 minutes, plus une fois 60 s après le démarrage.
- `src/lib/server/notifications/tick.ts` : au plus un envoi par utilisateur abonné et par jour local, à partir de 18 h dans le fuseau **du compte** (`users.timezone`). Le jour est réservé avant l'envoi. L'heure (`DISPATCH_HOUR = 18`) est figée dans le code, et aucune route ne permet de forcer un envoi.
- `src/lib/server/notifications/phases.ts` : la phase dépend uniquement de l'année civile (`computePhase`). Le scan quotidien du foyer inscrit dans `notification_log` les phases nouvellement atteintes par les vins en stock. Le premier scan d'un foyer ne fait qu'amorcer le journal, sans rien notifier.
- Chaque geste de l'utilisateur (création, modification, réassort, fenêtre proposée par l'IA) enregistre la phase en cours comme déjà vue (`markCurrentPhaseSilently`). Depuis l'interface, seul le changement d'année peut donc déclencher une notification.
- `digest.ts` regroupe les événements depuis le dernier envoi, par exemple « 1 vin est prêt à boire. ». Un clic ouvre `/app`.

État en base avant le test (lecture seule) : 12 lignes `notification_log`, toutes silencieuses (amorçage). Le scan tourne chaque soir, mais aucun push n'est jamais parti.

### Protocole retenu

1. Création, sur le téléphone, d'un vin « TEST RECETTE » (2020, à boire de 2024 à 2030, 1 bouteille). Sa phase « prête » est notée comme déjà vue.
2. Avec l'accord de l'utilisateur, une seule écriture en production : suppression de la ligne `notification_log` de ce vin.
3. Au premier passage du job après 18 h à Paris, soit 13 h heure locale, le scan voit la phase comme nouvelle et envoie le résumé.
4. Contrôle côté serveur : `users.last_dispatch_date`, `push_subscriptions.last_seen_at` (mis à jour après un envoi réussi) et journaux `[push]`.
5. Suppression du vin de test depuis l'appli.

### Résultat

- Vin de test créé le 23/11 à 09 h 43 locale (vin 13, ligne `notification_log` n° 37, silencieuse). La ligne a été supprimée à 09 h 44 avec l'accord de l'utilisateur. Ce fut la seule écriture en production.
- Côté serveur, à 13 h 02 min 29 locale (17:02:29 UTC, premier passage du job après 18 h à Paris) : jour réservé (`last_dispatch_date` = 2026-11-23), scan du foyer fait, phase `ready` du vin 13 enregistrée comme événement **non silencieux**. Le service push a accepté l'envoi (`push_subscriptions.last_seen_at` = 17:02:29, réponse 2xx), sans aucune ligne `[push] send failed`.
- Sur le téléphone : notification « Apogée : 1 vin est prêt à boire. » **reçue** (confirmée par l'utilisateur).

**Verdict : OK.** La chaîne complète (job du soir, scan des phases, résumé, Web Push, service worker, Android) fonctionne sur le vrai téléphone. Seule réserve : l'heure, 13 h locale au lieu de 18 h (ticket R-2).

## 2. Démarrage hors ligne depuis l'icône

Comportement attendu, d'après `src/service-worker/index.ts` et `src/lib/offline/page-cache.ts` :

- `start_url` = `/app`. Les pages de lecture (`/app`, `/app/cave`, `/app/wines/<id>`) passent d'abord par le réseau. Une copie de chaque page visitée est gardée, et sert si le réseau échoue ou si l'ouverture dépasse 4 s.
- Seules les pages déjà visitées en ligne sont disponibles. Les photos, les formulaires et les réglages exigent le réseau.
- « Bue » hors ligne : le geste est mis en file, puis envoyé au retour du réseau par Background Sync (tag `apogee-stock-sync`), même appli fermée.

Procédure suivie :

1. En ligne, depuis l'icône : visite de l'accueil, de la cave et de quelques fiches.
2. Fermeture complète de l'appli, puis mode avion.
3. Relance depuis l'icône : accueil, cave, fiche déjà vue, puis fiche jamais vue.
4. « Bue » sur une fiche, puis sortie du mode avion.
5. Contrôle côté serveur de la consommation reçue.

### Résultat

Observations de l'utilisateur sur le téléphone, avec le contrôle côté serveur :

- Lancement depuis l'icône en mode avion : l'accueil s'affiche normalement et vite. **OK**
- Liste « Cave » et fiches déjà visitées : tout s'ouvre, sans les photos, ce qui est attendu. **OK**
- « Bue » sur « Test recette » en mode avion : le geste est gardé, puis envoyé. La consommation est arrivée sur le serveur le 23/11 à 13 h 30 min 38 locale, avec son verdict (`early`), et le stock du vin est passé à 0. Aucune perte. **OK**
- Envoi automatique au retour du réseau, appli fermée : **pas constaté**. La bouteille n'est partie qu'à la réouverture de l'appli (ticket R-3).
- Fiche jamais ouverte avant le mode avion : **pas testé**.

## 3. Copie des sauvegardes vers Drive : OK

- `backups/sync-offsite.log` : une ligne `OK:` pour chaque exécution, la première à la main le 20/11 à 18 h 25, puis chaque nuit à 23 h 15 les 20, 21 et 22/11 (une base et une archive de photos copiées par nuit, contrôlées par SHA256).
- Tâche planifiée `\Apogee\Backup vers Google Drive` : dernier résultat 0, prochaine exécution le 23/11 à 23 h 15.
- Ordre des horaires respecté : la sauvegarde du conteneur part à 3 h à Paris, soit 22 h locale, et la copie à 23 h 15 locale.

## 4. Restauration à blanc

Sauvegarde testée : la base de la nuit du 22 au 23/11 et l'archive de photos de même horodatage, copiées dans un dossier temporaire (empreintes SHA256 identiques). `data/` n'a jamais été touché.

Contrôles en lecture seule :

- `PRAGMA integrity_check` = ok, `foreign_key_check` vide ;
- 12 vins, 12 lots (12 bouteilles), 1 utilisateur, 1 foyer, 12 photos référencées ;
- migrations 0000 à 0004 présentes (hachages identiques à `drizzle/`). La 0005 (`consumptions.verdict`) manque : c'est normal, elle a été livrée le matin du 23/11, après la sauvegarde.

Restauration selon `docs/BACKUP.md` (section Windows), sur la copie, avec l'image de production lancée sans réseau (`--network none`) :

- la première tentative a échoué (voir R-1) ;
- après correction des droits, le démarrage passe : « Migrations applied. », `/healthz` = ok, 6 migrations, colonne `verdict` présente, 12 vins, 1 utilisateur, 12 photos sur 12 retrouvées.

Conteneur de test et dossiers temporaires supprimés ensuite.

## Tickets

### R-1 : la restauration Windows décrite dans BACKUP.md rend la base en lecture seule

- **Constat** : avec Docker Desktop, `Copy-Item backups\apogee-<TS>.sqlite data\apogee.sqlite -Force` recopie aussi les métadonnées du fichier de sauvegarde, créé par root dans le conteneur `apogee-backup`. La base restaurée apparaît donc `root:root 0644` dans le conteneur, et l'application (uid 1000) ne peut plus y écrire. La doc précise même que « `chown` est inutile avec Docker Desktop ».
- **Étapes** : suivre la section Windows de « Restauration » de `docs/BACKUP.md`, puis démarrer `apogee`.
- **Attendu** : l'application démarre et rejoue les migrations.
- **Observé** : le conteneur s'arrête au démarrage avec `DrizzleError: Failed to run the query 'ALTER TABLE consumptions ADD verdict text;'`, causé par `SqliteError: attempt to write a readonly database`. Sans migration en attente, l'échec arriverait à la première écriture. Reproduit aussi en écrasant une base existante appartenant à `node`.
- **Contournement vérifié** : après la copie, `docker run --rm -v ${PWD}\data:/data alpine:3 chown -R 1000:1000 /data`, puis démarrage : tout passe.
- **Correctif proposé** : ajouter cette ligne à la procédure Windows et retirer la mention « `chown` est inutile ».

### R-2 : le fuseau du compte est figé sur Europe/Paris alors que l'utilisateur vit en UTC-4

- **Constat** : le fuseau d'un compte vient de `TZ` à sa création (`resolveInstanceTimezone`, `Europe/Paris` par défaut), et aucun écran ne permet de le changer. L'utilisateur vit en Guadeloupe (`America/Guadeloupe`, UTC-4 toute l'année), mais son compte et les conteneurs sont réglés sur `Europe/Paris`.
- **Étapes** : Compte › Notifications. Le texte d'aide affiche « fuseau horaire de votre compte : Europe/Paris », et rien ne permet de le modifier.
- **Attendu** : le résumé quotidien arrive vers 18 h heure locale, l'année des phases change le 1er janvier à minuit local, et la sauvegarde tourne à 3 h locale.
- **Observé** : résumé vers 13 h locale, bascule d'année le 31 décembre à 19 h locale, sauvegarde à 22 h locale. L'année affichée dans l'appli (`currentYear(user.timezone)`) suit aussi Paris.
- **Pistes** : (a) mettre `TZ` à la zone IANA réelle dans `.env`. Cela ne règle que les nouveaux comptes et l'heure de sauvegarde. La sauvegarde passerait alors à 3 h locale : la copie Drive de 23 h 15 l'emporterait avec près de 20 h de retard, et il vaudrait mieux la décaler vers 4 h. (b) Corriger `users.timezone` du compte existant, ce qui demande une écriture en base. (c) Ajouter le choix du fuseau dans Compte : c'est la vraie correction. Elle a été faite le 23/11 dans une session à part, sur la branche `feat/fuseau-horaire-compte` (commit 332d2a2, pas encore poussée). Une fois livrée, l'utilisateur passera son compte en `America/Guadeloupe` depuis ce nouvel écran.

### R-3 : la bouteille bue hors ligne n'est pas partie seule, appli fermée

- **Constat** : `src/service-worker/index.ts` écoute `sync` (tag `apogee-stock-sync`) pour envoyer la file « même appli fermée ». Sur le téléphone, l'envoi n'a eu lieu qu'à la réouverture de l'appli.
- **Étapes** : en mode avion, « Bue » sur une fiche, fermeture complète de l'appli, sortie du mode avion, attente d'environ une minute, réouverture.
- **Attendu** : la consommation part au retour du réseau, avant la réouverture.
- **Observé** : elle ne part qu'à la réouverture (13 h 30 min 38 côté serveur). La donnée arrive quand même, sans doublon : ce n'est pas bloquant.
- **À creuser** : la vérification n'a été faite qu'une fois. Chrome Android peut retarder un événement `sync` (économie de batterie, engagement du site, processus tué). Il faut vérifier que `requestBackgroundSync()` est bien appelé au moment du geste, puis regarder dans `chrome://inspect` › Service workers ou dans les journaux serveur quand la requête arrive. Si c'est inévitable, il suffit de corriger la promesse dans l'interface.
- **Gravité** : faible.

## Bilan

- La promesse centrale tient : un changement de phase déclenche bien une notification sur le vrai téléphone Android.
- Le démarrage hors ligne depuis l'icône marche, et un « Bue » hors ligne n'est jamais perdu.
- Les sauvegardes sont copiées hors machine chaque nuit et se restaurent, à condition de corriger les droits (R-1).
- Nettoyage : le vin de test (vin 13) a été supprimé par l'utilisateur depuis l'appli ; sa ligne de journal et sa consommation de test partent avec lui (`ON DELETE CASCADE`).
