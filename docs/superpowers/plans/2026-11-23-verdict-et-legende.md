# Verdict à « Bue » et légende des phases : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Après « Bue », demander si la bouteille a été ouverte trop tôt, à point ou trop tard (modifiable depuis l'historique), et expliquer l'ordre d'urgence des phases sur « Quoi ouvrir ».

**Architecture:** Le verdict est une colonne `consumptions.verdict` écrite par un nouveau geste de stock `review`, envoyé par la même file hors ligne que les autres. Il vise la consommation par son id, ou par l'`opId` du geste « Bue » quand l'id n'est pas encore connu (hors ligne) ; le serveur le résout via `applied_ops`. La fenêtre de verdict est montée une fois dans le layout racine, comme le toast. La légende est un composant autonome (bouton « ? » + `Sheet`) sur la page d'accueil.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, SQLite (better-sqlite3) + Drizzle, Paraglide (FR/EN), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-verdict-et-legende-design.md`

## Global Constraints

- Verdict : valeurs `'early' | 'right' | 'late'`, colonne nullable `consumptions.verdict` (text). `rating` n'est pas touché.
- Migration Drizzle additive uniquement (`npm run db:generate`, fichier `drizzle/0005_*.sql` + snapshot), aucune autre table modifiée.
- La note du verdict réutilise la colonne existante `consumptions.note`. Champ de saisie limité à 200 caractères (`maxlength="200"`) ; côté serveur la note est validée par `MAX_NOTE_LEN` (2000, déjà utilisé par `consume` pour la même colonne), coupée de ses espaces, vide → `null`.
- « Bue » part toujours en un appui ; le verdict est facultatif. « Plus tard », la croix, Échap ou le fond n'enregistrent rien.
- Un `review` rejeté (consommation disparue, « Bue » annulé) ne produit aucun message.
- Tous les textes en FR et EN (`messages/fr.json`, `messages/en.json`) ; le dossier `src/paraglide` est régénéré par vite/vitest, le lancer avant `npm run check`.
- Gestes `review` idempotents par `opId` (mécanisme existant de `applyStockOps`), même garde `x-apogee-user` que les autres (route existante, rien à changer).
- Ne jamais lancer le serveur de dev sur `./data/apogee.sqlite`.

## Review Focus

1. Verdict donné hors ligne juste après un « Bue » lui aussi en file : les deux partent dans le même lot, dans l'ordre ; le `review` doit trouver la consommation créée juste avant (test serveur « même lot »).
2. « Bue » annulé après un verdict en file : le `review` est rejeté `not_found` sans toast `offline_op_failed` (test client).
3. Verdict sur la consommation d'un autre foyer, par id ou par `consumeOpId` d'un autre foyer : `not_found`, rien modifié (tests serveur).
4. Fenêtre de verdict ouverte au-dessus d'une `<dialog>` modale : le toast « Annuler » de « Bue » serait inerte derrière elle ; il n'est donc affiché qu'à la fermeture de la fenêtre de verdict (Task 3).
5. Deuxième verdict sur la même bouteille : il remplace le premier, note comprise (test serveur).

---

### Task 1: Geste `review` côté serveur

**Files:**
- Modify: `src/lib/stock-ops.ts` (type `Verdict`, constante `VERDICTS`, variante `review`)
- Modify: `src/lib/server/db/schema.ts:150-160` (colonne `verdict`)
- Create: `drizzle/0005_*.sql` + `drizzle/meta/0005_snapshot.json` + `_journal.json` (générés)
- Modify: `src/lib/server/stock.ts` (`parseOp`, nouvelle fonction `review`, `applyOne`)
- Modify: `src/lib/server/wines.ts:485-515` (`WineDetail.consumptions[].verdict`)
- Test: `tests/server/stock.test.ts`, `tests/server/wines.test.ts`

**Interfaces:**
- Produces (dans `src/lib/stock-ops.ts`) :
  ```ts
  export type Verdict = 'early' | 'right' | 'late';
  export const VERDICTS: readonly Verdict[] = ['early', 'right', 'late'];
  // nouvelle variante de StockOp ; exactement l'un des deux champs de cible
  | { opId: string; kind: 'review'; consumptionId?: number; consumeOpId?: string; verdict: Verdict; note: string | null }
  ```
  Résultat appliqué : `{ opId, status: 'applied', consumptionId }`. Rejet : `reason: 'not_found'`.
- Produces : `WineDetail['consumptions'][number]` gagne `verdict: Verdict | null`.
- Schéma : `verdict: text('verdict', { enum: ['early', 'right', 'late'] })`.

- [ ] **Step 1: Tests de parsing** (`describe('parseStockOps')` existant ou nouveau bloc)
  - accepte `{ kind: 'review', consumptionId: 3, verdict: 'right', note: null }` ;
  - accepte `consumeOpId` en majuscules et le rend en minuscules ;
  - note `'  bien  '` → `'bien'`, note `'   '` → `null`, note absente → `null` ;
  - rejette : aucune cible, les deux cibles, `verdict: 'good'`, `consumeOpId` non UUID v4, note de `MAX_NOTE_LEN + 1` caractères, `consumptionId: 0`.
- [ ] **Step 2: Tests d'application**
  - `review` par `consumptionId` → `applied` avec ce `consumptionId`, la ligne a `verdict = 'right'` et la note ;
  - un second `review` (`'late'`, note `null`) remplace verdict et note ;
  - `consume` puis `review` avec `consumeOpId = consume.opId` **dans le même appel** `applyStockOps` → le second est `applied` et vise la consommation créée ;
  - `consume`, `unconsume`, puis `review` par `consumeOpId` → `rejected` / `not_found` ;
  - `review` d'une consommation du foyer B avec `ctx` du foyer A (par id, puis par `consumeOpId` d'un `consume` du foyer B) → `not_found`, verdict de B inchangé (`null`) ;
  - `consumeOpId` inconnu → `not_found` ;
  - rejouer le même `review` (même `opId`) après un autre verdict renvoie le résultat stocké sans réécrire.
- [ ] **Step 3: Test `getWineDetail`** dans `tests/server/wines.test.ts` : une consommation avec verdict `'early'` apparaît avec `verdict: 'early'`, une sans verdict avec `verdict: null`.
- [ ] **Step 4: Lancer** `npx vitest run tests/server/stock.test.ts tests/server/wines.test.ts` → échecs attendus.
- [ ] **Step 5: Implémenter**
  - type et constante dans `stock-ops.ts` (mettre à jour le commentaire d'en-tête : « types et une constante ») ;
  - colonne dans `schema.ts`, puis `npm run db:generate` (vérifier que le SQL généré ne contient que `ALTER TABLE \`consumptions\` ADD \`verdict\` text;`) ;
  - `parseOp` case `'review'` selon Step 1 ;
  - `function review(db, ctx, op)` : résoudre l'id (si `consumeOpId` : ligne `applied_ops` de ce `opId` **et** de `ctx.householdId`, `JSON.parse(result)`, exiger `status === 'applied'` et `consumptionId`), vérifier l'appartenance de la consommation au foyer par jointure `wines` (comme `unconsume`), puis `update consumptions set verdict, note` ;
  - `applyOne` case `'review'` ;
  - `getWineDetail` : sélectionner `verdict: consumptions.verdict`.
- [ ] **Step 6: Lancer** `npx vitest run` (toute la suite, y compris `schema.test.ts`) → PASS.
- [ ] **Step 7: Commit** `feat(stock): geste review pour le verdict d'une bouteille bue`

### Task 2: Logique client du verdict (pure) et file hors ligne

**Files:**
- Create: `src/lib/verdict.ts`
- Modify: `src/lib/offline/overlay.ts` (commentaire : `review` ne change pas la ligne)
- Modify: `src/lib/offline/pending.svelte.ts` (`handleOutcome` / `afterSync` : un `review` rejeté n'est pas un échec signalé)
- Test: `tests/lib/verdict.test.ts`, `tests/lib/offline-overlay.test.ts`, `tests/lib/stock-client.test.ts`

**Interfaces:**
- Consumes : `Verdict`, `StockOp`, `OpResult` (Task 1) ; `ClientOpResult` de `$lib/stock-client` (type seulement — importer en `import type` pour garder le module sans framework) ; `newOpId` de `$lib/offline/op-id`.
- Produces (`src/lib/verdict.ts`, sans dépendance Svelte ni messages) :
  ```ts
  export type ReviewRef = { consumptionId: number } | { consumeOpId: string };
  /** La cible d'un verdict juste après « Bue » ; null si rien n'a été bu (rejet, erreur). */
  export function reviewRefAfterDrink(op: StockOp, r: ClientOpResult): ReviewRef | null;
  /** Le geste `review` ; la note est coupée de ses espaces, vide → null. */
  export function reviewOp(ref: ReviewRef, verdict: Verdict, note: string): StockOp;
  /** L'historique avec les verdicts en attente (cible consumptionId) déjà appliqués ; le dernier gagne. */
  export function applyPendingReviews<C extends { id: number; verdict: Verdict | null; note: string | null }>(list: C[], ops: StockOp[]): C[];
  ```

- [ ] **Step 1: Tests `tests/lib/verdict.test.ts`**
  - `reviewRefAfterDrink` : `applied` + `consumptionId: 7` → `{ consumptionId: 7 }` ; `queued` → `{ consumeOpId: op.opId }` ; `rejected` → `null` ; `applied` sans `consumptionId` → `null` ;
  - `reviewOp({ consumptionId: 7 }, 'late', '  trop tannique ')` → `kind: 'review'`, `consumptionId: 7`, pas de `consumeOpId`, `note: 'trop tannique'`, `opId` UUID v4 ; note `''` → `null` ; avec `{ consumeOpId }` → `consumeOpId` posé, pas de `consumptionId` ;
  - `applyPendingReviews` : deux `review` sur l'id 7 → le dernier verdict et sa note ; un `review` par `consumeOpId` et un `consume` sont ignorés ; la liste d'entrée n'est pas mutée.
- [ ] **Step 2: Test overlay** (`tests/lib/offline-overlay.test.ts`) : `applyPending(row, [review])` rend une ligne aux mêmes quantités et au même `bottles`.
- [ ] **Step 3: Test file** (`tests/lib/stock-client.test.ts`, sur le modèle du test « opération refusée par le serveur (400) ») : un `review` mis en file hors ligne puis rejeté `not_found` par le serveur lors de `syncPending(1)` → `toast.current` reste `null` (aucun `offline_op_failed`), la file est vide ; et, en contrôle, un `consume` rejeté `not_found` dans les mêmes conditions affiche toujours `offline_op_failed`.
- [ ] **Step 4: Lancer** `npx vitest run tests/lib/verdict.test.ts tests/lib/offline-overlay.test.ts tests/lib/stock-client.test.ts` → échecs attendus.
- [ ] **Step 5: Implémenter** `src/lib/verdict.ts` ; dans `pending.svelte.ts`, relever les `opId` des gestes `review` connus (entrées de `state`) avant `applyResults` et les exclure du calcul de `failed` dans `afterSync` (ils restent comptés dans `changed`).
- [ ] **Step 6: Lancer** `npx vitest run` → PASS.
- [ ] **Step 7: Commit** `feat(verdict): cible et geste review côté client, rejet silencieux`

### Task 3: Fenêtre de verdict, « Bue » et historique

**Files:**
- Create: `src/lib/verdict-sheet.svelte.ts` (état, sur le modèle de `src/lib/toast.svelte.ts`)
- Create: `src/lib/components/VerdictSheet.svelte`
- Modify: `src/routes/+layout.svelte` (monter `<VerdictSheet />` à côté de `<Toast />`, seulement si `data.user`)
- Modify: `src/lib/components/DrinkButton.svelte`
- Modify: `src/routes/app/wines/[id]/+page.svelte` (historique)
- Modify: `messages/fr.json`, `messages/en.json`

**Interfaces:**
- Consumes : `reviewRefAfterDrink`, `reviewOp`, `applyPendingReviews`, `ReviewRef` (Task 2) ; `VERDICTS`, `Verdict` (Task 1) ; `sendStockOps`, `SessionExpiredError` ; `reload`, `pendingOps`.
- Produces (`src/lib/verdict-sheet.svelte.ts`) :
  ```ts
  export type VerdictRequest = { title: string; ref: ReviewRef; verdict: Verdict | null; note: string | null; onclosed?: () => void };
  export const verdictSheet: { current: VerdictRequest | null }; // $state
  export function askVerdict(req: VerdictRequest): void;
  export function closeVerdict(): void; // appelle onclosed une seule fois puis vide current
  ```

Textes (clé : FR / EN) :
- `verdict_question` : « Ouverte au bon moment ? » / « Opened at the right time? »
- `verdict_early` : « Trop tôt » / « Too early »
- `verdict_right` : « À point » / « Just right »
- `verdict_late` : « Trop tard » / « Too late »
- `verdict_note_label` : « Note (facultatif) » / « Note (optional) »
- `verdict_later` : « Plus tard » / « Later »
- `wine_history_verdict_add` : « Donner un verdict » / « Add a verdict »
- `wine_history_verdict_edit` : « Modifier le verdict » / « Change the verdict »

Comportement :
- `VerdictSheet` : `Sheet` ouvert quand `verdictSheet.current` ; titre = `req.title` ; la question ; un champ note (`maxlength="200"`, pré-rempli par `req.note`) ; trois boutons pleine largeur (verdict pré-sélectionné marqué `aria-pressed="true"`) ; « Plus tard » en bouton `ghost`. Un appui sur un verdict : `sendStockOps([reviewOp(ref, verdict, note)])`, puis `closeVerdict()`, puis `reload()` sauf si `queued`. Aucun toast en cas de succès, de mise en file ou de rejet ; `wine_err_network` sur erreur réseau (sauf `SessionExpiredError`). Double appui protégé par un `busy` synchrone, comme `DrinkButton`.
- `DrinkButton` : titre = `` `${wineTitle(row.wine)} ${row.wine.vintage ?? m.wine_nv()}` ``. Si `reviewRefAfterDrink(op, r)` n'est pas `null`, appeler `askVerdict({ title, ref, verdict: null, note: null, onclosed: () => showToast(<même message qu'aujourd'hui>, undo) })` au lieu d'afficher le toast tout de suite (le toast d'une `<dialog>` modale ouverte serait inerte). Rejet et erreur : toast immédiat, sans fenêtre, comme aujourd'hui.
- Historique de la fiche : `const history = $derived(applyPendingReviews(detail.consumptions, pendingOps()))`. Chaque ligne affiche le libellé du verdict après la date s'il existe (`{date} · À point`), la note comme aujourd'hui, et un bouton `ghost` `size="sm"` « Donner un verdict » ou « Modifier le verdict » qui appelle `askVerdict({ title: `${title} ${wine.vintage ?? m.wine_nv()}`, ref: { consumptionId: c.id }, verdict: c.verdict, note: c.note })`.

- [ ] **Step 1: Ajouter les textes FR/EN**, lancer `npx vitest run tests/lib` (régénère paraglide ; le test de complétude des messages doit passer).
- [ ] **Step 2: Implémenter** `verdict-sheet.svelte.ts`, `VerdictSheet.svelte`, le montage dans le layout, `DrinkButton`, l'historique.
- [ ] **Step 3: Vérifier** `npm run check` → 0 erreur, et `npx vitest run` → PASS.
- [ ] **Step 4: Commit** `feat(verdict): fenêtre de verdict après « Bue » et dans l'historique`

### Task 4: Légende des phases

**Files:**
- Create: `src/lib/components/PhaseLegend.svelte`
- Modify: `src/routes/app/+page.svelte` (en-tête : le bouton à côté du `h1`, toujours rendu, même sans puces ni vin)
- Modify: `messages/fr.json`, `messages/en.json`

**Interfaces:**
- Consumes : `HOME_SECTION_ORDER` de `$lib/phase` ; `PhaseBadge` ; `Sheet`.
- Produces : `<PhaseLegend />`, sans props.

Textes (clé : FR / EN) :
- `phase_legend_open` (aria-label du bouton) : « Comprendre les phases » / « What the phases mean »
- `phase_legend_title` : « Les phases » / « The phases »
- `phase_legend_intro` : « Du plus urgent au moins urgent. » / « Most urgent first. »
- `phase_hint_past` : « La fenêtre est dépassée : buvez-le sans attendre. » / « Its window has closed: drink it now. »
- `phase_hint_last_call` : « Son apogée est passée, ou c'est la dernière année de sa fenêtre. » / « Past its peak, or in the last year of its window. »
- `phase_hint_peak` : « Le meilleur moment pour l'ouvrir. » / « The best time to open it. »
- `phase_hint_ready` : « Bon à boire, il peut encore progresser. » / « Good to drink, and it may still improve. »
- `phase_hint_too_young` : « Trop jeune : il s'ouvre à partir de l'année indiquée. » / « Too young: it opens from the year shown. »
- `phase_hint_unknown` : « Pas encore de fenêtre : saisissez-la ou demandez une estimation à l'IA. » / « No window yet: enter one or ask the AI for an estimate. »

Comportement : bouton rond de la taille tactile (`var(--tap)`), icône `Question` de phosphor, `aria-label={m.phase_legend_open()}`. La `Sheet` liste `HOME_SECTION_ORDER` dans cet ordre, une ligne par phase : `PhaseBadge` puis la phrase. Pas de requête réseau.

- [ ] **Step 1: Ajouter les textes**, lancer `npx vitest run tests/lib` (complétude des messages).
- [ ] **Step 2: Implémenter** `PhaseLegend.svelte` et l'intégrer dans l'en-tête (`h1` et bouton sur une ligne, `align-items: center`).
- [ ] **Step 3: Vérifier** `npm run check` → 0 erreur, `npx vitest run` → PASS.
- [ ] **Step 4: Commit** `feat(accueil): légende des phases dans l'ordre d'urgence`
