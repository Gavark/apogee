import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser } from '../helpers/fixtures';
import { bootstrapAdmin } from '../../src/lib/server/auth/bootstrap';

describe('bootstrapAdmin', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  beforeEach(() => {
    tdb = makeTestDb();
  });

  it('creates household and admin if users table is empty', async () => {
    await bootstrapAdmin(tdb.db, { email: 'admin@x', password: '12345678ab', householdName: 'Chez nous' });
    const u = tdb.sqlite.prepare('SELECT * FROM users WHERE email = ?').get('admin@x') as any;
    expect(u.is_admin).toBe(1);
    const h = tdb.sqlite.prepare('SELECT * FROM households WHERE id = ?').get(u.household_id) as any;
    expect(h.name).toBe('Chez nous');
  });

  it('defaults the household name to Ma cave', async () => {
    await bootstrapAdmin(tdb.db, { email: 'admin@x', password: '12345678ab' });
    const h = tdb.sqlite.prepare('SELECT name FROM households').get() as any;
    expect(h.name).toBe('Ma cave');
  });

  it('is a no-op if users table is not empty', async () => {
    makeUser(tdb, makeHousehold(tdb), { email: 'preexisting@x' });
    await bootstrapAdmin(tdb.db, { email: 'admin@x', password: '12345678ab' });
    const count = tdb.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get() as any;
    expect(count.n).toBe(1);
    const h = tdb.sqlite.prepare('SELECT COUNT(*) AS n FROM households').get() as any;
    expect(h.n).toBe(1);
  });

  it('no-op if env vars are missing', async () => {
    await bootstrapAdmin(tdb.db, { email: undefined, password: undefined });
    const n = (tdb.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get() as any).n;
    expect(n).toBe(0);
  });

  it('rejects weak password', async () => {
    await expect(bootstrapAdmin(tdb.db, { email: 'admin@x', password: 'short' })).rejects.toThrow();
  });
});
