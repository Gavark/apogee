import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './db/schema';
import { NotFoundError, type HouseholdCtx } from './context';
import type { Location } from './db/schema';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export const MAX_LOCATION_NAME_LEN = 60;

export type LocationWithCount = Location & { bottleCount: number };
export type LocationResult = { ok: true; location: Location } | { ok: false; reason: 'empty' | 'duplicate' };

const { locations, stockLots } = schema;

export function listLocations(db: DB, ctx: HouseholdCtx): LocationWithCount[] {
  return db
    .select({
      id: locations.id,
      householdId: locations.householdId,
      name: locations.name,
      sortOrder: locations.sortOrder,
      createdAt: locations.createdAt,
      bottleCount: sql<number>`coalesce(sum(${stockLots.quantity}), 0)`.mapWith(Number)
    })
    .from(locations)
    .leftJoin(stockLots, eq(stockLots.locationId, locations.id))
    .where(eq(locations.householdId, ctx.householdId))
    .groupBy(locations.id)
    .orderBy(asc(locations.sortOrder), asc(locations.id))
    .all();
}

function normalizeName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= MAX_LOCATION_NAME_LEN ? name : null;
}

function findOwned(db: DB, ctx: HouseholdCtx, id: number): Location {
  const row = db
    .select()
    .from(locations)
    .where(and(eq(locations.id, id), eq(locations.householdId, ctx.householdId)))
    .get();
  if (!row) throw new NotFoundError('location not found');
  return row;
}

function nameTaken(db: DB, ctx: HouseholdCtx, name: string, exceptId?: number): boolean {
  return db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.householdId, ctx.householdId), eq(locations.name, name)))
    .all()
    .some((r) => r.id !== exceptId);
}

export function createLocation(db: DB, ctx: HouseholdCtx, rawName: string): LocationResult {
  const name = normalizeName(rawName);
  if (!name) return { ok: false, reason: 'empty' };
  return db.transaction((tx) => {
    if (nameTaken(tx, ctx, name)) return { ok: false, reason: 'duplicate' } as const;
    const max = tx
      .select({ m: sql<number>`coalesce(max(${locations.sortOrder}), -1)`.mapWith(Number) })
      .from(locations)
      .where(eq(locations.householdId, ctx.householdId))
      .get();
    const location = tx
      .insert(locations)
      .values({ householdId: ctx.householdId, name, sortOrder: (max?.m ?? -1) + 1 })
      .returning()
      .get();
    return { ok: true, location } as const;
  });
}

export function renameLocation(db: DB, ctx: HouseholdCtx, id: number, rawName: string): LocationResult {
  findOwned(db, ctx, id);
  const name = normalizeName(rawName);
  if (!name) return { ok: false, reason: 'empty' };
  if (nameTaken(db, ctx, name, id)) return { ok: false, reason: 'duplicate' };
  const location = db.update(locations).set({ name }).where(eq(locations.id, id)).returning().get();
  return { ok: true, location };
}

export function reorderLocations(db: DB, ctx: HouseholdCtx, orderedIds: number[]): void {
  db.transaction((tx) => {
    const owned = new Set(
      tx
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.householdId, ctx.householdId), inArray(locations.id, orderedIds)))
        .all()
        .map((r) => r.id)
    );
    if (orderedIds.some((id) => !owned.has(id))) throw new NotFoundError('location not found');
    orderedIds.forEach((id, i) => {
      tx.update(locations).set({ sortOrder: i }).where(eq(locations.id, id)).run();
    });
  });
}

export function deleteLocation(db: DB, ctx: HouseholdCtx, id: number): { ok: true } | { ok: false; reason: 'not_empty' } {
  return db.transaction((tx) => {
    findOwned(tx, ctx, id);
    const stocked = tx
      .select({ n: sql<number>`coalesce(sum(${stockLots.quantity}), 0)`.mapWith(Number) })
      .from(stockLots)
      .where(eq(stockLots.locationId, id))
      .get();
    if ((stocked?.n ?? 0) > 0) return { ok: false, reason: 'not_empty' } as const;
    // Empty lots go away; consumptions keep their history (FK set null).
    tx.delete(stockLots).where(eq(stockLots.locationId, id)).run();
    tx.delete(locations).where(eq(locations.id, id)).run();
    return { ok: true } as const;
  });
}
