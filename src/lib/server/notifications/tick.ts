import { eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '../db/schema';
import { zonedParts } from '../label-analyses';
import { sendToUser, webPushSender, type PushSender } from '../push/send';
import { currentYear } from '../../phase';
import { buildDigest, formatDigest } from './digest';
import { householdReferenceTimeZone, scanHouseholdPhases } from './phases';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

const { users } = schema;

/** The digest goes out from this local hour on. */
const DISPATCH_HOUR = 18;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date (YYYY-MM-DD), month (YYYY-MM) and hour of `now` in `timeZone`. */
function localClock(now: Date, timeZone: string): { date: string; month: string; hour: number } {
  const { y, mo, d, h } = zonedParts(now.getTime(), timeZone);
  return { date: `${y}-${pad(mo)}-${pad(d)}`, month: `${y}-${pad(mo)}`, hour: h };
}

/**
 * Sends at most one digest per subscribed user per local day, from 18:00 local time; a user whose
 * evening was missed (server down) is served at the first pass afterwards, with everything since.
 * One user's failure never blocks the others.
 */
export async function runNotificationTick(
  db: DB,
  now: Date,
  sender: PushSender = webPushSender
): Promise<{ processed: number; sent: number }> {
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
      const local = localClock(now, user.timezone);
      if (local.hour < DISPATCH_HOUR || user.lastDispatchDate === local.date) continue;

      const refZone = householdReferenceTimeZone(db, user.householdId);
      const year = currentYear(refZone, now);
      scanHouseholdPhases(db, user.householdId, year, localClock(now, refZone).date, nowSec);

      const digest = buildDigest(db, user, local.month, year);
      if (digest) {
        const res = await sendToUser(db, user.id, formatDigest(digest, user.locale === 'en' ? 'en' : 'fr'), sender);
        if (res.sent > 0) sent++;
      }
      db.update(users)
        .set({
          lastDispatchDate: local.date,
          lastDispatchAt: nowSec,
          ...(digest?.monthly ? { lastMonthlyMonth: local.month } : {})
        })
        .where(eq(users.id, user.id))
        .run();
      processed++;
    } catch (e) {
      console.error('[notifications] tick failed for a user:', e instanceof Error ? e.name : 'unknown');
    }
  }
  return { processed, sent };
}
