import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser } from '../helpers/fixtures';
import { createInvitation } from '../../src/lib/server/auth/invitations';
import { signupWithToken } from '../../src/routes/signup/_logic';

describe('signupWithToken', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let hid: number;
  let adminId: number;
  beforeEach(() => {
    tdb = makeTestDb();
    hid = makeHousehold(tdb, 'Foyer A');
    adminId = makeUser(tdb, hid, { email: 'admin@x.test', isAdmin: true });
  });
  const invite = (householdId: number | null = hid) =>
    createInvitation(tdb.db, { createdBy: adminId, householdId });
  const nonAdminCount = () =>
    (tdb.sqlite.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 0').get() as { n: number }).n;
  const householdCount = () =>
    (tdb.sqlite.prepare('SELECT COUNT(*) AS n FROM households').get() as { n: number }).n;

  it('rejects unknown token', async () => {
    const r = await signupWithToken(tdb.db, { token: 'nope', email: 'b@x.test', password: '1234567890' });
    expect(r).toEqual({ ok: false, reason: 'bad-token' });
  });

  it('household invitation: the new user joins that household', async () => {
    const inv = invite();
    const r = await signupWithToken(tdb.db, { token: inv.token, email: 'b@x.test', password: '1234567890' });
    expect(r.ok).toBe(true);
    const u = tdb.sqlite.prepare('SELECT * FROM users WHERE email = ?').get('b@x.test') as any;
    expect(u.household_id).toBe(hid);
    expect(u.is_admin).toBe(0);
    const used = tdb.sqlite.prepare('SELECT * FROM invitations WHERE id = ?').get(inv.id) as any;
    expect(used.used_at).not.toBeNull();
    expect(used.used_by).toBe(u.id);
  });

  it('household-less invitation creates a household with the given name', async () => {
    const inv = invite(null);
    const r = await signupWithToken(tdb.db, {
      token: inv.token,
      email: 'paul@x.test',
      password: '1234567890',
      householdName: 'Chez Paul'
    });
    expect(r.ok).toBe(true);
    const u = tdb.sqlite.prepare('SELECT * FROM users WHERE email = ?').get('paul@x.test') as any;
    const h = tdb.sqlite.prepare('SELECT * FROM households WHERE id = ?').get(u.household_id) as any;
    expect(h.name).toBe('Chez Paul');
    expect(u.household_id).not.toBe(hid);
  });

  it('household-less invitation without household name -> household-name-required, no user created', async () => {
    const inv = invite(null);
    for (const householdName of [undefined, '', '   ']) {
      const r = await signupWithToken(tdb.db, {
        token: inv.token,
        email: 'paul@x.test',
        password: '1234567890',
        householdName
      });
      expect(r).toEqual({ ok: false, reason: 'household-name-required' });
    }
    expect(nonAdminCount()).toBe(0);
    expect(householdCount()).toBe(1);
    const used = tdb.sqlite.prepare('SELECT used_at FROM invitations WHERE id = ?').get(inv.id) as any;
    expect(used.used_at).toBeNull();
  });

  it('household name over 100 characters -> household-name-too-long, nothing created', async () => {
    const inv = invite(null);
    const r = await signupWithToken(tdb.db, {
      token: inv.token,
      email: 'paul@x.test',
      password: '1234567890',
      householdName: 'a'.repeat(101)
    });
    expect(r).toEqual({ ok: false, reason: 'household-name-too-long' });
    expect(nonAdminCount()).toBe(0);
    expect(householdCount()).toBe(1);
    const ok100 = await signupWithToken(tdb.db, {
      token: inv.token,
      email: 'paul@x.test',
      password: '1234567890',
      householdName: ` ${'a'.repeat(100)} `
    });
    expect(ok100.ok).toBe(true);
  });

  it('a duplicate email on a household-less invitation leaves no orphan household', async () => {
    const inv = invite(null);
    const r = await signupWithToken(tdb.db, {
      token: inv.token,
      email: 'admin@x.test',
      password: '1234567890',
      householdName: 'Chez Paul'
    });
    expect(r).toEqual({ ok: false, reason: 'duplicate-email' });
    expect(householdCount()).toBe(1);
  });

  it('a non-admin cannot create a household-less invitation', () => {
    const member = makeUser(tdb, hid, { email: 'm@x.test' });
    expect(() => createInvitation(tdb.db, { createdBy: member, householdId: null })).toThrow('forbidden');
  });

  it('rejects already-used token', async () => {
    const inv = invite();
    await signupWithToken(tdb.db, { token: inv.token, email: 'b@x.test', password: '1234567890' });
    const r2 = await signupWithToken(tdb.db, { token: inv.token, email: 'c@x.test', password: '1234567890' });
    expect(r2).toEqual({ ok: false, reason: 'bad-token' });
    expect(nonAdminCount()).toBe(1);
  });

  it('rejects weak password', async () => {
    const r = await signupWithToken(tdb.db, { token: invite().token, email: 'b@x.test', password: 'short' });
    expect(r).toEqual({ ok: false, reason: 'weak-password' });
  });

  it('rejects duplicate email', async () => {
    await signupWithToken(tdb.db, { token: invite().token, email: 'b@x.test', password: '1234567890' });
    const r2 = await signupWithToken(tdb.db, { token: invite().token, email: 'b@x.test', password: '1234567890' });
    expect(r2).toEqual({ ok: false, reason: 'duplicate-email' });
  });

  it('rejects invalid email shapes (no @, no dot, whitespace)', async () => {
    const cases = ['nodomain', '@onlydomain.test', 'no-at-sign.test', 'with space@x.test', 'noTLD@x', ''];
    for (const email of cases) {
      const r = await signupWithToken(tdb.db, { token: invite().token, email, password: '1234567890' });
      expect(r.ok, `expected reject for ${JSON.stringify(email)}`).toBe(false);
      if (!r.ok) expect(r.reason).toBe('invalid-email');
    }
  });

  it('normalises email case before lookup (uppercase form not allowed twice)', async () => {
    await signupWithToken(tdb.db, { token: invite().token, email: 'Mixed@x.test', password: '1234567890' });
    const r2 = await signupWithToken(tdb.db, { token: invite().token, email: 'mixed@x.test', password: '1234567890' });
    expect(r2).toEqual({ ok: false, reason: 'duplicate-email' });
  });
}, 30_000);
