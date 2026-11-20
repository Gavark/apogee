# Apogée — Plan 2b : sauvegarde automatique

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une sauvegarde nocturne automatique et vérifiée de la base SQLite et des photos, avec rotation, dans un conteneur `backup` du `docker-compose.yml`, comme babysleep.

**Architecture:** Un script POSIX `scripts/run-backup.sh` (repris de `D:\Dev\Gavark\CalculateurSommeilBebe\scripts\run-backup.sh`) produit une paire horodatée `apogee-<TS>.sqlite` + `apogee-photos-<TS>.tar.gz`, vérifie chaque fichier, puis fait tourner les anciennes sauvegardes. Un service alpine du compose l'exécute par cron. Le script est testé dans un vrai conteneur alpine depuis Vitest (ignoré sans Docker).

**Tech Stack:** POSIX sh, sqlite3, tar (alpine:3), Docker Compose, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-apogee-sauvegarde-design.md` (et la spec principale §6.8)

## Global Constraints

- Noms automatiques exactement : `apogee-YYYYMMDDTHHMMSSZ.sqlite` et `apogee-photos-YYYYMMDDTHHMMSSZ.tar.gz` (même `TS` UTC pour la paire d'un run).
- `BACKUP_RETENTION` défaut **30**, `BACKUP_SCHEDULE` défaut **`0 3 * * *`**, fuseau `TZ` (défaut `Europe/Paris`).
- La rotation ne s'exécute qu'après un run **entièrement** réussi et ne touche que les noms automatiques.
- `.backup` SQLite (jamais `cp`) puis `PRAGMA integrity_check` = `ok` ; archive photos vérifiée par `tar -tzf`.
- Le conteneur `backup` monte `./data` en **lecture seule**.
- Docs en français ; aucune nouvelle dépendance npm.

## Review Focus

1. **Base corrompue ou vide** → fichier supprimé, sortie non nulle, aucune rotation. → Task 1.
2. **Pas encore de base** (premier démarrage) → message, sortie 0, rien d'écrit. → Task 1.
3. **Pas de dossier photos** (IA jamais utilisée) → sauvegarde de la base seule, sortie 0. → Task 1.
4. **Copie nommée à la main** (`apogee-avant-maj.sqlite`) → jamais supprimée par la rotation. → Task 1.
5. **Restauration d'une paire** → l'appli redémarre avec les données et les photos de la sauvegarde. → Task 2 (vérification réelle).

---

### Task 1: Script de sauvegarde

**Files:**
- Create: `scripts/run-backup.sh`, `tests/server/backup-script.test.ts`

**Interfaces:**
- Produces: `scripts/run-backup.sh` — variables `DATA_DIR` (défaut `/data`), `BACKUP_DIR` (défaut `/backups`), `BACKUP_RETENTION` (défaut `30`) ; sortie 0 en succès ou base absente, non nulle en échec ; une ligne de journal horodatée par étape.

Règles (spec « Conception ») : base → `.backup` + non vide + `integrity_check` ok (sinon suppression, sortie 1) ; photos si `$DATA_DIR/photos` existe → `tar -czf` + `tar -tzf` (sinon suppression de l'archive, sortie 1, base gardée) ; rotation des deux familles de noms automatiques après succès complet (`ls -1t … | tail -n +$((RETENTION + 1)) | xargs -r rm -f`) ; ne jamais suivre un glob qui ne correspond à rien.

Les tests lancent **un** conteneur `alpine:3` (`docker run --rm -v <tmp>:/work -v <repo>/scripts:/scripts:ro alpine:3 sh -c "apk add --no-cache sqlite >/dev/null && …"`) qui joue tous les scénarios dans des dossiers séparés et écrit un résultat JSON ou texte par scénario ; le test Vitest lit ces résultats. `it.skipIf(!dockerAvailable)` avec `dockerAvailable` déterminé par `docker info` (spawnSync, code 0). Délai du test : 180 s.

- [ ] **Step 1: Écrire les tests**

```ts
it('crée une paire apogee-<TS>.sqlite + apogee-photos-<TS>.tar.gz de même horodatage, base intègre, archive lisible', …)
it('sans dossier photos : base seule, sortie 0', …)
it('sans base : message, sortie 0, aucun fichier', …)
it('base corrompue : aucun fichier .sqlite laissé, sortie non nulle, anciennes sauvegardes intactes', …)
it('rotation : avec BACKUP_RETENTION=2 et 4 paires existantes, il reste les 2 plus récentes de chaque type ; apogee-avant-maj.sqlite est conservé', …)
```

- [ ] **Step 2: `npx vitest run tests/server/backup-script.test.ts`** — FAIL (script absent).
- [ ] **Step 3: Écrire `scripts/run-backup.sh`** (exécutable, fins de ligne LF — le `.gitattributes` le garantit).
- [ ] **Step 4: Relancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Commit** — `feat: script de sauvegarde de la base et des photos`

---

### Task 2: Conteneur de sauvegarde, documentation, essai réel

**Files:**
- Modify: `docker-compose.yml` (service `backup`), `.env.example` (`BACKUP_RETENTION=`, `BACKUP_SCHEDULE=` vides avec commentaire), `docs/BACKUP.md`, `README.md`, `tests/server/compose.test.ts`

**Interfaces:**
- Consumes: `scripts/run-backup.sh` (Task 1).
- Produces: service `backup` — `image: alpine:3`, `container_name: apogee-backup`, `restart: unless-stopped`, volumes `./data:/data:ro`, `./backups:/backups`, `./scripts/run-backup.sh:/usr/local/bin/run-backup:ro`, environnement `TZ=${TZ:-Europe/Paris}`, `BACKUP_RETENTION=${BACKUP_RETENTION:-30}`, `BACKUP_SCHEDULE=${BACKUP_SCHEDULE:-0 3 * * *}` ; commande de démarrage identique à babysleep (`apk add --no-cache sqlite tzdata`, crontab, sauvegarde initiale, `exec crond -f -L /dev/stdout`) ; `depends_on: [apogee]`.

Documentation :
- `docs/BACKUP.md` : ce que fait le conteneur (horaire, destination `./backups/`, noms, rotation, vérification), sauvegarde à la demande (`docker compose exec backup sh /usr/local/bin/run-backup`), copie nommée avant une mise à jour (`cp backups/apogee-<TS>.sqlite backups/apogee-avant-maj.sqlite`), vérifier une sauvegarde, **restaurer une paire de même `<TS>`** (arrêt d'`apogee`, suppression `-wal`/`-shm`, copie, extraction des photos, `chown` conditionnel, redémarrage), copier `backups/` hors de la machine, puis une annexe « sans le conteneur » avec les commandes manuelles actuelles.
- README : `BACKUP_RETENTION` et `BACKUP_SCHEDULE` dans le tableau de configuration, la section sauvegardes pointe vers le conteneur.

- [ ] **Step 1: Étendre `compose.test.ts`** : service `backup` présent, `./data:/data:ro`, `./backups:/backups`, le script monté, les deux variables `BACKUP_*` avec leurs défauts. Lancer — FAIL.
- [ ] **Step 2: Modifier le compose, `.env.example`, la doc.** Relancer — PASS ; `npm test`, `npm run check`.
- [ ] **Step 3: Essai réel sur Docker Desktop** dans un dossier jetable hors du dépôt (copie de `docker-compose.yml`, `scripts/`, `.env` minimal avec `ORIGIN`, `BACKUP_SCHEDULE='*/1 * * * *'`, `BACKUP_RETENTION=2`, ports surchargés si 3000 est pris) : démarrer, créer l'admin via `/setup` (curl suffit), vérifier la sauvegarde initiale, attendre deux passages du cron → rotation à 2, simuler l'ajout d'un fichier dans `data/photos/1/` (en `sudo`/conteneur si besoin), relancer à la demande → paire avec archive ; puis **restaurer** une paire selon `docs/BACKUP.md` et vérifier que l'appli répond (`/healthz`) et que la base restaurée contient l'utilisateur. Tout supprimer ensuite (conteneurs, dossier, images si téléchargées pour l'occasion).
- [ ] **Step 4: Commit** — `feat: conteneur de sauvegarde nocturne, documentation de restauration`

### Task 3: Copie hors de la machine vers Google Drive (hôte Windows)

*Ajoutée à la demande de l'utilisateur : même mécanisme que babysleep (tâche planifiée `\BabySleep\Backup vers Google Drive`, script `D:\Dev\Gavark\CalculateurSommeilBebe\scripts\sync-backups-offsite.ps1`, destination `G:\Mon Drive\Perso\Backup\Babysleep`). Docker Desktop ne voit pas le lecteur virtuel de Google Drive : la copie se fait côté Windows.*

**Files:**
- Create: `scripts/sync-backups-offsite.ps1`, `tests/server/sync-offsite.test.ts`
- Modify: `docs/BACKUP.md` (section « Hôte Windows : tâche planifiée + dossier synchronisé »), `README.md` (une ligne vers cette section)

**Interfaces:**
- `sync-backups-offsite.ps1 -Destination <dossier> [-Source <dossier>] [-RetentionDays 7] [-DryRun]` — compatible Windows PowerShell 5.1 et PowerShell 7 ; `-Source` par défaut `..ackups` relatif au script ; journal `backups\sync-offsite.log` (500 dernières lignes) ; code de sortie 0 / 1.

Règles (reprises de babysleep, adaptées aux paires d'Apogée) :
- copie de chaque `*.sqlite` **et** `*.tar.gz` de la source de moins de `RetentionDays` jours absent ou de taille différente à destination, copies nommées comprises ; vérification SHA256 de chaque copie (écart → suppression de la copie et échec) ;
- rotation à destination des `*.sqlite` et `*.tar.gz` de plus de `RetentionDays` jours, **sauf** si la destination n'a aucune sauvegarde récente (filet de sécurité : rien n'est supprimé) ;
- lecteur de destination absent (client Drive arrêté) → échec sans rien toucher ; dossier de destination créé s'il manque ;
- **dossier source absent** (Apogée pas encore déployé) → message « rien à copier » et **sortie 0** (différence assumée avec babysleep, pour que la tâche ne soit pas en échec chaque nuit avant le premier déploiement).

- [ ] **Step 1: Écrire les tests** (`tests/server/sync-offsite.test.ts`, ignorés si ni `pwsh` ni `powershell` n'est disponible) : dossiers temporaires source/destination ; copie d'une paire récente + d'une copie nommée ; fichier ancien (mtime -10 j) non copié ; rotation d'un fichier ancien à destination ; filet de sécurité (destination sans fichier récent → rien supprimé) ; source absente → sortie 0 ; destination sur lecteur inexistant → sortie 1 ; `-DryRun` ne modifie rien.
- [ ] **Step 2: Lancer** — FAIL. **Step 3: Écrire le script et la doc.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Commit** — `feat: copie des sauvegardes vers un dossier synchronisé (hôte Windows)`
- [ ] **Step 6 (contrôleur, accord de l'utilisateur donné)** — essai `-DryRun` vers `G:\Mon Drive\Perso\Backup\Apogee`, puis enregistrement de la tâche `\Apogee\Backup vers Google Drive` (quotidienne 23:15, mêmes réglages que celle de babysleep : interactive, `StartWhenAvailable`, 15 min).

---

## Vérification finale

- [ ] `npm test`, `npm run check`, `npm run build` ; CI verte sur la PR.
- [ ] `tasks/todo.md` mis à jour.
