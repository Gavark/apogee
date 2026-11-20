import { describe, it, expect } from 'vitest';
import { rootRedirectTarget } from '../../src/routes/_logic';
import { toPublicUser } from '../../src/lib/server/auth/public-user';
import { load as layoutLoad } from '../../src/routes/+layout.server';
import { load as rootLoad } from '../../src/routes/+page.server';
import type { User } from '../../src/lib/server/db/schema';

const user: User = {
  id: 7,
  email: 'a@x.fr',
  passwordHash: '$argon2id$secret',
  isAdmin: 1,
  timezone: 'Europe/Paris',
  locale: 'fr',
  notifyPhases: 1,
  notifyMonthly: 1,
  lastDispatchDate: null,
  lastDispatchAt: null,
  lastMonthlyMonth: null,
  householdId: 3,
  createdAt: 1,
  updatedAt: 2
};

describe('GET /', () => {
  it('redirige vers /app si connecté, sinon /login', () => {
    expect(rootRedirectTarget(user)).toBe('/app');
    expect(rootRedirectTarget(null)).toBe('/login');
  });

  it('le load lève une redirection 303', () => {
    const run = (u: User | null) => {
      try {
        (rootLoad as (e: unknown) => unknown)({ locals: { user: u } });
      } catch (e) {
        return e as { status: number; location: string };
      }
      throw new Error('no redirect');
    };
    expect(run(user)).toMatchObject({ status: 303, location: '/app' });
    expect(run(null)).toMatchObject({ status: 303, location: '/login' });
  });
});

describe('utilisateur exposé au navigateur', () => {
  it("toPublicUser ne garde que les champs d'affichage", () => {
    expect(toPublicUser(user)).toEqual({
      id: 7,
      email: 'a@x.fr',
      isAdmin: true,
      timezone: 'Europe/Paris',
      locale: 'fr',
      householdId: 3
    });
    expect(toPublicUser(null)).toBeNull();
  });

  it('le load du layout racine ne renvoie jamais passwordHash', () => {
    const out = (layoutLoad as (e: unknown) => { user: unknown })({
      locals: { user, theme: 'auto', locale: 'fr' }
    });
    expect(JSON.stringify(out)).not.toContain('passwordHash');
    expect(JSON.stringify(out)).not.toContain('argon2id');
    expect(out.user).toMatchObject({ id: 7, timezone: 'Europe/Paris' });
  });
});
