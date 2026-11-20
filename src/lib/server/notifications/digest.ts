import { and, eq, gt, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '../db/schema';
import { listCellar, type CellarRow } from '../wines';
import type { PushPayload } from '../push/send';
import * as m from '$paraglide/messages';
import { NOTIFIED_PHASES, type NotifiedPhase } from './phases';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

const { wines, stockLots, notificationLog } = schema;

export type Digest = {
  phaseCounts: Partial<Record<NotifiedPhase, number>>;
  monthly: { bottles: number; names: string[] } | null;
};

export type DigestUser = {
  id: number;
  householdId: number;
  notifyPhases: number;
  notifyMonthly: number;
  lastDispatchAt: number | null;
  lastMonthlyMonth: string | null;
};

const MAX_NAMES = 3;

type NameLocale = { locale?: 'fr' | 'en' };

/** "Producer Cuvée-or-appellation Vintage", e.g. "Chinon 2016". */
function displayName(w: CellarRow['wine'], opts: NameLocale): string {
  const label = [w.producer, w.cuvee || w.appellation, w.vintage].filter((x) => x !== null && x !== '').join(' ');
  return label || m.wine_unnamed({}, opts);
}

/** Wines with a notifiable change since the user's last dispatch (still in stock), each counted once at its most advanced phase. */
function countPhaseEvents(db: DB, user: DigestUser): Digest['phaseCounts'] {
  const since = user.lastDispatchAt ?? -1;
  const rows = db
    .select({ wineId: notificationLog.wineId, phase: notificationLog.phase })
    .from(notificationLog)
    .innerJoin(wines, eq(wines.id, notificationLog.wineId))
    .where(
      and(
        eq(wines.householdId, user.householdId),
        eq(notificationLog.silent, 0),
        gt(notificationLog.detectedAt, since),
        sql`(select coalesce(sum(${stockLots.quantity}), 0) from ${stockLots} where ${stockLots.wineId} = ${wines.id}) > 0`
      )
    )
    .all();
  const rank = (p: string) => (NOTIFIED_PHASES as readonly string[]).indexOf(p);
  const best = new Map<number, NotifiedPhase>();
  for (const r of rows) {
    if (rank(r.phase) < 0) continue;
    const cur = best.get(r.wineId);
    if (cur === undefined || rank(r.phase) > rank(cur)) best.set(r.wineId, r.phase as NotifiedPhase);
  }
  const counts: Digest['phaseCounts'] = {};
  for (const p of best.values()) counts[p] = (counts[p] ?? 0) + 1;
  return counts;
}

function monthlyReminder(db: DB, user: DigestUser, year: number, opts: NameLocale): Digest['monthly'] {
  const urgent = listCellar(db, { userId: user.id, householdId: user.householdId, isAdmin: false }, {}, year).filter(
    (r) => r.bottles > 0 && (r.phase === 'last_call' || r.phase === 'past')
  );
  if (urgent.length === 0) return null;
  urgent.sort(
    (a, b) =>
      Number(b.phase === 'past') - Number(a.phase === 'past') ||
      (a.wine.drinkUntil ?? Infinity) - (b.wine.drinkUntil ?? Infinity) ||
      a.wine.id - b.wine.id
  );
  return {
    bottles: urgent.reduce((sum, r) => sum + r.bottles, 0),
    names: urgent.slice(0, MAX_NAMES).map((r) => displayName(r.wine, opts))
  };
}

export function buildDigest(
  db: DB,
  user: DigestUser,
  monthKey: string,
  year: number,
  locale: 'fr' | 'en' = 'fr'
): Digest | null {
  const phaseCounts = user.notifyPhases ? countPhaseEvents(db, user) : {};
  const monthly =
    user.notifyMonthly && user.lastMonthlyMonth !== monthKey ? monthlyReminder(db, user, year, { locale }) : null;
  if (Object.keys(phaseCounts).length === 0 && !monthly) return null;
  return { phaseCounts, monthly };
}

const PHASE_MESSAGES: Record<NotifiedPhase, (i: { count: number }, o: NameLocale) => string> = {
  ready: m.notif_digest_ready,
  peak: m.notif_digest_peak,
  last_call: m.notif_digest_last_call,
  past: m.notif_digest_past
};

export function formatDigest(d: Digest, locale: 'fr' | 'en'): PushPayload {
  const opts = { locale };
  const parts: string[] = NOTIFIED_PHASES.filter((p) => (d.phaseCounts[p] ?? 0) > 0).map((p) =>
    PHASE_MESSAGES[p]({ count: d.phaseCounts[p]! }, opts)
  );
  // Sentence case for the first phrase, then the phases read as one sentence.
  let body = parts.join(', ');
  if (body) body = body.charAt(0).toUpperCase() + body.slice(1) + '.';
  if (d.monthly)
    body = [body, m.notif_digest_monthly({ count: d.monthly.bottles, names: d.monthly.names.join(', ') }, opts)]
      .filter(Boolean)
      .join(' ');
  return { title: 'Apogée', body, url: '/app', tag: 'apogee-daily' };
}
