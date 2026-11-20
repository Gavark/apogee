import { and, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '$lib/server/db/schema';
import type { HouseholdCtx } from '$lib/server/context';
import { isHouseholdPhotoPath, readPhoto, type PhotoMime } from '$lib/server/photos';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/** The label photo of a wine of the caller household, or null (no wine, foreign wine, no photo, unsafe path). */
export function loadWinePhoto(
  db: DB,
  ctx: HouseholdCtx,
  wineId: number,
  dir: string
): { bytes: Buffer; mime: PhotoMime } | null {
  const row = db
    .select({ labelPhoto: schema.wines.labelPhoto })
    .from(schema.wines)
    .where(and(eq(schema.wines.id, wineId), eq(schema.wines.householdId, ctx.householdId)))
    .get();
  if (!row?.labelPhoto || !isHouseholdPhotoPath(row.labelPhoto, ctx.householdId)) return null;
  return readPhoto(dir, row.labelPhoto);
}
