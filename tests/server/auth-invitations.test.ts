import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser } from '../helpers/fixtures';
import {
  createInvitation,
  findUsableInvitation,
  markInvitationUsed,
  listInvitations,
  INVITATION_TTL_SEC
} from '../../src/lib/server/auth/invitations';

describe('invitations', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let hid: number;
  let adminId: number;
  beforeEach(() => {
    tdb = makeTestDb();
    hid = makeHousehold(tdb);
    adminId = makeUser(tdb, hid, { email: 'admin@x.test', isAdmin: true });
  });

  it('createInvitation generates a unique token with 7-day expiry', () => {
    const inv = createInvitation(tdb.db, { createdBy: adminId, householdId: hid });
    expect(inv.token.length).toBeGreaterThan(20);
    expect(inv.expiresAt - inv.createdAt).toBe(INVITATION_TTL_SEC);
    expect(inv.householdId).toBe(hid);
  });

  it('an admin can create an invitation without household', () => {
    const inv = createInvitation(tdb.db, { createdBy: adminId, householdId: null });
    expect(inv.householdId).toBeNull();
  });

  it('findUsableInvitation returns it if not used and not expired', () => {
    const inv = createInvitation(tdb.db, { createdBy: adminId, householdId: hid });
    expect(findUsableInvitation(tdb.db, inv.token)).not.toBeNull();
  });

  it('returns null for unknown token', () => {
    expect(findUsableInvitation(tdb.db, 'nope')).toBeNull();
  });

  it('returns null for expired token', () => {
    const t = Math.floor(Date.now() / 1000);
    tdb.sqlite
      .prepare('INSERT INTO invitations (token, created_by, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run('xxx', adminId, t - 10, t - 1000);
    expect(findUsableInvitation(tdb.db, 'xxx')).toBeNull();
  });

  it('returns null for used token', () => {
    const inv = createInvitation(tdb.db, { createdBy: adminId, householdId: hid });
    markInvitationUsed(tdb.db, inv.id, adminId);
    expect(findUsableInvitation(tdb.db, inv.token)).toBeNull();
  });

  it('listInvitations(null) returns all, newest first', () => {
    const a = createInvitation(tdb.db, { createdBy: adminId, householdId: hid });
    const b = createInvitation(tdb.db, { createdBy: adminId, householdId: null });
    const all = listInvitations(tdb.db, null);
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(b.id);
    expect(all[1].id).toBe(a.id);
  });

  it('listInvitations(householdId) only returns that household', () => {
    const other = makeHousehold(tdb, 'Autre');
    const mine = createInvitation(tdb.db, { createdBy: adminId, householdId: hid });
    createInvitation(tdb.db, { createdBy: adminId, householdId: other });
    createInvitation(tdb.db, { createdBy: adminId, householdId: null });
    expect(listInvitations(tdb.db, hid).map((r) => r.id)).toEqual([mine.id]);
  });
});
