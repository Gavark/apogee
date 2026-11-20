import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '$lib/server/db/schema';
import { listSubscriptionsForUser } from '$lib/server/push/subscribe';
import { sendToUser, type PushPayload, type PushSender } from '$lib/server/push/send';
import { rateLimit } from '$lib/server/rate-limit';
import * as m from '$paraglide/messages';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export const TEST_LIMIT_PER_HOUR = 3;

export const testRateKey = (userId: number) => `notif-test:${userId}`;

export type NotificationSettings = {
  notifyPhases: boolean;
  notifyMonthly: boolean;
  devices: { id: number; userAgent: string | null; createdAt: number; lastSeenAt: number }[];
};

/** Toggles and this user's own devices (endpoint and keys stay server-side). */
export function getNotificationSettings(db: DB, userId: number): NotificationSettings {
  const u = db
    .select({ notifyPhases: schema.users.notifyPhases, notifyMonthly: schema.users.notifyMonthly })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .all()[0];
  return {
    notifyPhases: (u?.notifyPhases ?? 1) === 1,
    notifyMonthly: (u?.notifyMonthly ?? 1) === 1,
    devices: listSubscriptionsForUser(db, userId)
      .map((s) => ({ id: s.id, userAgent: s.userAgent, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt }))
      .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
  };
}

export function saveNotificationSettings(
  db: DB,
  userId: number,
  input: { notifyPhases: boolean; notifyMonthly: boolean }
): void {
  db.update(schema.users)
    .set({ notifyPhases: input.notifyPhases ? 1 : 0, notifyMonthly: input.notifyMonthly ? 1 : 0 })
    .where(eq(schema.users.id, userId))
    .run();
}

/** Sends a test push to all of the user's devices. `null` when the hourly limit is reached. */
export async function sendTestNotification(
  db: DB,
  userId: number,
  locale: 'fr' | 'en',
  sender?: PushSender
): Promise<{ sent: number; dead: number; failed: number } | null> {
  if (listSubscriptionsForUser(db, userId).length === 0) return { sent: 0, dead: 0, failed: 0 };
  if (!rateLimit(testRateKey(userId), TEST_LIMIT_PER_HOUR, 3600)) return null;
  const payload: PushPayload = {
    title: 'Apogée',
    body: m.notif_test_body({}, { locale }),
    url: '/app',
    tag: 'apogee-test'
  };
  return sendToUser(db, userId, payload, sender);
}
