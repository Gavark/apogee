# Sauvegarde et restauration

Toutes les données d'Apogée tiennent dans un **seul fichier SQLite** : `/data/apogee.sqlite` dans le conteneur, soit `./data/apogee.sqlite` sur l'hôte avec le `docker-compose.yml` fourni.

Pour obtenir un instantané cohérent même si l'application écrit au même moment, utilisez la commande `.backup` de SQLite plutôt qu'un simple `cp`. L'image embarque le client `sqlite3`.

## Sauvegarde ponctuelle

```bash
mkdir -p backups
docker compose exec apogee sqlite3 /data/apogee.sqlite \
  ".backup '/data/apogee-backup.sqlite'"
mv data/apogee-backup.sqlite "backups/apogee-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
```

Faites-le avant toute mise à jour ou manipulation risquée.

## Vérifier une sauvegarde

```bash
sqlite3 backups/apogee-<DATE>.sqlite "PRAGMA integrity_check; SELECT COUNT(*) FROM users;"
```

Le résultat doit être `ok`, puis un nombre cohérent avec votre usage.

## Sauvegarde automatique

Planifiez la commande ci-dessus avec cron sur l'hôte, puis copiez le dossier `backups/` hors de la machine (rclone, restic, borg, rsync vers un second serveur). Une sauvegarde qui reste sur le même disque ne protège pas d'une panne de l'hôte.

```cron
0 3 * * * cd /opt/apogee && docker compose exec -T apogee sqlite3 /data/apogee.sqlite ".backup '/data/apogee-backup.sqlite'" && mv data/apogee-backup.sqlite backups/apogee-$(date -u +\%Y\%m\%dT\%H\%M\%SZ).sqlite
```

## Restauration

```bash
docker compose stop apogee
cp backups/apogee-<DATE>.sqlite data/apogee.sqlite
chown 1000:1000 data/apogee.sqlite
docker compose start apogee
```

Les migrations sont additives et rejouées au démarrage : une sauvegarde plus ancienne reste compatible avec une version plus récente.

## À conserver en plus

- `.env` (ORIGIN, identifiants d'amorçage) : sans lui l'instance démarre, mais vous devrez resaisir la configuration.
- `Caddyfile` (votre domaine et vos réglages du proxy).
