# Apogée — Plan 1 : fondations et cave manuelle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une application Apogée auto-hébergeable et utilisable sans IA : comptes et foyers, lieux, ajout manuel de vins, phases de dégustation, écran « Quoi ouvrir », « Bue » en un geste, déploiement Docker.

**Architecture:** Nouveau projet SvelteKit reprenant la stack et les briques éprouvées de babysleep (`D:\Dev\Gavark\CalculateurSommeilBebe`, lecture seule). La logique métier vit dans des modules serveur purs qui prennent `db` en premier argument (`src/lib/server/*.ts`, `src/routes/**/_logic.ts`) et sont testés sur une base SQLite en mémoire. Les routes restent minces. Les mouvements de stock passent par une API d'opérations idempotentes (`op_id` + deltas), que le plan 4 (hors ligne) réutilisera sans la modifier.

**Tech Stack:** SvelteKit 3 / Svelte 5, `adapter-node`, `better-sqlite3` + Drizzle ORM/Kit, Paraglide 2 (FR/EN), `@node-rs/argon2`, Vitest, Docker + Caddy. Mêmes versions que le `package.json` de babysleep.

**Spec:** `docs/superpowers/specs/2026-11-19-apogee-design.md`

### Découpage en plans

La spec couvre quatre sous-systèmes indépendants. Chaque plan livre une application qui fonctionne :

| Plan | Contenu | Spec |
|---|---|---|
| **1 (celui-ci)** | Fondations, comptes et foyers, lieux, vins (saisie manuelle), phases, écrans, « Bue », Docker | §5, §6.1–6.3, §6.6, §6.8 |
| 2 | Analyse IA de l'étiquette (photo, connecteurs, revue, doublons, ré-estimation, admin IA) | §6.5 |
| 3 | Notifications push (phases + rappel mensuel, préférences) | §6.4 |
| 4 | Réseau intermittent (cache de lecture, file IndexedDB, Background Sync) | §6.7 |

Les plans 2 à 4 seront rédigés une fois le plan 1 livré, à partir du code réel.

## Global Constraints

- Projet auto-hébergé, pas de SaaS : aucun paiement ni quota de facturation.
- Mobile d'abord, installable (manifest + service worker), utilisable sur desktop.
- FR (par défaut) et EN dès la v1 : **aucune chaîne visible en dur** dans les composants, tout passe par `messages/fr.json` / `messages/en.json`.
- Design : la skill `taste-skill:design-taste-frontend` **doit** être utilisée pour le design system (Task 4) ; clair et sombre.
- Isolation stricte des foyers : toute lecture/écriture de cave filtre par `householdId` de la session ; un identifiant d'un autre foyer se comporte exactement comme un identifiant inexistant (404 / `not_found`).
- Un admin d'instance ne voit pas le contenu des caves des autres foyers.
- Inscription fermée par défaut : `DISABLE_SIGNUP=true` dans `.env.example`.
- Base par défaut : `DATABASE_PATH=./data/apogee.sqlite` (dev), `/data/apogee.sqlite` (Docker).
- Années de fenêtre en **années absolues** ; un vin peut n'avoir aucune fenêtre (phase `unknown`).
- Licence AGPL-3.0-only, comme babysleep.
- Tout identifiant de code, nom de table et colonne en anglais ; textes et docs utilisateur en français.

## Review Focus

1. **Identifiants devinés d'un autre foyer** (vin, lot, lieu, consommation, `op_id`) dans une URL ou dans l'API → même réponse qu'un identifiant inexistant, aucune donnée ni écriture. → tests d'isolation dans Tasks 6, 8, 9.
2. **Double appui sur « Bue » / renvoi réseau** → un même `op_id` n'est appliqué qu'une fois et renvoie le résultat initial ; deux `op_id` différents sur un lot de 1 bouteille → le second est `rejected: empty_lot`. → Task 9.
3. **Fenêtre saisie à moitié ou dans le désordre** (seulement « à partir de », apogée inversée, année avant le millésime) → erreur sur le champ concerné, rien n'est enregistré ; tous les champs vides → enregistré en `unknown`. → Task 7 et Task 8.
4. **Passage d'année selon le fuseau** (31 décembre 23h30 à Paris = 22h30 UTC, ou 1er janvier 00h30 Paris = 23h30 UTC la veille) → la phase utilise l'année dans le fuseau de l'utilisateur. → Task 7.
5. **Doublons à l'écriture près** (« Château Margaux » vs « chateau  margaux », casse, accents, espaces) → détectés comme le même vin ; un magnum ou un NV d'une autre année d'achat → vin distinct. → Task 8.

---

## Structure des fichiers

```
apogee/
├── package.json, tsconfig.json, vite.config.ts, drizzle.config.ts, .gitignore, .env.example
├── project.inlang/settings.json, messages/{fr,en}.json
├── drizzle/                         # migrations générées
├── Dockerfile, docker-compose.yml, Caddyfile.example, README.md, LICENSE, docs/BACKUP.md
├── static/                          # manifest.webmanifest, icônes
├── src/
│   ├── app.html, app.d.ts, hooks.server.ts
│   ├── service-worker/index.ts      # précache des assets (comme babysleep)
│   ├── lib/
│   │   ├── phase.ts                 # phases, validation fenêtre, année courante (pur, client+serveur)
│   │   ├── theme.ts                 # repris de babysleep
│   │   ├── styles/{tokens,base,components}.css
│   │   ├── components/              # design system (Task 4)
│   │   └── server/
│   │       ├── db/{index,schema,migrate}.ts
│   │       ├── auth/{password,email,session,locale,bootstrap,invitations}.ts
│   │       ├── rate-limit.ts
│   │       ├── context.ts           # HouseholdCtx, requireCtx, NotFoundError
│   │       ├── households.ts        # membres, foyers, suppression (admin)
│   │       ├── locations.ts
│   │       ├── wines.ts             # identité, doublons, CRUD, listes
│   │       └── stock.ts             # opérations idempotentes
│   └── routes/
│       ├── setup, login, logout, signup, healthz
│       ├── account/ (+ sessions/[id], household/)
│       ├── admin/
│       ├── app/                     # « Quoi ouvrir »
│       │   ├── cave/, add/, locations/
│       │   └── wines/[id]/ (+ edit/)
│       └── api/{stock/ops,theme,locale}/+server.ts
└── tests/
    ├── helpers/{db,fixtures}.ts
    ├── lib/phase.test.ts
    └── server/*.test.ts
```

Tous les modules serveur utilisent le type de babysleep :
`type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;`

---

### Task 1: Squelette du projet

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `drizzle.config.ts`, `.gitignore`, `.env.example`, `LICENSE`, `project.inlang/settings.json`, `messages/fr.json`, `messages/en.json`, `src/app.html`, `src/app.d.ts`, `src/lib/server/db/index.ts`, `src/lib/server/db/migrate.ts`, `src/routes/healthz/+server.ts`, `tests/helpers/db.ts`
- Test: `tests/server/healthz.test.ts`

**Interfaces:**
- Produces: `getDb(): { db, sqlite }`, `createDb(path)`, `makeTestDb(): { db, sqlite, schema }` (même contrat que babysleep), alias `$lib` et `$paraglide`.

- [ ] **Step 1: Copier et adapter la configuration de babysleep**

Depuis `D:\Dev\Gavark\CalculateurSommeilBebe` : `package.json` (nom `apogee`, version `0.1.0`, retirer `chart.js` et le script `demo`/`reset-password`, garder toutes les autres versions à l'identique), `tsconfig.json`, `vite.config.ts` (identique, y compris CSP et `test.include`), `drizzle.config.ts`, `project.inlang/settings.json`, `LICENSE`, `src/app.html`, `src/lib/server/db/index.ts` et `migrate.ts` (chemin par défaut `./data/apogee.sqlite`), `tests/helpers/db.ts`. `.gitignore` : celui de babysleep **sans** la ligne `docs/superpowers/`. `messages/*.json` : uniquement `{"app_name": "Apogée"}` pour l'instant. `src/app.d.ts` : `Locals` comme babysleep (`user`, `session`, `theme`, `locale`).

`.env.example` :
```
DATABASE_PATH=./data/apogee.sqlite
ORIGIN=http://localhost:5173
TZ=Europe/Paris
DISABLE_SIGNUP=true
ADMIN_EMAIL=
ADMIN_PASSWORD=
HOUSEHOLD_NAME=Ma cave
```

- [ ] **Step 2: Écrire le test qui échoue**

```ts
// tests/server/healthz.test.ts
import { GET } from '../../src/routes/healthz/+server';
it('healthz répond 200 "ok"', async () => {
  const res = await GET({} as any);
  expect(res.status).toBe(200);
  expect(await res.text()).toBe('ok');
});
```

- [ ] **Step 3: `npm install` puis `npx vitest run tests/server/healthz.test.ts`** — attendu : FAIL (module introuvable).

- [ ] **Step 4: Implémenter `GET` dans `src/routes/healthz/+server.ts`** (repris de babysleep).

- [ ] **Step 5: `npm test` et `npm run check`** — attendu : tests PASS, `svelte-check` 0 erreur.

- [ ] **Step 6: Commit** — `chore: squelette SvelteKit repris de babysleep`

---

### Task 2: Schéma de données

**Files:**
- Create: `src/lib/server/db/schema.ts`, `drizzle/0000_*.sql` (généré), `tests/helpers/fixtures.ts`
- Test: `tests/server/schema.test.ts`

**Interfaces:**
- Produces (tables Drizzle, colonnes en snake_case SQL / camelCase TS) :
  - `households`: `id`, `name` (non nul), `createdAt`
  - `users`: comme babysleep + `householdId` (FK `households.id`, non nul, `onDelete: 'restrict'`)
  - `sessions`, `appConfig` : identiques à babysleep
  - `invitations`: comme babysleep + `householdId` (FK nullable, `onDelete: 'cascade'`)
  - `locations`: `id`, `householdId` (FK cascade), `name`, `sortOrder` (int, défaut 0), `createdAt` ; unique `(householdId, name)`
  - `wines`: `id`, `householdId` (FK cascade), `producer`, `cuvee`, `appellation`, `region`, `country`, `color`, `vintage` (int null), `grapes`, `formatCl` (int, défaut 75), `acquiredYear` (int null), `drinkFrom`, `peakFrom`, `peakTo`, `drinkUntil` (int null), `windowSource` (`'ai'|'manual'`, défaut `'manual'`), `aiConfidence`, `aiRationale`, `aiModel`, `aiAnalyzedAt`, `labelPhoto`, `notes`, `identityKey` (texte non nul), `createdBy` (FK users, `onDelete: 'set null'`), `createdAt`, `updatedAt` ; index `(householdId, identityKey)`
  - `stockLots`: `id`, `wineId` (FK cascade), `locationId` (FK `restrict`), `position` (texte non nul, défaut `''`), `quantity` (int non nul, défaut 0) ; unique `(wineId, locationId, position)`
  - `consumptions`: `id`, `wineId` (FK cascade), `lotId` (FK `stockLots.id`, `set null`), `locationId` (FK `set null`), `userId` (FK `set null`), `consumedOn` (texte `YYYY-MM-DD`), `rating` (int null), `note`, `createdAt`
  - `appliedOps`: `opId` (texte PK), `householdId` (FK cascade), `appliedAt`, `result` (texte JSON)
  - Types exportés : `Household`, `User`, `Session`, `Invitation`, `Location`, `Wine`, `StockLot`, `Consumption`.
- Produces (`tests/helpers/fixtures.ts`) : `makeHousehold(tdb, name?) → number`, `makeUser(tdb, householdId, opts?: { email?: string; isAdmin?: boolean }) → number`, `makeLocation(tdb, householdId, name) → number`.

`notification_log` et `push_subscriptions` arrivent avec le plan 3.

- [ ] **Step 1: Écrire les tests de contraintes**

```ts
it('supprimer un utilisateur garde ses vins et consommations (created_by / user_id → NULL)', …)
  // créer foyer, user, lieu, vin (createdBy=user), lot, consommation (userId=user)
  // DELETE user → wine.created_by IS NULL, consumption.user_id IS NULL, 1 vin, 1 consommation
it('supprimer un foyer supprime ses lieux, vins, lots, consommations, invitations', …)
  // après DELETE des users puis du foyer → COUNT(*) = 0 dans chaque table
it('refuse de supprimer un foyer qui a encore des membres', …)
  // expect(() => DELETE households).toThrow(/FOREIGN KEY/)
it('refuse un lieu en double dans un même foyer, accepte le même nom dans un autre foyer', …)
it('refuse de supprimer un lieu qui porte un lot', …)  // toThrow(/FOREIGN KEY/)
```

- [ ] **Step 2: `npx vitest run tests/server/schema.test.ts`** — attendu : FAIL.

- [ ] **Step 3: Écrire `schema.ts` et `fixtures.ts`, puis `npm run db:generate`.**

- [ ] **Step 4: `npx vitest run tests/server/schema.test.ts`** — attendu : PASS.

- [ ] **Step 5: Commit** — `feat(db): schéma foyers, lieux, vins, lots, consommations`

---

### Task 3: Authentification et foyers

**Files:**
- Create (transplantés de babysleep puis adaptés) : `src/lib/server/auth/{password,email,session,locale,bootstrap,invitations}.ts`, `src/lib/server/rate-limit.ts`, `src/hooks.server.ts`, `src/lib/server/context.ts`, `src/routes/signup/_logic.ts`, `src/routes/login/_logic.ts`, `src/routes/setup/_logic.ts`
- Test: `tests/server/auth-*.test.ts` (portés), `tests/server/rate-limit.test.ts` (porté), `tests/server/signup.test.ts`, `tests/server/setup.test.ts`, `tests/server/context.test.ts`

**Interfaces:**
- Consumes: schéma (Task 2).
- Produces:
  - `createInvitation(db, opts: { createdBy: number; householdId: number | null }): Invitation` — lève `Error('forbidden')` si `householdId === null` et que `createdBy` n'est pas admin. `findUsableInvitation`, `markInvitationUsed` inchangés ; `listInvitations(db, householdId: number | null)` (null = toutes, réservé admin).
  - `bootstrapAdmin(db, env: { email?: string; password?: string; householdName?: string })` — crée le foyer (`householdName ?? 'Ma cave'`) puis l'admin, dans une transaction.
  - `setupFirstAdmin(db, input: { email; password; householdName; locale }) → { ok: true; userId } | { ok: false; reason: 'already-setup'|'weak-password'|'invalid-email'|'household-name-required' }`
  - `signupWithToken(db, input: { token; email; password; locale?; householdName?: string }) → { ok: true; userId } | { ok: false; reason: 'bad-token'|'weak-password'|'duplicate-email'|'invalid-email'|'household-name-required' }` — invitation avec foyer → rejoint ce foyer ; sans foyer → crée un foyer nommé `householdName` (obligatoire).
  - `attemptLogin` : repris tel quel.
  - `context.ts` : `type HouseholdCtx = { userId: number; householdId: number; isAdmin: boolean }`, `requireCtx(locals: App.Locals): HouseholdCtx` (lève `redirect(303, '/login')` si non connecté), `class NotFoundError extends Error`.
  - `hooks.server.ts` : identique à babysleep **sans** le scheduler push ; `Permissions-Policy` passe à `camera=(self), microphone=(), geolocation=(), interest-cohort=()` (préparation du plan 2) ; `bootstrapAdmin` reçoit `HOUSEHOLD_NAME`.

- [ ] **Step 1: Porter les tests babysleep** `auth-password`, `auth-session`, `auth-invitations`, `auth-bootstrap`, `rate-limit`, `i18n/locale-resolution`, en remplaçant les `INSERT INTO users` manuels par `makeUser(tdb, makeHousehold(tdb))`.

- [ ] **Step 2: Écrire les nouveaux tests**

```ts
// signup.test.ts
it('invitation de foyer : le nouvel utilisateur rejoint ce foyer', …)        // users.household_id === hid
it('invitation sans foyer : crée un foyer au nom fourni', …)                 // households.name === 'Chez Paul'
it('invitation sans foyer sans nom de foyer → household-name-required', …)   // et aucun user créé
it('un non-admin ne peut pas créer une invitation sans foyer', …)            // toThrow('forbidden')
// setup.test.ts
it('crée le foyer et l\'admin', …)                                           // isAdmin=1, household name
it('refuse un second setup → already-setup', …)
// context.test.ts
it('requireCtx redirige vers /login sans utilisateur', …)
it('requireCtx renvoie userId, householdId, isAdmin', …)
```

- [ ] **Step 3: `npm test`** — attendu : FAIL sur les nouveaux tests.

- [ ] **Step 4: Transplanter les modules et implémenter les changements listés dans Interfaces.**

- [ ] **Step 5: `npm test`** — attendu : PASS.

- [ ] **Step 6: Commit** — `feat(auth): comptes, sessions, invitations rattachées à un foyer`

---

### Task 4: Design system

**Files:**
- Create: `src/lib/styles/{tokens,base,components}.css`, `src/lib/theme.ts` (repris), `src/routes/api/theme/+server.ts` et `src/routes/api/locale/+server.ts` (repris), `src/routes/+layout.svelte`, `src/routes/+layout.server.ts`, `src/lib/components/{Button,Card,BottomNav,Toast,Sheet,PhaseBadge,WindowTimeline,EmptyState,Field,LocaleSwitcher,ThemeToggle}.svelte`, `src/lib/toast.svelte.ts`, `static/manifest.webmanifest`, `static/icon-192.png`, `static/icon-512.png`, `static/apple-touch-icon.png`, `src/service-worker/index.ts` (repris, cache `apogee-${version}`), `src/routes/dev/styleguide/+page.svelte` (+ `+page.server.ts` qui renvoie 404 si `NODE_ENV === 'production'`)
- Test: `tests/lib/theme.test.ts` (porté), `tests/i18n/messages-completeness.test.ts` (porté)

**Interfaces:**
- Consumes: `Phase` de Task 7 — le composant `PhaseBadge` déclare localement `type Phase = 'unknown'|'too_young'|'ready'|'peak'|'last_call'|'past'` jusqu'à ce que Task 7 l'exporte, puis l'importe de `$lib/phase`.
- Produces:
  - `<PhaseBadge phase={Phase} />` — libellés : `unknown` « À estimer », `too_young` « Patience », `ready` « Prêt », `peak` « À l'apogée », `last_call` « À boire vite », `past` « Ne tardez plus ».
  - `<WindowTimeline drinkFrom peakFrom peakTo drinkUntil currentYear />` — frise horizontale, année courante marquée.
  - `<BottomNav />` — 4 entrées : Quoi ouvrir (`/app`), Cave (`/app/cave`), ＋ (`/app/add`), Compte (`/account`).
  - `<Sheet open onclose>` (feuille du bas), `<Field label error>` (champ de formulaire avec message d'erreur).
  - `toast.svelte.ts` : `showToast(message: string, action?: { label: string; run: () => void }, ms = 5000)` ; `<Toast />` monté une fois dans le layout racine.

- [ ] **Step 1: Invoquer la skill `taste-skill:design-taste-frontend`** avec ce brief : application mobile d'abord pour une cave à vin personnelle ; ton chaleureux, sobre, « cave » (pas de clichés bordeaux/or criards) ; clair et sombre ; lisible à une main dans une cave peu éclairée ; composants listés ci-dessus. Retenir la typographie, la palette (tokens CSS) et les règles d'espacement qu'elle produit.

- [ ] **Step 2: Porter `theme.test.ts` et `messages-completeness.test.ts` ; `npm test`** — attendu : FAIL tant que `theme.ts` et les messages manquent.

- [ ] **Step 3: Écrire tokens, styles, composants, layout racine, manifest, icônes et service worker.** Les couleurs ne sont définies que dans `tokens.css` (variables CSS), avec bloc sombre via `[data-theme="dark"]` et `prefers-color-scheme`, comme babysleep.

- [ ] **Step 4: Page `/dev/styleguide`** affichant chaque composant et chaque `PhaseBadge`.

- [ ] **Step 5: Vérification** — `npm test` et `npm run check` PASS ; `npm run dev`, ouvrir `/dev/styleguide` à 375 px de large en clair puis en sombre : aucun débordement horizontal, contraste des badges lisible.

- [ ] **Step 6: Commit** — `feat(ui): design system, thème, PWA`

---

### Task 5: Écrans de compte et d'administration

**Files:**
- Create: `src/routes/{setup,login,signup}/+page.{svelte,server.ts}`, `src/routes/logout/+server.ts`, `src/routes/account/+page.{svelte,server.ts}`, `src/routes/account/sessions/[id]/+server.ts`, `src/routes/account/household/+page.{svelte,server.ts}`, `src/routes/admin/+page.{svelte,server.ts}`, `src/lib/server/households.ts`
- Test: `tests/server/households.test.ts`

**Interfaces:**
- Consumes: Task 3 (auth, `requireCtx`), Task 4 (composants).
- Produces (`households.ts`) :
  - `listMembers(db, householdId): { id; email; isAdmin; createdAt }[]`
  - `listHouseholdsForAdmin(db): { id; name; memberCount; createdAt }[]` — **aucune** donnée de cave.
  - `deleteUserAsAdmin(db, ctx: HouseholdCtx, userId): { ok: true } | { ok: false; reason: 'forbidden'|'self'|'not_found' }`
  - `deleteHouseholdAsAdmin(db, ctx, householdId): { ok: true } | { ok: false; reason: 'forbidden'|'has_members'|'own_household'|'not_found' }`

- [ ] **Step 1: Écrire les tests**

```ts
it('listMembers ne renvoie que les membres du foyer', …)
it('listHouseholdsForAdmin renvoie nom et nombre de membres', …)
it('deleteUserAsAdmin refuse un non-admin → forbidden, et sa propre suppression → self', …)
it('deleteHouseholdAsAdmin refuse un foyer avec membres → has_members', …)
it('deleteHouseholdAsAdmin supprime un foyer vide et toute sa cave', …)
```

- [ ] **Step 2: `npx vitest run tests/server/households.test.ts`** — attendu : FAIL.

- [ ] **Step 3: Implémenter `households.ts`.**

- [ ] **Step 4: Pages** — reprendre la structure de babysleep pour `setup` (ajouter le champ « Nom du foyer »), `login`, `logout`, `signup` (champ « Nom du foyer » affiché seulement si l'invitation n'a pas de foyer), `account` (profil, langue, thème, sessions). `account/household` : membres + bouton « Inviter » qui crée une invitation du foyer et affiche le lien à copier. `admin` (admins seulement, sinon 404) : foyers, bouton « Inviter un nouveau foyer », invitations, suppression d'utilisateurs et de foyers vides avec confirmation.

- [ ] **Step 5: Vérification** — `npm test` PASS ; dans le navigateur : setup → login → inviter un membre → s'inscrire avec le lien dans une fenêtre privée → les deux comptes voient le même foyer dans `account/household`.

- [ ] **Step 6: Commit** — `feat: écrans setup, connexion, compte, foyer, admin`

---

### Task 6: Lieux

**Files:**
- Create: `src/lib/server/locations.ts`, `src/routes/app/+layout.server.ts`, `src/routes/app/+layout.svelte`, `src/routes/app/locations/+page.{svelte,server.ts}`
- Test: `tests/server/locations.test.ts`

**Interfaces:**
- Consumes: `HouseholdCtx`, `NotFoundError`.
- Produces:
  - `listLocations(db, ctx): (Location & { bottleCount: number })[]` triés par `sortOrder`, puis `id`
  - `createLocation(db, ctx, name: string): { ok: true; location: Location } | { ok: false; reason: 'empty'|'duplicate' }` — nom `trim()`, 1–60 caractères, ajouté en fin d'ordre
  - `renameLocation(db, ctx, id, name)` : même résultat + lève `NotFoundError`
  - `reorderLocations(db, ctx, orderedIds: number[])` — lève `NotFoundError` si un id n'est pas du foyer
  - `deleteLocation(db, ctx, id): { ok: true } | { ok: false; reason: 'not_empty' }` — refuse si un lot du lieu a `quantity > 0` ; sinon supprime les lots à 0 puis le lieu (les consommations gardent l'historique avec `locationId = NULL`)
- `app/+layout.server.ts` : `requireCtx`, renvoie `{ locations, isAdmin, locale, theme }` ; `app/+layout.svelte` monte `BottomNav`.

- [ ] **Step 1: Écrire les tests**

```ts
it('crée, liste dans l\'ordre, renomme, réordonne', …)
it('refuse un nom vide ou déjà pris dans le foyer', …)
it('deleteLocation refuse si des bouteilles y sont → not_empty', …)
it('deleteLocation supprime les lots vides et garde les consommations (location_id NULL)', …)
it('isolation : renommer/réordonner/supprimer un lieu d\'un autre foyer → NotFoundError, rien ne change', …)
```

- [ ] **Step 2: Lancer** — attendu : FAIL. **Step 3: Implémenter.** **Step 4: Lancer** — attendu : PASS.

- [ ] **Step 5: Page `/app/locations`** — liste, ajout, renommage en place, flèches monter/descendre, suppression (message « Ce lieu contient encore N bouteilles » si `not_empty`).

- [ ] **Step 6: Commit** — `feat: gestion des lieux`

---

### Task 7: Phases et validation de la fenêtre

**Files:**
- Create: `src/lib/phase.ts`
- Test: `tests/lib/phase.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Phase = 'unknown' | 'too_young' | 'ready' | 'peak' | 'last_call' | 'past';
  export type WindowYears = { drinkFrom: number | null; peakFrom: number | null; peakTo: number | null; drinkUntil: number | null };
  export const HOME_SECTION_ORDER: Phase[] = ['past', 'last_call', 'peak', 'ready', 'too_young', 'unknown'];
  export function computePhase(w: WindowYears, year: number): Phase;
  export function currentYear(timeZone: string, now?: Date): number;
  export type WindowError = { field: keyof WindowYears; reason: 'partial' | 'order' | 'before_ref' };
  export function validateWindow(w: WindowYears, refYear: number | null): WindowError | null;
  ```

Règles de `computePhase` (spec §6.3), dans cet ordre :
1. `drinkFrom` ou `drinkUntil` nul → `unknown`
2. `year < drinkFrom` → `too_young`
3. `year > drinkUntil` → `past`
4. `year === drinkUntil` → `last_call`
5. apogée renseignée : `year < peakFrom` → `ready` ; `year <= peakTo` → `peak` ; sinon → `last_call`
6. sinon → `ready`

Règles de `validateWindow` : tout vide → `null` (valide, phase `unknown`) ; un seul de `drinkFrom`/`drinkUntil` → `partial` sur le champ vide ; un seul de `peakFrom`/`peakTo` → `partial` ; ordre `drinkFrom ≤ peakFrom ≤ peakTo ≤ drinkUntil` (sinon `order` sur le premier champ fautif) ; `drinkFrom < refYear` → `before_ref` sur `drinkFrom` (`refYear` = millésime, ou année d'entrée en cave pour un NV).

- [ ] **Step 1: Écrire les tests**

```ts
const w = { drinkFrom: 2022, peakFrom: 2025, peakTo: 2030, drinkUntil: 2034 };
it.each([
  [2021, 'too_young'], [2022, 'ready'], [2024, 'ready'], [2025, 'peak'], [2030, 'peak'],
  [2031, 'last_call'], [2034, 'last_call'], [2035, 'past']
])('année %i → %s', (y, p) => expect(computePhase(w, y)).toBe(p));
it('sans apogée : ready jusqu\'à drinkUntil-1, last_call la dernière année', …)
  // {2022,null,null,2026}: 2025 → ready, 2026 → last_call
it('fenêtre incomplète → unknown', …)  // drinkUntil null
it('peakTo === drinkUntil : la dernière année est last_call', …) // {2020,2022,2026,2026}, 2026 → last_call
it('currentYear suit le fuseau', () => {
  expect(currentYear('Europe/Paris', new Date('2026-12-31T23:30:00Z'))).toBe(2027);
  expect(currentYear('UTC', new Date('2026-12-31T23:30:00Z'))).toBe(2026);
});
it('validateWindow', () => {
  expect(validateWindow({ drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null }, 2018)).toBeNull();
  expect(validateWindow({ drinkFrom: 2022, peakFrom: null, peakTo: null, drinkUntil: null }, 2018))
    .toEqual({ field: 'drinkUntil', reason: 'partial' });
  expect(validateWindow({ drinkFrom: 2022, peakFrom: 2031, peakTo: 2030, drinkUntil: 2034 }, 2018))
    .toEqual({ field: 'peakFrom', reason: 'order' });
  expect(validateWindow({ drinkFrom: 2016, peakFrom: null, peakTo: null, drinkUntil: 2030 }, 2018))
    .toEqual({ field: 'drinkFrom', reason: 'before_ref' });
});
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter** (`currentYear` via `Intl.DateTimeFormat('en', { timeZone, year: 'numeric' })`). **Step 4: Lancer** — PASS.

- [ ] **Step 5: Faire importer `Phase` depuis `$lib/phase` par `PhaseBadge`.**

- [ ] **Step 6: Commit** — `feat: calcul des phases et validation de la fenêtre`

---

### Task 8: Vins

**Files:**
- Create: `src/lib/server/wines.ts`
- Test: `tests/server/wines.test.ts`

**Interfaces:**
- Consumes: `HouseholdCtx`, `NotFoundError`, `computePhase`, `validateWindow`, `WindowYears`, `Phase`.
- Produces:
  ```ts
  export type Color = 'red' | 'white' | 'rose' | 'sparkling' | 'sweet' | 'fortified';
  export type WineInput = {
    producer: string | null; cuvee: string | null; appellation: string | null;
    region: string | null; country: string | null; color: Color | null;
    vintage: number | null; grapes: string | null; formatCl: number;
    acquiredYear: number | null; window: WindowYears; notes: string | null;
  };
  export type LotInput = { locationId: number; position: string; quantity: number };
  export type WineInputError = { field: string; reason: 'required' | 'invalid' | WindowError['reason'] };
  export function normalizeText(s: string | null): string;          // minuscules, sans accents (NFD), espaces compactés, trim
  export function identityKey(w: Pick<WineInput, 'producer'|'cuvee'|'appellation'|'color'|'vintage'|'formatCl'|'acquiredYear'>): string;
  export function validateWineInput(input: WineInput, currentYear: number): WineInputError | null;
  export function findDuplicate(db, ctx, input: WineInput): Wine | null;
  export function createWine(db, ctx, input: WineInput, lot: LotInput): { wineId: number; lotId: number };
  export function addStock(db, ctx, wineId: number, lot: LotInput): { lotId: number };   // fusionne si (lieu, position) existe
  export function updateWine(db, ctx, wineId: number, input: WineInput): void;           // recalcule identityKey
  export function deleteWine(db, ctx, wineId: number): void;
  export type CellarRow = { wine: Wine; phase: Phase; bottles: number; lots: { lotId: number; locationId: number; locationName: string; position: string; quantity: number }[] };
  export type CellarFilter = { q?: string; locationId?: number; color?: Color; phase?: Phase; finished?: boolean };
  export function listCellar(db, ctx, filter: CellarFilter, year: number): CellarRow[];
  export function homeSections(rows: CellarRow[]): { phase: Phase; rows: CellarRow[] }[];
  export type WineDetail = CellarRow & { consumptions: { id: number; consumedOn: string; rating: number | null; note: string | null; userEmail: string | null; locationName: string | null }[] };
  export function getWineDetail(db, ctx, wineId: number, year: number): WineDetail;  // NotFoundError si absent ou autre foyer
  ```

Règles :
- `identityKey` : `normalizeText` de producteur, cuvée, appellation, puis couleur, millésime, format, et `acquiredYear` **seulement si `vintage` est nul**, joints par `|`.
- `validateWineInput` : au moins un de `producer`/`cuvee`/`appellation` (sinon `required` sur `producer`) ; `vintage` entre 1900 et `currentYear` ; `formatCl` parmi `37, 50, 75, 150, 300, 600` ; `acquiredYear` obligatoire si `vintage` nul ; `quantity` ≥ 1 (dans `createWine`) ; puis `validateWindow(window, vintage ?? acquiredYear)`.
- `createWine` : `windowSource = 'manual'`, `createdBy = ctx.userId`, vérifie que `lot.locationId` appartient au foyer (sinon `NotFoundError`).
- `listCellar` : `finished` absent ou `false` → seulement les vins avec `bottles > 0` ; `true` → seulement les vins à 0. `q` cherche dans producteur, cuvée, appellation, région (sur `normalizeText`). Tri par défaut : producteur puis millésime.
- `homeSections` : groupes dans l'ordre `HOME_SECTION_ORDER`, sections vides omises ; tri interne par `drinkUntil` croissant (nuls en dernier), puis millésime.

- [ ] **Step 1: Écrire les tests**

```ts
it('identityKey ignore casse, accents et espaces', () =>
  expect(identityKey({ producer: 'Château  Margaux', … })).toBe(identityKey({ producer: 'chateau margaux ', … })));
it('un magnum a une identité distincte du 75 cl', …)
it('NV : deux années d\'entrée différentes → deux identités ; millésimé : acquiredYear ignoré', …)
it('validateWineInput : NV sans acquiredYear → required ; fenêtre avant le millésime → before_ref', …)
it('createWine puis findDuplicate retrouve le vin', …)
it('addStock fusionne dans le lot existant (même lieu + position) sinon crée un lot', …)
it('listCellar : filtre lieu/couleur/phase/q, exclut les vins finis par défaut', …)
it('homeSections : ordre past, last_call, peak, ready, too_young, unknown ; sections vides omises', …)
it('isolation : getWineDetail/updateWine/deleteWine/addStock d\'un autre foyer → NotFoundError', …)
it('createWine avec un lieu d\'un autre foyer → NotFoundError, rien n\'est créé', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter.** **Step 4: Lancer** — PASS.

- [ ] **Step 5: Commit** — `feat: vins, identité, doublons, liste de cave`

---

### Task 9: Opérations de stock idempotentes

**Files:**
- Create: `src/lib/server/stock.ts`, `src/routes/api/stock/ops/+server.ts`
- Test: `tests/server/stock.test.ts`

**Interfaces:**
- Consumes: `HouseholdCtx`, schéma.
- Produces:
  ```ts
  export type StockOp =
    | { opId: string; kind: 'consume'; lotId: number; consumedOn: string; rating?: number | null; note?: string | null }
    | { opId: string; kind: 'adjust'; lotId: number; delta: number }
    | { opId: string; kind: 'move'; lotId: number; toLocationId: number; toPosition: string; quantity: number }
    | { opId: string; kind: 'unconsume'; consumptionId: number };
  export type OpResult = {
    opId: string;
    status: 'applied' | 'partial' | 'rejected';
    appliedQuantity?: number;
    consumptionId?: number;
    reason?: 'empty_lot' | 'not_found' | 'invalid';
  };
  export function parseStockOps(body: unknown): { ok: true; ops: StockOp[] } | { ok: false; error: string };
  export function applyStockOps(db, ctx, ops: StockOp[]): OpResult[];
  ```
- API : `POST /api/stock/ops` corps `{ ops: StockOp[] }` (1 à 100 ops) → `200 { results: OpResult[] }` ; `400` si `parseStockOps` échoue ; `401` sans session. Le plan 4 enverra sa file d'attente à cette même route.

Règles :
- Chaque op s'exécute dans sa propre transaction. Si `opId` existe déjà dans `applied_ops` **pour ce foyer** → renvoyer le `result` enregistré sans rien réappliquer. S'il existe pour un autre foyer → `rejected: not_found`.
- `opId` : UUID v4 (validé par `parseStockOps`). `consumedOn` : `YYYY-MM-DD`. `rating` : 1–5 ou nul. `delta` : entier non nul. `quantity` : entier ≥ 1.
- `consume` : lot à 0 → `rejected: empty_lot` ; sinon −1 sur le lot et insertion d'une consommation (`lotId`, `locationId` du lot, `userId = ctx.userId`) → `applied`, `consumptionId`.
- `adjust` : quantité bornée à 0 ; si le delta négatif dépasse le stock → `partial`, `appliedQuantity` = variation réelle.
- `move` : déplace `min(quantity, lot.quantity)` vers le lot `(wineId, toLocationId, toPosition)` (créé si besoin) ; lot source à 0 → `rejected: empty_lot` ; déplacement partiel → `partial`.
- `unconsume` : supprime la consommation et remet +1 sur son lot d'origine (`lotId`) ; si ce lot n'existe plus mais que le lieu existe, crée/complète le lot `(wineId, locationId, '')` ; si le lieu a été supprimé → `rejected: not_found`.
- Toute référence (lot, lieu, consommation) hors du foyer → `rejected: not_found`.
- Le résultat (même `rejected`) est enregistré dans `applied_ops`.

- [ ] **Step 1: Écrire les tests**

```ts
it('consume décrémente et crée une consommation', …)
it('le même opId rejoué renvoie le même résultat sans décrémenter deux fois', …)
it('deux consume différents sur un lot de 1 : applied puis rejected empty_lot', …)
it('adjust -5 sur un lot de 2 → partial, appliedQuantity -2, lot à 0', …)
it('move 3 sur un lot de 2 → partial, 2 déplacées, lot cible créé', …)
it('unconsume remet la bouteille et supprime la consommation', …)
it('isolation : lot, lieu cible ou consommation d\'un autre foyer → rejected not_found, rien ne change', …)
it('opId déjà utilisé par un autre foyer → rejected not_found', …)
it('parseStockOps refuse un opId non UUID, un rating 6, un delta 0, plus de 100 ops', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter `stock.ts` puis la route.** **Step 4: Lancer** — PASS.

- [ ] **Step 5: Commit** — `feat: opérations de stock idempotentes (consume, adjust, move, unconsume)`

---

### Task 10: Ajouter un vin et fiche vin

**Files:**
- Create: `src/routes/app/add/+page.{svelte,server.ts}`, `src/routes/app/add/_logic.ts`, `src/routes/app/wines/[id]/+page.{svelte,server.ts}`, `src/routes/app/wines/[id]/edit/+page.{svelte,server.ts}`, `src/lib/components/WineForm.svelte`, `src/lib/components/LotList.svelte`, `src/lib/stock-client.ts`
- Test: `tests/server/add-logic.test.ts`

**Interfaces:**
- Consumes: `wines.ts`, `locations.ts`, `phase.ts`, `POST /api/stock/ops`, composants Task 4.
- Produces:
  - `parseWineForm(form: FormData): { input: WineInput; lot: LotInput }` — champs vides → `null` ; années en entier.
  - `submitAddWine(db, ctx, form: FormData, year: number): { ok: true; wineId: number } | { ok: false; error: WineInputError } | { ok: false; duplicateOf: number }` — si `findDuplicate` trouve un vin et que `form.get('confirmDuplicate') !== 'add-stock'|'new'`, renvoie `duplicateOf` ; `'add-stock'` → `addStock` ; `'new'` → `createWine`.
  - `stock-client.ts` : `sendStockOps(ops: StockOp[]): Promise<OpResult[]>` et `newOpId(): string` (`crypto.randomUUID()`), utilisés par Tasks 10 et 11.
  - `<WineForm>` : champs identité, format, année d'entrée (affichée si millésime vide, pré-remplie avec l'année courante), fenêtre (4 années), notes ; erreurs par champ via `<Field>`.

- [ ] **Step 1: Écrire les tests**

```ts
it('parseWineForm convertit les champs vides en null et les années en nombres', …)
it('submitAddWine crée le vin et son lot', …)
it('submitAddWine sur un doublon renvoie duplicateOf, puis add-stock ajoute au vin existant', …)
it('submitAddWine renvoie l\'erreur de fenêtre sur le bon champ', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter `_logic.ts`.** **Step 4: Lancer** — PASS.

- [ ] **Step 5: Pages**
  - `/app/add` : `<WineForm>` + lieu (liste des lieux, mémorise le dernier lieu choisi dans un cookie `last_location_id`), précision, quantité. Écran doublon : « Ce vin est déjà dans la cave (N bouteilles) » → [Ajouter au stock existant] [Créer une fiche séparée]. Après succès : écran de confirmation avec bouton principal **« Ajouter une autre »** (retour à `/app/add`, même lieu) et lien vers la fiche. *(Le plan 2 remplacera le point d'entrée par la photo.)*
  - `/app/wines/[id]` : en-tête (producteur, cuvée, millésime, `PhaseBadge`), `<WindowTimeline>`, provenance de la fenêtre (« Saisie manuelle »), `<LotList>` (par lieu : +/−, « Déplacer » via `<Sheet>`, chaque geste = une op envoyée par `sendStockOps`), bouton « Bue », historique des consommations, Modifier, Supprimer (confirmation). 404 si `NotFoundError`.
  - `/app/wines/[id]/edit` : `<WineForm>` pré-rempli → `updateWine`.

- [ ] **Step 6: Vérification navigateur (375 px)** — ajouter un vin, le retrouver, +1/−1, déplacer une bouteille vers un autre lieu, modifier la fenêtre, supprimer.

- [ ] **Step 7: Commit** — `feat: ajout manuel, fiche vin, édition`

---

### Task 11: « Quoi ouvrir », Cave et « Bue »

**Files:**
- Create: `src/routes/app/+page.{svelte,server.ts}`, `src/routes/app/cave/+page.{svelte,server.ts}`, `src/lib/components/WineRow.svelte`, `src/lib/components/DrinkButton.svelte`
- Test: `tests/server/home.test.ts`

**Interfaces:**
- Consumes: `listCellar`, `homeSections`, `currentYear`, `sendStockOps`, `newOpId`, `showToast`.
- Produces:
  - `/app` load : `{ sections: ReturnType<typeof homeSections>, total: number, year: number }` avec `year = currentYear(user.timezone)`.
  - `/app/cave` load : `{ rows: CellarRow[], filter: CellarFilter, total: number }` depuis les paramètres d'URL `q`, `location`, `color`, `phase`, `finished`.
  - `<DrinkButton row={CellarRow}>` : un seul lot → envoie `consume` immédiatement ; plusieurs lots → `<Sheet>` pour choisir le lot (lieu + précision + quantité). Après succès : décrément optimiste à l'écran, `showToast('Bue · {vin}', { label: 'Annuler', run: () => sendStockOps([{ kind: 'unconsume', consumptionId, opId: newOpId() }]) })`. `rejected: empty_lot` → toast « Plus de bouteille à cet endroit » et rechargement des données.

- [ ] **Step 1: Écrire les tests** (fonctions de `load` appelées avec un `locals` simulé et une base de test)

```ts
it('/app renvoie les sections dans l\'ordre d\'urgence pour l\'année du fuseau utilisateur', …)
it('/app exclut les vins finis et ne montre que le foyer de l\'utilisateur', …)
it('/app/cave applique les filtres d\'URL', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter les `load`.** **Step 4: Lancer** — PASS.

- [ ] **Step 5: Écrans**
  - `/app` « Quoi ouvrir » : compteur total, sections par `PhaseBadge` (`too_young` repliée par défaut, avec l'année d'ouverture ; `unknown` en bas avec lien « Saisir la fenêtre » vers l'édition), `<WineRow>` = vin, millésime, nombre de bouteilles, lieu(x) + précision, « jusqu'à {drinkUntil} », `<DrinkButton>`. État vide : invitation à ajouter un premier vin.
  - `/app/cave` : recherche, filtres (lieu, couleur, phase, « Bus »), même `<WineRow>`, compteur.

- [ ] **Step 6: Vérification navigateur (375 px, clair et sombre)** — avec 6 vins couvrant chaque phase : ordre des sections, « Bue » sur un vin à un lot puis Annuler, « Bue » sur un vin à deux lieux (feuille de choix), double appui rapide sur « Bue » d'un lot de 1 → une seule consommation.

- [ ] **Step 7: Commit** — `feat: écran Quoi ouvrir, cave, Bue en un geste`

---

### Task 12: Déploiement Docker et documentation

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `Caddyfile.example`, `README.md`, `docs/BACKUP.md`
- Test: `tests/server/compose.test.ts`

**Interfaces:**
- Consumes: scripts `build`, `db:migrate`, `start`.
- Produces: image qui applique les migrations au démarrage puis lance `build/index.js` ; volume `/data` contenant `apogee.sqlite` (et `photos/` au plan 2).

- [ ] **Step 1: Écrire le test**

```ts
it('docker-compose monte /data et transmet DISABLE_SIGNUP, ORIGIN, ADMIN_EMAIL, ADMIN_PASSWORD, HOUSEHOLD_NAME', …)
  // lecture du YAML en texte, assertions sur les clés
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Écrire** `Dockerfile` (celui de babysleep avec `DATABASE_PATH=/data/apogee.sqlite`), `docker-compose.yml` (service `apogee`, volume `./data:/data`, healthcheck), `Caddyfile.example`, `README.md` (présentation, démarrage rapide Docker, variables d'environnement, mise à jour), `docs/BACKUP.md` (adapté de babysleep). **Step 4: Lancer** — PASS.

- [ ] **Step 5: Vérification** — `docker build -t apogee .` puis `docker run --rm -p 3000:3000 -e ORIGIN=http://localhost:3000 -v ./data-test:/data apogee` ; `curl http://localhost:3000/healthz` → `ok` ; `/` redirige vers `/setup`. Si Docker n'est pas disponible sur la machine, le signaler dans le rapport au lieu de cocher l'étape.

- [ ] **Step 6: Commit** — `chore: image Docker, compose, Caddy, documentation`

---

## Vérification finale du plan 1

- [ ] `npm test`, `npm run check`, `npm run build` passent.
- [ ] Parcours complet en navigateur mobile : setup → créer deux lieux → ajouter 3 vins (dont un NV et un magnum) → « Quoi ouvrir » → « Bue » + Annuler → inviter un second membre → il voit la même cave → un utilisateur d'un autre foyer ne voit rien.
- [ ] Mettre à jour `tasks/todo.md` (section revue).
