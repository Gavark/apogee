import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../../helpers/fixtures';
import {
  NOTIFIED_PHASES,
  markCurrentPhaseSilently,
  scanHouseholdPhases,
  householdReferenceTimeZone
} from '../../../src/lib/server/notifications/phases';
import { createWine, updateWine, applyAiWindow, type WineInput } from '../../../src/lib/server/wines';
import { currentYear } from '../../../src/lib/phase';
import type { HouseholdCtx } from '../../../src/lib/server/context';

const NOW = 1_800_000_000;
const TODAY = '2027-01-01';

let tdb: ReturnType<typeof makeTestDb>;
let ctx: HouseholdCtx;
let hh: number;
let loc: number;

function win(drinkFrom: number | null, peakFrom: number | null, peakTo: number | null, drinkUntil: number | null) {
  return { drinkFrom, peakFrom, peakTo, drinkUntil };
}
function wine(window = win(null, null, null, null), producer = 'P'): WineInput {
  return {
    producer, cuvee: null, appellation: null, region: null, country: null, color: 'red',
    vintage: 2010, grapes: null, formatCl: 75, acquiredYear: null, window, notes: null
  };
}
const add = (window: ReturnType<typeof win>, qty = 1, producer = 'P') =>
  createWine(tdb.db, ctx, wine(window, producer), { locationId: loc, position: '', quantity: qty }).wineId;
const log = (wineId?: number) => {
  const rows = tdb.db.select().from(tdb.schema.notificationLog).all();
  return wineId === undefined ? rows : rows.filter((r) => r.wineId === wineId);
};
/** Inserts directly (no silent marking), to simulate pre-existing data. */
const insertWine = (window: ReturnType<typeof win>, qty: number, producer: string) => {
  const id = tdb.db
    .insert(tdb.schema.wines)
    .values({
      householdId: hh, producer, formatCl: 75, vintage: 2010, identityKey: producer,
      drinkFrom: window.drinkFrom, peakFrom: window.peakFrom, peakTo: window.peakTo, drinkUntil: window.drinkUntil
    })
    .returning({ id: tdb.schema.wines.id })
    .get().id;
  tdb.db.insert(tdb.schema.stockLots).values({ wineId: id, locationId: loc, position: '', quantity: qty }).run();
  return id;
};

beforeEach(() => {
  tdb = makeTestDb();
  hh = makeHousehold(tdb);
  const userId = makeUser(tdb, hh);
  loc = makeLocation(tdb, hh, 'Cave');
  ctx = { userId, householdId: hh } as HouseholdCtx;
});

describe('phases', () => {
  it('NOTIFIED_PHASES', () => expect([...NOTIFIED_PHASES]).toEqual(['ready', 'peak', 'last_call', 'past']));

  it("premier scan d'un foyer : tout est silencieux, aucun événement", () => {
    const y = currentYear('Europe/Paris');
    insertWine(win(y - 2, null, null, y + 5), 2, 'A'); // ready
    insertWine(win(y - 5, y - 1, y + 1, y + 9), 2, 'B'); // peak
    const r = scanHouseholdPhases(tdb.db, hh, y, TODAY, NOW);
    expect(r.newEvents).toBe(0);
    const rows = log();
    expect(rows).toHaveLength(2);
    expect(rows.every((l) => l.silent === 1)).toBe(true);
    expect(tdb.db.select().from(tdb.schema.households).get()!.phaseScanDate).toBe(TODAY);
  });

  it('scan suivant, un vin passe ready → peak (année suivante) : un événement non silencieux', () => {
    insertWine(win(2020, 2026, 2030, 2040), 1, 'A'); // 2025 : ready
    scanHouseholdPhases(tdb.db, hh, 2025, '2025-06-01', NOW);
    const r = scanHouseholdPhases(tdb.db, hh, 2026, '2026-01-01', NOW + 100);
    expect(r.newEvents).toBe(1);
    const peak = log().find((l) => l.phase === 'peak')!;
    expect(peak).toMatchObject({ silent: 0, detectedAt: NOW + 100 });
    expect(log().find((l) => l.phase === 'ready')!.silent).toBe(1);
  });

  it("un vin hors stock (0 bouteille) n'est jamais compté", () => {
    scanHouseholdPhases(tdb.db, hh, 2025, '2025-06-01', NOW); // amorce
    insertWine(win(2020, null, null, 2040), 0, 'A');
    const r = scanHouseholdPhases(tdb.db, hh, 2025, '2025-06-02', NOW);
    expect(r.newEvents).toBe(0);
    expect(log()).toHaveLength(0);
  });

  it('deux scans le même jour : le second ne fait rien', () => {
    scanHouseholdPhases(tdb.db, hh, 2025, '2025-06-01', NOW); // amorce
    insertWine(win(2020, null, null, 2040), 1, 'A');
    expect(scanHouseholdPhases(tdb.db, hh, 2025, '2025-06-02', NOW).newEvents).toBe(1);
    insertWine(win(2020, null, null, 2040), 1, 'B');
    expect(scanHouseholdPhases(tdb.db, hh, 2025, '2025-06-02', NOW).newEvents).toBe(0);
    expect(log()).toHaveLength(1);
  });

  it('createWine / updateWine (fenêtre changée) / applyAiWindow enregistrent la phase courante en silencieux', () => {
    const y = currentYear('Europe/Paris');
    const a = add(win(y - 2, null, null, y + 5));
    expect(log(a)).toMatchObject([{ phase: 'ready', silent: 1 }]);

    updateWine(tdb.db, ctx, a, wine(win(y - 3, y - 1, y + 1, y + 6)));
    expect(log(a).map((l) => l.phase).sort()).toEqual(['peak', 'ready']);
    expect(log(a).every((l) => l.silent === 1)).toBe(true);

    const b = add(win(null, null, null, null), 1, 'Q');
    const analysis = tdb.db
      .insert(tdb.schema.labelAnalyses)
      .values({
        householdId: hh, photoPath: null, model: 'm',
        result: JSON.stringify({
          isWineLabel: true, producer: 'x', cuvee: null, appellation: null, region: null, country: null,
          color: 'red', vintage: 2010, grapes: null, formatCl: 75,
          window: win(y - 1, null, null, y + 8), confidence: 'high', rationale: 'r'
        })
      })
      .returning({ id: tdb.schema.labelAnalyses.id })
      .get().id;
    expect(log(b)).toHaveLength(0);
    applyAiWindow(tdb.db, ctx, b, analysis);
    expect(log(b)).toMatchObject([{ phase: 'ready', silent: 1 }]);
  });

  it("un vin modifié pour passer last_call aujourd'hui ne produit pas d'événement au scan", () => {
    const y = currentYear('Europe/Paris');
    scanHouseholdPhases(tdb.db, hh, y, '2020-01-01', NOW); // amorce du foyer
    const a = add(win(y - 5, null, null, y + 9));
    updateWine(tdb.db, ctx, a, wine(win(y - 5, null, null, y)));
    const r = scanHouseholdPhases(tdb.db, hh, y, '2020-01-02', NOW);
    expect(r.newEvents).toBe(0);
    expect(log(a).find((l) => l.phase === 'last_call')!.silent).toBe(1);
  });

  it('phases too_young et unknown jamais enregistrées', () => {
    const y = currentYear('Europe/Paris');
    const a = add(win(y + 3, null, null, y + 9));
    const b = add(win(null, null, null, null), 1, 'Q');
    markCurrentPhaseSilently(tdb.db, a, y);
    markCurrentPhaseSilently(tdb.db, b, y);
    scanHouseholdPhases(tdb.db, hh, y, TODAY, NOW);
    scanHouseholdPhases(tdb.db, hh, y, '2027-01-02', NOW);
    expect(log()).toHaveLength(0);
  });

  it('markCurrentPhaseSilently ne réécrit pas une phase déjà journalisée', () => {
    const y = currentYear('Europe/Paris');
    const a = add(win(y - 2, null, null, y + 5));
    tdb.db.update(tdb.schema.notificationLog).set({ silent: 0, detectedAt: 5 }).where(eq(tdb.schema.notificationLog.wineId, a)).run();
    markCurrentPhaseSilently(tdb.db, a, y);
    expect(log(a)).toMatchObject([{ silent: 0, detectedAt: 5 }]);
  });

  it('householdReferenceTimeZone : fuseau du plus ancien membre, défaut Europe/Paris', () => {
    const h2 = makeHousehold(tdb, 'Autre');
    expect(householdReferenceTimeZone(tdb.db, h2)).toBe('Europe/Paris');
    const u1 = makeUser(tdb, h2);
    const u2 = makeUser(tdb, h2);
    tdb.db.update(tdb.schema.users).set({ timezone: 'America/New_York' }).where(eq(tdb.schema.users.id, u1)).run();
    tdb.db.update(tdb.schema.users).set({ timezone: 'Asia/Tokyo' }).where(eq(tdb.schema.users.id, u2)).run();
    expect(householdReferenceTimeZone(tdb.db, h2)).toBe('America/New_York');
  });
});
