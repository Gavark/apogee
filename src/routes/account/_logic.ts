import { eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { hashPassword, verifyPassword, isStrongEnough } from '$lib/server/auth/password';
import { deleteOtherSessionsForUser } from '$lib/server/auth/session';
import { canonicalTimeZone, localClock } from '$lib/server/timezone';

type DB = ReturnType<typeof drizzle<typeof schema>>;

export type ChangeResult = { ok: true } | { ok: false; reason: 'wrong-current' | 'mismatch' | 'weak' };

/** Changes the password and signs out every other device. */
export async function changePassword(
  db: DB,
  userId: number,
  currentSessionId: string,
  input: { current: string; next: string; confirm: string }
): Promise<ChangeResult> {
  if (input.next !== input.confirm) return { ok: false, reason: 'mismatch' };
  if (!isStrongEnough(input.next)) return { ok: false, reason: 'weak' };
  const u = db.select().from(schema.users).where(eq(schema.users.id, userId)).all()[0];
  if (!u) return { ok: false, reason: 'wrong-current' };
  if (!(await verifyPassword(u.passwordHash, input.current))) return { ok: false, reason: 'wrong-current' };
  const hash = await hashPassword(input.next);
  const t = Math.floor(Date.now() / 1000);
  db.update(schema.users).set({ passwordHash: hash, updatedAt: t }).where(eq(schema.users.id, userId)).run();
  deleteOtherSessionsForUser(db, userId, currentSessionId);
  return { ok: true };
}

export type TimezoneResult = { ok: true; timezone: string; changed: boolean } | { ok: false; reason: 'invalid' };

/**
 * Sets the account time zone (canonical IANA name). The daily digest is claimed per LOCAL day
 * (`lastDispatchDate`, in the old zone): it is re-expressed as the date, in the new zone, of the last
 * dispatch (`lastDispatchAt`), so the next digest follows the new zone's days, never twice on the
 * same day and never skipping a day that had none. `lastMonthlyMonth` names the month whose reminder
 * was already evaluated, whatever the zone: it is kept. After an evening where every device failed,
 * `lastDispatchAt` still points to the last digest received, so the new zone may retry that day.
 */
export function changeTimezone(db: DB, userId: number, input: unknown): TimezoneResult {
  const zone = canonicalTimeZone(input);
  if (!zone) return { ok: false, reason: 'invalid' };
  const u = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!u) return { ok: false, reason: 'invalid' };
  if (u.timezone === zone) return { ok: true, timezone: zone, changed: false };
  // Without a claimed day, lastDispatchAt is only the subscription time (digest window start): nothing to move.
  const lastDispatchDate =
    u.lastDispatchDate === null || u.lastDispatchAt === null ? null : localClock(u.lastDispatchAt * 1000, zone).date;
  db.update(schema.users)
    .set({ timezone: zone, lastDispatchDate, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.users.id, userId))
    .run();
  return { ok: true, timezone: zone, changed: true };
}
