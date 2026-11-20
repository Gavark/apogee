import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import { applyStockOps, parseStockOps, type StockOp } from '../../src/lib/server/stock';
import type { HouseholdCtx } from '../../src/lib/server/context';
import { POST } from '../../src/routes/api/stock/ops/+server';

// The route reads its database through getDb(): point it at the test database of the moment.
const dbRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('$lib/server/db', () => ({ getDb: () => dbRef.current }));

let n = 0;
const uuid = () => {
  n++;
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
};

describe('stock ops', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let ctx: HouseholdCtx;
  let otherCtx: HouseholdCtx;
  let locA: number;
  let locA2: number;
  let locB: number;
  const s = () => tdb.schema;

  beforeEach(() => {
    tdb = makeTestDb();
    const hidA = makeHousehold(tdb, 'A');
    const hidB = makeHousehold(tdb, 'B');
    ctx = { userId: makeUser(tdb, hidA), householdId: hidA, isAdmin: false };
    otherCtx = { userId: makeUser(tdb, hidB), householdId: hidB, isAdmin: false };
    locA = makeLocation(tdb, hidA, 'Cave');
    locA2 = makeLocation(tdb, hidA, 'Frigo');
    locB = makeLocation(tdb, hidB, 'Cave B');
  });

  function addLot(householdId: number, locationId: number, quantity: number, position = '', wineId?: number) {
    const wid =
      wineId ??
      tdb.db
        .insert(s().wines)
        .values({ householdId, identityKey: `k${Math.random()}` })
        .returning({ id: s().wines.id })
        .get().id;
    const lotId = tdb.db
      .insert(s().stockLots)
      .values({ wineId: wid, locationId, position, quantity })
      .returning({ id: s().stockLots.id })
      .get().id;
    return { wineId: wid, lotId };
  }
  const lot = (id: number) => tdb.db.select().from(s().stockLots).where(eq(s().stockLots.id, id)).get();
  const lots = () => tdb.db.select().from(s().stockLots).all();
  const consumptions = () => tdb.db.select().from(s().consumptions).all();
  const ops = () => tdb.db.select().from(s().appliedOps).all();
  const consume = (lotId: number, opId = uuid()): StockOp => ({
    opId,
    kind: 'consume',
    lotId,
    consumedOn: '2026-11-19',
    rating: 4,
    note: 'bon'
  });

  it('consume décrémente et crée une consommation', () => {
    const { wineId, lotId } = addLot(ctx.householdId, locA, 3);
    const op = consume(lotId);
    const [r] = applyStockOps(tdb.db, ctx, [op]);
    expect(r.status).toBe('applied');
    expect(r.opId).toBe(op.opId);
    expect(lot(lotId)?.quantity).toBe(2);
    const cs = consumptions();
    expect(cs).toHaveLength(1);
    expect(r.consumptionId).toBe(cs[0].id);
    expect(cs[0]).toMatchObject({
      wineId,
      lotId,
      locationId: locA,
      userId: ctx.userId,
      consumedOn: '2026-11-19',
      rating: 4,
      note: 'bon'
    });
    expect(ops()).toHaveLength(1);
    expect(ops()[0]).toMatchObject({ opId: op.opId, householdId: ctx.householdId });
  });

  it('le même opId rejoué renvoie le même résultat sans décrémenter deux fois', () => {
    const { lotId } = addLot(ctx.householdId, locA, 3);
    const op = consume(lotId);
    const [first] = applyStockOps(tdb.db, ctx, [op]);
    const [second] = applyStockOps(tdb.db, ctx, [op]);
    expect(second).toEqual(first);
    expect(lot(lotId)?.quantity).toBe(2);
    expect(consumptions()).toHaveLength(1);
    expect(ops()).toHaveLength(1);
  });

  it('un rejet rejoué est renvoyé verbatim, même si le stock a changé entre-temps', () => {
    const { lotId } = addLot(ctx.householdId, locA, 0);
    const op = consume(lotId);
    expect(applyStockOps(tdb.db, ctx, [op])[0]).toEqual({ opId: op.opId, status: 'rejected', reason: 'empty_lot' });
    tdb.db.update(s().stockLots).set({ quantity: 5 }).where(eq(s().stockLots.id, lotId)).run();
    expect(applyStockOps(tdb.db, ctx, [op])[0]).toEqual({ opId: op.opId, status: 'rejected', reason: 'empty_lot' });
    expect(lot(lotId)?.quantity).toBe(5);
    expect(consumptions()).toHaveLength(0);
  });

  it('deux consume différents sur un lot de 1 : applied puis rejected empty_lot', () => {
    const { lotId } = addLot(ctx.householdId, locA, 1);
    const [a, b] = applyStockOps(tdb.db, ctx, [consume(lotId), consume(lotId)]);
    expect(a.status).toBe('applied');
    expect(b).toMatchObject({ status: 'rejected', reason: 'empty_lot' });
    expect(lot(lotId)?.quantity).toBe(0);
    expect(consumptions()).toHaveLength(1);
    expect(ops()).toHaveLength(2);
  });

  it('adjust -5 sur un lot de 2 → partial, appliedQuantity -2, lot à 0', () => {
    const { lotId } = addLot(ctx.householdId, locA, 2);
    const [r] = applyStockOps(tdb.db, ctx, [{ opId: uuid(), kind: 'adjust', lotId, delta: -5 }]);
    expect(r).toMatchObject({ status: 'partial', appliedQuantity: -2 });
    expect(lot(lotId)?.quantity).toBe(0);
  });

  it('adjust positif et négatif exact → applied avec la variation', () => {
    const { lotId } = addLot(ctx.householdId, locA, 2);
    const [up] = applyStockOps(tdb.db, ctx, [{ opId: uuid(), kind: 'adjust', lotId, delta: 3 }]);
    expect(up).toMatchObject({ status: 'applied', appliedQuantity: 3 });
    expect(lot(lotId)?.quantity).toBe(5);
    const [down] = applyStockOps(tdb.db, ctx, [{ opId: uuid(), kind: 'adjust', lotId, delta: -5 }]);
    expect(down).toMatchObject({ status: 'applied', appliedQuantity: -5 });
    expect(lot(lotId)?.quantity).toBe(0);
  });

  it('move 3 sur un lot de 2 → partial, 2 déplacées, lot cible créé', () => {
    const { wineId, lotId } = addLot(ctx.householdId, locA, 2);
    const [r] = applyStockOps(tdb.db, ctx, [
      { opId: uuid(), kind: 'move', lotId, toLocationId: locA2, toPosition: 'étagère 2', quantity: 3 }
    ]);
    expect(r).toMatchObject({ status: 'partial', appliedQuantity: 2 });
    expect(lot(lotId)?.quantity).toBe(0);
    const target = lots().find((l) => l.locationId === locA2);
    expect(target).toMatchObject({ wineId, position: 'étagère 2', quantity: 2 });
  });

  it('move complet vers un lot cible existant : additionne', () => {
    const { wineId, lotId } = addLot(ctx.householdId, locA, 4);
    const target = addLot(ctx.householdId, locA2, 1, 'x', wineId);
    const [r] = applyStockOps(tdb.db, ctx, [
      { opId: uuid(), kind: 'move', lotId, toLocationId: locA2, toPosition: 'x', quantity: 3 }
    ]);
    expect(r).toMatchObject({ status: 'applied', appliedQuantity: 3 });
    expect(lot(lotId)?.quantity).toBe(1);
    expect(lot(target.lotId)?.quantity).toBe(4);
  });

  it('move : lot source à 0 → empty_lot ; même lieu+position → invalid', () => {
    const empty = addLot(ctx.householdId, locA, 0);
    const [e] = applyStockOps(tdb.db, ctx, [
      { opId: uuid(), kind: 'move', lotId: empty.lotId, toLocationId: locA2, toPosition: '', quantity: 1 }
    ]);
    expect(e).toMatchObject({ status: 'rejected', reason: 'empty_lot' });
    const full = addLot(ctx.householdId, locA, 3, 'p');
    const [i] = applyStockOps(tdb.db, ctx, [
      { opId: uuid(), kind: 'move', lotId: full.lotId, toLocationId: locA, toPosition: 'p', quantity: 1 }
    ]);
    expect(i).toMatchObject({ status: 'rejected', reason: 'invalid' });
    expect(lot(full.lotId)?.quantity).toBe(3);
    expect(lots()).toHaveLength(2);
  });

  it('unconsume remet la bouteille et supprime la consommation', () => {
    const { lotId } = addLot(ctx.householdId, locA, 1);
    const [c] = applyStockOps(tdb.db, ctx, [consume(lotId)]);
    expect(lot(lotId)?.quantity).toBe(0);
    const [u] = applyStockOps(tdb.db, ctx, [{ opId: uuid(), kind: 'unconsume', consumptionId: c.consumptionId! }]);
    expect(u.status).toBe('applied');
    expect(lot(lotId)?.quantity).toBe(1);
    expect(consumptions()).toHaveLength(0);
  });

  it("unconsume : lot d'origine disparu → crée le lot (wine, lieu, '')", () => {
    const { wineId, lotId } = addLot(ctx.householdId, locA, 1, 'p');
    const [c] = applyStockOps(tdb.db, ctx, [consume(lotId)]);
    tdb.db.delete(s().stockLots).where(eq(s().stockLots.id, lotId)).run();
    const [u] = applyStockOps(tdb.db, ctx, [{ opId: uuid(), kind: 'unconsume', consumptionId: c.consumptionId! }]);
    expect(u.status).toBe('applied');
    expect(lots()).toHaveLength(1);
    expect(lots()[0]).toMatchObject({ wineId, locationId: locA, position: '', quantity: 1 });
    expect(consumptions()).toHaveLength(0);
  });

  it("unconsume : lot d'origine disparu et lot (wine, lieu, '') existant → fusionne", () => {
    const { wineId, lotId } = addLot(ctx.householdId, locA, 1, 'p');
    const existing = addLot(ctx.householdId, locA, 2, '', wineId);
    const [c] = applyStockOps(tdb.db, ctx, [consume(lotId)]);
    tdb.db.delete(s().stockLots).where(eq(s().stockLots.id, lotId)).run();
    applyStockOps(tdb.db, ctx, [{ opId: uuid(), kind: 'unconsume', consumptionId: c.consumptionId! }]);
    expect(lots()).toHaveLength(1);
    expect(lot(existing.lotId)?.quantity).toBe(3);
  });

  it('unconsume : lieu supprimé (locationId NULL) → rejected not_found, consommation conservée', () => {
    const { lotId } = addLot(ctx.householdId, locA, 1);
    const [c] = applyStockOps(tdb.db, ctx, [consume(lotId)]);
    tdb.db.delete(s().stockLots).where(eq(s().stockLots.id, lotId)).run();
    tdb.db.delete(s().locations).where(eq(s().locations.id, locA)).run();
    expect(consumptions()[0].locationId).toBeNull();
    const [u] = applyStockOps(tdb.db, ctx, [{ opId: uuid(), kind: 'unconsume', consumptionId: c.consumptionId! }]);
    expect(u).toMatchObject({ status: 'rejected', reason: 'not_found' });
    expect(consumptions()).toHaveLength(1);
    expect(lots()).toHaveLength(0);
  });

  it("isolation : lot, lieu cible ou consommation d'un autre foyer → rejected not_found, rien ne change", () => {
    const foreign = addLot(otherCtx.householdId, locB, 3);
    const own = addLot(ctx.householdId, locA, 3);
    applyStockOps(tdb.db, otherCtx, [consume(foreign.lotId)]);
    const foreignConsumption = consumptions()[0];
    const before = { lots: lots(), consumptions: consumptions() };

    const results = applyStockOps(tdb.db, ctx, [
      consume(foreign.lotId),
      { opId: uuid(), kind: 'adjust', lotId: foreign.lotId, delta: 1 },
      { opId: uuid(), kind: 'move', lotId: foreign.lotId, toLocationId: locA, toPosition: '', quantity: 1 },
      { opId: uuid(), kind: 'move', lotId: own.lotId, toLocationId: locB, toPosition: '', quantity: 1 },
      { opId: uuid(), kind: 'unconsume', consumptionId: foreignConsumption.id },
      { opId: uuid(), kind: 'adjust', lotId: 99999, delta: 1 }
    ]);
    for (const r of results) expect(r).toMatchObject({ status: 'rejected', reason: 'not_found' });
    expect(lots()).toEqual(before.lots);
    expect(consumptions()).toEqual(before.consumptions);
  });

  it("opId déjà utilisé par un autre foyer → rejected not_found, rien n'est stocké pour lui", () => {
    const mine = addLot(ctx.householdId, locA, 3);
    const theirs = addLot(otherCtx.householdId, locB, 3);
    const op = consume(theirs.lotId);
    applyStockOps(tdb.db, otherCtx, [op]);
    const stored = ops();
    const [r] = applyStockOps(tdb.db, ctx, [{ ...consume(mine.lotId), opId: op.opId }]);
    expect(r).toEqual({ opId: op.opId, status: 'rejected', reason: 'not_found' });
    expect(lot(mine.lotId)?.quantity).toBe(3);
    expect(ops()).toEqual(stored);
    expect(ops()[0].householdId).toBe(otherCtx.householdId);
  });

  it('un opId en majuscules rejoué est la même opération', () => {
    const { lotId } = addLot(ctx.householdId, locA, 5);
    const op = parseStockOps({
      ops: [{ opId: '11111111-1111-4111-8111-11111111ABCD', kind: 'adjust', lotId, delta: -1 }]
    });
    const low = parseStockOps({
      ops: [{ opId: '11111111-1111-4111-8111-11111111abcd', kind: 'adjust', lotId, delta: -1 }]
    });
    if (!op.ok || !low.ok) throw new Error('parse failed');
    applyStockOps(tdb.db, ctx, op.ops);
    applyStockOps(tdb.db, ctx, low.ops);
    expect(lot(lotId)?.quantity).toBe(4);
    expect(ops()).toHaveLength(1);
    expect(ops()[0].opId).toBe('11111111-1111-4111-8111-11111111abcd');
  });

  describe('parseStockOps', () => {
    const good = { opId: '11111111-1111-4111-8111-111111111111', kind: 'adjust', lotId: 1, delta: 1 };
    it('accepte des ops valides de chaque type', () => {
      const r = parseStockOps({
        ops: [
          good,
          { opId: '11111111-1111-4111-8111-111111111112', kind: 'consume', lotId: 1, consumedOn: '2026-11-19', rating: null },
          {
            opId: '11111111-1111-4111-8111-111111111113',
            kind: 'move',
            lotId: 1,
            toLocationId: 2,
            toPosition: '',
            quantity: 1
          },
          { opId: '11111111-1111-4111-8111-111111111114', kind: 'unconsume', consumptionId: 4 }
        ]
      });
      expect(r.ok).toBe(true);
    });
    it('refuse un opId non UUID, un rating 6, un delta 0, plus de 100 ops', () => {
      const bad = (op: unknown) => expect(parseStockOps({ ops: [op] }).ok).toBe(false);
      bad({ ...good, opId: 'abc' });
      bad({ ...good, opId: '11111111-1111-1111-8111-111111111111' }); // not v4
      bad({ opId: good.opId, kind: 'consume', lotId: 1, consumedOn: '2026-11-19', rating: 6 });
      bad({ opId: good.opId, kind: 'consume', lotId: 1, consumedOn: '2026-11-19', rating: 0 });
      bad({ opId: good.opId, kind: 'consume', lotId: 1, consumedOn: '2026-13-45' });
      bad({ opId: good.opId, kind: 'consume', lotId: 1, consumedOn: '19/11/2026' });
      bad({ ...good, delta: 0 });
      bad({ ...good, delta: 1.5 });
      bad({ opId: good.opId, kind: 'move', lotId: 1, toLocationId: 2, toPosition: '', quantity: 0 });
      bad({ opId: good.opId, kind: 'wat' });
      bad(null);
      expect(parseStockOps({ ops: [] }).ok).toBe(false);
      expect(parseStockOps({}).ok).toBe(false);
      expect(parseStockOps(null).ok).toBe(false);
      const many = Array.from({ length: 101 }, (_, i) => ({
        ...good,
        opId: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`
      }));
      expect(parseStockOps({ ops: many }).ok).toBe(false);
      expect(parseStockOps({ ops: many.slice(0, 100) }).ok).toBe(true);
    });
    it('bornes : ids sûrs, delta, quantity, toPosition, note', () => {
      const bad = (op: unknown) => expect(parseStockOps({ ops: [op] }).ok).toBe(false);
      const ok = (op: unknown) => expect(parseStockOps({ ops: [op] }).ok).toBe(true);
      const id = good.opId;
      bad({ ...good, lotId: 2 ** 60 });
      bad({ opId: id, kind: 'unconsume', consumptionId: Number.MAX_SAFE_INTEGER + 2 });
      ok({ ...good, delta: 10000 });
      ok({ ...good, delta: -10000 });
      bad({ ...good, delta: 10001 });
      bad({ ...good, delta: -10001 });
      const move = { opId: id, kind: 'move', lotId: 1, toLocationId: 2, toPosition: 'A1', quantity: 1 };
      ok({ ...move, quantity: 10000 });
      bad({ ...move, quantity: 10001 });
      ok({ ...move, toPosition: 'x'.repeat(100) });
      bad({ ...move, toPosition: 'x'.repeat(101) });
      bad({ ...move, toPosition: ' '.repeat(5) + 'x'.repeat(101) });
      const consume = { opId: id, kind: 'consume', lotId: 1, consumedOn: '2026-11-19' };
      ok({ ...consume, note: 'x'.repeat(2000) });
      bad({ ...consume, note: 'x'.repeat(2001) });
    });
    it('toPosition est rogné et opId passé en minuscules', () => {
      const r = parseStockOps({
        ops: [
          {
            opId: '11111111-1111-4111-8111-11111111ABCD',
            kind: 'move',
            lotId: 1,
            toLocationId: 2,
            toPosition: '  B2  ',
            quantity: 1
          }
        ]
      });
      expect(r.ok && r.ops[0]).toMatchObject({ opId: '11111111-1111-4111-8111-11111111abcd', toPosition: 'B2' });
    });
  });
});

describe('POST /api/stock/ops (HTTP glue)', () => {
  const call = (locals: unknown, body: unknown, headers: Record<string, string> = {}) =>
    POST({
      request: new Request('http://x/api/stock/ops', {
        method: 'POST',
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body)
      }),
      locals
    } as never);

  it('401 JSON sans session', async () => {
    const res = await call({ user: null }, { ops: [] });
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
  it('400 sur JSON invalide ou ops invalides', async () => {
    const user = { id: 1, householdId: 1, isAdmin: 0 };
    expect((await call({ user }, 'not json')).status).toBe(400);
    const res = await call({ user }, { ops: [{ opId: 'nope' }] });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  describe('utilisateur attendu (x-apogee-user)', () => {
    let tdb: ReturnType<typeof makeTestDb>;
    let user: { id: number; householdId: number; isAdmin: number };
    let lotId: number;

    beforeEach(() => {
      tdb = makeTestDb();
      dbRef.current = tdb;
      const hid = makeHousehold(tdb, 'A');
      user = { id: makeUser(tdb, hid), householdId: hid, isAdmin: 0 };
      const loc = makeLocation(tdb, hid, 'Cave');
      const wineId = tdb.db
        .insert(tdb.schema.wines)
        .values({ householdId: hid, identityKey: 'k' })
        .returning({ id: tdb.schema.wines.id })
        .get().id;
      lotId = tdb.db
        .insert(tdb.schema.stockLots)
        .values({ wineId, locationId: loc, position: '', quantity: 3 })
        .returning({ id: tdb.schema.stockLots.id })
        .get().id;
    });

    const body = () => ({ ops: [{ opId: uuid(), kind: 'adjust', lotId, delta: -1 }] });
    const quantity = () =>
      tdb.db.select().from(tdb.schema.stockLots).where(eq(tdb.schema.stockLots.id, lotId)).get()?.quantity;

    it('autre utilisateur que la session → 409 user_mismatch, rien n’est appliqué', async () => {
      const res = await call({ user }, body(), { 'x-apogee-user': String(user.id + 1) });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'user_mismatch' });
      expect(quantity()).toBe(3);
      expect(tdb.db.select().from(tdb.schema.appliedOps).all()).toEqual([]);
    });

    it('en-tête illisible → 409, rien n’est appliqué', async () => {
      const res = await call({ user }, body(), { 'x-apogee-user': 'abc' });
      expect(res.status).toBe(409);
      expect(quantity()).toBe(3);
    });

    it('même utilisateur → 200, appliqué', async () => {
      const res = await call({ user }, body(), { 'x-apogee-user': String(user.id) });
      expect(res.status).toBe(200);
      expect((await res.json()).results[0]).toMatchObject({ status: 'applied' });
      expect(quantity()).toBe(2);
    });

    it('sans en-tête → 200, appliqué comme avant', async () => {
      const res = await call({ user }, body());
      expect(res.status).toBe(200);
      expect(quantity()).toBe(2);
    });
  });
});
