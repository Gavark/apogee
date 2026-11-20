import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../../helpers/fixtures';
import { buildDigest, formatDigest, type DigestUser } from '../../../src/lib/server/notifications/digest';

const YEAR = 2027;
let tdb: ReturnType<typeof makeTestDb>;
let hh: number;
let loc: number;
let uid: number;

type Win = [number | null, number | null, number | null, number | null];

function addWine(producer: string, vintage: number, window: Win, qty: number) {
  const id = tdb.db
    .insert(tdb.schema.wines)
    .values({
      householdId: hh, producer, formatCl: 75, vintage, identityKey: `${producer}${vintage}`,
      drinkFrom: window[0], peakFrom: window[1], peakTo: window[2], drinkUntil: window[3]
    })
    .returning({ id: tdb.schema.wines.id })
    .get().id;
  tdb.db.insert(tdb.schema.stockLots).values({ wineId: id, locationId: loc, position: '', quantity: qty }).run();
  return id;
}
const event = (wineId: number, phase: string, detectedAt: number, silent = 0) =>
  tdb.db.insert(tdb.schema.notificationLog).values({ wineId, phase, detectedAt, silent }).run();
const user = (o: Partial<DigestUser> = {}): DigestUser => ({
  id: uid, householdId: hh, notifyPhases: 1, notifyMonthly: 1, lastDispatchAt: null, lastMonthlyMonth: null, ...o
});

beforeEach(() => {
  tdb = makeTestDb();
  hh = makeHousehold(tdb);
  uid = makeUser(tdb, hh);
  loc = makeLocation(tdb, hh, 'Cave');
});

describe('buildDigest', () => {
  it('compte les événements non silencieux après lastDispatchAt, par phase', () => {
    const a = addWine('A', 2015, [2015, 2020, 2030, 2040], 1);
    const b = addWine('B', 2015, [2015, 2020, 2030, 2040], 1);
    event(a, 'peak', 100);
    event(b, 'peak', 200);
    event(b, 'ready', 50, 1); // silencieux
    event(a, 'ready', 10); // avant le dernier envoi
    const d = buildDigest(tdb.db, user({ lastDispatchAt: 20, notifyMonthly: 0 }), '2027-01', YEAR)!;
    expect(d.phaseCounts).toEqual({ peak: 2 });
    expect(d.monthly).toBeNull();
    expect(buildDigest(tdb.db, user({ lastDispatchAt: null, notifyMonthly: 0 }), '2027-01', YEAR)!.phaseCounts).toEqual({
      peak: 2
    }); // wine a: ready then peak -> counted once, at peak
  });

  it("vin bu entre la détection et l'envoi (0 bouteille) : non compté", () => {
    const a = addWine('A', 2015, [2015, 2020, 2030, 2040], 0);
    event(a, 'peak', 100);
    expect(buildDigest(tdb.db, user(), '2027-01', YEAR)).toBeNull();
  });

  it("rappel : bouteilles last_call/past, 3 noms max, past d'abord puis drinkUntil croissant", () => {
    addWine('Ok', 2015, [2015, null, null, 2040], 5); // ready : ignoré
    addWine('Dernier', 2016, [2010, null, null, 2027], 2); // last_call
    addWine('Passe1', 2010, [2005, null, null, 2025], 1); // past
    addWine('Passe2', 2011, [2005, null, null, 2022], 3); // past, plus ancien
    addWine('Dernier2', 2012, [2010, null, null, 2027], 4); // last_call
    const d = buildDigest(tdb.db, user({ notifyPhases: 0 }), '2027-01', YEAR)!;
    expect(d.monthly).toEqual({ bottles: 10, names: ['Passe2 2011', 'Passe1 2010', 'Dernier 2016'] });
  });

  it('rappel : rien sans bouteille last_call/past, ni si déjà fait ce mois', () => {
    addWine('Ok', 2015, [2015, null, null, 2040], 5);
    expect(buildDigest(tdb.db, user(), '2027-01', YEAR)).toBeNull();
    addWine('Passe', 2010, [2005, null, null, 2025], 1);
    expect(buildDigest(tdb.db, user({ lastMonthlyMonth: '2027-01' }), '2027-01', YEAR)).toBeNull();
    expect(buildDigest(tdb.db, user({ lastMonthlyMonth: '2026-12' }), '2027-01', YEAR)).not.toBeNull();
  });

  it('préférences : phases off → rappel seul ; rappel off → phases seules ; les deux off → null', () => {
    const a = addWine('A', 2010, [2005, null, null, 2025], 1); // past
    event(a, 'past', 100);
    expect(buildDigest(tdb.db, user({ notifyPhases: 0 }), '2027-01', YEAR)).toEqual({
      phaseCounts: {},
      monthly: { bottles: 1, names: ['A 2010'] }
    });
    expect(buildDigest(tdb.db, user({ notifyMonthly: 0 }), '2027-01', YEAR)).toEqual({
      phaseCounts: { past: 1 },
      monthly: null
    });
    expect(buildDigest(tdb.db, user({ notifyPhases: 0, notifyMonthly: 0 }), '2027-01', YEAR)).toBeNull();
  });
});

describe('buildDigest (R6, locale)', () => {
  it('un vin qui a franchi deux phases compte une fois, à la plus avancée', () => {
    const a = addWine('A', 2010, [2005, null, null, 2025], 1);
    event(a, 'ready', 10);
    event(a, 'last_call', 20);
    event(a, 'past', 30);
    expect(buildDigest(tdb.db, user({ notifyMonthly: 0 }), '2027-01', YEAR)!.phaseCounts).toEqual({ past: 1 });
  });

  it('le nom de repli est localisé', () => {
    tdb.db.insert(tdb.schema.wines).values({
      householdId: hh, producer: null, formatCl: 75, vintage: null, identityKey: 'n',
      drinkFrom: 2000, drinkUntil: 2020
    }).run();
    const id = tdb.db.select().from(tdb.schema.wines).get()!.id;
    tdb.db.insert(tdb.schema.stockLots).values({ wineId: id, locationId: loc, position: '', quantity: 1 }).run();
    expect(buildDigest(tdb.db, user({ notifyPhases: 0 }), '2027-01', YEAR, 'en')!.monthly!.names).toEqual(['Unnamed wine']);
    expect(buildDigest(tdb.db, user({ notifyPhases: 0 }), '2027-01', YEAR, 'fr')!.monthly!.names).not.toEqual(['Unnamed wine']);
  });
});

describe('formatDigest', () => {
  it('FR : phases puis rappel, pluriels', () => {
    const p = formatDigest(
      { phaseCounts: { peak: 3, last_call: 1 }, monthly: { bottles: 4, names: ['Chinon 2016', 'Gigondas 2018'] } },
      'fr'
    );
    expect(p).toEqual({
      title: 'Apogée',
      body: '3 vins entrent à leur apogée, 1 vin est à boire vite. Ce mois-ci, 4 bouteilles à ne pas oublier : Chinon 2016, Gigondas 2018',
      url: '/app',
      tag: 'apogee-daily'
    });
  });

  it('FR : singulier', () => {
    const p = formatDigest({ phaseCounts: {}, monthly: { bottles: 1, names: ['X 2010'] } }, 'fr');
    expect(p.body).toBe('Ce mois-ci, 1 bouteille à ne pas oublier : X 2010');
  });

  it('EN : phases et rappel', () => {
    expect(formatDigest({ phaseCounts: { peak: 1, ready: 3 }, monthly: null }, 'en').body).toBe(
      '3 wines are ready to drink, 1 wine is reaching its peak.'
    );
    expect(formatDigest({ phaseCounts: {}, monthly: { bottles: 4, names: ['A', 'B'] } }, 'en').body).toBe(
      'This month, 4 bottles not to forget: A, B'
    );
  });

  it("n'compte pas les événements d'un autre foyer", () => {
    const other = makeHousehold(tdb);
    const otherLoc = makeLocation(tdb, other, 'Cave');
    const id = tdb.db
      .insert(tdb.schema.wines)
      .values({ householdId: other, producer: 'Autre', formatCl: 75, vintage: 2015, identityKey: 'autre', drinkFrom: 2015, peakFrom: 2020, peakTo: 2030, drinkUntil: 2040 })
      .returning({ id: tdb.schema.wines.id })
      .get().id;
    tdb.db.insert(tdb.schema.stockLots).values({ wineId: id, locationId: otherLoc, position: '', quantity: 3 }).run();
    event(id, 'peak', 100);
    expect(buildDigest(tdb.db, user({ notifyMonthly: 0 }), '2027-01', YEAR)).toBeNull();
  });
});
