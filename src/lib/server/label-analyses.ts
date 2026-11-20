import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './db/schema';
import { NotFoundError, type HouseholdCtx } from './context';
import { readPhoto, savePhoto, type PhotoMime } from './photos';
import { AiError, type AiErrorCode, type AiProvider, type LabelAnalysis, type LabelHints } from './ai/types';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

const { labelAnalyses } = schema;

export type AnalysisOutcome =
  | { ok: true; analysisId: number; analysis: LabelAnalysis; model: string }
  | { ok: false; analysisId: number | null; error: AiErrorCode | 'limit_reached' | 'invalid_photo' };

function zonedParts(ms: number, timeZone: string): { y: number; mo: number; d: number; offsetMs: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return { y: n('year'), mo: n('month'), d: n('day'), offsetMs: asUtc - Math.floor(ms / 1000) * 1000 };
}

/** Unix timestamp (seconds) of the start of the local day containing `now` in `timeZone`. */
function startOfLocalDay(now: Date, timeZone: string): number {
  const { y, mo, d, offsetMs } = zonedParts(now.getTime(), timeZone);
  const localMidnightAsUtc = Date.UTC(y, mo - 1, d);
  // The offset may differ at midnight (DST change that day): refine once.
  let start = localMidnightAsUtc - offsetMs;
  start = localMidnightAsUtc - zonedParts(start, timeZone).offsetMs;
  return Math.floor(start / 1000);
}

/** Successful analyses (non-null result) of the household since local midnight. */
export function countAnalysesToday(db: DB, householdId: number, timeZone: string, now: Date = new Date()): number {
  const start = startOfLocalDay(now, timeZone);
  return db
    .select({ n: sql<number>`count(*)` })
    .from(labelAnalyses)
    .where(
      and(
        eq(labelAnalyses.householdId, householdId),
        isNotNull(labelAnalyses.result),
        gte(labelAnalyses.createdAt, start)
      )
    )
    .get()!.n;
}

type StoreRow = { photoPath: string | null; result?: string; errorCode?: string; model?: string };

function insertRow(db: DB, ctx: HouseholdCtx, row: StoreRow): number {
  return db
    .insert(labelAnalyses)
    .values({ householdId: ctx.householdId, userId: ctx.userId, ...row })
    .returning({ id: labelAnalyses.id })
    .get().id;
}

export async function analyzeAndStore(
  db: DB,
  ctx: HouseholdCtx,
  provider: AiProvider | null,
  input: {
    photo: Uint8Array | null;
    existingPhotoPath?: string | null;
    hints: LabelHints | null;
    locale: 'fr' | 'en';
    currentYear: number;
    timeZone: string;
    dailyLimit: number;
    photosDir: string;
  }
): Promise<AnalysisOutcome> {
  let photoPath: string | null = null;
  let image: { data: Uint8Array; mimeType: PhotoMime } | null = null;

  if (input.photo) {
    try {
      const saved = savePhoto(input.photosDir, ctx.householdId, input.photo);
      photoPath = saved.path;
      image = { data: input.photo, mimeType: saved.mime };
    } catch {
      return { ok: false, analysisId: null, error: 'invalid_photo' };
    }
  } else if (input.existingPhotoPath) {
    const existing = readPhoto(input.photosDir, input.existingPhotoPath);
    if (existing) {
      photoPath = input.existingPhotoPath;
      image = { data: existing.bytes, mimeType: existing.mime };
    }
  }

  if (!provider) {
    const analysisId = insertRow(db, ctx, { photoPath, errorCode: 'not_configured' });
    return { ok: false, analysisId, error: 'not_configured' };
  }

  if (input.dailyLimit > 0 && countAnalysesToday(db, ctx.householdId, input.timeZone) >= input.dailyLimit) {
    const analysisId = insertRow(db, ctx, { photoPath, errorCode: 'limit_reached' });
    return { ok: false, analysisId, error: 'limit_reached' };
  }

  try {
    const analysis = await provider.analyzeLabel({
      image,
      hints: input.hints,
      locale: input.locale,
      currentYear: input.currentYear
    });
    const analysisId = insertRow(db, ctx, {
      photoPath,
      result: JSON.stringify(analysis),
      model: provider.model
    });
    return { ok: true, analysisId, analysis, model: provider.model };
  } catch (e) {
    let error: AiErrorCode = 'unavailable';
    if (!(e instanceof AiError)) console.error('label analysis failed:', e instanceof Error ? e.name : 'unknown');
    else error = e.code;
    const analysisId = insertRow(db, ctx, { photoPath, errorCode: error });
    return { ok: false, analysisId, error };
  }
}

export function getOwnedAnalysis(
  db: DB,
  ctx: HouseholdCtx,
  analysisId: number
): { id: number; photoPath: string | null; analysis: LabelAnalysis | null; model: string | null } {
  const row = db
    .select()
    .from(labelAnalyses)
    .where(and(eq(labelAnalyses.id, analysisId), eq(labelAnalyses.householdId, ctx.householdId)))
    .get();
  if (!row) throw new NotFoundError('analysis not found');
  return {
    id: row.id,
    photoPath: row.photoPath,
    analysis: row.result ? (JSON.parse(row.result) as LabelAnalysis) : null,
    model: row.model
  };
}
