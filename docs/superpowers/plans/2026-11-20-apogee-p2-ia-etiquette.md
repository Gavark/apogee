# Apogée — Plan 2 : analyse IA de l'étiquette

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un vin en photographiant son étiquette : l'IA identifie le vin et propose une fenêtre de dégustation, l'utilisateur valide ou corrige ; la fiche montre la photo, la provenance de la fenêtre et permet de ré-estimer.

**Architecture:** Une couche `src/lib/server/ai/` isole le fournisseur derrière une interface unique (`AiProvider.analyzeLabel`) avec deux connecteurs (Anthropic via le SDK officiel, et « compatible OpenAI » via `fetch`). Toute réponse passe par `normalizeAnalysis` (contrat JSON de la spec §6.5, validé côté serveur). Chaque analyse est enregistrée dans une table `label_analyses` (photo, résultat, modèle) : elle sert à la fois de brouillon que le formulaire référence par `analysisId`, de preuve côté serveur de ce que l'IA a proposé (pour décider `windowSource`), et de compteur pour la limite quotidienne. Les photos vivent sur disque dans le volume de données, servies par une route qui vérifie le foyer.

**Tech Stack:** SvelteKit 3 / Svelte 5, SQLite + Drizzle, `@anthropic-ai/sdk` (nouvelle dépendance), Paraglide, Vitest. Pas d'autre dépendance (pas de zod, pas de SDK OpenAI).

**Spec:** `docs/superpowers/specs/2026-11-19-apogee-design.md` (§6.5 surtout ; §6.2 pour les colonnes `ai_*` et `label_photo` déjà présentes ; §6.6 fiche vin).

## Global Constraints

- Contrat de sortie exactement celui de la spec §6.5 (`producer`, `cuvee`, `appellation`, `region`, `country`, `color`, `vintage`, `grapes`, `format_cl`, `window{drink_from,peak_from,peak_to,drink_until}`, `confidence` `low|medium|high`, `rationale` 1–3 phrases dans la langue de l'utilisateur, `is_wine_label`).
- Variables d'environnement : `AI_PROVIDER` (`anthropic|openai-compatible|none`, défaut `none` si `AI_API_KEY` vide, sinon `anthropic`), `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_DAILY_LIMIT_PER_HOUSEHOLD` (défaut **100**), `PHOTOS_DIR` (défaut : dossier `photos` à côté de `DATABASE_PATH`).
- Modèle Anthropic par défaut : **`claude-opus-5-5`**, `output_config.effort: "medium"`, réflexion adaptative implicite (ne pas envoyer `thinking`). *Écart assumé avec la spec, qui proposait « le Sonnet le plus récent » : c'était un choix de Claude, pas de l'utilisateur ; Opus 5.5 lit mieux les étiquettes et connaît mieux les vins, pour ~2–3 centimes par photo. `AI_MODEL` permet de changer.*
- Fallback de refus activé par défaut sur Anthropic : `client.beta.messages.create` avec `betas: ["server-side-fallback-2026-07-01"]` et `fallbacks: "default"`. Toujours vérifier `stop_reason` avant de lire le contenu (`refusal` → erreur `refused`).
- Sortie structurée Anthropic : `output_config.format = { type: "json_schema", schema: LABEL_JSON_SCHEMA }` ; le JSON est quand même re-validé par `normalizeAnalysis` (même chemin pour les deux connecteurs).
- La clé n'est jamais envoyée au client, jamais journalisée (pas de `console.log` de la config ni des en-têtes ; les erreurs journalisées sont réduites à un code et un statut HTTP).
- Sans IA configurée ou en cas d'échec, la saisie manuelle fonctionne toujours et la photo est conservée.
- Photos : JPEG, PNG ou WebP uniquement (vérifiés par les octets magiques, pas par le nom), ≤ **5 Mo** après redimensionnement client ; redimensionnement navigateur à **1600 px** de grand côté, JPEG qualité **0,8**.
- Isolation des foyers : une analyse, une photo ou un vin d'un autre foyer se comporte comme inexistant (404 / `not_found`).
- FR (par défaut) et EN, aucune chaîne visible en dur ; design via les composants existants de `src/lib/components/`.
- Les tests n'appellent jamais le réseau : clients/`fetch` injectés.

## Review Focus

1. **Photo qui n'est pas une étiquette de vin** (`is_wine_label=false`) → message « Ce n'est pas une étiquette de vin », formulaire manuel, aucune fenêtre pré-remplie. → Task 1 et Task 5.
2. **Réponse IA incohérente** (années dans le désordre, fenêtre avant le millésime, millésime futur, couleur inconnue, format exotique, texte de 5 000 caractères, champs manquants, JSON invalide) → champs fautifs laissés vides / bornés, jamais d'exception jusqu'à l'utilisateur. → Task 1.
3. **Fournisseur en panne ou clé invalide** (401, 429, 500, timeout, refus) → l'utilisateur voit « Analyse impossible » et continue à la main ; la limite quotidienne n'est pas consommée par un échec réseau. → Task 2 et Task 3.
4. **L'utilisateur corrige la fenêtre proposée** → `windowSource = 'manual'` ; s'il ne la touche pas → `'ai'` avec confiance/justification/modèle. Une modification ultérieure de la fiche qui ne change pas la fenêtre ne fait pas basculer la provenance. → Task 5.
5. **Photo d'un autre foyer ou `analysisId` deviné** → 404, rien n'est attaché. Suppression d'un vin → sa photo est supprimée du disque. → Task 3 et Task 5.

---

## Structure des fichiers

```
src/lib/server/ai/
  types.ts            # LabelAnalysis, AnalyzeInput, AiProvider, AiError
  contract.ts         # LABEL_JSON_SCHEMA + normalizeAnalysis()
  prompt.ts           # buildLabelPrompt()
  config.ts           # readAiConfig(), getAiProvider()
  anthropic.ts        # createAnthropicProvider()
  openai-compatible.ts# createOpenAiCompatibleProvider()
src/lib/server/photos.ts          # stockage disque des photos
src/lib/server/label-analyses.ts  # analyse + enregistrement + limite quotidienne
src/lib/image-resize.ts           # redimensionnement navigateur
src/routes/api/label/analyze/+server.ts
src/routes/app/wines/[id]/photo/+server.ts
src/lib/components/LabelCapture.svelte
```

Toujours le type `type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>` dans les modules serveur.

---

### Task 1: Contrat IA, normalisation et prompt

**Files:**
- Create: `src/lib/server/ai/types.ts`, `src/lib/server/ai/contract.ts`, `src/lib/server/ai/prompt.ts`
- Test: `tests/server/ai-contract.test.ts`, `tests/server/ai-prompt.test.ts`

**Interfaces:**
- Consumes: `validateWindow`, `WindowYears` (`$lib/phase`), `WINE_FORMATS_CL`, `MIN_VINTAGE`, `MAX_TEXT_LEN`, `type Color` (`$lib/server/wines`).
- Produces:
  ```ts
  // types.ts
  export type AiConfidence = 'low' | 'medium' | 'high';
  export type LabelAnalysis = {
    isWineLabel: boolean;
    producer: string | null; cuvee: string | null; appellation: string | null;
    region: string | null; country: string | null; color: Color | null;
    vintage: number | null; grapes: string | null; formatCl: number | null;
    window: WindowYears;                 // tout à null si invalide ou si !isWineLabel
    confidence: AiConfidence | null;
    rationale: string | null;            // ≤ 600 caractères
  };
  export type LabelHints = { producer?: string | null; cuvee?: string | null; appellation?: string | null;
    color?: Color | null; vintage?: number | null; formatCl?: number | null; acquiredYear?: number | null };
  export type AnalyzeInput = { image: { data: Uint8Array; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' } | null;
    hints: LabelHints | null; locale: 'fr' | 'en'; currentYear: number };
  export type AiErrorCode = 'not_configured' | 'auth' | 'rate_limited' | 'refused' | 'invalid_response' | 'unavailable';
  export class AiError extends Error { constructor(public code: AiErrorCode, public status?: number) }
  export interface AiProvider { readonly name: string; readonly model: string;
    analyzeLabel(input: AnalyzeInput): Promise<LabelAnalysis> }  // lève AiError
  // contract.ts
  export const LABEL_JSON_SCHEMA: Record<string, unknown>;      // JSON Schema du contrat §6.5, additionalProperties:false, tous les champs required (null autorisé)
  export function normalizeAnalysis(raw: unknown, opts: { currentYear: number; acquiredYear: number | null }): LabelAnalysis; // lève AiError('invalid_response') seulement si raw n'est pas un objet
  // prompt.ts
  export function buildLabelPrompt(input: Pick<AnalyzeInput, 'hints' | 'locale' | 'currentYear'> & { hasImage: boolean }): { system: string; user: string };
  ```

Règles de `normalizeAnalysis` (mapping snake_case → camelCase) :
- Textes : `trim`, vide → `null`, coupés à `MAX_TEXT_LEN` (200) ; `rationale` coupé à 600.
- `color` hors des 6 valeurs → `null`. `format_cl` hors `WINE_FORMATS_CL` → `null`. `vintage` entier entre `MIN_VINTAGE` et `currentYear`, sinon `null`.
- Années de fenêtre : entiers entre 1900 et `currentYear + 80`, sinon `null` ; puis `validateWindow(window, vintage ?? acquiredYear)` — si erreur, **toute** la fenêtre passe à `null` (spec : « la fenêtre est laissée vide »).
- `is_wine_label` absent → `true` ; `false` → fenêtre et identité à `null`, `confidence`/`rationale` gardés.
- `confidence` hors `low|medium|high` → `null`.

Règles de `buildLabelPrompt` : le système décrit le rôle (sommelier qui lit une étiquette et estime une fenêtre de dégustation réaliste pour une cave de particulier), exige des années absolues, l'honnêteté sur l'incertitude (`confidence: low` plutôt qu'inventer), `rationale` en français si `locale='fr'`, en anglais sinon ; l'utilisateur rappelle l'année courante, les indices connus (`hints`) et, pour un non-millésimé, « année d'entrée en cave : N, raisonne à partir de cette année ». Sans image (`hasImage=false`) : « estime à partir de ces informations ». Le texte du prompt reste stable d'un appel à l'autre (pas d'horodatage hors de la ligne d'année).

- [ ] **Step 1: Écrire les tests**

```ts
// ai-contract.test.ts
const Y = 2026;
it('mappe un JSON valide', () => {
  const a = normalizeAnalysis({ producer: 'Domaine Santa Duc', cuvee: null, appellation: 'Gigondas', region: 'Rhône',
    country: 'France', color: 'red', vintage: 2018, grapes: 'Grenache, Syrah', format_cl: 75,
    window: { drink_from: 2022, peak_from: 2025, peak_to: 2030, drink_until: 2034 },
    confidence: 'high', rationale: 'Gigondas de bon millésime.', is_wine_label: true }, { currentYear: Y, acquiredYear: null });
  expect(a).toMatchObject({ producer: 'Domaine Santa Duc', color: 'red', vintage: 2018, formatCl: 75,
    window: { drinkFrom: 2022, peakFrom: 2025, peakTo: 2030, drinkUntil: 2034 }, confidence: 'high', isWineLabel: true });
});
it('fenêtre dans le désordre → fenêtre entièrement vide', …)        // peak_from 2031 > peak_to 2030
it('fenêtre avant le millésime → vide ; NV : référence = acquiredYear', …)
it('millésime futur, couleur inconnue, format 70 cl → null', …)     // vintage 2031, color 'orange', format_cl 70
it('textes bornés : 500 caractères → 200 ; rationale 5000 → 600', …)
it('is_wine_label false → identité et fenêtre nulles', …)
it('champs manquants → null, pas d\'exception', () => expect(normalizeAnalysis({}, {currentYear: Y, acquiredYear: null}).window.drinkFrom).toBeNull());
it('raw non objet → AiError invalid_response', () => expect(() => normalizeAnalysis('oops', …)).toThrow(AiError));
it('LABEL_JSON_SCHEMA liste tous les champs du contrat en required, additionalProperties false', …)
// ai-prompt.test.ts
it('rationale demandée en français / en anglais selon la locale', …)
it('NV : l\'année d\'entrée en cave est donnée comme référence', …)
it('sans image : demande une estimation à partir des indices', …)
it('le prompt système ne contient aucune date variable', () => expect(buildLabelPrompt({...,currentYear: 2026}).system).not.toMatch(/2026/));
```

- [ ] **Step 2: `npx vitest run tests/server/ai-contract.test.ts tests/server/ai-prompt.test.ts`** — FAIL (modules absents).
- [ ] **Step 3: Implémenter les trois fichiers.**
- [ ] **Step 4: Relancer** — PASS. `npm run check` — 0 erreur.
- [ ] **Step 5: Commit** — `feat(ai): contrat d'analyse d'étiquette, normalisation, prompt`

---

### Task 2: Connecteurs et configuration

**Files:**
- Create: `src/lib/server/ai/config.ts`, `src/lib/server/ai/anthropic.ts`, `src/lib/server/ai/openai-compatible.ts`
- Modify: `package.json` (+ `@anthropic-ai/sdk`, dernière version publiée, dans `dependencies`)
- Test: `tests/server/ai-config.test.ts`, `tests/server/ai-anthropic.test.ts`, `tests/server/ai-openai-compatible.test.ts`

**Interfaces:**
- Consumes: Task 1 (`AiProvider`, `AnalyzeInput`, `AiError`, `LABEL_JSON_SCHEMA`, `normalizeAnalysis`, `buildLabelPrompt`).
- Produces:
  ```ts
  // config.ts
  export type AiConfig =
    | { provider: 'none' }
    | { provider: 'anthropic'; apiKey: string; model: string }
    | { provider: 'openai-compatible'; apiKey: string | null; model: string; baseUrl: string };
  export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';
  export function readAiConfig(env: Record<string, string | undefined>): AiConfig;
  export function aiDailyLimit(env: Record<string, string | undefined>): number;   // défaut 100, entier ≥ 0 (0 = illimité)
  export function getAiProvider(): AiProvider | null;   // singleton depuis process.env ; null si 'none'
  export function describeAiConfig(cfg: AiConfig): { provider: string; model: string | null; baseUrl: string | null; configured: boolean }; // jamais la clé
  // anthropic.ts
  export function createAnthropicProvider(opts: { apiKey: string; model: string; client?: Pick<Anthropic, 'beta'> }): AiProvider;
  // openai-compatible.ts
  export function createOpenAiCompatibleProvider(opts: { apiKey: string | null; model: string; baseUrl: string; fetch?: typeof fetch }): AiProvider;
  ```

Règles :
- `readAiConfig` : `AI_PROVIDER` explicite prime ; sinon `anthropic` si `AI_API_KEY` non vide, sinon `none`. `anthropic` sans clé → `none`. `openai-compatible` exige `AI_BASE_URL` (http/https) et `AI_MODEL`, sinon `none` (et un avertissement unique en console **sans** valeur de variable). Le `/` final de `AI_BASE_URL` est retiré.
- **Anthropic** (`new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 })`) : un seul appel `client.beta.messages.create` avec `model`, `max_tokens: 4096`, `betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`, `output_config: { effort: 'medium', format: { type: 'json_schema', schema: LABEL_JSON_SCHEMA } }`, `system` = prompt système, un message `user` avec le bloc `image` base64 (si image) **avant** le bloc texte. `stop_reason === 'refusal'` → `AiError('refused')` ; `max_tokens` → `invalid_response` ; sinon concaténer les blocs `text`, `JSON.parse` (échec → `invalid_response`), `normalizeAnalysis`. Erreurs SDK → codes : `AuthenticationError`/`PermissionDeniedError` → `auth`, `RateLimitError` → `rate_limited`, autres `APIError` et `APIConnectionError` → `unavailable`, avec `status`. Ne jamais propager le message brut de l'erreur (il peut contenir des en-têtes).
- **Compatible OpenAI** : `POST {baseUrl}/chat/completions`, en-tête `Authorization: Bearer <clé>` seulement si clé, corps `{ model, temperature: 0, response_format: { type: 'json_object' }, messages: [system, user] }`, contenu utilisateur en tableau `[{type:'image_url', image_url:{url:'data:<mime>;base64,…'}}, {type:'text', text}]` ; le prompt utilisateur se termine par le JSON Schema attendu (les serveurs compatibles ne gèrent pas tous `json_schema`). Timeout 60 s via `AbortSignal.timeout`. HTTP 401/403 → `auth`, 429 → `rate_limited`, autres ≥ 400 / réseau / timeout → `unavailable` ; `choices[0].message.content` absent ou non-JSON → `invalid_response`.
- `provider.name` : `'anthropic'` / `'openai-compatible'` ; `provider.model` : le modèle configuré.

- [ ] **Step 1: Écrire les tests** (client et `fetch` simulés ; enregistrer les arguments reçus)

```ts
// ai-config.test.ts
it('clé seule → anthropic avec claude-opus-5-5', () => expect(readAiConfig({ AI_API_KEY: 'k' })).toEqual({ provider: 'anthropic', apiKey: 'k', model: 'claude-opus-5-5' }));
it('rien → none ; AI_PROVIDER=none l\'emporte sur une clé', …)
it('openai-compatible sans AI_BASE_URL ou sans AI_MODEL → none', …)
it('baseUrl : / final retiré ; schéma non http(s) refusé', …)
it('aiDailyLimit : défaut 100, "0" → 0, "abc" → 100', …)
it('describeAiConfig ne contient jamais la clé', () => expect(JSON.stringify(describeAiConfig(readAiConfig({ AI_API_KEY: 'sk-secret' })))).not.toContain('sk-secret'));
// ai-anthropic.test.ts
it('envoie modèle, fallbacks default, beta, effort medium, json_schema, image avant texte', …) // assertions sur l'argument du faux client
it('n\'envoie pas de paramètre thinking', …)
it('stop_reason refusal → AiError refused', …)
it('texte non JSON → invalid_response', …)
it('AuthenticationError → auth ; RateLimitError → rate_limited ; APIConnectionError → unavailable', …) // instances des classes du SDK
it('le message d\'erreur levé ne contient pas la clé', …)
it('sans image : un seul bloc texte', …)
// ai-openai-compatible.test.ts
it('POST {baseUrl}/chat/completions avec data URL, response_format json_object, Bearer', …)
it('pas de clé → pas d\'en-tête Authorization', …)
it('401 → auth, 429 → rate_limited, 500 → unavailable, réseau → unavailable', …)
it('content non JSON → invalid_response ; JSON valide → normalizeAnalysis appliqué', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: `npm install @anthropic-ai/sdk` puis implémenter.** **Step 4: Lancer** — PASS ; `npm test` et `npm run check` OK.
- [ ] **Step 5: Commit** — `feat(ai): connecteurs Anthropic et compatible OpenAI, configuration`

---

### Task 3: Photos, analyses enregistrées et limite quotidienne

**Files:**
- Create: `src/lib/server/photos.ts`, `src/lib/server/label-analyses.ts`, `src/routes/app/wines/[id]/photo/+server.ts`
- Modify: `src/lib/server/db/schema.ts` (+ table `labelAnalyses`, migration générée), `src/lib/server/wines.ts` (`deleteWine` supprime la photo), `src/lib/server/households.ts` (`deleteHouseholdAsAdmin` supprime le dossier photos du foyer)
- Test: `tests/server/photos.test.ts`, `tests/server/label-analyses.test.ts`, `tests/helpers/fake-ai.ts`

**Interfaces:**
- Consumes: Task 1–2 (`AiProvider`, `AnalyzeInput`, `LabelAnalysis`, `AiError`), `HouseholdCtx`, `NotFoundError`, `findOwnedWine` pattern de `wines.ts`.
- Produces:
  - Table `labelAnalyses` : `id`, `householdId` (FK cascade), `userId` (FK set null), `photoPath` (texte null), `result` (texte JSON null — la `LabelAnalysis` normalisée), `errorCode` (texte null), `model` (texte null), `createdAt` ; index `(householdId, createdAt)`.
  - `photos.ts` :
    ```ts
    export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
    export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';
    export function photosDir(): string;                                   // PHOTOS_DIR ?? join(dirname(DATABASE_PATH ?? './data/apogee.sqlite'), 'photos')
    export function sniffImage(bytes: Uint8Array): PhotoMime | null;       // octets magiques
    export function savePhoto(dir: string, householdId: number, bytes: Uint8Array): { path: string; mime: PhotoMime }; // path relatif "<householdId>/<uuid>.<ext>" ; lève RangeError si trop gros ou type inconnu
    export function readPhoto(dir: string, relPath: string): { bytes: Buffer; mime: PhotoMime } | null;
    export function deletePhoto(dir: string, relPath: string | null): void;  // silencieux si absent
    export function deleteHouseholdPhotos(dir: string, householdId: number): void;
    export function isSafeRelPath(relPath: string): boolean;               // /^\d+\/[0-9a-f-]{36}\.(jpg|png|webp)$/
    ```
  - `label-analyses.ts` :
    ```ts
    export type AnalysisOutcome =
      | { ok: true; analysisId: number; analysis: LabelAnalysis; model: string }
      | { ok: false; analysisId: number | null; error: AiErrorCode | 'limit_reached' | 'invalid_photo' };
    export function countAnalysesToday(db: DB, householdId: number, timeZone: string, now?: Date): number; // analyses réussies (result non nul) du jour local
    export async function analyzeAndStore(db: DB, ctx: HouseholdCtx, provider: AiProvider | null,
      input: { photo: Uint8Array | null; existingPhotoPath?: string | null; hints: LabelHints | null; locale: 'fr' | 'en';
               currentYear: number; timeZone: string; dailyLimit: number; photosDir: string }): Promise<AnalysisOutcome>;
    export function getOwnedAnalysis(db: DB, ctx: HouseholdCtx, analysisId: number): { id: number; photoPath: string | null; analysis: LabelAnalysis | null; model: string | null };  // NotFoundError sinon
    ```

Règles de `analyzeAndStore` :
1. Photo fournie : `savePhoto` (erreur → `invalid_photo`, rien enregistré).
2. `provider === null` → enregistre la ligne (photo, `errorCode: 'not_configured'`) et renvoie `{ ok:false, analysisId, error:'not_configured' }` : la photo reste attachable au vin.
3. `dailyLimit > 0` et `countAnalysesToday ≥ dailyLimit` → `limit_reached` (ligne enregistrée avec la photo, sans appel).
4. Appel `provider.analyzeLabel` ; succès → `result` + `model` enregistrés ; `AiError` → `errorCode` enregistré, photo gardée. Les échecs ne comptent pas dans la limite.
5. `existingPhotoPath` (ré-estimation depuis la fiche) : relit la photo pour l'envoyer, ne la recopie pas.

Route `GET /app/wines/[id]/photo` : `requireCtx`, `parseRouteId`, vin du foyer avec `labelPhoto` non nul et `isSafeRelPath`, sinon 404 ; réponse avec le bon `Content-Type`, `Cache-Control: private, max-age=86400`, `X-Content-Type-Options: nosniff`.

`tests/helpers/fake-ai.ts` : `fakeProvider(result: LabelAnalysis | AiError): AiProvider & { calls: AnalyzeInput[] }` et `sampleAnalysis(overrides?)`, réutilisés par les tâches suivantes. Les tests photo utilisent un dossier temporaire (`mkdtempSync(join(os.tmpdir(), 'apogee-photos-'))`) nettoyé en `afterEach`.

- [ ] **Step 1: Écrire les tests**

```ts
// photos.test.ts
it('sniffImage reconnaît JPEG/PNG/WebP, refuse un GIF et un texte', …)
it('savePhoto écrit <hid>/<uuid>.jpg et refuse > 5 Mo ou type inconnu', …)
it('isSafeRelPath refuse "../1/x.jpg", "1/../../etc", un chemin absolu', …)
it('deletePhoto et deleteHouseholdPhotos suppriment ; absent → pas d\'erreur', …)
// label-analyses.test.ts
it('succès : ligne avec result + model, photo sur disque, provider appelé avec l\'image', …)
it('provider null → not_configured, photo conservée, analysisId utilisable', …)
it('limite atteinte → limit_reached sans appel au provider ; les échecs ne comptent pas', …)
it('AiError unavailable → ok:false error unavailable, ligne enregistrée', …)
it('countAnalysesToday suit le fuseau (23h30 UTC le 31/12 = lendemain à Paris)', …)
it('getOwnedAnalysis d\'un autre foyer → NotFoundError', …)
it('deleteWine supprime la photo du disque ; deleteHouseholdAsAdmin supprime le dossier du foyer', …)
it('route photo : 200 avec le bon type pour le foyer, 404 pour un autre foyer, 404 sans photo', …) // via une fonction testable loadWinePhoto(db, ctx, id, dir)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Schéma + `npm run db:generate`, puis implémenter.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Commit** — `feat: stockage des photos, analyses d'étiquette enregistrées, limite quotidienne`

---

### Task 4: API d'analyse et redimensionnement côté navigateur

**Files:**
- Create: `src/routes/api/label/analyze/+server.ts`, `src/routes/api/label/analyze/_logic.ts`, `src/lib/image-resize.ts`, `src/lib/label-client.ts`
- Modify: `Dockerfile` (`ENV BODY_SIZE_LIMIT=8M`), `docker-compose.yml` (+ `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_DAILY_LIMIT_PER_HOUSEHOLD`, tous `${VAR:-}`), `.env.example` (mêmes variables, vides), `tests/server/compose.test.ts`
- Test: `tests/server/label-api.test.ts`, `tests/lib/image-resize.test.ts`

**Interfaces:**
- Consumes: `analyzeAndStore`, `getAiProvider`, `aiDailyLimit`, `photosDir`, `currentYear`, `toPublicUser`/`locals.user` (timezone, locale).
- Produces:
  - `POST /api/label/analyze` — `multipart/form-data` : `photo` (fichier, optionnel), `hints` (JSON `LabelHints`, optionnel), `wineId` (optionnel : ré-estimation d'un vin existant, dont la photo et l'identité servent alors d'entrée). Réponses JSON : `401` sans session ; `400 { error: 'invalid_request' }` (ni photo ni hints ni wineId, `hints` non JSON) ; `404` vin d'un autre foyer ; `413 { error: 'invalid_photo' }` ; sinon `200` avec `AnalysisOutcome` (même en échec IA : l'interface décide).
  - `_logic.ts` : `handleAnalyze(db, ctx, provider, form: FormData, env: { timeZone; locale; currentYear; dailyLimit; photosDir }): Promise<{ status: number; body: unknown }>` (testable sans `getDb`).
  - `image-resize.ts` : `fitWithin(width: number, height: number, max = 1600): { width: number; height: number }` (pur, testé) et `resizeImage(file: File, max = 1600, quality = 0.8): Promise<Blob>` (canvas / `createImageBitmap` avec `imageOrientation: 'from-image'`, sortie `image/jpeg` ; si le navigateur échoue, renvoie le fichier d'origine).
  - `label-client.ts` : `analyzeLabel(args: { photo?: Blob; hints?: LabelHints; wineId?: number }): Promise<AnalysisOutcome>` ; 401 → `goto('/login')` comme `stock-client.ts`.

- [ ] **Step 1: Écrire les tests**

```ts
// label-api.test.ts (handleAnalyze avec fakeProvider et dossier temporaire)
it('photo JPEG → 200 ok:true avec analysisId', …)
it('rien de fourni → 400 invalid_request ; hints non JSON → 400', …)
it('fichier texte renommé .jpg → 413 invalid_photo', …)
it('wineId d\'un autre foyer → 404', …)
it('wineId sans photo → hints construits depuis la fiche, provider appelé sans image', …)
it('provider null → 200 ok:false not_configured', …)
it('POST sans session → 401 JSON', …)              // via le handler exporté avec locals.user null
// image-resize.test.ts
it('fitWithin : 4000×3000 → 1600×1200 ; 3000×4000 → 1200×1600 ; 800×600 inchangé', …)
// compose.test.ts : AI_* transmises, BODY_SIZE_LIMIT dans le Dockerfile
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Commit** — `feat: API d'analyse d'étiquette, redimensionnement des photos`

---

### Task 5: Ajouter un vin par la photo

**Files:**
- Create: `src/lib/components/LabelCapture.svelte`
- Modify: `src/routes/app/add/+page.svelte`, `src/routes/app/add/+page.server.ts`, `src/routes/app/add/_logic.ts`, `src/lib/components/WineForm.svelte`, `src/lib/server/wines.ts` (`createWine` accepte la provenance IA ; `updateWine` ne bascule en `manual` que si la fenêtre change), `messages/fr.json`, `messages/en.json`
- Test: `tests/server/add-logic.test.ts`, `tests/server/wines.test.ts`

**Interfaces:**
- Consumes: Task 3 (`getOwnedAnalysis`), Task 4 (`analyzeLabel`, `resizeImage`), `submitAddWine`, `createWine`, `addStock`, `updateWine`.
- Produces:
  - `wines.ts` : `export type AiProvenance = { analysisId: number; photoPath: string | null; window: WindowYears | null; confidence: AiConfidence | null; rationale: string | null; model: string | null }` ; `createWine(db, ctx, input, lot, provenance?: AiProvenance | null)` — `windowSource = 'ai'` **si** `provenance.window` est non nul et égal champ à champ à `input.window`, sinon `'manual'` ; `aiConfidence/aiRationale/aiModel/aiAnalyzedAt` remplis seulement si `'ai'` ; `labelPhoto = provenance.photoPath` dans tous les cas. `updateWine` : si la fenêtre soumise est identique à celle en base, `windowSource` et les champs `ai_*` sont conservés ; sinon `manual` et `ai_*` remis à `null` (la photo reste).
  - `submitAddWine(db, ctx, form, year)` lit `analysisId` (optionnel) → `getOwnedAnalysis` (étranger → erreur champ `analysisId`/`invalid`, rien créé) → passe la provenance à `createWine`. En `add-stock` (doublon), la photo est attachée au vin existant seulement s'il n'en a pas.
  - `WineForm` : prop `initial?: Partial<WineInput>` pour pré-remplir, et prop `aiWindow?: WindowYears | null` qui affiche sous la fenêtre un rappel « Proposé par l'IA (confiance …) » + la justification.
  - `LabelCapture.svelte` : `<input type="file" accept="image/*" capture="environment">` stylé en gros bouton « Photographier l'étiquette », lien secondaire « Choisir une photo » (sans `capture`) et « Saisir sans photo » ; état « Analyse en cours… » ; émet `onresult(outcome: AnalysisOutcome, preview: string)` (URL d'objet pour l'aperçu).

Parcours `/app/add` (spec §6.5, plan 1 Task 10 pour le reste) :
1. Écran initial = `LabelCapture` (si `AI_PROVIDER` vaut `none`, l'écran initial reste le formulaire manuel, avec le bouton photo pour joindre une photo sans analyse).
2. Résultat `ok:true` → formulaire pré-rempli, aperçu de la photo, rappel IA ; `is_wine_label=false` → message `add_ai_not_label` et formulaire vide (photo jointe quand même) ; `ok:false` → message selon le code (`add_ai_error_unavailable`, `…_limit`, `…_not_configured`, `…_refused`, `…_auth` → « Analyse indisponible, saisissez le vin »), formulaire manuel avec la photo jointe.
3. Champ caché `analysisId`. Doublon / « Ajouter une autre » : inchangé ; « Ajouter une autre » rouvre la capture photo.

- [ ] **Step 1: Écrire les tests**

```ts
// wines.test.ts
it('createWine avec provenance et fenêtre identique → windowSource ai + confiance/justification/modèle', …)
it('createWine avec fenêtre corrigée → manual, ai_* nuls, photo attachée', …)
it('updateWine sans changer la fenêtre garde ai ; en la changeant → manual et ai_* nuls', …)
// add-logic.test.ts
it('submitAddWine avec analysisId du foyer → vin créé, photo et provenance', …)
it('analysisId d\'un autre foyer → erreur analysisId, aucun vin', …)
it('doublon + add-stock : photo attachée au vin existant s\'il n\'en a pas, sinon conservée', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter serveur puis interface.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Vérification navigateur (375 px, clair et sombre)** avec un faux fournisseur : lancer le dev server avec `AI_PROVIDER=openai-compatible`, `AI_BASE_URL` pointant sur un petit serveur local de test (script non commité sous le dossier de travail, qui renvoie une réponse fixe), et une image d'étiquette quelconque : parcours photo → formulaire pré-rempli → enregistrement ; vérifier en base `window_source='ai'`, puis refaire en corrigeant une année → `manual`. Cas « pas une étiquette » et « erreur 500 » avec le même faux serveur.
- [ ] **Step 6: Commit** — `feat: ajout d'un vin par photo de l'étiquette`

---

### Task 6: Fiche vin — photo, provenance, ré-estimation

**Files:**
- Modify: `src/routes/app/wines/[id]/+page.svelte`, `src/routes/app/wines/[id]/+page.server.ts`, `src/routes/app/+page.svelte` (section « À estimer » : bouton « Estimer avec l'IA »), `src/lib/server/wines.ts`, `messages/*.json`
- Test: `tests/server/wines.test.ts`

**Interfaces:**
- Consumes: `analyzeLabel` (client, avec `wineId`), `getOwnedAnalysis`, `updateWine`.
- Produces:
  - `applyAiWindow(db, ctx, wineId: number, analysisId: number): void` dans `wines.ts` — l'analyse et le vin doivent être du foyer (sinon `NotFoundError`), l'analyse doit avoir une fenêtre non nulle (sinon `RangeError`) ; écrit la fenêtre, `windowSource='ai'`, `ai_*` ; ne touche pas à l'identité.
  - Action `?/applyAi` sur `/app/wines/[id]` (champ `analysisId`).

Fiche (spec §6.6) :
- Photo en tête si `labelPhoto` (via `/app/wines/[id]/photo`, `loading="lazy"`, `alt` = nom du vin) ; touche → plein écran dans un `Sheet`.
- Provenance : `windowSource='ai'` → « Estimée par l'IA · confiance {low|medium|high} » + justification repliable + modèle en petit ; `manual` → « Saisie manuelle ».
- Bouton « Ré-estimer avec l'IA » (masqué si IA non configurée) → appel avec `wineId` → `Sheet` qui compare la fenêtre actuelle et la proposée (deux `WindowTimeline`) + justification → « Appliquer » (`?/applyAi`) ou « Garder l'actuelle ». Erreurs : mêmes messages que Task 5.
- « Quoi ouvrir », section `unknown` : bouton « Estimer avec l'IA » par vin → même `Sheet` (composant partagé `AiEstimateSheet.svelte` à créer dans `src/lib/components/`).

- [ ] **Step 1: Écrire les tests**

```ts
it('applyAiWindow écrit fenêtre + ai_* sans toucher à l\'identité', …)
it('applyAiWindow avec analyse sans fenêtre → RangeError, rien ne change', …)
it('applyAiWindow : vin ou analyse d\'un autre foyer → NotFoundError', …)
it('getWineDetail expose windowSource, aiConfidence, aiRationale, aiModel et hasPhoto', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Vérification navigateur** avec le faux serveur de Task 5 : fiche avec photo et provenance IA ; ré-estimation → comparaison → Appliquer ; vin « À estimer » → Estimer → passe dans la bonne section.
- [ ] **Step 6: Commit** — `feat: photo et provenance sur la fiche, ré-estimation par l'IA`

---

### Task 7: Administration IA et documentation

**Files:**
- Modify: `src/routes/admin/+page.server.ts`, `src/routes/admin/+page.svelte`, `README.md`, `docs/BACKUP.md`, `messages/*.json`
- Create: `src/routes/admin/_ai.ts`
- Test: `tests/server/admin-ai.test.ts`

**Interfaces:**
- Consumes: `readAiConfig`, `describeAiConfig`, `getAiProvider`, `aiDailyLimit`, `countAnalysesToday`.
- Produces:
  - `aiStatus(db, env): { provider; model; baseUrl; configured; dailyLimit; analysesToday: number }` (`analysesToday` = toutes analyses réussies de l'instance aujourd'hui, en UTC — l'admin ne voit pas le détail par foyer).
  - `testAiProvider(provider: AiProvider | null): Promise<{ ok: true; model: string; ms: number } | { ok: false; error: AiErrorCode }>` — appel **sans image** avec des indices fixes (« Château Margaux, Margaux, rouge, 2015 ») ; ne crée aucune ligne `label_analyses`.
  - Action admin `?/testAi` (admin seulement, comme les autres actions ; 404 sinon).

Documentation :
- README : section « Analyse IA de l'étiquette » — variables `AI_*` et `PHOTOS_DIR` dans le tableau de configuration, exemple Anthropic (clé + modèle par défaut `claude-opus-5-5`), exemple compatible OpenAI (OpenAI, Mistral, OpenRouter, Ollama local `http://host.docker.internal:11434/v1`), coût indicatif (« de l'ordre de 2 à 3 centimes par étiquette avec le modèle par défaut »), confidentialité (la photo est envoyée au fournisseur choisi ; rien d'autre), limite quotidienne. Retirer « Analyse IA de l'étiquette » de la section « À venir ».
- BACKUP.md : le dossier `data/photos/` fait partie de la sauvegarde (commande `tar` ou `rsync` à côté du `.backup` SQLite) et de la restauration.

- [ ] **Step 1: Écrire les tests**

```ts
it('aiStatus ne contient jamais la clé', …)
it('aiStatus compte les analyses réussies du jour', …)
it('testAiProvider : ok avec le modèle et une durée ; provider null → not_configured ; AiError → son code', …)
it('testAiProvider ne crée pas de ligne label_analyses', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter + docs.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`, `npm run build`.
- [ ] **Step 5: Commit** — `feat(admin): état et test de l'IA ; docs IA et sauvegarde des photos`

---

## Vérification finale du plan 2

- [ ] `npm test`, `npm run check`, `npm run build` passent ; `docker build` OK.
- [ ] Parcours complet avec le faux fournisseur (Task 5) en navigateur mobile.
- [ ] **Essai réel (contrôleur, avec accord explicite de l'utilisateur, ses crédits API)** : une analyse avec `AI_API_KEY` réelle et `claude-opus-5-5` sur une photo d'étiquette fournie par l'utilisateur ; noter le résultat, la durée et le coût (`usage`) dans `tasks/todo.md`.
- [ ] Mettre à jour `tasks/todo.md` (revue du plan 2).
