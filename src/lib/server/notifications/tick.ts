import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '../db/schema';
import { localClock } from '../timezone';
import { sendToUser, webPushSender, type PushSender } from '../push/send';
import { currentYear } from '../../phase';
import { buildDigest, formatDigest } from './digest';
import { householdReferenceTimeZone, scanHouseholdPhases } from './phases';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

const { users } = schema;

/** The digest goes out from this local hour on. */
const DISPATCH_HOUR = 18;

let running = false;

/**
 * Sends at most one digest per subscribed user per local day, from 18:00 local time; a user whose
 * evening was missed (server down) is served at the first pass afterwards, with everything since.
 * The day is claimed atomically BEFORE sending (at-most-once: a crash mid-send loses one evening),
 * and overlapping runs are refused. One user's failure never blocks the others.
 */
export async function runNotificationTick(
  db: DB,
  now: Date,
  sender: PushSender = webPushSender
): Promise<{ processed: number; sent: number }> {
  if (running) return { processed: 0, sent: 0 };
  running = true;
  try {
    return await tickOnce(db, now, sender);
  } finally {
    running = false;
  }
}

async function tickOnce(db: DB, now: Date, sender: PushSender): Promise<{ processed: number; sent: number }> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const candidates = db
    .select()
    .from(users)
    .where(sql`exists (select 1 from push_subscriptions where push_subscriptions.user_id = ${users.id})`)
    .all();

  let processed = 0;
  let sent = 0;
  for (const user of candidates) {
    try {
      const local = localClock(now.getTime(), user.timezone);
      if (local.hour < DISPATCH_HOUR || user.lastDispatchDate === local.date) continue;

      // Claim the day. The reminder is evaluated once per month (here, at the first processed evening),
      // so lastMonthlyMonth advances on every dispatch; the digest below reads the previous values.
      // The claim also requires the time zone read above: a change made meanwhile (during an earlier
      // user's send) re-expressed lastDispatchDate in the new zone, and `local` is in the old one.
      const claimed = db
        .update(users)
        .set({ lastDispatchDate: local.date, lastDispatchAt: nowSec, lastMonthlyMonth: local.month })
        .where(
          and(
            eq(users.id, user.id),
            eq(users.timezone, user.timezone),
            or(isNull(users.lastDispatchDate), ne(users.lastDispatchDate, local.date))
          )
        )
        .returning({ id: users.id })
        .all();
      if (claimed.length === 0) continue;
      processed++;

      const refZone = householdReferenceTimeZone(db, user.householdId);
      const year = currentYear(refZone, now);
      scanHouseholdPhases(db, user.householdId, year, localClock(now.getTime(), refZone).date, nowSec);

      const locale = user.locale === 'en' ? 'en' : 'fr';
      const digest = buildDigest(db, user, local.month, year, locale);
      if (digest) {
        const res = await sendToUser(db, user.id, formatDigest(digest, locale), sender);
        if (res.sent > 0) sent++;
        else if (res.failed > 0) {
          // Every device failed transiently: keep the day claimed (still at most one push a day) but
          // give the window and the monthly evaluation back, so tomorrow's digest carries everything.
          db.update(users)
            .set({ lastDispatchAt: user.lastDispatchAt, lastMonthlyMonth: user.lastMonthlyMonth })
            .where(eq(users.id, user.id))
            .run();
        }
      }
    } catch (e) {
      console.error('[notifications] tick failed for a user:', e instanceof Error ? e.name : 'unknown');
    }
  }
  return { processed, sent };
}
