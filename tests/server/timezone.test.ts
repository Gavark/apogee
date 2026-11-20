import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveInstanceTimezone, DEFAULT_TIMEZONE } from '../../src/lib/server/timezone';
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
