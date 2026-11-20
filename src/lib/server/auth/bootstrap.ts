import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '../db/schema';
import { hashPassword, isStrongEnough } from './password';
import { normalizeEmail } from './email';
import { resolveInstanceTimezone } from '../timezone';

// Widened so transaction-scoped handles passed in by db.transaction(...) also satisfy it.
type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/** True when the users table is empty (i.e. first-run / wizard mode). */
export function hasNoUsers(db: DB): boolean {
  return db.select().from(schema.users).all().length === 0;
}

/** Creates the household then its admin, atomically. Callers check hasNoUsers first. */
export function insertHouseholdAndAdmin(
  db: DB,
  input: { email: string; passwordHash: string; householdName: string; locale?: 'fr' | 'en' }
): number {
  const t = Math.floor(Date.now() / 1000);
  return db.transaction((tx) => {
    const household = tx
      .insert(schema.households)
      .values({ name: input.householdName, createdAt: t })
      .returning()
      .all()[0];
    const user = tx
      .insert(schema.users)
      .values({
        email: input.email,
        passwordHash: input.passwordHash,
        isAdmin: 1,
        locale: input.locale ?? 'fr',
        timezone: resolveInstanceTimezone(),
        householdId: household.id,
        createdAt: t,
        updatedAt: t
      })
      .returning()
      .all()[0];
    return user.id;
  });
}

export async function bootstrapAdmin(
  db: DB,
  env: { email?: string; password?: string; householdName?: string }
) {
  if (!env.email || !env.password) return;
  if (!hasNoUsers(db)) return;
  if (!isStrongEnough(env.password)) {
    throw new Error('ADMIN_PASSWORD too weak (need at least 10 chars)');
  }
  const passwordHash = await hashPassword(env.password);
  insertHouseholdAndAdmin(db, {
    email: normalizeEmail(env.email),
    passwordHash,
    householdName: env.householdName?.trim() || 'Ma cave'
  });
}
