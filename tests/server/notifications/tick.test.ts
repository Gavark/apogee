import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../../helpers/fixtures';
import { registerSubscription } from '../../../src/lib/server/push/subscribe';
import type { PushSender } from '../../../src/lib/server/push/send';
import { runNotificationTick } from '../../../src/lib/server/notifications/tick';

let tdb: ReturnType<typeof makeTestDb>;
let hh: number;
let loc: number;
let pushes: { endpoint: string; body: string }[];
const sender: PushSender = async (sub, payload) => {
  pushes.push({ endpoint: sub.endpoint, body: payload.body });
  return { statusCode: 201 };
};

const tick = (now: string, s: PushSender = sender) => runNotificationTick(tdb.db, new Date(now), s);

function member(tz: string, name: string, over: Record<string, unknown> = {}) {
  const id = makeUser(tdb, hh, { email: `${name}@x.fr` });
  tdb.db.update(tdb.schema.users).set({ timezone: tz, ...over }).where(eq(tdb.schema.users.id, id)).run();
  registerSubscription(tdb.db, id, { endpoint: `https://push/${name}`, p256dh: 'P', auth: 'A', userAgent: null });
  return id;
}
function addWine(producer: string, window: [number, number | null, number | null, number], qty = 1) {
  const id = tdb.db
    .insert(tdb.schema.wines)
    .values({
      householdId: hh, producer, formatCl: 75, vintage: 2010, identityKey: producer,
      drinkFrom: window[0], peakFrom: window[1], peakTo: window[2], drinkUntil: window[3]
    })
    .returning({ id: tdb.schema.wines.id })
    .get().id;
  tdb.db.insert(tdb.schema.stockLots).values({ wineId: id, locationId: loc, position: '', quantity: qty }).run();
  return id;
}
/** Marks the household as already scanned (not its first scan), so later changes are announced. */
const prime = (date: string) =>
  tdb.db.update(tdb.schema.households).set({ phaseScanDate: date }).where(eq(tdb.schema.households.id, hh)).run();
const userRow = (id: number) => tdb.db.select().from(tdb.schema.users).where(eq(tdb.schema.users.id, id)).get()!;

beforeEach(() => {
  tdb = makeTestDb();
  hh = makeHousehold(tdb);
  loc = makeLocation(tdb, hh, 'Cave');
  pushes = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// January 2027: Paris = UTC+1, Toronto/Montreal = UTC-5. A window with peakFrom 2027 is "peak" in 2027
// and was never logged, so the first non-first scan announces it.
const crossing = (name = 'W') => addWine(name, [2020, 2027, 2030, 2040]);

describe('runNotificationTick', () => {
  it('17h59 locales : rien ; 18h00 : un push', async () => {
    member('Europe/Paris', 'a');
    prime('2026-12-31');
    crossing();
    expect(await tick('2027-01-05T16:59:00Z')).toEqual({ processed: 0, sent: 0 });
    expect(pushes).toHaveLength(0);
    expect(await tick('2027-01-05T17:00:00Z')).toEqual({ processed: 1, sent: 1 });
    expect(pushes).toHaveLength(1);
  });

  it('deux passages le même soir : un seul push', async () => {
    member('Europe/Paris', 'a');
    prime('2026-12-31');
    crossing();
    await tick('2027-01-05T17:00:00Z');
    expect(await tick('2027-01-05T17:10:00Z')).toEqual({ processed: 0, sent: 0 });
    expect(await tick('2027-01-05T22:00:00Z')).toEqual({ processed: 0, sent: 0 });
    expect(pushes).toHaveLength(1);
  });

  it("un utilisateur sans abonnement n'est pas traité", async () => {
    const id = makeUser(tdb, hh);
    prime('2026-12-31');
    crossing();
    expect(await tick('2027-01-05T20:00:00Z')).toEqual({ processed: 0, sent: 0 });
    expect(userRow(id).lastDispatchDate).toBeNull();
  });

  it('serveur éteint 3 jours : un seul push qui regroupe les changements des 3 jours', async () => {
    const a = member('Europe/Paris', 'a', { notifyMonthly: 0 });
    prime('2026-12-31');
    crossing('W1');
    await tick('2027-01-05T17:00:00Z');
    expect(pushes).toHaveLength(1);
    // Server down; meanwhile two more wines get announced by the next scans.
    addWine('W2', [2020, null, null, 2027]); // last_call
    addWine('W3', [2020, 2022, 2025, 2030]); // last_call (after peakTo)
    pushes = [];
    expect(await tick('2027-01-09T09:00:00Z')).toEqual({ processed: 0, sent: 0 });
    expect(await tick('2027-01-09T17:30:00Z')).toEqual({ processed: 1, sent: 1 });
    expect(pushes).toHaveLength(1);
    expect(pushes[0].body).toBe('2 vins sont à boire vite.');
    expect(userRow(a).lastDispatchDate).toBe('2027-01-09');
  });

  it('Paris et Montréal : chacun à 18h locales, le second reçoit aussi les changements du premier passage', async () => {
    member('Europe/Paris', 'paris', { notifyMonthly: 0 });
    member('America/Toronto', 'mtl', { notifyMonthly: 0 });
    prime('2026-12-31');
    crossing();
    await tick('2027-01-05T17:00:00Z'); // 18h Paris, 12h Montréal
    expect(pushes.map((p) => p.endpoint)).toEqual(['https://push/paris']);
    await tick('2027-01-05T22:59:00Z'); // 17h59 Montréal
    expect(pushes).toHaveLength(1);
    await tick('2027-01-05T23:00:00Z'); // 18h Montréal
    expect(pushes.map((p) => p.endpoint)).toEqual(['https://push/paris', 'https://push/mtl']);
    expect(pushes[1].body).toBe('1 vin entre à son apogée.');
  });

  it('1er du mois : rappel fusionné avec les phases ; le lendemain plus de rappel', async () => {
    const a = member('Europe/Paris', 'a');
    prime('2026-12-31');
    crossing();
    addWine('Passe1', [2000, null, null, 2020], 1);
    addWine('Passe2', [2000, null, null, 2021], 2);
    await tick('2027-01-01T17:00:00Z');
    expect(pushes).toHaveLength(1);
    expect(pushes[0].body).toContain('1 vin entre à son apogée');
    expect(pushes[0].body).toContain('Ce mois-ci, 3 bouteilles à ne pas oublier : Passe1 2010, Passe2 2010');
    expect(userRow(a).lastMonthlyMonth).toBe('2027-01');
    pushes = [];
    expect(await tick('2027-01-02T17:00:00Z')).toEqual({ processed: 1, sent: 0 });
    expect(pushes).toHaveLength(0);
    expect(userRow(a).lastDispatchDate).toBe('2027-01-02');
  });

  it('mois où le serveur était éteint le 1er : rappel au premier passage du mois', async () => {
    member('Europe/Paris', 'a');
    prime('2026-12-30');
    addWine('Passe', [2000, null, null, 2020], 1);
    await tick('2026-12-31T17:00:00Z'); // décembre : rappel
    pushes = [];
    expect(await tick('2027-01-04T17:00:00Z')).toEqual({ processed: 1, sent: 1 });
    expect(pushes[0].body).toBe('Ce mois-ci, 1 bouteille à ne pas oublier : Passe 2010');
  });

  it("rien à dire : pas de push, mais le jour est marqué fait", async () => {
    const a = member('Europe/Paris', 'a');
    prime('2026-12-31');
    expect(await tick('2027-01-05T17:00:00Z')).toEqual({ processed: 1, sent: 0 });
    expect(userRow(a).lastDispatchDate).toBe('2027-01-05');
    expect(userRow(a).lastDispatchAt).toBe(Math.floor(Date.parse('2027-01-05T17:00:00Z') / 1000));
  });

  it('erreur sur un utilisateur : les autres sont traités', async () => {
    member('Europe/Paris', 'ok', { notifyMonthly: 0 }); // oldest member = household reference zone
    member('Mars/Olympus', 'bad'); // invalid zone -> RangeError
    prime('2026-12-31');
    crossing();
    expect(await tick('2027-01-05T17:00:00Z')).toEqual({ processed: 1, sent: 1 });
    expect(pushes.map((p) => p.endpoint)).toEqual(['https://push/ok']);
  });

  it('deux passages simultanés avec un envoi lent : un seul push par utilisateur', async () => {
    member('Europe/Paris', 'a', { notifyMonthly: 0 });
    prime('2026-12-31');
    crossing();
    const slow: PushSender = async (sub, payload) => {
      await new Promise((r) => setTimeout(r, 30));
      return sender(sub, payload, undefined as never);
    };
    const [r1, r2] = await Promise.all([tick('2027-01-05T17:00:00Z', slow), tick('2027-01-05T17:00:01Z', slow)]);
    expect(pushes).toHaveLength(1);
    expect(r1.sent + r2.sent).toBe(1);
  });

  it("jour déjà pris par un autre passage (course) : l'utilisateur est ignoré", async () => {
    const a = member('Europe/Paris', 'a', { notifyMonthly: 0 });
    prime('2026-12-31');
    crossing();
    // Simulates a second process having claimed the evening after our candidate read: stale row, claim fails.
    const sendSpy = vi.fn(sender);
    tdb.db.update(tdb.schema.users).set({ lastDispatchDate: '2027-01-05' }).where(eq(tdb.schema.users.id, a)).run();
    expect(await tick('2027-01-05T17:00:00Z', sendSpy)).toEqual({ processed: 0, sent: 0 });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("rappel évalué une fois par mois : liste vide le 1er, vin past ajouté le 15 → pas de rappel ; mois suivant → rappel", async () => {
    member('Europe/Paris', 'a');
    prime('2026-12-31');
    await tick('2027-01-01T17:00:00Z'); // nothing to say, month evaluated
    addWine('Passe', [2000, null, null, 2020], 1);
    pushes = [];
    await tick('2027-01-15T17:00:00Z');
    expect(pushes.filter((p) => p.body.includes('Ce mois-ci'))).toHaveLength(0);
    await tick('2027-02-01T17:00:00Z');
    expect(pushes.some((p) => p.body.includes('Ce mois-ci, 1 bouteille'))).toBe(true);
  });
});
