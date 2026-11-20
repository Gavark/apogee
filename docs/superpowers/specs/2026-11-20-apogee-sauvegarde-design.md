# Apogée — Sauvegarde automatique (conception courte)

*2026-11-20 — complément à la spec principale (§6.8 Exploitation).*

## Intention

Aujourd'hui, `docs/BACKUP.md` décrit des commandes à lancer soi-même ; rien n'est automatique. L'utilisateur veut le même filet de sécurité que babysleep : une sauvegarde nocturne vérifiée, avec rotation, sans rien installer sur l'hôte.

## Objectifs / non-objectifs

- **Objectifs** : sauvegarde automatique quotidienne de la base **et des photos**, cohérente, vérifiée, avec rotation ; déclenchement à la demande ; restauration documentée et testée.
- **Non-objectifs** : envoi hors de la machine (restic, rclone, S3…) — documenté comme étape à ajouter, pas automatisé ; chiffrement ; interface dans l'appli.
- **Anti-objectif** : un fichier corrompu ou vide qui ressemble à une sauvegarde valable ; une rotation qui supprime une bonne sauvegarde à cause d'un run raté.

## Approches

| | Approche | Compromis |
|---|---|---|
| **A** ✅ | **Conteneur `backup` (alpine + cron + script) dans le `docker-compose.yml` principal, comme babysleep** | Rien à installer sur l'hôte, même mécanisme que babysleep ; un conteneur de plus |
| B | Garder le cron sur l'hôte documenté, juste fournir le script | Pas de conteneur, mais l'utilisateur doit configurer cron lui-même : c'est la situation actuelle |
| C | Sauvegarde déclenchée par l'appli Node (setInterval) | Pas de conteneur, mais mélange exploitation et appli, et sqlite3/tar ne sont pas dans l'image d'exécution de façon garantie |

**Choix validé par l'utilisateur : A**, avec deux différences par rapport à babysleep : les photos sont archivées avec la base (même horodatage), et le service est dans le compose principal (Apogée n'a pas de fichier « full »).

## Conception

- `scripts/run-backup.sh` (POSIX sh, repris de babysleep) :
  - horodatage UTC `TS=YYYYMMDDTHHMMSSZ` ;
  - base : `sqlite3 "$DATA_DIR/apogee.sqlite" ".backup '$BACKUP_DIR/apogee-$TS.sqlite'"`, puis fichier non vide **et** `PRAGMA integrity_check` = `ok`, sinon suppression et échec ;
  - photos : si `$DATA_DIR/photos` existe, `tar -czf "$BACKUP_DIR/apogee-photos-$TS.tar.gz" -C "$DATA_DIR" photos`, puis `tar -tzf` doit réussir, sinon suppression de l'archive et échec (la sauvegarde de la base, valide, est gardée) ; pas de dossier photos → pas d'archive, ce n'est pas une erreur ;
  - rotation **seulement après un run entièrement réussi** : garder les `BACKUP_RETENTION` (défaut 30) plus récentes de chaque type, en ne considérant que les noms automatiques (`apogee-<TS>.sqlite`, `apogee-photos-<TS>.tar.gz`) ; les copies nommées à la main ne sont jamais supprimées ;
  - base absente (premier démarrage) → message et sortie 0 ;
  - `DATA_DIR` (défaut `/data`) et `BACKUP_DIR` (défaut `/backups`) surchargeables pour les tests.
- Service `backup` dans `docker-compose.yml` : `alpine:3`, `./data:/data:ro`, `./backups:/backups`, `./scripts/run-backup.sh:/usr/local/bin/run-backup:ro`, `TZ`, `BACKUP_RETENTION=${BACKUP_RETENTION:-30}`, `BACKUP_SCHEDULE=${BACKUP_SCHEDULE:-0 3 * * *}` ; au démarrage : `apk add sqlite tzdata`, enregistrement de la crontab, une sauvegarde initiale, puis `crond -f`. `restart: unless-stopped`.
- Sauvegarde à la demande : `docker compose exec backup sh /usr/local/bin/run-backup`.
- `docs/BACKUP.md` réécrit autour du conteneur (ce qu'il fait, à la demande, vérifier, restaurer une **paire** de même horodatage, copier `backups/` hors de la machine) ; les commandes manuelles restent en annexe pour qui n'utilise pas le compose. README : variables `BACKUP_*` et lien.

## Laissé au constructeur

Forme exacte des journaux du script ; organisation interne des tests (le script est testé dans un vrai conteneur alpine, test ignoré si Docker est absent).
