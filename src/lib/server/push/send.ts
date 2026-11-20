import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '../db/schema';
import { getVapidKeys, vapidDetails } from './vapid';
import { deleteSubscriptionByEndpoint, listSubscriptionsForUser } from './subscribe';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export type PushPayload = { title: string; body: string; url: string; tag: string };

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type PushSender = (
  sub: PushTarget,
  payload: PushPayload,
  vapid: ReturnType<typeof vapidDetails>
) => Promise<{ statusCode: number }>;

/** A stalled push service must not hold a tick open. */
const PUSH_TIMEOUT_MS = 15_000;

/** Real sender; a rejected promise (WebPushError) carries `statusCode`. */
export const webPushSender: PushSender = async (sub, payload, vapid) => {
  const res = await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
    { vapidDetails: vapid, TTL: 86400, timeout: PUSH_TIMEOUT_MS }
  );
  return { statusCode: res.statusCode };
};

/**
 * Send one payload to every subscription of a user.
 * 404/410 delete the subscription (`dead`); any other error or non-2xx is
 * `failed`, logged by status / error name only (endpoints are capability URLs).
 * Never throws.
 */
export async function sendToUser(
  db: DB,
  userId: number,
  payload: PushPayload,
  sender: PushSender = webPushSender
): Promise<{ sent: number; dead: number; failed: number }> {
  const result = { sent: 0, dead: 0, failed: 0 };
  const subs = listSubscriptionsForUser(db, userId);
  if (subs.length === 0) return result;
  let vapid: ReturnType<typeof vapidDetails>;
  try {
    vapid = vapidDetails(await getVapidKeys(db));
  } catch (e) {
    console.error('[push] vapid keys unavailable', { error: (e as { name?: string } | null)?.name ?? 'Error' });
    result.failed = subs.length;
    return result;
  }

  for (const sub of subs) {
    let status: number | undefined;
    let errName: string | undefined;
    try {
      status = (await sender({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload, vapid))
        .statusCode;
    } catch (e) {
      status = (e as { statusCode?: number } | null)?.statusCode;
      errName = (e as { name?: string } | null)?.name ?? 'Error';
    }

    if (status === 404 || status === 410) {
      deleteSubscriptionByEndpoint(db, sub.endpoint);
      result.dead += 1;
    } else if (errName === undefined && status !== undefined && status >= 200 && status < 300) {
      db.update(schema.pushSubscriptions)
        .set({ lastSeenAt: Math.floor(Date.now() / 1000) })
        .where(eq(schema.pushSubscriptions.id, sub.id))
        .run();
      result.sent += 1;
    } else {
      console.error('[push] send failed', { status, error: errName });
      result.failed += 1;
    }
  }
  return result;
}
