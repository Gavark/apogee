import type { User } from '../db/schema';

/** The only user fields the browser may see (never the password hash). */
export type PublicUser = {
  id: number;
  email: string;
  isAdmin: boolean;
  timezone: string;
  locale: string;
  householdId: number;
};

export function toPublicUser(user: User | null): PublicUser | null {
  if (!user) return null;
  const { id, email, isAdmin, timezone, locale, householdId } = user;
  return { id, email, isAdmin: isAdmin === 1, timezone, locale, householdId };
}
