# File de gestes : envoi en arrière-plan (#23) et quarantaine — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** le service worker réessaie pendant l'événement `sync` (issue #23), et un geste qui échoue sans fin passe en quarantaine visible, avec « Réessayer » et « Abandonner », sans bloquer la file.

**Architecture :** tout le mécanisme vit dans les modules sans framework de `src/lib/offline/` (`queue.ts`, `sync.ts`, plus un nouveau `background-sync.ts`). Le service worker les importe aussi. `pending.svelte.ts` expose l'état réactif de la quarantaine et ses deux actions, et un composant `QuarantinePanel.svelte` l'affiche dans `src/routes/app/+layout.svelte`.

**Tech Stack :** SvelteKit 2, Svelte 5 (runes), TypeScript, IndexedDB (`fake-indexeddb` en test), Vitest, Paraglide (`messages/fr.json`, `messages/en.json`).

**Spec :** `docs/superpowers/specs/2026-11-23-file-gestes-design.md`

## Global Constraints

- Réponses, commentaires de commit et textes d'interface en français ; tout nouveau message existe en FR **et** en EN (le test `tests/i18n/messages-completeness.test.ts` l'impose). Les commentaires du code restent en anglais, comme le reste du dépôt.
- `queue.ts`, `sync.ts`, `background-sync.ts` : aucun import de `$app/*` ni de runes (le service worker les importe). `npm run check` compile aussi `src/service-worker`.
- Délais d'essai pendant l'événement `sync` : `[2000, 4000, 8000, 15000, 30000, 60000]` ms.
- Nombre de coups avant quarantaine : `MAX_STRIKES = 5`. « Réessayer » remet `strikes = MAX_STRIKES - 1`.
- Sonde de joignabilité : `GET /healthz`, délai 5 s, toute réponse HTTP = joignable.
- Aucun changement de `DB_VERSION` (champs facultatifs sans index).
- Refus métier inchangés (400 → `dropped`, `rejected` → toasts existants) ; un `review` rejeté reste silencieux.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Lancer les tests : `npx vitest run <fichier>` ; tout : `npx vitest run` ; types : `npm run check`.

## Review Focus

1. Serveur totalement injoignable (`/healthz` échoue aussi) pendant longtemps : aucun coup, aucune quarantaine, `attempts` augmente quand même. → test Task 3.
2. Navigateur hors ligne (`navigator.onLine === false`) : ni envoi, ni coup. → test Task 3.
3. Un `review` dont le « Bue » a déjà été appliqué (plus en file) n'est jamais retenu. → test Task 2.
4. Message `sync-outcome` d'un ancien service worker sans `quarantined` : accepté, traité comme `[]`. → test Task 4.
5. « Abandonner » un geste marqué `undo` : la ligne disparaît et aucun inverse n'est mis en file. → test Task 4.

---

### Task 1 : essais pendant l'événement `sync` (issue #23)

**Files :**
- Create : `src/lib/offline/background-sync.ts`
- Modify : `src/service-worker/index.ts:157-177` (`backgroundSync()`)
- Test : `tests/lib/offline-background-sync.test.ts`

**Interfaces :**
- Consumes : `SyncOutcome`, `SyncStatus` de `src/lib/offline/sync.ts`.
- Produces :
  - `export const BACKGROUND_RETRY_DELAYS_MS: readonly number[] = [2000, 4000, 8000, 15000, 30000, 60000]`
  - `export function shouldRetry(status: SyncStatus): boolean` — vrai pour `retry`, `offline`, `busy`.
  - `export async function runWithRetries(syncOnce: () => Promise<SyncOutcome>, onOutcome: (o: SyncOutcome) => void | Promise<void>, delays: readonly number[] = BACKGROUND_RETRY_DELAYS_MS, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<SyncOutcome>` — appelle `syncOnce`, passe chaque résultat à `onOutcome`, attend `delays[i]` puis recommence tant que `shouldRetry`, au plus `delays.length + 1` appels ; renvoie le dernier résultat.

- [ ] **Step 1 : tests en échec** dans `tests/lib/offline-background-sync.test.ts` (fabriquer les `SyncOutcome` à la main, `sleep` = `vi.fn(async () => {})`) :
  - `succès au 3e essai → 3 appels, sleeps [2000, 4000], renvoie ok` ;
  - `idle ou unauthorized au 1er essai → 1 appel, aucun sleep` ;
  - `retry à chaque fois → 7 appels, sleeps égaux à BACKGROUND_RETRY_DELAYS_MS, renvoie retry` ;
  - `offline puis busy puis ok → 3 appels` ;
  - `onOutcome reçoit chaque résultat, dans l'ordre` ;
  - `somme de BACKGROUND_RETRY_DELAYS_MS < 150000` (rester sous la limite de durée d'un événement `sync`).
- [ ] **Step 2 :** `npx vitest run tests/lib/offline-background-sync.test.ts` → FAIL (module absent).
- [ ] **Step 3 :** implémenter `background-sync.ts`.
- [ ] **Step 4 :** relancer → PASS.
- [ ] **Step 5 :** dans `backgroundSync()` du service worker : après `getActiveUser()`, `const outcome = await runWithRetries(() => syncNow(userId), post)` où `post` envoie `{ type: 'sync-outcome', userId, outcome }` aux fenêtres quand le statut n'est ni `busy` ni `idle` (même règle qu'aujourd'hui, mais à chaque essai) ; puis `if (shouldRetry(outcome.status)) throw new Error(...)`. Mettre à jour le commentaire (pourquoi : Chrome reprogramme un `sync` rejeté plusieurs minutes plus tard).
- [ ] **Step 6 :** `npm run check` → 0 erreur.
- [ ] **Step 7 : commit** `fix(offline): réessayer pendant l'événement sync au retour du réseau (#23)`.

### Task 2 : file IndexedDB — coups, quarantaine, gestes retenus

**Files :**
- Modify : `src/lib/offline/queue.ts`
- Test : `tests/lib/offline-queue.test.ts`

**Interfaces :**
- Produces :
  - `QueuedOp` gagne `strikes?: number` et `quarantinedAt?: number` (renvoyés par `listQueued` seulement s'ils sont définis, comme `undo`).
  - `export function strike(opId: string): Promise<number>` — +1, renvoie le nouveau total (0 si la ligne n'existe plus).
  - `export function quarantine(opId: string, at?: number): Promise<void>` — pose `quarantinedAt` (défaut `Date.now()`).
  - `export function releaseQuarantine(opId: string, strikes: number): Promise<boolean>` — retire `quarantinedAt`, fixe `strikes` ; `false` si la ligne n'existe plus.
  - `export type QuarantineItem = { row: QueuedOp; held: QueuedOp[] }`
  - `export function splitQuarantine(rows: QueuedOp[]): { sendable: QueuedOp[]; quarantined: QuarantineItem[] }` — pure. `quarantined` : les lignes avec `quarantinedAt`, dans l'ordre de la file ; `held` : les lignes `review` dont `op.consumeOpId` est l'`opId` d'une ligne en quarantaine. `sendable` : tout le reste, ordre conservé.

- [ ] **Step 1 : tests en échec** :
  - `strike incrémente et renvoie le total ; ligne absente → 0` ;
  - `quarantine puis listQueued → quarantinedAt présent ; releaseQuarantine(id, 4) → quarantinedAt absent, strikes 4` ;
  - `splitQuarantine : consume en quarantaine + review qui le vise + adjust → sendable [adjust], quarantined [{ row: consume, held: [review] }]` ;
  - `splitQuarantine : review dont le consumeOpId n'est pas en file → sendable` (Review Focus 3) ;
  - `review lui-même en quarantaine → quarantined avec held []`.
- [ ] **Step 2 :** `npx vitest run tests/lib/offline-queue.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter (même patron que `markUndo`/`bumpAttempts`).
- [ ] **Step 4 :** relancer → PASS.
- [ ] **Step 5 : commit** `feat(offline): coups et quarantaine dans la file IndexedDB`.

### Task 3 : synchro — coup imputable, envoi seul, quarantaine

**Files :**
- Modify : `src/lib/offline/sync.ts`
- Test : `tests/lib/offline-sync.test.ts`

**Interfaces :**
- Consumes : Task 2 (`strike`, `quarantine`, `splitQuarantine`, champs `strikes`).
- Produces :
  - `export const MAX_STRIKES = 5`
  - `PostOutcome` : `{ kind: 'failed'; answered: boolean }` — `answered` vrai si une réponse HTTP est arrivée (statut non géré, ou corps illisible après une réponse), faux pour une exception (réseau, délai).
  - `export async function serverReachable(doFetch: typeof fetch = fetch): Promise<boolean>` — `GET /healthz`, `cache: 'no-store'`, `credentials: 'same-origin'`, délai 5 s.
  - `SyncOutcome` gagne `quarantined: string[]` (opIds mis en quarantaine pendant cette synchro) ; tous les littéraux `SyncOutcome` (y compris le `busy` de `syncNow`) le portent.

Comportement de `sendQueued` (à documenter dans le commentaire de `syncNow`) :
1. Ne considérer que `splitQuarantine(queued).sendable`.
2. Lots : séquences de lignes sans coup (≤ `SYNC_BATCH_SIZE`) ; une ligne avec `strikes > 0` part **seule**.
3. Sur `failed` : `bumpAttempts(ids)` comme aujourd'hui ; si `res.answered || await serverReachable(doFetch)`, `strike(tête)` ; si le total ≥ `MAX_STRIKES`, `quarantine(tête)`, ajouter son opId à `out.quarantined`, puis **relister la file** (nouveau passage : les gestes retenus et suivants sont recalculés) ; sinon `status = 'retry'` et arrêt.
4. Un passage qui a mis en quarantaine compte comme un passage qui demande un nouveau tour (comme les inverses), dans la limite `MAX_PASSES`.

Attention : dans les tests existants, le faux serveur `server()` lit le corps JSON de chaque requête ; un `GET /healthz` sans corps fait rejeter le faux `fetch`, donc « injoignable ». Les nouveaux tests utilisent un faux serveur qui répond à `/healthz` selon le cas.

- [ ] **Step 1 : tests en échec** :
  - `500 → coup sur la tête du lot, status retry` ;
  - `erreur réseau + /healthz répond → coup` ; `erreur réseau + /healthz échoue → aucun coup, attempts +1` (Review Focus 1) ;
  - `navigator.onLine false → ni envoi ni coup` (Review Focus 2) ;
  - `lot [A, B, C], B fait 500 : 1re synchro coup sur A ; synchro suivante A part seul et passe ; puis [B, C] → coup sur B ; B part seul ensuite` (vérifier les lots envoyés) ;
  - `B échoue seul jusqu'à 5 coups → quarantaine, out.quarantined = [B], C envoyé dans la même synchro` ;
  - `consume en quarantaine + review qui le vise → le review n'est pas envoyé, reste en file` ;
  - `geste en quarantaine jamais renvoyé aux synchros suivantes` ;
  - `400 et rejected : inchangés, aucun coup` ;
  - `réponse 200 au corps illisible → answered, coup sans sonde /healthz`.
- [ ] **Step 2 :** `npx vitest run tests/lib/offline-sync.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter ; adapter `src/lib/stock-client.ts` si le typage de `PostOutcome` l'exige (son comportement ne change pas).
- [ ] **Step 4 :** `npx vitest run tests/lib/offline-sync.test.ts tests/lib/stock-client.test.ts` → PASS ; `npm run check` → 0 erreur.
- [ ] **Step 5 : commit** `feat(offline): mise en quarantaine des gestes en échec répété`.

### Task 4 : état côté page — quarantaine, toasts, « Réessayer », « Abandonner »

**Files :**
- Modify : `src/lib/offline/pending.svelte.ts`, `messages/fr.json`, `messages/en.json`
- Test : `tests/lib/offline-quarantine.test.ts` (mêmes mocks `$app/navigation` et `$app/state` que `tests/lib/stock-client.test.ts`)

**Interfaces :**
- Consumes : Tasks 2 et 3 (`splitQuarantine`, `releaseQuarantine`, `removeQueued`, `MAX_STRIKES`, `SyncOutcome.quarantined`, `withSyncLock`, `syncIdle`).
- Produces :
  - `export function quarantinedItems(): QuarantineItem[]` (réactif).
  - `export async function retryQuarantined(userId: number, opId: string): Promise<void>` — sous `withSyncLock` : `releaseQuarantine(opId, MAX_STRIKES - 1)` ; puis `refreshPending`, puis `syncPending` (si `busy` : `await syncIdle()` et une seconde fois) ; si le geste est de nouveau en quarantaine, toast `quarantine_still_failing`.
  - `export async function abandonQuarantined(userId: number, opId: string): Promise<void>` — sous `withSyncLock` : `removeQueued([opId, ...held])` (sans inverse) ; puis `refreshPending`, `reload()`, toast `quarantine_abandoned`.
- `refreshPending` : les lignes en quarantaine et les lignes retenues sortent de `state.entries` (donc de `pendingOps()` et `pendingCount()`) et alimentent l'état `quarantine` ; ne jamais les compter comme « parties ailleurs » (`vanished`).
- `handleOutcome`/`afterSync` : `quarantined` non vide → `changed` ; toast `offline_op_quarantined` si aucun toast plus prioritaire (`drink_empty_lot`, puis `offline_op_failed`).
- `swOutcome` : `quarantined` absent → `[]`.
- Messages (clé : FR / EN) :
  - `offline_op_quarantined` : « Un geste n'a pas pu être envoyé » / "A change could not be sent"
  - `quarantine_still_failing` : « Toujours impossible à envoyer » / "Still unable to send"
  - `quarantine_abandoned` : « Geste abandonné » / "Change discarded"

- [ ] **Step 1 : tests en échec** :
  - `refreshPending : geste en quarantaine absent de pendingOps et pendingCount, présent dans quarantinedItems` ;
  - `review retenu : absent de pendingOps, présent dans held` ;
  - `synchro qui met en quarantaine → toast offline_op_quarantined et invalidateAll appelé` ;
  - `review rejeté → toujours aucun toast` (non-régression) ;
  - `retryQuarantined : serveur OK → geste appliqué, quarantinedItems vide` ;
  - `retryQuarantined : nouveau 500 (serveur joignable) → de nouveau en quarantaine, toast quarantine_still_failing` ;
  - `retryQuarantined hors ligne → geste de nouveau en attente (pendingCount 1), pas en quarantaine` ;
  - `abandonQuarantined : ligne et review retenu supprimés, invalidateAll appelé, toast quarantine_abandoned` ;
  - `abandonQuarantined sur une ligne undo → aucun inverse en file` (Review Focus 5) ;
  - `message sync-outcome sans quarantined → accepté` (Review Focus 4 ; passer par `startSyncLoop` et un faux `navigator.serviceWorker`, ou exporter `swOutcome` pour le test).
- [ ] **Step 2 :** `npx vitest run tests/lib/offline-quarantine.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter, ajouter les messages FR/EN.
- [ ] **Step 4 :** `npx vitest run` → tout PASS ; `npm run check` → 0 erreur.
- [ ] **Step 5 : commit** `feat(offline): état de quarantaine, Réessayer et Abandonner`.

### Task 5 : bloc « gestes bloqués » dans l'appli

**Files :**
- Create : `src/lib/components/QuarantinePanel.svelte`
- Modify : `src/routes/app/+layout.svelte`, `messages/fr.json`, `messages/en.json`

**Interfaces :**
- Consumes : Task 4 (`quarantinedItems`, `retryQuarantined`, `abandonQuarantined`), `Sheet.svelte`, `Button.svelte`.
- Props : `{ userId: number }`. Rendu dans le layout juste après la ligne `.pending`, seulement si `quarantinedItems().length > 0`.

Contenu (spec, § Interface) : titre pluriel ; une ligne par geste = libellé du type + date et heure du geste (`queuedAt`, `Intl.DateTimeFormat(getLocale(), { dateStyle: 'short', timeStyle: 'short' })`) + « + verdict » si `held` non vide ; boutons « Réessayer » (désactivé pendant l'action) et « Abandonner » qui ouvre un `Sheet` de confirmation (« Abandonner » / « Garder »). Le bloc a `role="status"` ; style sobre aligné sur `.pending` et les cartes existantes (variables `--c-*`, `--s-*`), lisible à 375 px.

Messages (clé : FR / EN) :
- `quarantine_title` (pluriel sur `count`, même forme que `offline_pending`) : « {count} geste n'a pas pu être envoyé » / « {count} gestes n'ont pas pu être envoyés » ; "{count} change could not be sent" / "{count} changes could not be sent"
- `quarantine_kind_consume` : « Bouteille bue » / "Bottle drunk"
- `quarantine_kind_adjust` : « Stock ajusté » / "Stock adjusted"
- `quarantine_kind_move` : « Bouteille déplacée » / "Bottle moved"
- `quarantine_kind_unconsume` : « Bouteille remise en cave » / "Bottle put back"
- `quarantine_kind_review` : « Verdict » / "Verdict"
- `quarantine_with_review` : « + verdict » / "+ verdict"
- `quarantine_retry` : « Réessayer » / "Retry"
- `quarantine_abandon` : « Abandonner » / "Discard"
- `quarantine_keep` : « Garder » / "Keep"
- `quarantine_abandon_title` : « Abandonner ce geste ? » / "Discard this change?"
- `quarantine_abandon_body` : « Ce geste ne sera jamais envoyé. S'il a déjà été pris en compte, corrigez le stock à la main. » / "This change will never be sent. If it was already recorded, correct the stock by hand."

- [ ] **Step 1 :** écrire le composant et l'insérer dans le layout ; ajouter les messages.
- [ ] **Step 2 :** `npx vitest run tests/i18n` → PASS ; `npm run check` → 0 erreur.
- [ ] **Step 3 : commit** `feat(offline): bloc des gestes bloqués avec Réessayer et Abandonner`.

### Task 6 : vérifications finales (session principale)

- [ ] `npm run check` et `npx vitest run` : 0 erreur, tous les tests verts.
- [ ] Navigateur au format téléphone (375×812), serveur de dev sur une base temporaire du scratchpad : avec Playwright, `page.route('**/api/stock/ops')` répond 500 pour un geste donné (service worker bloqué pour que la route s'applique) ; vérifier l'apparition du bloc après 5 coups, que les autres gestes passent, puis « Réessayer » (route levée → appliqué) et « Abandonner » (confirmation → disparu, stock rechargé).
- [ ] Issue #23 dans Chromium : build de production servi en local, geste mis en file, fenêtre de l'appli fermée (page sur `about:blank`), serveur coupé, `ServiceWorker.dispatchSyncEvent` par CDP, serveur relancé quelques secondes plus tard ; attendu : geste appliqué pendant le même événement (`applied_ops`).
- [ ] Revue de branche (superpowers:requesting-code-review).
- [ ] Dependabot : `gh api repos/Gavark/apogee/dependabot/alerts --jq '.[] | select(.state=="open")'` et PR Dependabot ouvertes ; corriger ce qui est mineur, noter les majeures dans `tasks/dependabot-majeures.md`.
- [ ] Mettre à jour `tasks/todo.md` (section de ce chantier), puis demander avant push et PR (`Fixes #23` dans la description).
