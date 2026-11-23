# Sauvegarde et restauration

Les données d'Apogée sont dans **un fichier SQLite** (`/data/apogee.sqlite` dans le conteneur, soit `./data/apogee.sqlite` sur l'hôte avec le `docker-compose.yml` fourni) **et dans le dossier des photos d'étiquettes** (`./data/photos/` sur l'hôte). Une sauvegarde complète contient les deux : sans le dossier, les fiches restent mais les photos sont perdues.

> Sous Linux, le dossier `data/` appartient à l'uid 1000 et le dossier `backups/` est créé par le conteneur de sauvegarde (donc à root) : les commandes de l'hôte qui y touchent (`mv`, `cp`, `rm`, `chown`) peuvent nécessiter `sudo`.

## Ce que fait le conteneur de sauvegarde

Le `docker-compose.yml` fourni lance, à côté de l'application, un conteneur `backup` (`apogee-backup`) qui n'a rien à configurer :

- **Quand** : une sauvegarde au démarrage, puis chaque nuit à 3 h (heure de `TZ`, `Europe/Paris` par défaut). Réglable avec `BACKUP_SCHEDULE` dans `.env` (syntaxe cron, par exemple `30 4 * * *`).
- **Où** : dans `./backups/` sur l'hôte.
- **Quoi** : une paire de fichiers de même horodatage UTC, `apogee-<TS>.sqlite` (la base) et `apogee-photos-<TS>.tar.gz` (les photos, absent tant que `data/photos/` n'existe pas), avec `<TS>` de la forme `20261120T030000Z`. La base est copiée avec la commande `.backup` de SQLite : l'instantané est cohérent même si l'application écrit au même moment.
- **Vérification** : après chaque copie, la base est contrôlée (`PRAGMA integrity_check`) et l'archive est relue. Une sauvegarde qui échoue est signalée dans les journaux (`docker logs apogee-backup`, ligne `backup FAILED`) et ne supprime jamais les anciennes.
- **Rotation** : les 30 dernières bases et les 30 dernières archives sont conservées, classées par leur horodatage (`BACKUP_RETENTION` dans `.env` pour changer). Seuls les fichiers au nom horodaté sont concernés : une copie nommée à la main (voir plus bas) n'est jamais supprimée. La rotation n'a lieu que si toute la sauvegarde a réussi : si l'archive des photos échoue chaque nuit, les anciens instantanés de base s'accumulent sans être supprimés. Surveillez `docker logs apogee-backup`.
- **Écriture** : chaque fichier est d'abord écrit sous un nom caché `.apogee-<TS>….partial`, vérifié, puis renommé. Un arrêt en pleine sauvegarde ne laisse donc jamais de fichier non vérifié sous un vrai nom ; les `.partial` résiduels sont supprimés au démarrage suivant.

Le conteneur lit `./data` en lecture seule : il ne peut pas abîmer vos données. Il attend que l'application soit en bonne santé avant de démarrer : sur une installation neuve, la première vraie sauvegarde a lieu dès que l'application a créé sa base. Il a besoin que l'application ait déjà tourné au moins une fois ; si vous voyez `backup FAILED` juste après avoir restauré ou déplacé `data/`, démarrez l'application puis lancez une sauvegarde à la demande.

> **Machine qui se met en veille** : le `cron` du conteneur (busybox `crond`) ne rattrape pas une sauvegarde manquée pendant la veille ou l'extinction du PC ; seule la sauvegarde faite au démarrage du conteneur reste. Choisissez un `BACKUP_SCHEDULE` à une heure où le PC est allumé, ou comptez sur la sauvegarde du démarrage.

Contrôler que ça tourne :

```bash
docker logs --tail 20 apogee-backup
ls -lh backups/
```

## Sauvegarde à la demande

```bash
docker compose exec backup sh /usr/local/bin/run-backup
```

Faites-le avant toute mise à jour ou manipulation risquée. Pour garder cette sauvegarde à l'abri de la rotation, donnez-lui un nom à vous :

```bash
docker compose exec backup cp /backups/apogee-<TS>.sqlite /backups/apogee-avant-maj.sqlite
docker compose exec backup cp /backups/apogee-photos-<TS>.tar.gz /backups/apogee-photos-avant-maj.tar.gz   # seulement si l'archive des photos existe
```

## Vérifier une sauvegarde

```bash
sqlite3 backups/apogee-<TS>.sqlite "PRAGMA integrity_check; SELECT COUNT(*) FROM users;"
tar -tzf backups/apogee-photos-<TS>.tar.gz | head
```

La base doit répondre `ok`, puis un nombre cohérent avec votre usage ; l'archive doit lister `photos/…`. Sans `sqlite3` sur l'hôte : `docker compose exec backup sqlite3 /backups/apogee-<TS>.sqlite "PRAGMA integrity_check;"`.

Sous Windows (PowerShell), à la racine du dépôt :

```powershell
docker run --rm -v ${PWD}\backups:/b alpine:3 sh -c "apk add --no-cache sqlite >/dev/null && sqlite3 /b/apogee-<TS>.sqlite 'PRAGMA integrity_check; SELECT COUNT(*) FROM users;'"
tar -tzf backups\apogee-photos-<TS>.tar.gz | Select-Object -First 10   # tar est fourni avec Windows 10 et suivants
```

## Restauration

Restaurez **une paire de même `<TS>`** : une fiche pointe vers sa photo par son nom de fichier, la base et l'archive doivent donc venir de la même sauvegarde. Si la base la plus récente n'a pas d'archive de photos du même `<TS>` (l'archive a échoué cette nuit-là), restaurez plutôt la paire **complète** la plus récente, sauf si vous n'avez jamais utilisé les photos.

```bash
docker compose stop apogee
rm -f data/apogee.sqlite-wal data/apogee.sqlite-shm
cp backups/apogee-<TS>.sqlite data/apogee.sqlite
chown 1000:1000 data/apogee.sqlite
tar -xzf backups/apogee-photos-<TS>.tar.gz -C data   # recrée data/photos/ ; sans archive, sautez cette ligne
[ -d data/photos ] && chown -R 1000:1000 data/photos
docker compose start apogee
```

Sous Windows (PowerShell, à la racine du dépôt) :

```powershell
docker compose stop apogee
Remove-Item data\apogee.sqlite-wal, data\apogee.sqlite-shm -ErrorAction SilentlyContinue
Copy-Item backups\apogee-<TS>.sqlite data\apogee.sqlite -Force
tar -xzf backups\apogee-photos-<TS>.tar.gz -C data   # sans archive, sautez cette ligne
docker run --rm -v ${PWD}\data:/data alpine:3 chown -R 1000:1000 /data
docker compose start apogee
```

Ne sautez pas la ligne `chown`. Avec Docker Desktop, `Copy-Item` recopie aussi le propriétaire du fichier de sauvegarde, créé par root dans le conteneur `apogee-backup`. La base restaurée apparaît alors `root:root` en lecture seule pour l'application (uid 1000). Celle-ci s'arrête au démarrage avec `attempt to write a readonly database`.

Supprimez toujours les fichiers `-wal` et `-shm` avant la copie : la base est en mode WAL, et un WAL résiduel rejoué sur le fichier restauré pourrait le corrompre ou mélanger d'anciennes données. Restaurez les photos pendant que le conteneur est arrêté ; si `data/photos/` contient déjà des fichiers, l'extraction les complète ou les remplace par ceux de la sauvegarde.

Les migrations sont additives et rejouées au démarrage : une sauvegarde plus ancienne reste compatible avec une version plus récente.

Vérifiez ensuite que l'application répond (`curl -fsS http://127.0.0.1:3000/healthz`) et que vous retrouvez vos vins.

## Copier les sauvegardes hors de la machine

Le conteneur sauvegarde sur le même disque que l'application : cela protège d'une fausse manœuvre ou d'une base abîmée, pas d'une panne de l'hôte. Copiez régulièrement le dossier `backups/` ailleurs (rclone, restic, borg, rsync vers un second serveur, disque externe), par exemple une fois par jour après 3 h :

```bash
rsync -a /opt/apogee/backups/ utilisateur@autre-serveur:/sauvegardes/apogee/
```

## Hôte Windows : tâche planifiée + dossier synchronisé

Si Docker tourne sur une machine Windows, la copie hors machine la plus simple est un dossier que votre client cloud synchronise déjà (Google Drive pour ordinateur, OneDrive, Dropbox, partage NAS). Docker Desktop ne voit pas le lecteur virtuel de Google Drive : la copie se fait donc côté Windows, avec [`scripts/sync-backups-offsite.ps1`](../scripts/sync-backups-offsite.ps1) (Windows PowerShell 5.1 ou PowerShell 7), qui copie `./backups/` vers ce dossier et y fait la rotation :

- **Copie** : chaque `*.sqlite` et `*.tar.gz` de `./backups/` de moins de `-RetentionDays` jours (7 par défaut) absent à destination ou de taille ou de date de modification différente, copies nommées comprises. Chaque copie est comparée à l'original par SHA256 ; un écart supprime la copie et fait échouer l'exécution.
- **Rotation** : les `*.sqlite` et `*.tar.gz` de destination de plus de `-RetentionDays` jours sont supprimés. Le filet de sécurité s'applique **par type** : les `*.sqlite` (ou les `*.tar.gz`) anciens ne sont supprimés que si la destination contient au moins une sauvegarde récente du même type (si les archives de photos s'arrêtent alors que les bases continuent, les anciennes archives sont conservées, avec un avertissement dans le journal). Le dossier n'est ainsi jamais vidé d'un type. L'avertissement n'apparaît que s'il existe de vieux fichiers de ce type à destination.
- **Copies nommées** : elles restent à l'abri de la rotation **locale** (`./backups/`), mais sont supprimées de Drive après `-RetentionDays` jours comme les autres. La rotation de destination supprime tout `*.sqlite` et `*.tar.gz` du dossier : utilisez un **dossier dédié** à ces sauvegardes.
- **Sauvegardes figées** : si `./backups/` ne contient aucune base `*.sqlite` de moins de `-RetentionDays` jours, l'exécution écrit `FAILED: no recent database backup in source` et sort en code 1 (visible dans le Planificateur de tâches). Une archive `*.tar.gz` manquante reste un simple avertissement.
- **Lecteur absent** (client Drive arrêté) : échec sans rien toucher. Le dossier de destination est créé s'il manque.
- **Dossier `backups/` absent** (Apogée pas encore déployé) : message « rien à copier » et sortie 0, pour que la tâche ne soit pas en échec chaque nuit avant le premier déploiement.
- **Journal** : `./backups/sync-offsite.log` (500 dernières lignes). Le code de sortie est non nul en cas d'échec, visible dans « Résultat de la dernière exécution » du Planificateur de tâches.

Commencez par voir ce qu'il ferait :

```powershell
powershell -File scripts\sync-backups-offsite.ps1 -Destination 'G:\Mon Drive\Sauvegardes\Apogee' -DryRun
```

Puis enregistrez une tâche quotidienne (depuis le dossier du dépôt ; la source est passée explicitement avec `-Source`, pour que la tâche pointe toujours vers les sauvegardes de ce déploiement) :

```powershell
$repo   = (Get-Location).Path
$script = Join-Path $repo 'scripts\sync-backups-offsite.ps1'
$dest   = 'G:\Mon Drive\Sauvegardes\Apogee'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Destination `"$dest`" -Source `"$repo\backups`""
$trigger  = New-ScheduledTaskTrigger -Daily -At '23:15'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive
Register-ScheduledTask -TaskPath '\Apogee\' -TaskName 'Backup vers Google Drive' `
  -Action $action -Trigger $trigger -Settings $settings -Principal $principal
```

Après le premier déploiement, vérifiez que `backups\sync-offsite.log` contient des lignes `OK:` (lancez la tâche à la main depuis le Planificateur de tâches pour ne pas attendre la nuit).

À soigner :

- **Horaire** : le déclencheur suit l'horloge de l'**hôte**, alors que `BACKUP_SCHEDULE` suit le `TZ` du conteneur. Laissez au moins une demi-heure après la sauvegarde (lancer plus tôt est sans danger : la sauvegarde du jour part la nuit suivante). `-StartWhenAvailable` rattrape une exécution manquée machine éteinte.
- **Session ouverte** : une lettre de lecteur comme `G:` n'existe que pendant que le client de synchronisation tourne dans votre session ; la tâche utilise donc une ouverture de session interactive. Si le lecteur manque, l'exécution échoue sans rien toucher.
- **Fichiers supprimés** : la rotation supprime via le client de synchronisation ; les fichiers passent généralement par la corbeille du fournisseur (30 jours sur Google Drive) avant de disparaître vraiment.

## À conserver en plus

- `.env` (ORIGIN, identifiants d'amorçage) : sans lui l'instance démarre, mais vous devrez resaisir la configuration.
- `Caddyfile` (votre domaine et vos réglages du proxy).

## Annexe : sans le conteneur de sauvegarde

Si vous avez retiré le service `backup` du `docker-compose.yml`, voici les commandes manuelles. L'image de l'application embarque le client `sqlite3`.

```bash
mkdir -p backups
docker compose exec apogee sqlite3 /data/apogee.sqlite \
  ".backup '/data/apogee-backup.sqlite'"
mv data/apogee-backup.sqlite "backups/apogee-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
tar -czf "backups/apogee-photos-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" -C data photos
```

(si `data/photos/` n'existe pas, l'analyse IA n'a jamais servi : il n'y a rien à archiver). Pour les planifier avec cron sur l'hôte :

```cron
0 3 * * * cd /opt/apogee && docker compose exec -T apogee sqlite3 /data/apogee.sqlite ".backup '/data/apogee-backup.sqlite'" && mv data/apogee-backup.sqlite backups/apogee-$(date -u +\%Y\%m\%dT\%H\%M\%SZ).sqlite
5 3 * * * cd /opt/apogee && tar -czf backups/apogee-photos-$(date -u +\%Y\%m\%dT\%H\%M\%SZ).tar.gz -C data photos
```

Dans ce cas la base et l'archive n'ont pas le même horodatage : pour restaurer, prenez l'archive des photos la plus proche de la base (même nuit). La restauration est la même que ci-dessus.
