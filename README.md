# Apogée

Application web (PWA) auto-hébergée pour gérer sa cave à vin : inventaire des bouteilles, emplacements, stock par foyer. Pensée pour un usage domestique, sur votre propre serveur : ce n'est pas un service SaaS.

Stack : SvelteKit, SQLite (Drizzle), français et anglais. Licence AGPL-3.0-only.

## Démarrage rapide (Docker Compose)

```bash
git clone https://github.com/gavark/apogee.git && cd apogee
cp .env.example .env        # puis éditez ORIGIN (et éventuellement ADMIN_*)
mkdir -p data && chown 1000:1000 data   # le conteneur tourne avec l'utilisateur "node"
docker compose up -d
```

L'application écoute sur `127.0.0.1:3000`. Placez-la derrière un reverse proxy HTTPS (voir `Caddyfile.example`) et renseignez son URL publique dans `ORIGIN` : sans cela, les formulaires sont rejetés (403). Ne publiez pas le port 3000 en clair sur Internet.

Les migrations de base de données sont appliquées automatiquement à chaque démarrage. Toutes les données sont dans `./data/apogee.sqlite`.

## Configuration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `ORIGIN` | (vide) | URL publique de l'instance, par exemple `https://cave.example.com`. Obligatoire derrière un proxy. |
| `ADMIN_EMAIL` | (vide) | Email du premier administrateur (voir Premier lancement). |
| `ADMIN_PASSWORD` | (vide) | Mot de passe du premier administrateur, 10 caractères minimum. |
| `HOUSEHOLD_NAME` | `Ma cave` | Nom du premier foyer créé par l'amorçage. |
| `TZ` | `Europe/Paris` | Fuseau horaire. |
| `DATABASE_PATH` | `/data/apogee.sqlite` (image) | Chemin du fichier SQLite. Fixé dans l'image, à ne pas changer avec Docker. |
| `NODE_ENV` | `production` (image) | Fixé par l'image : cookies sécurisés, et la page `/dev/styleguide` répond 404. |

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
docker compose up -d --build
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
