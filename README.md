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
| `NODE_ENV` | `production` (image) | Fixé par l'image : cookies sécurisés, et la page `/dev/styleguide` répond 404. |

`ADDRESS_HEADER` et `XFF_DEPTH` sont définis dans `docker-compose.yml` parce que le port est lié à `127.0.0.1`, derrière Caddy. Sans eux, tous les clients partageraient la même IP (celle du proxy) et la même limite de tentatives. **Si vous exposez le conteneur directement, sans reverse proxy, supprimez ces deux variables** : sinon un client pourrait forger `X-Forwarded-For` pour contourner la limite.

## Premier lancement

Deux options :

- **Assistant** : ouvrez l'application, vous êtes redirigé vers `/setup` pour créer le premier foyer et le compte administrateur.
- **Amorçage par variables** : définissez `ADMIN_EMAIL` et `ADMIN_PASSWORD` (et `HOUSEHOLD_NAME`) avant le premier démarrage. Le compte est créé seulement si la base ne contient encore aucun utilisateur ; ces variables sont ensuite ignorées.

## Invitations

L'inscription se fait uniquement sur invitation. Les membres d'un foyer invitent leurs proches depuis Compte, puis Foyer. L'administrateur de l'instance invite de nouveaux foyers depuis Administration.

## Sauvegardes

Toutes les données tiennent dans un seul fichier SQLite. Voir [docs/BACKUP.md](docs/BACKUP.md).

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

Analyse IA de l'étiquette, notifications, mode hors ligne.
