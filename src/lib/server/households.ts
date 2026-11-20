import { eq, sql, asc, count } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './db/schema';
import type { HouseholdCtx } from './context';
import { deleteHouseholdPhotos, photosDir } from './photos';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export const MAX_HOUSEHOLD_NAME_LEN = 100;

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
  householdId: number,
  photosDirPath: string = photosDir()
): { ok: true } | { ok: false; reason: 'forbidden' | 'has_members' | 'own_household' | 'not_found' } {
  if (!ctx.isAdmin) return { ok: false, reason: 'forbidden' };
  if (householdId === ctx.householdId) return { ok: false, reason: 'own_household' };
  const result = db.transaction((tx) => {
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
  // Only once the delete has committed.
  if (result.ok) deleteHouseholdPhotos(photosDirPath, householdId);
  return result;
}

export type AdminInvitationRow = {
  id: number;
  householdName: string | null;
  status: 'pending' | 'used' | 'expired';
  expiresAt: number;
  /** Only for household-less invitations or the admin's own household. */
  link: string | null;
};

/**
 * What the instance admin may see of invitations. A household-bound token lets
 * its holder join that household and read its cellar, so the token and link
 * are withheld for every household but the admin's own.
 */
export function adminInvitationRows(
  invitations: { id: number; token: string; householdId: number | null; usedAt: number | null; expiresAt: number }[],
  householdNames: Map<number, string>,
  ownHouseholdId: number,
  origin: string,
  now: number = Math.floor(Date.now() / 1000)
): AdminInvitationRow[] {
  return invitations.map((inv) => {
    const status = inv.usedAt ? 'used' : inv.expiresAt <= now ? 'expired' : 'pending';
    const visible = inv.householdId === null || inv.householdId === ownHouseholdId;
    return {
      id: inv.id,
      householdName: inv.householdId === null ? null : (householdNames.get(inv.householdId) ?? null),
      status,
      expiresAt: inv.expiresAt,
      link: visible && status === 'pending' ? `${origin}/signup?token=${inv.token}` : null
    };
  });
}
