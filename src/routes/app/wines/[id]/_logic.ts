import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from '$lib/server/db/schema';
import type { HouseholdCtx } from '$lib/server/context';
import { applyAiWindow } from '$lib/server/wines';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/** Applies the analysis named by the form. 400 for a malformed or unusable analysis; NotFoundError for a foreign one. */
export function applyAiFromForm(db: DB, ctx: HouseholdCtx, wineId: number, form: FormData): { status: 200 | 400 } {
  const raw = form.get('analysisId');
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return { status: 400 };
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) return { status: 400 };
  try {
    applyAiWindow(db, ctx, wineId, id);
  } catch (e) {
    if (e instanceof RangeError) return { status: 400 };
    throw e;
  }
  return { status: 200 };
}
