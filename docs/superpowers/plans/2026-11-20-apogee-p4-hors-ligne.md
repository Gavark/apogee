# Apogée — Plan 4 : réseau intermittent et resynchronisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** À la cave, sans réseau, on peut encore consulter « Quoi ouvrir », la cave et les fiches déjà vues, et noter « Bue », +/− et les déplacements ; tout se resynchronise seul au retour du réseau, sans doublon ni perte.

**Architecture:** Les mouvements de stock passent déjà par `POST /api/stock/ops`, idempotent par `opId` et exprimé en deltas (plan 1). On ajoute côté client une **file d'opérations** dans IndexedDB (`src/lib/offline/`), une surcouche optimiste qui applique les opérations en attente aux quantités affichées, et une boucle de synchronisation déclenchée au retour du réseau, au retour au premier plan, périodiquement et par Background Sync quand le navigateur le permet. Le service worker passe en **network-first** pour les pages de lecture (HTML et `__data.json` de `/app`, `/app/cave`, `/app/wines/[id]`) avec repli sur un cache vidé à la déconnexion.

**Tech Stack:** SvelteKit service worker, IndexedDB (API native, sans bibliothèque d'exécution), `fake-indexeddb` en dépendance de développement pour les tests, Vitest, Playwright pour la vérification hors ligne.

**Spec:** `docs/superpowers/specs/2026-11-19-apogee-design.md` §6.7.

## Global Constraints

- Seuls les mouvements de stock sont possibles hors ligne : `consume` (« Bue »), `adjust` (+/−), `move`, `unconsume` (annulation). Ajout de vin, modification de fiche, lieux, comptes, IA, notifications : **réseau obligatoire**, l'écran le dit et bloque l'envoi.
- Chaque geste garde son `opId` (UUID minuscule) du clic jusqu'au serveur : un renvoi n'a jamais d'effet en plus.
- Lecture : stratégie **network-first** avec repli cache pour `/app`, `/app/cave`, `/app/wines/<id>` et leurs `__data.json` ; bandeau « Hors ligne — données du JJ/MM HH:mm » (heure du dernier chargement en ligne).
- Le cache des pages et la file sont **par utilisateur** : vidés / jamais envoyés sous un autre compte ; la déconnexion vide le cache des pages et prévient s'il reste des gestes non synchronisés.
- Annulation : geste encore en file → retiré de la file ; geste déjà synchronisé → opération inverse (comme aujourd'hui).
- Après synchronisation, un résultat `partial` ou `rejected` est signalé (toast) et les données sont rechargées.
- Réponses serveur : 2xx → résultats appliqués ; 401 → file conservée, retour à la connexion ; 400 → opérations retirées et signalées (elles ne passeront jamais) ; 5xx / réseau / délai → nouvel essai plus tard.
- FR/EN, aucune chaîne en dur ; aucune nouvelle dépendance d'exécution.

## Review Focus

1. **Double appui sur « Bue » hors ligne** puis retour du réseau → une seule consommation. → Task 2.
2. **Deux membres du foyer notent chacun « Bue » hors ligne sur la dernière bouteille** → la première synchronisée passe, la seconde revient `empty_lot` et l'utilisateur en est prévenu. → Task 2.
3. **Annuler un « Bue » fait hors ligne avant la synchronisation** → rien n'est envoyé. → Task 2.
4. **Un autre compte se connecte sur le même téléphone** → il ne voit pas les pages en cache du premier et la file du premier n'est pas envoyée sous son compte. → Task 3.
5. **Réseau qui revient pendant une synchronisation déjà en cours** (événement `online` + Background Sync en même temps) → pas de double envoi concurrent. → Task 2.

---

### Task 1: File d'opérations et surcouche optimiste

**Files:**
- Create: `src/lib/offline/queue.ts`, `src/lib/offline/overlay.ts`
- Modify: `package.json` (+ `fake-indexeddb` en devDependency), `src/lib/server/wines.ts` + `src/routes/app/add/_logic.ts` (alignement de la longueur max de la « précision » à **100**, comme `MAX_POSITION_LEN` de `stock.ts` — point reporté du plan 2)
- Test: `tests/lib/offline-queue.test.ts`, `tests/lib/offline-overlay.test.ts`, test existant d'ajout pour la précision

**Interfaces:**
- `type QueuedOp = { op: StockOp; userId: number; queuedAt: number; attempts: number }` (`StockOp` importé en type depuis `$lib/server/stock`).
- `queue.ts` (base IndexedDB `apogee-offline`, magasin `ops`, clé `op.opId`) :
  `enqueue(userId: number, op: StockOp): Promise<void>`, `listQueued(userId: number): Promise<QueuedOp[]>` (ordre d'arrivée), `removeQueued(opIds: string[]): Promise<void>`, `bumpAttempts(opIds: string[]): Promise<void>`, `countQueued(userId: number): Promise<number>`, `clearQueue(userId?: number): Promise<void>`.
- `overlay.ts` (pur) : `applyPending<T extends { lots: { lotId: number; quantity: number }[]; bottles: number }>(row: T, ops: StockOp[]): T` — `consume` −1 sur le lot (borné à 0), `adjust` delta borné, `move` retire du lot source (le lot cible n'est ajouté que s'il est déjà affiché) ; `bottles` recalculé ; `unconsume` ignoré (la consommation n'est pas affichée sur la ligne) ; ne modifie pas l'objet reçu.

- [ ] **Step 1: Écrire les tests** (avec `import 'fake-indexeddb/auto'`) : enqueue/list/remove dans l'ordre ; deux utilisateurs séparés ; `enqueue` du même `opId` deux fois → une seule entrée ; `clearQueue(userId)` ne touche que lui ; overlay : consume sur lot de 2 → 1, sur lot de 0 → 0, adjust −5 sur 2 → 0, move 1 de A vers B affiché, `bottles` recalculé, objet d'origine intact ; précision de 101 caractères refusée à l'ajout.
- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Commit** — `feat(offline): file d'opérations et surcouche optimiste`

---

### Task 2: Envoi via la file et synchronisation

**Files:**
- Create: `src/lib/offline/sync.ts`, `src/lib/offline/pending.svelte.ts`
- Modify: `src/lib/stock-client.ts`, `src/lib/components/DrinkButton.svelte`, `src/routes/app/wines/[id]/+page.svelte`, `src/routes/app/+page.svelte`, `src/routes/app/cave/+page.svelte`, `src/routes/app/+layout.svelte`, `messages/{fr,en}.json`
- Test: `tests/lib/offline-sync.test.ts`, `tests/lib/stock-client.test.ts`

**Interfaces:**
- `sync.ts` : `syncNow(userId: number, deps?: { fetch?: typeof fetch }): Promise<SyncOutcome>` avec `type SyncOutcome = { sent: number; results: OpResult[]; dropped: StockOp[]; status: 'ok' | 'offline' | 'retry' | 'unauthorized' | 'idle' | 'busy' }` — envoie par lots de 100 dans l'ordre ; garde-fou d'exclusivité (une seule synchronisation à la fois par onglet, et un verrou `navigator.locks.request('apogee-sync', …)` quand disponible pour l'onglet + le service worker) ; 2xx → retire les opérations envoyées ; 400 → les retire et les renvoie dans `dropped` ; 401 → `unauthorized`, rien retiré ; 5xx / réseau → `retry`, `bumpAttempts`.
- `stock-client.ts` : `sendStockOps(ops)` garde sa signature mais : **met d'abord en file**, tente `syncNow` et renvoie les résultats de ces `opId` s'ils ont été obtenus ; s'ils restent en file, renvoie des résultats `{ opId, status: 'queued' }` (nouveau statut client : étendre le type côté client `ClientOpResult = OpResult | { opId: string; status: 'queued' }`).
- `pending.svelte.ts` : état réactif `pendingOps: StockOp[]` de l'utilisateur courant (chargé depuis la file, mis à jour à chaque `enqueue`/`syncNow`) ; `startSyncLoop(userId)` — déclenche `syncNow` sur `online`, `visibilitychange` (visible), toutes les **30 s** tant que la file n'est pas vide, et demande un Background Sync `'apogee-stock-sync'` quand `registration.sync` existe ; après un `syncNow` avec résultats `partial`/`rejected` ou `dropped`, toast d'avertissement (« Plus de bouteille à cet endroit », « Une opération n'a pas pu être appliquée ») puis `invalidateAll()`.
- Pages : les lignes affichées passent par `applyPending(row, pendingOps)` ; « Bue » / ± / déplacer hors ligne → effet immédiat à l'écran + toast « Enregistré, sera synchronisé » ; **Annuler** d'un geste encore en file → `removeQueued([opId])` ; d'un geste synchronisé → opération inverse (règles actuelles). Indicateur discret dans le layout « N gestes en attente » tant que la file n'est pas vide.

- [ ] **Step 1: Écrire les tests** (`fake-indexeddb`, `fetch` simulé) : en ligne → résultats `applied` et file vide ; hors ligne → `queued`, file d'un élément ; double appui (même geste deux fois hors ligne = deux `opId` distincts mais un lot de 1) → au retour, applied puis `rejected empty_lot` signalé ; même `opId` renvoyé deux fois → une seule entrée ; 400 → retiré et `dropped` ; 401 → file conservée ; 500 → `retry` et `attempts` incrémenté ; deux `syncNow` lancés en même temps → un seul `fetch` (l'autre `busy`) ; annulation d'un geste en file → aucun envoi ; ordre des opérations conservé ; plus de 100 opérations → plusieurs lots.
- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter et brancher dans les pages.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Commit** — `feat(offline): gestes de stock en file et resynchronisation`

---

### Task 3: Service worker — lecture hors ligne et Background Sync

**Files:**
- Modify: `src/service-worker/index.ts`, `src/routes/+layout.svelte` (bandeau hors ligne), `src/routes/account/+page.svelte` (déconnexion), `messages/{fr,en}.json`
- Create: `src/lib/offline/page-cache.ts` (règles pures partagées), `src/lib/components/OfflineBanner.svelte`
- Test: `tests/lib/offline-page-cache.test.ts`

**Interfaces:**
- `page-cache.ts` (pur, importable par le service worker) : `isOfflineReadable(url: URL, origin: string): boolean` — vrai pour `GET` same-origin `/app`, `/app/cave`, `/app/wines/<chiffres>` et les mêmes chemins suivis de `/__data.json` (avec ou sans paramètres `x-sveltekit-invalidated`), faux pour tout le reste (API, `/account`, `/admin`, `/app/add`, `/app/locations`, `/app/wines/<id>/edit`, `/app/wines/<id>/photo`) ; `cacheKeyFor(url: URL): string` — chemin + paramètres de filtre de la cave, **sans** `x-sveltekit-invalidated`.
- Service worker : cache dédié `apogee-pages` (indépendant de la version des assets) ; pour une requête `isOfflineReadable` : fetch réseau → si 200, mise en cache sous `cacheKeyFor` puis réponse ; si échec réseau → réponse en cache si présente, sinon laisser échouer (la page d'erreur hors ligne de SvelteKit s'affiche) ; les réponses non 200 et les redirections ne sont jamais mises en cache ; message `{ type: 'clear-page-cache' }` → suppression de `apogee-pages` ; événement `sync` `'apogee-stock-sync'` → `syncNow` pour l'utilisateur dont l'id est mémorisé dans IndexedDB par la page (`setActiveUser(userId)` dans `queue.ts`), en respectant le même verrou que la page.
- Cloisonnement par utilisateur : la page enregistre `setActiveUser(userId)` à chaque chargement authentifié ; si l'id change (autre compte), elle envoie `clear-page-cache` avant tout ; la déconnexion envoie `clear-page-cache` et, s'il reste des gestes en file, affiche « N gestes ne sont pas encore synchronisés : restez connecté et reconnectez-vous au réseau pour les envoyer » avec « Se déconnecter quand même » (qui vide la file de cet utilisateur).
- `OfflineBanner` : affiché quand `navigator.onLine === false` ou quand le dernier chargement de page vient du cache ; texte « Hors ligne — données du {date} » avec la date du dernier chargement **en ligne** mémorisée (`localStorage`, clé par utilisateur).

- [ ] **Step 1: Écrire les tests** de `page-cache.ts` (chaque chemin inclus/exclu, `__data.json` avec et sans `x-sveltekit-invalidated`, origine étrangère exclue, clé sans paramètre d'invalidation, paramètres de filtre de la cave conservés).
- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter SW, bandeau, déconnexion.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`, `npm run build`.
- [ ] **Step 5: Commit** — `feat(offline): lecture hors ligne et synchronisation en arrière-plan`

---

### Task 4: Écrans « réseau requis », documentation, vérification hors ligne

**Files:**
- Modify: `src/routes/app/add/+page.svelte`, `src/routes/app/wines/[id]/edit/+page.svelte`, `src/routes/app/locations/+page.svelte`, `src/routes/account/**/+page.svelte`, `src/routes/admin/+page.svelte` (message + bouton désactivé quand hors ligne, via un petit état partagé `online` dans `src/lib/offline/online.svelte.ts`), `README.md`, `messages/{fr,en}.json`
- Test: `tests/lib/offline-online.test.ts` (état `online` suit les événements)

**Interfaces:**
- `online.svelte.ts` : `export const network = $state({ online: true })` initialisé depuis `navigator.onLine` et mis à jour par `online`/`offline`.
- Écrans réseau requis : bandeau « Cet écran nécessite le réseau » et boutons d'envoi désactivés quand `network.online` est faux ; l'IA d'ajout par photo affiche le même message au lieu de tenter l'envoi.
- README : section « Mode hors ligne » (ce qui marche, ce qui ne marche pas, synchronisation automatique, Background Sync selon les navigateurs, déconnexion).

- [ ] **Step 1: Écrire le test** de `online.svelte.ts`. **Step 2: Lancer** — FAIL. **Step 3: Implémenter + docs.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`, `npm run build`.
- [ ] **Step 5: Vérification navigateur hors ligne** (Playwright Chromium, `npm run build && npm run preview` ou l'image Docker, base jetable) : charger `/app`, `/app/cave` et une fiche ; passer hors ligne (`context.setOffline(true)`) ; recharger `/app` → données en cache + bandeau ; « Bue » deux fois sur un lot de 1 → affichage optimiste, indicateur « 2 gestes en attente » ; annuler un geste → « 1 geste » ; revenir en ligne → synchronisation, base : une seule consommation de plus ; un second compte se connecte → pas de pages en cache du premier. Nettoyer ensuite.
- [ ] **Step 6: Commit** — `feat(offline): écrans réseau requis, documentation`

---

## Vérification finale

- [ ] `npm test`, `npm run check`, `npm run build` ; CI verte.
- [ ] `tasks/todo.md` mis à jour.
