import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  resolveInstanceTimezone,
  DEFAULT_TIMEZONE,
  canonicalTimeZone,
  timeZoneOptions,
  localClock,
  zonedParts
} from '../../src/lib/server/timezone';
import { makeTestDb } from '../helpers/db';
import { setupFirstAdmin } from '../../src/routes/setup/_logic';
import { bootstrapAdmin } from '../../src/lib/server/auth/bootstrap';
import { signupWithToken } from '../../src/routes/signup/_logic';
import { createInvitation } from '../../src/lib/server/auth/invitations';
import { makeHousehold, makeUser } from '../helpers/fixtures';

describe('resolveInstanceTimezone', () => {
  it('garde une zone IANA valide', () => {
    expect(resolveInstanceTimezone('America/Montreal')).toBe('America/Montreal');
    expect(resolveInstanceTimezone('UTC')).toBe('UTC');
  });
  it("retombe sur Europe/Paris quand TZ est absent, vide ou invalide", () => {
    for (const tz of [undefined, '', '  ', 'Mars/Olympus', ':/etc/localtime', 'pas une zone'])
      expect(resolveInstanceTimezone(tz)).toBe(DEFAULT_TIMEZONE);
    expect(DEFAULT_TIMEZONE).toBe('Europe/Paris');
  });
  it('lit process.env.TZ par défaut', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo');
    expect(resolveInstanceTimezone()).toBe('Asia/Tokyo');
  });
});

describe('fuseau des nouveaux comptes', () => {
  afterEach(() => vi.unstubAllEnvs());
  const tzOf = (tdb: ReturnType<typeof makeTestDb>, email: string) =>
    tdb.db.select().from(tdb.schema.users).all().find((u) => u.email === email)?.timezone;

  it('setup, amorçage et inscription utilisent TZ', async () => {
    vi.stubEnv('TZ', 'America/Montreal');
    const a = makeTestDb();
    await setupFirstAdmin(a.db, { email: 'a@x.fr', password: 'motdepasse-long', householdName: 'F', locale: 'fr' });
    expect(tzOf(a, 'a@x.fr')).toBe('America/Montreal');

    const b = makeTestDb();
    await bootstrapAdmin(b.db, { email: 'b@x.fr', password: 'motdepasse-long' });
    expect(tzOf(b, 'b@x.fr')).toBe('America/Montreal');

    const h = makeHousehold(a);
    const admin = makeUser(a, h, { isAdmin: true });
    const inv = createInvitation(a.db, { createdBy: admin, householdId: h });
    const res = await signupWithToken(a.db, { token: inv.token, email: 'c@x.fr', password: 'motdepasse-long' });
    expect(res.ok).toBe(true);
    expect(tzOf(a, 'c@x.fr')).toBe('America/Montreal');
  });

  it('TZ invalide → Europe/Paris', async () => {
    vi.stubEnv('TZ', 'Nope/Nowhere');
    const a = makeTestDb();
    await setupFirstAdmin(a.db, { email: 'a@x.fr', password: 'motdepasse-long', householdName: 'F', locale: 'fr' });
    expect(tzOf(a, 'a@x.fr')).toBe('Europe/Paris');
  });
});

describe('canonicalTimeZone', () => {
  it('accepte une zone IANA connue', () => {
    expect(canonicalTimeZone('America/Guadeloupe')).toBe('America/Guadeloupe');
    expect(canonicalTimeZone('Europe/Paris')).toBe('Europe/Paris');
    expect(canonicalTimeZone('UTC')).toBe('UTC');
    expect(canonicalTimeZone('  Pacific/Auckland  ')).toBe('Pacific/Auckland');
  });
  it('rend le nom canonique (casse, alias)', () => {
    expect(canonicalTimeZone('europe/paris')).toBe('Europe/Paris');
    expect(canonicalTimeZone('Etc/UTC')).toBe('UTC');
    // Alias: whatever name the runtime treats as canonical, it is one of the options.
    const ids = timeZoneOptions().map((o) => o.id);
    expect(ids).toContain(canonicalTimeZone('America/Montreal'));
    expect(ids).toContain(canonicalTimeZone('Asia/Kolkata'));
  });
  it('rejette tout ce qui n’est pas une zone IANA', () => {
    for (const z of [
      undefined, null, 42, {}, '', '   ', 'Mars/Olympus', 'pas une zone', '+05:00', '-04:00', 'GMT+4',
      ':/etc/localtime', 'Europe/Paris\u0000', 'A'.repeat(100)
    ])
      expect(canonicalTimeZone(z)).toBeNull();
  });
});

describe('timeZoneOptions', () => {
  it('libellé « (UTC±hh:mm) Zone » avec le décalage actuel, et chaque option est valide', () => {
    const opts = timeZoneOptions(new Date('2026-11-23T12:00:00Z'));
    expect(opts.map((o) => o.id)).toContain('UTC');
    expect(opts.find((o) => o.id === 'America/Guadeloupe')?.label).toBe('(UTC−04:00) America/Guadeloupe');
    expect(opts.find((o) => o.id === 'Europe/Paris')?.label).toBe('(UTC+01:00) Europe/Paris');
    expect(opts.find((o) => o.id === 'America/New_York')?.label).toBe('(UTC−05:00) America/New York');
    const kathmandu = canonicalTimeZone('Asia/Kathmandu')!; // Asia/Katmandu on some ICU versions
    expect(opts.find((o) => o.id === kathmandu)?.label).toBe(`(UTC+05:45) ${kathmandu}`);
    for (const o of opts) expect(canonicalTimeZone(o.id)).toBe(o.id);
  });
  it('triée par décalage croissant, puis par nom à décalage égal', () => {
    const now = new Date('2026-11-23T12:00:00Z');
    const opts = timeZoneOptions(now);
    const offset = (id: string) => zonedParts(now.getTime(), id).offsetMs;
    for (let i = 1; i < opts.length; i++) {
      const [a, b] = [opts[i - 1].id, opts[i].id];
      expect(offset(a) < offset(b) || (offset(a) === offset(b) && a < b), `${a} avant ${b}`).toBe(true);
    }
    const ids = opts.map((o) => o.id);
    expect(ids.indexOf('America/Guadeloupe')).toBeLessThan(ids.indexOf('UTC'));
    expect(ids.indexOf('UTC')).toBeLessThan(ids.indexOf('Europe/Paris'));
  });
  it("suit l'heure d'été", () => {
    expect(timeZoneOptions(new Date('2027-07-01T12:00:00Z')).find((o) => o.id === 'Europe/Paris')?.label).toBe(
      '(UTC+02:00) Europe/Paris'
    );
  });
});

describe('localClock', () => {
  it('date, mois et heure locaux', () => {
    const ms = Date.parse('2026-12-31T23:30:00Z');
    expect(localClock(ms, 'America/Guadeloupe')).toEqual({ date: '2026-12-31', month: '2026-12', hour: 19 });
    expect(localClock(ms, 'Europe/Paris')).toEqual({ date: '2027-01-01', month: '2027-01', hour: 0 });
  });
});
