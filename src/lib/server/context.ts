import { redirect } from '@sveltejs/kit';

export type HouseholdCtx = { userId: number; householdId: number; isAdmin: boolean };

/** Thrown when a row does not exist or belongs to another household. */
export class NotFoundError extends Error {
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function requireCtx(locals: App.Locals): HouseholdCtx {
  const user = locals.user;
  if (!user) throw redirect(303, '/login');
  return { userId: user.id, householdId: user.householdId, isAdmin: user.isAdmin === 1 };
}
