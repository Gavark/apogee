import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';

let tdb: ReturnType<typeof makeTestDb>;
beforeEach(() => {
  tdb = makeTestDb();
});

const count = (table: string) =>
  (tdb.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

function seedWine(householdId: number, createdBy: number | null, name = 'Domaine X') {
  const { db, schema } = tdb;
  return db
    .insert(schema.wines)
    .values({ householdId, producer: name, identityKey: name.toLowerCase(), createdBy })
    .returning({ id: schema.wines.id })
    .get().id;
}

describe('schema constraints', () => {
  it('supprimer un utilisateur garde ses vins et consommations (created_by / user_id → NULL)', () => {
    const { db, sqlite, schema } = tdb;
    const h = makeHousehold(tdb);
    const u = makeUser(tdb, h);
    const loc = makeLocation(tdb, h, 'Cave');
    const wineId = seedWine(h, u);
    const lotId = db.insert(schema.stockLots).values({ wineId, locationId: loc, quantity: 3 }).returning({ id: schema.stockLots.id }).get().id;
    db.insert(schema.consumptions).values({ wineId, lotId, locationId: loc, userId: u, consumedOn: '2026-01-01' }).run();

    sqlite.prepare('DELETE FROM users WHERE id = ?').run(u);

    expect(sqlite.prepare('SELECT created_by FROM wines').get()).toEqual({ created_by: null });
    expect(sqlite.prepare('SELECT user_id FROM consumptions').get()).toEqual({ user_id: null });
    expect(count('wines')).toBe(1);
    expect(count('consumptions')).toBe(1);
  });

  it('supprimer un foyer supprime ses lieux, vins, lots, consommations, invitations', () => {
    const { db, sqlite, schema } = tdb;
    const h = makeHousehold(tdb);
    const u = makeUser(tdb, h);
    const loc = makeLocation(tdb, h, 'Cave');
    const wineId = seedWine(h, u);
    const lotId = db.insert(schema.stockLots).values({ wineId, locationId: loc, quantity: 1 }).returning({ id: schema.stockLots.id }).get().id;
    db.insert(schema.consumptions).values({ wineId, lotId, locationId: loc, userId: u, consumedOn: '2026-01-01' }).run();
    db.insert(schema.invitations).values({ token: 't', createdBy: u, expiresAt: 9999999999, householdId: h }).run();
    db.insert(schema.appliedOps).values({ opId: 'op1', householdId: h, result: '{}' }).run();

    // Remove lots/consumptions' dependants are cascaded from the household; users must go first.
    sqlite.prepare('DELETE FROM users WHERE household_id = ?').run(h);
    sqlite.prepare('DELETE FROM households WHERE id = ?').run(h);

    for (const t of ['locations', 'wines', 'stock_lots', 'consumptions', 'invitations', 'applied_ops']) {
      expect(count(t), t).toBe(0);
    }
  });

  it('refuse de supprimer un foyer qui a encore des membres', () => {
    const h = makeHousehold(tdb);
    makeUser(tdb, h);
    expect(() => tdb.sqlite.prepare('DELETE FROM households WHERE id = ?').run(h)).toThrow(/FOREIGN KEY/);
  });

  it('refuse un lieu en double dans un même foyer, accepte le même nom dans un autre foyer', () => {
    const h1 = makeHousehold(tdb, 'A');
    const h2 = makeHousehold(tdb, 'B');
    makeLocation(tdb, h1, 'Cave');
    expect(() => makeLocation(tdb, h1, 'Cave')).toThrow(/UNIQUE/);
    expect(() => makeLocation(tdb, h2, 'Cave')).not.toThrow();
  });

  it('refuse de supprimer un lieu qui porte un lot', () => {
    const { db, sqlite, schema } = tdb;
    const h = makeHousehold(tdb);
    const loc = makeLocation(tdb, h, 'Cave');
    const wineId = seedWine(h, null);
    db.insert(schema.stockLots).values({ wineId, locationId: loc, quantity: 1 }).run();
    expect(() => sqlite.prepare('DELETE FROM locations WHERE id = ?').run(loc)).toThrow(/FOREIGN KEY/);
  });
});
