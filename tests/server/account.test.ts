import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold } from '../helpers/fixtures';
import { hashPassword, verifyPassword } from '../../src/lib/server/auth/password';
import { createSession, listSessionsForUser } from '../../src/lib/server/auth/session';
import { changePassword, changeTimezone } from '../../src/routes/account/_logic';

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

describe('changeTimezone', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let userId: number;
  const row = () => tdb.db.select().from(tdb.schema.users).all().find((u) => u.id === userId)!;
  const set = (o: Record<string, unknown>) =>
    tdb.sqlite
      .prepare(`UPDATE users SET ${Object.keys(o).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...Object.values(o), userId);
  beforeEach(() => {
    tdb = makeTestDb();
    const hid = makeHousehold(tdb);
    userId = tdb.db
      .insert(tdb.schema.users)
      .values({ email: 'a@x.test', passwordHash: 'x', householdId: hid })
      .returning({ id: tdb.schema.users.id })
      .get().id;
  });

  it('enregistre une zone valide, sous son nom canonique', () => {
    expect(row().timezone).toBe('Europe/Paris');
    expect(changeTimezone(tdb.db, userId, 'America/Guadeloupe')).toEqual({
      ok: true,
      timezone: 'America/Guadeloupe',
      changed: true
    });
    expect(row().timezone).toBe('America/Guadeloupe');
    expect(changeTimezone(tdb.db, userId, 'europe/paris')).toMatchObject({ ok: true, timezone: 'Europe/Paris' });
    expect(row().timezone).toBe('Europe/Paris');
  });

  it('rejette une zone invalide sans rien changer', () => {
    set({ last_dispatch_date: '2026-11-23', last_dispatch_at: 1 });
    for (const z of [null, '', 'Mars/Olympus', '+05:00', 'Europe/Paris; DROP TABLE users'])
      expect(changeTimezone(tdb.db, userId, z)).toEqual({ ok: false, reason: 'invalid' });
    expect(row()).toMatchObject({ timezone: 'Europe/Paris', lastDispatchDate: '2026-11-23' });
  });

  it('même zone : rien ne change', () => {
    set({ last_dispatch_date: '2026-11-23', last_dispatch_at: Date.parse('2026-11-20T17:00:00Z') / 1000 });
    expect(changeTimezone(tdb.db, userId, 'Europe/Paris')).toEqual({ ok: true, timezone: 'Europe/Paris', changed: false });
    expect(row().lastDispatchDate).toBe('2026-11-23');
  });

  it("ré-exprime le jour du dernier résumé dans la nouvelle zone, garde le mois du rappel", () => {
    // Sent at 18:00 in Auckland on 24 Nov = 19:00 on 23 Nov in Honolulu.
    const at = Date.parse('2026-11-24T05:00:00Z') / 1000;
    tdb.db.update(tdb.schema.users).set({ timezone: 'Pacific/Auckland' }).run();
    set({ last_dispatch_date: '2026-11-24', last_dispatch_at: at, last_monthly_month: '2026-11' });
    changeTimezone(tdb.db, userId, 'Pacific/Honolulu');
    expect(row()).toMatchObject({
      timezone: 'Pacific/Honolulu',
      lastDispatchDate: '2026-11-23',
      lastDispatchAt: at,
      lastMonthlyMonth: '2026-11'
    });
  });

  it("abonné mais jamais servi : le jour reste vide (lastDispatchAt n'est que l'heure d'abonnement)", () => {
    set({ last_dispatch_at: Date.parse('2026-11-23T12:00:00Z') / 1000 });
    changeTimezone(tdb.db, userId, 'America/Guadeloupe');
    expect(row().lastDispatchDate).toBeNull();
  });
});
