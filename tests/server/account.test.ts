import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold } from '../helpers/fixtures';
import { hashPassword, verifyPassword } from '../../src/lib/server/auth/password';
import { createSession, listSessionsForUser } from '../../src/lib/server/auth/session';
import { changePassword } from '../../src/routes/account/_logic';

describe('changePassword', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let userId: number;
  let keep: string;
  beforeEach(async () => {
    tdb = makeTestDb();
    const hid = makeHousehold(tdb);
    userId = tdb.db
      .insert(tdb.schema.users)
      .values({ email: 'a@x.test', passwordHash: await hashPassword('old-password-1'), householdId: hid })
      .returning({ id: tdb.schema.users.id })
      .get().id;
    keep = createSession(tdb.db, userId, 'ua').id;
    createSession(tdb.db, userId, 'other');
  });
  const input = (o: Partial<{ current: string; next: string; confirm: string }> = {}) => ({
    current: 'old-password-1',
    next: 'new-password-2',
    confirm: 'new-password-2',
    ...o
  });

  it('changes the hash and keeps only the current session', async () => {
    expect(await changePassword(tdb.db, userId, keep, input())).toEqual({ ok: true });
    const u = tdb.sqlite.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any;
    expect(await verifyPassword(u.password_hash, 'new-password-2')).toBe(true);
    expect(listSessionsForUser(tdb.db, userId).map((s) => s.id)).toEqual([keep]);
  });

  it('rejects a wrong current password, a mismatch and a weak password without changes', async () => {
    expect(await changePassword(tdb.db, userId, keep, input({ current: 'nope-nope-nope' }))).toEqual({
      ok: false,
      reason: 'wrong-current'
    });
    expect(await changePassword(tdb.db, userId, keep, input({ confirm: 'different-pass' }))).toEqual({
      ok: false,
      reason: 'mismatch'
    });
    expect(await changePassword(tdb.db, userId, keep, input({ next: 'short', confirm: 'short' }))).toEqual({
      ok: false,
      reason: 'weak'
    });
    expect(listSessionsForUser(tdb.db, userId)).toHaveLength(2);
  });
}, 30_000);
