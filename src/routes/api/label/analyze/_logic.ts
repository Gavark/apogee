import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from '$lib/server/db/schema';
import { NotFoundError, type HouseholdCtx } from '$lib/server/context';
import { analyzeAndStore } from '$lib/server/label-analyses';
import { MAX_PHOTO_BYTES } from '$lib/server/photos';
import { findOwnedWine } from '$lib/server/wines';
import type { AiProvider, LabelHints } from '$lib/server/ai/types';
import { COLORS } from '$lib/wine-constants';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

const MAX_HINT_LEN = 200;
const TEXT_KEYS = ['producer', 'cuvee', 'appellation'] as const;
const INT_KEYS = ['vintage', 'formatCl', 'acquiredYear'] as const;

/** Lenient hints parser: keeps only known keys with the right primitive type. null when not a JSON object. */
export function parseHints(raw: string): LabelHints | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const out: LabelHints = {};
  for (const k of TEXT_KEYS) {
    const s = o[k];
    if (typeof s === 'string') {
      const t = s.trim();
      if (t && t.length <= MAX_HINT_LEN) out[k] = t;
    }
  }
  for (const k of INT_KEYS) {
    const n = o[k];
    if (typeof n === 'number' && Number.isInteger(n)) out[k] = n;
  }
  if (typeof o.color === 'string' && (COLORS as string[]).includes(o.color)) out.color = o.color as LabelHints['color'];
  return out;
}

const bad = { status: 400, body: { error: 'invalid_request' } };

export async function handleAnalyze(
  db: DB,
  ctx: HouseholdCtx,
  provider: AiProvider | null,
  form: FormData,
  env: { timeZone: string; locale: 'fr' | 'en'; currentYear: number; dailyLimit: number; photosDir: string }
): Promise<{ status: number; body: unknown }> {
  const file = form.get('photo');
  const hintsRaw = form.get('hints');
  const wineIdRaw = form.get('wineId');

  let hints: LabelHints | null = null;
  if (typeof hintsRaw === 'string') {
    hints = parseHints(hintsRaw);
    if (!hints) return bad;
  }

  let photo: Uint8Array | null = null;
  if (file instanceof File) {
    if (file.size > MAX_PHOTO_BYTES) return { status: 413, body: { error: 'invalid_photo' } };
    if (file.size > 0) photo = new Uint8Array(await file.arrayBuffer());
  }

  let existingPhotoPath: string | null = null;
  if (typeof wineIdRaw === 'string' && wineIdRaw !== '') {
    if (!/^\d+$/.test(wineIdRaw)) return bad;
    try {
      const wine = findOwnedWine(db, ctx, Number(wineIdRaw));
      existingPhotoPath = wine.labelPhoto;
      hints = {
        producer: wine.producer,
        cuvee: wine.cuvee,
        appellation: wine.appellation,
        color: wine.color as LabelHints['color'],
        vintage: wine.vintage,
        formatCl: wine.formatCl,
        acquiredYear: wine.acquiredYear
      };
    } catch (e) {
      if (e instanceof NotFoundError) return { status: 404, body: { error: 'not_found' } };
      throw e;
    }
  } else if (!photo && !hints) {
    return bad;
  }

  const outcome = await analyzeAndStore(db, ctx, provider, {
    photo,
    existingPhotoPath,
    hints,
    locale: env.locale,
    currentYear: env.currentYear,
    timeZone: env.timeZone,
    dailyLimit: env.dailyLimit,
    photosDir: env.photosDir
  });
  if (!outcome.ok && outcome.error === 'invalid_photo') return { status: 413, body: { error: 'invalid_photo' } };
  return { status: 200, body: outcome };
}
