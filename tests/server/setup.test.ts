import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser } from '../helpers/fixtures';
import { hasNoUsers } from '../../src/lib/server/auth/bootstrap';
import { setupFirstAdmin } from '../../src/routes/setup/_logic';

const ok = { email: 'admin@x.test', password: '1234567890', householdName: 'Ma cave', locale: 'fr' as const };

describe('hasNoUsers', () => {
  it('is true on a fresh DB, false once a user exists', () => {
    const tdb = makeTestDb();
    expect(hasNoUsers(tdb.db)).toBe(true);
    makeUser(tdb, makeHousehold(tdb));
    expect(hasNoUsers(tdb.db)).toBe(false);
  });
});

describe('setupFirstAdmin', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  beforeEach(() => {
    tdb = makeTestDb();
  });

  it('creates the household and the admin', async () => {
    const r = await setupFirstAdmin(tdb.db, { ...ok, householdName: 'Chez Jo', locale: 'en' });
    expect(r.ok).toBe(true);
    const u = tdb.sqlite.prepare('SELECT * FROM users WHERE email = ?').get('admin@x.test') as any;
    expect(u.is_admin).toBe(1);
    expect(u.locale).toBe('en');
    const h = tdb.sqlite.prepare('SELECT name FROM households WHERE id = ?').get(u.household_id) as any;
    expect(h.name).toBe('Chez Jo');
  });

  it('refuses a second setup -> already-setup', async () => {
    expect((await setupFirstAdmin(tdb.db, ok)).ok).toBe(true);
    const r2 = await setupFirstAdmin(tdb.db, { ...ok, email: 'other@x.test' });
    expect(r2).toEqual({ ok: false, reason: 'already-setup' });
    const n = (tdb.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get() as any).n;
    expect(n).toBe(1);
  });

  it('rejects invalid email shapes', async () => {
    for (const email of ['nodomain', '@onlydomain.test', 'noTLD@x', '', 'with space@x.test']) {
      const r = await setupFirstAdmin(tdb.db, { ...ok, email });
      expect(r, JSON.stringify(email)).toEqual({ ok: false, reason: 'invalid-email' });
    }
  });

  it('rejects weak password without creating anything', async () => {
    const r = await setupFirstAdmin(tdb.db, { ...ok, password: 'short' });
    expect(r).toEqual({ ok: false, reason: 'weak-password' });
    expect(hasNoUsers(tdb.db)).toBe(true);
    expect((tdb.sqlite.prepare('SELECT COUNT(*) AS n FROM households').get() as any).n).toBe(0);
  });

  it('requires a household name', async () => {
    const r = await setupFirstAdmin(tdb.db, { ...ok, householdName: '  ' });
    expect(r).toEqual({ ok: false, reason: 'household-name-required' });
    expect(hasNoUsers(tdb.db)).toBe(true);
  });

  it('normalises email to lowercase', async () => {
    await setupFirstAdmin(tdb.db, { ...ok, email: 'Mixed@X.Test' });
    expect((tdb.sqlite.prepare('SELECT email FROM users').get() as any).email).toBe('mixed@x.test');
  });
}, 30_000);
