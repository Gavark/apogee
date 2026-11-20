import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import {
  listMembers,
  listHouseholdsForAdmin,
  deleteUserAsAdmin,
  deleteHouseholdAsAdmin
} from '../../src/lib/server/households';
import type { HouseholdCtx } from '../../src/lib/server/context';

describe('households', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let hidA: number;
  let hidB: number;
  let adminId: number;
  let memberId: number;
  let otherId: number;
  let adminCtx: HouseholdCtx;
  let memberCtx: HouseholdCtx;

  beforeEach(() => {
    tdb = makeTestDb();
    hidA = makeHousehold(tdb, 'Foyer A');
    hidB = makeHousehold(tdb, 'Foyer B');
    adminId = makeUser(tdb, hidA, { email: 'admin@x.test', isAdmin: true });
    memberId = makeUser(tdb, hidA, { email: 'member@x.test' });
    otherId = makeUser(tdb, hidB, { email: 'other@x.test' });
    adminCtx = { userId: adminId, householdId: hidA, isAdmin: true };
    memberCtx = { userId: memberId, householdId: hidA, isAdmin: false };
  });

  const count = (table: string) =>
    (tdb.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

  it('listMembers ne renvoie que les membres du foyer', () => {
    const members = listMembers(tdb.db, hidA);
    expect(members.map((m) => m.email).sort()).toEqual(['admin@x.test', 'member@x.test']);
    const admin = members.find((m) => m.id === adminId)!;
    expect(admin.isAdmin).toBe(true);
    expect(members.find((m) => m.id === memberId)!.isAdmin).toBe(false);
    expect(typeof admin.createdAt).toBe('number');
    expect(Object.keys(admin).sort()).toEqual(['createdAt', 'email', 'id', 'isAdmin']);
    expect(listMembers(tdb.db, hidB).map((m) => m.id)).toEqual([otherId]);
  });

  it('listHouseholdsForAdmin renvoie nom et nombre de membres', () => {
    const emptyId = makeHousehold(tdb, 'Foyer vide');
    const rows = listHouseholdsForAdmin(tdb.db);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(hidA)).toMatchObject({ name: 'Foyer A', memberCount: 2 });
    expect(byId.get(hidB)).toMatchObject({ name: 'Foyer B', memberCount: 1 });
    expect(byId.get(emptyId)).toMatchObject({ name: 'Foyer vide', memberCount: 0 });
    // Aucune donnée de cave dans la réponse.
    expect(Object.keys(rows[0]).sort()).toEqual(['createdAt', 'id', 'memberCount', 'name']);
  });

  it('deleteUserAsAdmin refuse un non-admin -> forbidden, et sa propre suppression -> self', () => {
    expect(deleteUserAsAdmin(tdb.db, memberCtx, otherId)).toEqual({ ok: false, reason: 'forbidden' });
    expect(count('users')).toBe(3);
    expect(deleteUserAsAdmin(tdb.db, adminCtx, adminId)).toEqual({ ok: false, reason: 'self' });
    expect(count('users')).toBe(3);
  });

  it('deleteUserAsAdmin supprime un utilisateur et ses sessions, not_found sinon', () => {
    tdb.sqlite
      .prepare('INSERT INTO sessions (id, user_id, expires_at, last_used_at) VALUES (?, ?, ?, ?)')
      .run('s1', otherId, 9999999999, 1);
    expect(deleteUserAsAdmin(tdb.db, adminCtx, otherId)).toEqual({ ok: true });
    expect(count('users')).toBe(2);
    expect(count('sessions')).toBe(0);
    expect(deleteUserAsAdmin(tdb.db, adminCtx, otherId)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('deleteHouseholdAsAdmin refuse un non-admin, son propre foyer, un foyer avec membres', () => {
    expect(deleteHouseholdAsAdmin(tdb.db, memberCtx, hidB)).toEqual({ ok: false, reason: 'forbidden' });
    expect(deleteHouseholdAsAdmin(tdb.db, adminCtx, hidA)).toEqual({ ok: false, reason: 'own_household' });
    expect(deleteHouseholdAsAdmin(tdb.db, adminCtx, hidB)).toEqual({ ok: false, reason: 'has_members' });
    expect(count('households')).toBe(2);
  });

  it('deleteHouseholdAsAdmin -> not_found pour un foyer inexistant', () => {
    expect(deleteHouseholdAsAdmin(tdb.db, adminCtx, 9999)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('deleteHouseholdAsAdmin supprime un foyer vide et toute sa cave', () => {
    const emptyId = makeHousehold(tdb, 'Foyer vide');
    const locId = makeLocation(tdb, emptyId, 'Cave');
    const wineId = tdb.db
      .insert(tdb.schema.wines)
      .values({ householdId: emptyId, identityKey: 'k' })
      .returning({ id: tdb.schema.wines.id })
      .get().id;
    tdb.db.insert(tdb.schema.stockLots).values({ wineId, locationId: locId, quantity: 3 }).run();
    tdb.sqlite
      .prepare('INSERT INTO invitations (token, created_by, household_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .run('tok', adminId, emptyId, 9999999999, 1);
    // La cave du foyer A ne doit pas être touchée.
    makeLocation(tdb, hidA, 'Cave A');

    expect(deleteHouseholdAsAdmin(tdb.db, adminCtx, emptyId)).toEqual({ ok: true });
    expect(count('households')).toBe(2);
    expect(count('wines')).toBe(0);
    expect(count('stock_lots')).toBe(0);
    expect(count('invitations')).toBe(0);
    expect(count('locations')).toBe(1);
  });
});
