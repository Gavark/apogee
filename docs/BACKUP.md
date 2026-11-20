# Sauvegarde et restauration

Les données d'Apogée sont dans **un fichier SQLite** (`/data/apogee.sqlite` dans le conteneur, soit `./data/apogee.sqlite` sur l'hôte avec le `docker-compose.yml` fourni) **et dans le dossier des photos d'étiquettes** (`./data/photos/` sur l'hôte). Une sauvegarde complète contient les deux : sans le dossier, les fiches restent mais les photos sont perdues.

Pour obtenir un instantané cohérent même si l'application écrit au même moment, utilisez la commande `.backup` de SQLite plutôt qu'un simple `cp`. L'image embarque le client `sqlite3`.

> Sous Linux, le dossier `data/` appartient à l'uid 1000 : les commandes de l'hôte qui y touchent (`mv`, `cp`, `rm`, `chown`) peuvent nécessiter `sudo`.

## Sauvegarde ponctuelle

```bash
mkdir -p backups
docker compose exec apogee sqlite3 /data/apogee.sqlite \
  ".backup '/data/apogee-backup.sqlite'"
mv data/apogee-backup.sqlite "backups/apogee-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
```

Copiez ensuite les photos à côté. Ce sont de simples fichiers, un `tar` suffit :

```bash
tar -czf "backups/apogee-photos-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" -C data photos
```

(ou `rsync -a data/photos/ <destination>/photos/` pour une copie incrémentale). Si le dossier n'existe pas encore, l'analyse IA n'a jamais servi : il n'y a rien à copier.

Faites-le avant toute mise à jour ou manipulation risquée.

## Vérifier une sauvegarde

```bash
sqlite3 backups/apogee-<DATE>.sqlite "PRAGMA integrity_check; SELECT COUNT(*) FROM users;"
```

Le résultat doit être `ok`, puis un nombre cohérent avec votre usage.

## Sauvegarde automatique

Planifiez les commandes ci-dessus avec cron sur l'hôte, puis copiez le dossier `backups/` hors de la machine (rclone, restic, borg, rsync vers un second serveur). Une sauvegarde qui reste sur le même disque ne protège pas d'une panne de l'hôte.

```cron
0 3 * * * cd /opt/apogee && docker compose exec -T apogee sqlite3 /data/apogee.sqlite ".backup '/data/apogee-backup.sqlite'" && mv data/apogee-backup.sqlite backups/apogee-$(date -u +\%Y\%m\%dT\%H\%M\%SZ).sqlite
5 3 * * * cd /opt/apogee && tar -czf backups/apogee-photos-$(date -u +\%Y\%m\%dT\%H\%M\%SZ).tar.gz -C data photos
```

## Restauration

```bash
docker compose stop apogee
rm -f data/apogee.sqlite-wal data/apogee.sqlite-shm
cp backups/apogee-<DATE>.sqlite data/apogee.sqlite
chown 1000:1000 data/apogee.sqlite
tar -xzf backups/apogee-photos-<DATE>.tar.gz -C data   # recrée data/photos/ ; facultatif sans analyse IA
chown -R 1000:1000 data/photos
docker compose start apogee
```

Restaurez les photos pendant que le conteneur est arrêté, avec la même sauvegarde datée que la base : une fiche pointe vers sa photo par son nom de fichier. Si `data/photos/` contient déjà des fichiers, l'extraction les complète ou les remplace par ceux de la sauvegarde.

Supprimez toujours les fichiers `-wal` et `-shm` avant la copie : la base est en mode WAL, et un WAL résiduel rejoué sur le fichier restauré pourrait le corrompre ou mélanger d'anciennes données.

Les migrations sont additives et rejouées au démarrage : une sauvegarde plus ancienne reste compatible avec une version plus récente.

## À conserver en plus

- `data/photos/` (voir ci-dessus).
- `.env` (ORIGIN, identifiants d'amorçage) : sans lui l'instance démarre, mais vous devrez resaisir la configuration.
- `Caddyfile` (votre domaine et vos réglages du proxy).
