# Ménage des photos orphelines et plafond du cache de pages : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher l'accumulation de photos d'étiquettes inutilisées et borner le cache de pages hors ligne.

**Architecture:** Deux corrections à la source (analyse, suppression d'un vin), un module serveur `photo-sweep.ts` (ménage synchrone + tâche quotidienne branchée dans `hooks.server.ts`), et une éviction du cache de pages écrite dans `page-cache.ts` (logique pure, testée) appelée par le service worker après chaque mise en cache.

**Tech Stack:** SvelteKit 2, TypeScript, better-sqlite3 + Drizzle, Vitest, Cache API (service worker).

**Spec:** `docs/superpowers/specs/2026-11-23-menage-photos-cache-design.md`

## Global Constraints

- Délai de grâce des photos : **7 jours** (`PHOTO_GRACE_MS = 7 * 24 * 3600 * 1000`), sur le mtime du fichier ET sur `label_analyses.created_at` (secondes Unix).
- Ménage : **une fois par jour local, à partir de 14 h** (`SWEEP_HOUR = 14`), fuseau de l'instance (`resolveInstanceTimezone()`), passage toutes les 10 minutes, premier passage 10 minutes après le démarrage.
- Ne regarder que `<dir>/<n>/<uuid>.<ext>` avec `n` numérique et `isSafeRelPath(\`${n}/${name}\`)` vrai, entrées `Dirent.isFile()` seulement (les liens sont ignorés).
- Journaux serveur en anglais, préfixe `[photos]` : `[photos] orphan removed: <rel>`, `[photos] sweep: N removed, M recent kept`, avertissement `[photos] sweep skipped: no wine references a photo`. Une erreur de fichier journalise son code seulement.
- Cache de pages : **`MAX_PAGE_ENTRIES = 120`**, en-tête **`x-apogee-stored-at`** (millisecondes Unix), jamais évincées : les clés de chemin `/app` et `/app/__data.json` **sans paramètres**.
- Ne pas toucher à `src/lib/offline/pending.svelte.ts`, `queue.ts`, `sync.ts`, ni au Background Sync / `online` du service worker (session parallèle `fix/file-gestes`). Dans `src/service-worker/index.ts`, seule la fonction `store()` change.
- Aucun texte affiché : pas de message Paraglide.
- Tests en français dans le style existant (`it('…')`), commandes : `npx vitest run <fichier>`, `npm run check`.

## Review Focus

1. Un fichier référencé par un vin mais vieux de plusieurs mois → jamais supprimé (test Task 2).
2. Base vide / mauvaise base montée avec un dossier photos plein → rien supprimé, avertissement (test Task 2).
3. Une photo récente d'un ajout en cours (fichier < 7 jours, ou analyse < 7 jours avec mtime ancien après restauration) → gardée (tests Task 2).
4. Fichiers étrangers dans `photos/` (`notes.txt`, sous-dossier, nom non-UUID, dossier non numérique) → intouchés (test Task 2).
5. Démarrage hors ligne depuis l'icône après avoir consulté 200 fiches → `/app` toujours en cache (test Task 4).

---

### Task 1: Corrections à la source (analyse et suppression d'un vin)

**Files:**
- Modify: `src/lib/server/label-analyses.ts` (`analyzeAndStore`)
- Modify: `src/lib/server/wines.ts` (`deleteWine`, ~l. 351-368)
- Test: `tests/server/label-analyses.test.ts`

**Interfaces:**
- Consumes: `cleanupQuietly`, `deletePhoto` de `src/lib/server/photos.ts`.
- Produces: rien de nouveau ; comportements ci-dessous.

- [ ] **Step 1: Write the failing tests** (dans `tests/server/label-analyses.test.ts`, réutiliser `input()`, `mkWine()`, `dir`)

```ts
it("si l'enregistrement de l'analyse échoue, la photo écrite est effacée et l'erreur remonte", async () => {
  tdb.sqlite.exec('DROP TABLE label_analyses');
  await expect(analyzeAndStore(tdb.db, ctx, null, input())).rejects.toThrow();
  expect(readdirSync(join(dir, String(hid)))).toEqual([]);
});

it("si l'enregistrement échoue avec la photo existante d'un vin, celle-ci n'est pas effacée", async () => {
  // savePhoto une photo, la rattacher à un vin (mkWine(ctx, 2015, path)), DROP TABLE label_analyses,
  // analyzeAndStore(..., input({ photo: null, existingPhotoPath: path })) rejette, existsSync(join(dir, path)) === true
});

it("deleteWine vide photo_path des analyses qui pointaient vers la photo effacée", () => {
  // une analyse (analyzeAndStore succès avec fakeAi) → createWine avec provenance photoPath ; deleteWine
  // → rows()[0].photoPath === null
});

it("deleteWine garde photo_path des analyses si un autre vin utilise encore la photo", () => {
  // deux vins sur le même chemin, une analyse sur ce chemin ; deleteWine du premier → photoPath inchangé
});
```

- [ ] **Step 2: Run** `npx vitest run tests/server/label-analyses.test.ts` — Expected: les 2 tests « échoue » et « vide photo_path » FAIL.

- [ ] **Step 3: Implement**
  - `analyzeAndStore` : retenir si la photo vient d'être écrite (`savedNew`). Envelopper tout ce qui suit l'écriture (les trois `insertRow` et l'appel IA) dans un `try`; en cas d'exception, si `savedNew`, `cleanupQuietly(() => deletePhoto(input.photosDir, photoPath))`, puis relancer. Ne jamais effacer `existingPhotoPath`.
  - `deleteWine` : dans la transaction, quand la photo n'est plus utilisée par aucun vin, `tx.update(labelAnalyses).set({ photoPath: null }).where(eq(labelAnalyses.photoPath, wine.labelPhoto)).run()` avant de renvoyer le chemin.

- [ ] **Step 4: Run** `npx vitest run tests/server/label-analyses.test.ts tests/server/wines.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `fix(photos): pas de photo orpheline si l'analyse échoue à s'enregistrer, ni de chemin mort après suppression d'un vin`

---

### Task 2: Ménage des photos orphelines (`sweepOrphanPhotos`)

**Files:**
- Create: `src/lib/server/photo-sweep.ts`
- Test: `tests/server/photo-sweep.test.ts`

**Interfaces:**
- Consumes: `isSafeRelPath` (`photos.ts`), `schema.wines.labelPhoto`, `schema.labelAnalyses.{photoPath, createdAt}`.
- Produces:
  ```ts
  export const PHOTO_GRACE_MS: number; // 7 jours
  export type SweepResult = { removed: string[]; keptRecent: number; skipped: 'no_references' | null };
  export function sweepOrphanPhotos(db: DB, dir: string, now: Date): SweepResult;
  ```
  `DB` = `BaseSQLiteDatabase<'sync', unknown, typeof schema>` comme ailleurs. Entièrement synchrone (`readdirSync`, `statSync`, `rmSync`) : aucune requête ne peut s'intercaler.

- [ ] **Step 1: Write the failing tests** — dossier `mkdtempSync`, base `makeTestDb()`, foyer/utilisateur via `tests/helpers/fixtures.ts`. Un helper `put(rel, ageDays)` écrit un fichier et fixe son mtime avec `utimesSync`. `NOW = new Date('2026-11-23T15:00:00Z')`. Cas :

```ts
it('supprime une photo non référencée de plus de 7 jours et la journalise')
  // put('1/<uuid>.jpg', 8) + un vin qui référence une autre photo → removed == ['1/<uuid>.jpg'], fichier absent,
  // console.log appelé avec '[photos] orphan removed: 1/<uuid>.jpg'
it('garde une photo référencée par un vin, quel que soit son âge')            // âge 400 jours
it('garde une photo non référencée de moins de 7 jours')                      // âge 6 → keptRecent 1
it("garde une photo vieille mais citée par une analyse de moins de 7 jours")  // mtime 30 j, analyse created_at = NOW - 1 j
it("remet à NULL photo_path des analyses (anciennes) de la photo supprimée")
it('ignore ce qui ne ressemble pas à une photo stockée')
  // '1/notes.txt', '1/abc.jpg', 'x/<uuid>.jpg', '1/sub/<uuid>.jpg', tous vieux de 30 j → tous encore là, removed []
it("ne supprime rien si aucun vin ne référence de photo alors qu'il y a des fichiers")
  // skipped 'no_references', fichiers présents, console.warn '[photos] sweep skipped: no wine references a photo'
it('dossier photos absent : résultat vide, ne lève pas')
it("supprime aussi les photos d'un dossier de foyer qui n'existe plus")       // '99/<uuid>.jpg', 30 j, un vin ailleurs
```

- [ ] **Step 2: Run** `npx vitest run tests/server/photo-sweep.test.ts` — Expected: FAIL (module absent).

- [ ] **Step 3: Implement `sweepOrphanPhotos`** — références de vins (`select distinct label_photo … is not null`) et chemins d'analyses récentes (`created_at >= nowSec - 7 j`) chargés une fois en `Set`; lister les fichiers candidats; garde-fou `no_references` si des candidats existent et que le `Set` des vins est vide; pour chaque fichier non référencé : récent (mtime ou analyse) → `keptRecent++`, sinon `rmSync`, journal, `update label_analyses set photo_path = null where photo_path = rel`. Erreur sur un fichier : `console.error('[photos] sweep failed on a file:', code)` et on continue. Bilan `[photos] sweep: N removed, M recent kept` seulement si quelque chose a été supprimé ou gardé.

- [ ] **Step 4: Run** `npx vitest run tests/server/photo-sweep.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(photos): ménage des photos orphelines avec délai de grâce de 7 jours`

---

### Task 3: Tâche quotidienne, branchement et documentation

**Files:**
- Modify: `src/lib/server/photo-sweep.ts`
- Modify: `src/hooks.server.ts` (à côté de `notificationTick`)
- Modify: `docs/BACKUP.md` (un paragraphe « Ménage des photos »)
- Test: `tests/server/photo-sweep.test.ts`

**Interfaces:**
- Consumes: `sweepOrphanPhotos`, `zonedParts` et `resolveInstanceTimezone` (`src/lib/server/timezone.ts`), `photosDir()`.
- Produces:
  ```ts
  export const SWEEP_HOUR = 14;
  /** Lance le ménage au premier passage d'un jour local à partir de 14 h ; null sinon. */
  export function runPhotoSweepTick(db: DB, now: Date, dir: string, timeZone: string): SweepResult | null;
  export function resetPhotoSweepTick(): void; // tests uniquement
  ```
  L'état « dernier jour traité » est en mémoire (un redémarrage relance le ménage, sans danger : il est idempotent).

- [ ] **Step 1: Write the failing tests**

```ts
it('ne fait rien avant 14 h locales')             // 2026-11-23T12:59:00Z en Europe/Paris (13:59) → null
it('lance le ménage à 14 h locales, une seule fois par jour') // 13:00Z → résultat ; 13:10Z → null ; lendemain 13:00Z → résultat
it("rattrape l'après-midi si l'appli démarre plus tard")       // 2026-11-23T21:00:00Z → résultat
```

- [ ] **Step 2: Run** `npx vitest run tests/server/photo-sweep.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `runPhotoSweepTick` (date locale `YYYY-MM-DD` via `zonedParts`; met à jour le jour traité avant d'appeler le ménage). Dans `hooks.server.ts` :

```ts
// Daily photo cleanup: from 14:00 local, far from the 03:00 backup and from the one the backup
// container runs at boot (the first pass waits 10 minutes). unref(): never keep the process alive.
const photoSweepTick = () => {
  try {
    runPhotoSweepTick(db, new Date(), photosDir(), resolveInstanceTimezone());
  } catch (e) {
    console.error('[photos] sweep failed:', e instanceof Error ? e.name : 'unknown');
  }
};
setInterval(photoSweepTick, 10 * 60 * 1000).unref();
setTimeout(photoSweepTick, 10 * 60 * 1000).unref();
```

`docs/BACKUP.md` : un court paragraphe — l'appli supprime chaque jour après 14 h les photos qu'aucune fiche n'utilise depuis plus de 7 jours ; elles restent dans les archives nocturnes (30 par défaut) ; les suppressions apparaissent dans `docker logs apogee` (`[photos]`).

- [ ] **Step 4: Run** `npx vitest run tests/server/photo-sweep.test.ts` puis `npm run check` — Expected: PASS, 0 erreur.

- [ ] **Step 5: Commit** `feat(photos): ménage quotidien après 14 h, documenté dans BACKUP.md`

---

### Task 4: Plafond du cache de pages

**Files:**
- Modify: `src/lib/offline/page-cache.ts`
- Modify: `src/service-worker/index.ts` (fonction `store()` seulement)
- Test: `tests/lib/offline-page-cache.test.ts`

**Interfaces:**
- Produces (dans `page-cache.ts`) :
  ```ts
  export const MAX_PAGE_ENTRIES = 120;
  export const STORED_AT_HEADER = 'x-apogee-stored-at';
  /** Les en-têtes donnés plus l'horodatage de mise en cache. */
  export function stampedHeaders(headers: HeadersInit, now: number): Headers;
  /** Les URL à supprimer, les plus anciennes d'abord, pour revenir à `max` ; jamais /app ni /app/__data.json sans paramètres. storedAt null = plus ancien que tout. */
  export function entriesToEvict(entries: { url: string; storedAt: number | null }[], max: number): string[];
  /** Lit les horodatages d'un cache et supprime ce que entriesToEvict désigne. Ne lève jamais. */
  export async function trimPageCache(cache: Pick<Cache, 'keys' | 'match' | 'delete'>, max?: number): Promise<void>;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
describe('entriesToEvict', () => {
  it('rien à supprimer sous le plafond')
  it('supprime les plus anciennes jusqu’au plafond')      // 5 entrées storedAt 1..5, max 3 → [url1, url2]
  it('une entrée sans horodatage passe avant les autres')
  it('ne supprime jamais /app ni /app/__data.json')        // ce sont les plus anciennes → épargnées, les suivantes partent
  it('/app?filtre est évinçable comme les autres')
});
describe('trimPageCache', () => {
  it('lit x-apogee-stored-at et supprime les plus anciennes') // faux cache Map<string, Response>
  it('Review Focus : après 200 fiches consultées, /app et /app/__data.json sont toujours là, 120 entrées au plus')
});
it('stampedHeaders garde les en-têtes et ajoute x-apogee-stored-at')
```

- [ ] **Step 2: Run** `npx vitest run tests/lib/offline-page-cache.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** les trois fonctions (comparer `new URL(url).pathname` et `search === ''` pour les clés protégées). Dans `store()` du service worker : HTML mis en cache sous `new Response(res.body, { status: res.status, statusText: res.statusText, headers: stampedHeaders(res.headers, Date.now()) })` ; données avec `stampedHeaders({ 'content-type': 'application/json' }, Date.now())` ; puis `await trimPageCache(cache)` après chaque `put`. Rien d'autre ne change dans le service worker.

- [ ] **Step 4: Run** `npx vitest run tests/lib/offline-page-cache.test.ts` puis `npm run check` — Expected: PASS, 0 erreur.

- [ ] **Step 5: Commit** `feat(hors-ligne): plafond de 120 entrées pour le cache de pages, /app épargnée`

---

### Task 5: Vérification finale (session principale)

- [ ] `npm run check` et `npx vitest run` : tout passe.
- [ ] Navigateur, serveur de dev sur une base temporaire du scratchpad (`DATABASE_PATH`, `PHOTOS_DIR`, `ADMIN_*`, `ORIGIN`), port 5174 : consulter `/app` et des fiches, couper le réseau, recharger `/app` et `/` → la copie s'affiche ; inspecter `apogee-pages` (en-tête `x-apogee-stored-at`). Ménage : fichier orphelin vieilli dans le `PHOTOS_DIR` temporaire, appel du ménage, journal `[photos] orphan removed`.
- [ ] Revue de la branche entière (sous-agent).
- [ ] Dependabot : `gh api repos/Gavark/apogee/dependabot/alerts --jq '[.[]|select(.state=="open")]|length'` et PR Dependabot ouvertes ; corriger ce qui touche le projet ou le signaler.
- [ ] `git fetch` + rebase sur `origin/main`, re-tests, puis demander avant push et PR.

---

## Bilan (2026-11-23)

- Tâches 1 à 4 faites en TDD, chacune relue ; revue finale de la branche puis une vague de corrections (garde-fou élargi : rien n'est supprimé si aucune photo présente sur le disque n'appartient à un vin).
- Écart au plan : l'éviction se fait **par page** (HTML et `__data.json` ensemble) et `dropCachedHtml`/`refetch` conservent l'horodatage d'origine, sinon chaque déploiement re-datait toutes les pages HTML.
- Vérifié : `npm run check` 0 erreur, vitest 805/805 ; navigateur (build + `node build`, base temporaire) : en-tête `x-apogee-stored-at` présent, 140 entrées ramenées à 120 avec `/app` gardée, démarrage hors ligne depuis `/` et fiches OK ; ménage réel au premier passage : orpheline de 30 jours supprimée et journalisée, photo d'un vin et photo récente gardées, `photo_path` de l'analyse remis à NULL.
- Dependabot : aucune alerte ni PR ouverte.
