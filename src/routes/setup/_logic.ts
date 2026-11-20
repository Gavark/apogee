import type { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { hashPassword, isStrongEnough } from '$lib/server/auth/password';
import { hasNoUsers, insertHouseholdAndAdmin } from '$lib/server/auth/bootstrap';
import { MAX_HOUSEHOLD_NAME_LEN } from '$lib/server/households';
import { normalizeEmail, isValidEmail } from '$lib/server/auth/email';

type DB = ReturnType<typeof drizzle<typeof schema>>;

export type SetupResult =
  | { ok: true; userId: number }
  | { ok: false; reason: 'already-setup' | 'weak-password' | 'invalid-email' | 'household-name-required' | 'household-name-too-long' };

/**
 * Wizard-driven counterpart to bootstrapAdmin. Refuses if any user already
 * exists so the endpoint cannot be replayed to take over an existing instance.
 * Reasons are codes; the page maps them to messages.
 */
export async function setupFirstAdmin(
  db: DB,
  input: { email: string; password: string; householdName: string; locale: 'fr' | 'en' }
): Promise<SetupResult> {
  if (!hasNoUsers(db)) return { ok: false, reason: 'already-setup' };
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? '');
  const householdName = String(input.householdName ?? '').trim();
  if (!isValidEmail(email)) return { ok: false, reason: 'invalid-email' };
  if (!isStrongEnough(password)) return { ok: false, reason: 'weak-password' };
  if (!householdName) return { ok: false, reason: 'household-name-required' };
  if (householdName.length > MAX_HOUSEHOLD_NAME_LEN) return { ok: false, reason: 'household-name-too-long' };

  const passwordHash = await hashPassword(password);
  // The hasNoUsers re-check inside the transaction guards against two parallel
  // POSTs both passing the check above while the hash was computing.
  return db.transaction((tx) => {
    if (!hasNoUsers(tx)) return { ok: false, reason: 'already-setup' as const };
    const userId = insertHouseholdAndAdmin(tx, { email, passwordHash, householdName, locale: input.locale });
    return { ok: true, userId };
  });
}
