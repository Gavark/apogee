import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import {
  listLocations,
  createLocation,
  renameLocation,
  reorderLocations,
  deleteLocation
} from '../../src/lib/server/locations';
import { NotFoundError, type HouseholdCtx } from '../../src/lib/server/context';

describe('locations', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let ctx: HouseholdCtx;
  let otherCtx: HouseholdCtx;

  beforeEach(() => {
    tdb = makeTestDb();
    const hidA = makeHousehold(tdb, 'A');
    const hidB = makeHousehold(tdb, 'B');
    ctx = { userId: makeUser(tdb, hidA), householdId: hidA, isAdmin: false };
    otherCtx = { userId: makeUser(tdb, hidB), householdId: hidB, isAdmin: false };
  });

  const names = () => listLocations(tdb.db, ctx).map((l) => l.name);

  function addWineWithLot(locationId: number, quantity: number, householdId = ctx.householdId) {
    const wineId = tdb.db
      .insert(tdb.schema.wines)
      .values({ householdId, identityKey: `k${Math.random()}` })
      .returning({ id: tdb.schema.wines.id })
      .get().id;
    const lotId = tdb.db
      .insert(tdb.schema.stockLots)
      .values({ wineId, locationId, quantity })
      .returning({ id: tdb.schema.stockLots.id })
      .get().id;
    return { wineId, lotId };
  }

  it("crée, liste dans l'ordre, renomme, réordonne", () => {
    const a = createLocation(tdb.db, ctx, '  Cave  ');
    const b = createLocation(tdb.db, ctx, 'Cave électrique');
    const c = createLocation(tdb.db, ctx, 'Cellier');
    expect(a.ok && a.location.name).toBe('Cave');
    expect(names()).toEqual(['Cave', 'Cave électrique', 'Cellier']);

    if (!(a.ok && b.ok && c.ok)) throw new Error('unreachable');
    const r = renameLocation(tdb.db, ctx, b.location.id, 'Frigo');
    expect(r.ok && r.location.name).toBe('Frigo');

    reorderLocations(tdb.db, ctx, [c.location.id, a.location.id, b.location.id]);
    expect(names()).toEqual(['Cellier', 'Cave', 'Frigo']);

    // new locations go to the end
    createLocation(tdb.db, ctx, 'Garage');
    expect(names().at(-1)).toBe('Garage');
    // renaming to its own name is not a duplicate
    expect(renameLocation(tdb.db, ctx, a.location.id, 'Cave').ok).toBe(true);
  });

  it('refuse un nom vide ou déjà pris dans le foyer', () => {
    expect(createLocation(tdb.db, ctx, '   ')).toEqual({ ok: false, reason: 'empty' });
    expect(createLocation(tdb.db, ctx, 'x'.repeat(61))).toEqual({ ok: false, reason: 'empty' });
    const a = createLocation(tdb.db, ctx, 'Cave');
    expect(createLocation(tdb.db, ctx, 'Cave')).toEqual({ ok: false, reason: 'duplicate' });
    const b = createLocation(tdb.db, ctx, 'Cellier');
    if (!(a.ok && b.ok)) throw new Error('unreachable');
    expect(renameLocation(tdb.db, ctx, b.location.id, ' Cave ')).toEqual({ ok: false, reason: 'duplicate' });
    expect(renameLocation(tdb.db, ctx, b.location.id, '')).toEqual({ ok: false, reason: 'empty' });
    // another household may reuse the name
    expect(createLocation(tdb.db, otherCtx, 'Cave').ok).toBe(true);
  });

  it('deleteLocation refuse si des bouteilles y sont → not_empty', () => {
    const id = makeLocation(tdb, ctx.householdId, 'Cave');
    addWineWithLot(id, 3);
    expect(deleteLocation(tdb.db, ctx, id)).toEqual({ ok: false, reason: 'not_empty' });
    expect(names()).toEqual(['Cave']);
    expect(listLocations(tdb.db, ctx)[0].bottleCount).toBe(3);
  });

  it('deleteLocation supprime les lots vides et garde les consommations (location_id NULL)', () => {
    const id = makeLocation(tdb, ctx.householdId, 'Cave');
    const { wineId, lotId } = addWineWithLot(id, 0);
    const consId = tdb.db
      .insert(tdb.schema.consumptions)
      .values({ wineId, lotId, locationId: id, consumedOn: '2026-01-01' })
      .returning({ id: tdb.schema.consumptions.id })
      .get().id;

    expect(deleteLocation(tdb.db, ctx, id)).toEqual({ ok: true });
    expect(names()).toEqual([]);
    expect(tdb.db.select().from(tdb.schema.stockLots).all()).toHaveLength(0);
    const cons = tdb.db.select().from(tdb.schema.consumptions).where(eq(tdb.schema.consumptions.id, consId)).get();
    expect(cons?.locationId).toBeNull();
    expect(cons?.lotId).toBeNull();
  });

  it("isolation : renommer/réordonner/supprimer un lieu d'un autre foyer → NotFoundError, rien ne change", () => {
    const mine = makeLocation(tdb, ctx.householdId, 'Cave');
    const theirs = makeLocation(tdb, otherCtx.householdId, 'Leur cave');
    addWineWithLot(theirs, 0, otherCtx.householdId);

    expect(() => renameLocation(tdb.db, ctx, theirs, 'Pwned')).toThrow(NotFoundError);
    expect(() => reorderLocations(tdb.db, ctx, [mine, theirs])).toThrow(NotFoundError);
    expect(() => deleteLocation(tdb.db, ctx, theirs)).toThrow(NotFoundError);

    expect(listLocations(tdb.db, otherCtx).map((l) => l.name)).toEqual(['Leur cave']);
    expect(tdb.db.select().from(tdb.schema.stockLots).all()).toHaveLength(1);
    expect(names()).toEqual(['Cave']);
  });
});
