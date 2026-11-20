import { asc, eq, gt, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '../db/schema';
import { computePhase, type Phase, type WindowYears } from '../../phase';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

const { wines, stockLots, notificationLog, households, users } = schema;

/** Phases whose arrival is worth a notification (too_young and unknown never are). */
export const NOTIFIED_PHASES = ['ready', 'peak', 'last_call', 'past'] as const;
export type NotifiedPhase = (typeof NOTIFIED_PHASES)[number];

const isNotified = (p: Phase): p is NotifiedPhase => (NOTIFIED_PHASES as readonly string[]).includes(p);

const windowOf = (w: WindowYears): WindowYears => ({
  drinkFrom: w.drinkFrom,
  peakFrom: w.peakFrom,
  peakTo: w.peakTo,
  drinkUntil: w.drinkUntil
});

/**
 * Records the wine's current phase as already seen (silent), so a change the user made themselves
 * is never announced by the daily scan. No-op for non-notifiable phases or a phase already logged.
 */
export function markCurrentPhaseSilently(db: DB, wineId: number, year: number): void {
  const wine = db.select().from(wines).where(eq(wines.id, wineId)).get();
  if (!wine) return;
  const phase = computePhase(windowOf(wine), year);
  if (!isNotified(phase)) return;
  db.insert(notificationLog)
    .values({ wineId, phase, detectedAt: Math.floor(Date.now() / 1000), silent: 1 })
    .onConflictDoNothing()
    .run();
}

/**
 * Logs, once per day, the notifiable phases newly reached by in-stock wines of the household.
 * The household's very first scan only primes the log (all silent), so an upgrade never bursts.
 */
export function scanHouseholdPhases(
  db: DB,
  householdId: number,
  year: number,
  today: string,
  now: number
): { newEvents: number } {
  return db.transaction((tx) => {
    const household = tx.select().from(households).where(eq(households.id, householdId)).get();
    if (!household || household.phaseScanDate === today) return { newEvents: 0 };
    const silent = household.phaseScanDate === null ? 1 : 0;

    const inStock = tx
      .select({ wine: wines })
      .from(wines)
      .innerJoin(stockLots, eq(stockLots.wineId, wines.id))
      .where(eq(wines.householdId, householdId))
      .groupBy(wines.id)
      .having(gt(sql`sum(${stockLots.quantity})`, 0))
      .all();

    let newEvents = 0;
    for (const { wine } of inStock) {
      const phase = computePhase(windowOf(wine), year);
      if (!isNotified(phase)) continue;
      const inserted = tx
        .insert(notificationLog)
        .values({ wineId: wine.id, phase, detectedAt: now, silent })
        .onConflictDoNothing()
        .returning({ id: notificationLog.id })
        .all();
      if (!silent) newEvents += inserted.length;
    }
    tx.update(households).set({ phaseScanDate: today }).where(eq(households.id, householdId)).run();
    return { newEvents };
  });
}

/** Time zone of the household's oldest member (lowest user id); Europe/Paris when it has none. */
export function householdReferenceTimeZone(db: DB, householdId: number): string {
  const row = db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.householdId, householdId))
    .orderBy(asc(users.id))
    .get();
  return row?.timezone ?? 'Europe/Paris';
}
