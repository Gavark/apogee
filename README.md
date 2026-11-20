# Apogée

[![CI](https://github.com/Gavark/apogee/actions/workflows/ci.yml/badge.svg)](https://github.com/Gavark/apogee/actions/workflows/ci.yml)

Application web (PWA) auto-hébergée pour gérer sa cave à vin : inventaire des bouteilles, emplacements, stock par foyer. Pensée pour un usage domestique, sur votre propre serveur : ce n'est pas un service SaaS.

Stack : SvelteKit, SQLite (Drizzle), français et anglais. Licence AGPL-3.0-only.

## Démarrage rapide (Docker Compose)

```bash
git clone https://github.com/gavark/apogee.git && cd apogee
cp .env.example .env        # puis éditez .env : ORIGIN = URL publique (le défaut est le port de dev 5173)
mkdir -p data && chown 1000:1000 data   # le conteneur tourne avec l'utilisateur "node"
docker compose up -d
```

Le `docker-compose.yml` tire l'image publiée `ghcr.io/gavark/apogee:latest` (amd64 et arm64). Pour la construire localement, décommentez `build: .` et remplacez `image:` en conséquence.

L'application écoute sur `127.0.0.1:3000`. Placez-la derrière un reverse proxy HTTPS (voir `Caddyfile.example`) et renseignez son URL publique dans `ORIGIN` : sans cela, les formulaires sont rejetés (403). Ne publiez pas le port 3000 en clair sur Internet.

Les migrations de base de données sont appliquées automatiquement à chaque démarrage. Toutes les données sont dans `./data/apogee.sqlite`.

## Configuration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `ORIGIN` | (vide) | URL publique de l'instance, par exemple `https://cave.example.com`. Obligatoire derrière un proxy. |
| `ADMIN_EMAIL` | (vide) | Email du premier administrateur (voir Premier lancement). |
| `ADMIN_PASSWORD` | (vide) | Mot de passe du premier administrateur, 10 caractères minimum. |
| `HOUSEHOLD_NAME` | `Ma cave` | Nom du premier foyer créé par l'amorçage. |
| `TZ` | `Europe/Paris` | Fuseau horaire de l'instance, utilisé pour les nouveaux comptes et le calcul des phases. |
| `ADDRESS_HEADER` | `x-forwarded-for` (compose) | En-tête portant l'IP réelle du client, posé par le reverse proxy. Sert à la limite de tentatives par IP. |
| `XFF_DEPTH` | `1` (compose) | Nombre de proxys de confiance devant l'application : lit la dernière entrée de `X-Forwarded-For`. |
| `DATABASE_PATH` | `/data/apogee.sqlite` (image) | Chemin du fichier SQLite. Fixé dans l'image, à ne pas changer avec Docker. |
| `AI_PROVIDER` | (vide) | `anthropic` ou `openai-compatible`. Vide : `anthropic` si `AI_API_KEY` est défini, sinon l'analyse IA est désactivée. |
| `AI_API_KEY` | (vide) | Clé d'API du fournisseur. Facultative pour un serveur local (Ollama). |
| `AI_MODEL` | `claude-opus-5-5` (Anthropic) | Modèle utilisé. Obligatoire avec `openai-compatible`. |
| `AI_BASE_URL` | (vide) | Adresse de l'API, obligatoire avec `openai-compatible` (par exemple `https://api.openai.com/v1`). |
| `AI_DAILY_LIMIT_PER_HOUSEHOLD` | `100` | Analyses facturées par jour et par foyer (réussies, ou réponse refusée / inexploitable). `0` = illimité. |
| `PHOTOS_DIR` | `photos/` à côté de la base (`/data/photos` dans l'image) | Dossier des photos d'étiquettes, dans le volume de données. À ne pas changer avec Docker. |
| `BACKUP_RETENTION` | `30` | Nombre de sauvegardes conservées de chaque type (bases et archives de photos) par le conteneur `backup`. |
| `BACKUP_SCHEDULE` | `0 3 * * *` | Horaire cron de la sauvegarde automatique (heure de `TZ`). Par défaut, tous les jours à 3 h. |
| `BODY_SIZE_LIMIT` | `8M` (image) | Taille maximale d'une requête, pour les photos. Fixé à `8M` dans l'image Docker. Hors Docker (`npm start`), définissez-la aussi : adapter-node limite à 512 Ko par défaut et la plupart des photos seraient refusées (erreur 413). |
| `NODE_ENV` | `production` (image) | Fixé par l'image : cookies sécurisés, et la page `/dev/styleguide` répond 404. |

`ADDRESS_HEADER` et `XFF_DEPTH` sont définis dans `docker-compose.yml` parce que le port est lié à `127.0.0.1`, derrière Caddy. Sans eux, tous les clients partageraient la même IP (celle du proxy) et la même limite de tentatives. **Si vous exposez le conteneur directement, sans reverse proxy, supprimez ces deux variables** : sinon un client pourrait forger `X-Forwarded-For` pour contourner la limite.

## Analyse IA de l'étiquette

Facultative. Quand elle est activée, vous photographiez une étiquette en ajoutant un vin : l'IA pré-remplit la fiche (producteur, appellation, millésime, fenêtre de dégustation estimée…) et vous corrigez avant d'enregistrer. Elle peut aussi ré-estimer la fenêtre d'un vin existant. Sans configuration, l'application fonctionne exactement comme avant.

**Anthropic** : renseignez la clé, le modèle par défaut est `claude-opus-5-5`.

```bash
AI_API_KEY=sk-ant-...
# AI_MODEL=claude-opus-5-5   # facultatif
```

**API compatible OpenAI** (OpenAI, Mistral, OpenRouter, Ollama local…) :

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o          # un modèle qui accepte les images
```

Avec Ollama sur l'hôte et Apogée dans Docker : `AI_BASE_URL=http://host.docker.internal:11434/v1`, sans clé, avec un modèle qui accepte les images. Sous Linux, ajoutez au service dans `docker-compose.yml` :

```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

- **Coût** : environ 1,5 à 2 centimes de dollar par étiquette avec le modèle par défaut (mesuré : ~2 300 tokens en entrée, 300 à 450 en sortie, 5 à 6 s), facturés par le fournisseur sur votre compte.
- **Confidentialité** : la photo de l'étiquette est envoyée au fournisseur que vous avez choisi, avec les indices déjà saisis (producteur, millésime…) ; rien d'autre. Avec un Ollama local, rien ne quitte votre réseau. Les photos sont conservées sur votre serveur, dans `data/photos/`.
- **Limite quotidienne** : `AI_DAILY_LIMIT_PER_HOUSEHOLD` (100 par défaut) protège votre budget ; chaque foyer a son compteur.
- **Vérifier la configuration** : la page Administration affiche le fournisseur, le modèle et le nombre d'analyses du jour, avec un bouton de test (un appel réel, quelques centimes). La clé n'est jamais affichée.

## Premier lancement

Deux options :

- **Assistant** : ouvrez l'application, vous êtes redirigé vers `/setup` pour créer le premier foyer et le compte administrateur.
- **Amorçage par variables** : définissez `ADMIN_EMAIL` et `ADMIN_PASSWORD` (et `HOUSEHOLD_NAME`) avant le premier démarrage. Le compte est créé seulement si la base ne contient encore aucun utilisateur ; ces variables sont ensuite ignorées.

## Invitations

L'inscription se fait uniquement sur invitation. Les membres d'un foyer invitent leurs proches depuis Compte, puis Foyer. L'administrateur de l'instance invite de nouveaux foyers depuis Administration.

## Sauvegardes

Le `docker-compose.yml` lance un conteneur `backup` qui sauvegarde chaque nuit la base SQLite et, si vous utilisez l'analyse IA, le dossier `data/photos/` (photos des étiquettes) dans `./backups/`, vérifie le résultat et ne garde que les dernières copies (`BACKUP_RETENTION`, `BACKUP_SCHEDULE`). Pensez à copier `backups/` hors de la machine. La sauvegarde à la demande, la restauration et les détails sont dans [docs/BACKUP.md](docs/BACKUP.md).
Sous Windows, [`scripts/sync-backups-offsite.ps1`](scripts/sync-backups-offsite.ps1) copie ces sauvegardes vers un dossier Google Drive : voir [la section dédiée](docs/BACKUP.md#hôte-windows--tâche-planifiée--dossier-synchronisé).

## Mise à jour

```bash
git pull
docker compose pull
docker compose up -d
```

Les migrations sont additives et appliquées au démarrage. Faites une sauvegarde avant de mettre à jour.

## Développement

```bash
npm install
cp .env.example .env
npm run db:migrate   # crée ./data/apogee.sqlite
npm run dev          # serveur de développement
npm test             # tests (Vitest)
npm run check        # svelte-check et TypeScript
```

## À venir

Notifications, mode hors ligne.
