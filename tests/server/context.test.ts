import { describe, it, expect } from 'vitest';
import { requireCtx, NotFoundError } from '../../src/lib/server/context';

function locals(user: unknown): App.Locals {
  return { user, session: null, theme: 'auto', locale: 'fr' } as unknown as App.Locals;
}

describe('requireCtx', () => {
  it('redirects to /login without user', () => {
    try {
      requireCtx(locals(null));
      expect.unreachable();
    } catch (e: any) {
      expect(e.status).toBe(303);
      expect(e.location).toBe('/login');
    }
  });

  it('returns userId, householdId, isAdmin', () => {
    expect(requireCtx(locals({ id: 7, householdId: 3, isAdmin: 1 }))).toEqual({
      userId: 7,
      householdId: 3,
      isAdmin: true
    });
    expect(requireCtx(locals({ id: 8, householdId: 3, isAdmin: 0 })).isAdmin).toBe(false);
  });

  it('NotFoundError is an Error', () => {
    expect(new NotFoundError('x')).toBeInstanceOf(Error);
    expect(new NotFoundError('x').name).toBe('NotFoundError');
  });
});
