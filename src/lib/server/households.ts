import { eq, sql, asc, count } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './db/schema';
import type { HouseholdCtx } from './context';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export type Member = { id: number; email: string; isAdmin: boolean; createdAt: number };
export type HouseholdSummary = { id: number; name: string; memberCount: number; createdAt: number };

export function listMembers(db: DB, householdId: number): Member[] {
  return db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      isAdmin: schema.users.isAdmin,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .where(eq(schema.users.householdId, householdId))
    .orderBy(asc(schema.users.createdAt), asc(schema.users.id))
    .all()
    .map((u) => ({ ...u, isAdmin: u.isAdmin === 1 }));
}

/** Names and member counts only: an instance admin never sees another household's cellar. */
export function listHouseholdsForAdmin(db: DB): HouseholdSummary[] {
  return db
    .select({
      id: schema.households.id,
      name: schema.households.name,
      memberCount: count(schema.users.id),
      createdAt: schema.households.createdAt
    })
    .from(schema.households)
    .leftJoin(schema.users, eq(schema.users.householdId, schema.households.id))
    .groupBy(schema.households.id)
    .orderBy(asc(schema.households.createdAt), asc(schema.households.id))
    .all();
}

export function deleteUserAsAdmin(
  db: DB,
  ctx: HouseholdCtx,
  userId: number
): { ok: true } | { ok: false; reason: 'forbidden' | 'self' | 'not_found' } {
  if (!ctx.isAdmin) return { ok: false, reason: 'forbidden' };
  if (userId === ctx.userId) return { ok: false, reason: 'self' };
  const deleted = db.delete(schema.users).where(eq(schema.users.id, userId)).returning({ id: schema.users.id }).all();
  return deleted.length ? { ok: true } : { ok: false, reason: 'not_found' };
}

export function deleteHouseholdAsAdmin(
  db: DB,
  ctx: HouseholdCtx,
  householdId: number
): { ok: true } | { ok: false; reason: 'forbidden' | 'has_members' | 'own_household' | 'not_found' } {
  if (!ctx.isAdmin) return { ok: false, reason: 'forbidden' };
  if (householdId === ctx.householdId) return { ok: false, reason: 'own_household' };
  return db.transaction((tx) => {
    const household = tx.select({ id: schema.households.id }).from(schema.households)
      .where(eq(schema.households.id, householdId)).all()[0];
    if (!household) return { ok: false, reason: 'not_found' as const };
    const members = tx.select({ n: sql<number>`count(*)` }).from(schema.users)
      .where(eq(schema.users.householdId, householdId)).all()[0].n;
    if (members > 0) return { ok: false, reason: 'has_members' as const };
    // Wines first: their lots cascade away, which frees the locations that
    // stock_lots otherwise keeps RESTRICTed. The rest cascades from the household.
    tx.delete(schema.wines).where(eq(schema.wines.householdId, householdId)).run();
    tx.delete(schema.households).where(eq(schema.households.id, householdId)).run();
    return { ok: true as const };
  });
}
