import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import { loadHome, loadCave } from '../../src/routes/app/_logic';
import { createWine, type WineInput } from '../../src/lib/server/wines';
import { applyStockOps } from '../../src/lib/server/stock';
import type { HouseholdCtx } from '../../src/lib/server/context';

const Y = 2026;

let tdb: ReturnType<typeof makeTestDb>;
let ctx: HouseholdCtx;
let loc: number;

function wine(
  producer: string,
  win: [number | null, number | null, number | null, number | null],
  over: Partial<WineInput> = {},
  quantity = 2,
  locationId = loc,
  context = ctx
) {
  const input: WineInput = {
    producer,
    cuvee: null,
    appellation: null,
    region: null,
    country: null,
    color: 'red',
    vintage: 2015,
    grapes: null,
    formatCl: 75,
    acquiredYear: null,
    window: { drinkFrom: win[0], peakFrom: win[1], peakTo: win[2], drinkUntil: win[3] },
    notes: null,
    ...over
  };
  return createWine(tdb.db, context, input, { locationId, position: '', quantity });
}

beforeEach(() => {
  tdb = makeTestDb();
  const h = makeHousehold(tdb);
  ctx = { userId: makeUser(tdb, h), householdId: h, isAdmin: false };
  loc = makeLocation(tdb, h, 'Cave');
});

describe('loadHome', () => {
  it("renvoie les sections dans l'ordre d'urgence pour l'année donnée", () => {
    wine('Inconnu', [null, null, null, null]);
    wine('Jeune', [2030, null, null, 2040]);
    wine('Prêt', [2020, null, null, 2035]);
    wine('Apogée', [2020, 2025, 2028, 2035]);
    wine('Vite', [2020, 2022, 2025, 2030]);
    wine('Dernier', [2020, null, null, 2026]);
    wine('Passé', [2010, null, null, 2020]);
    const home = loadHome(tdb.db, ctx, Y);
    expect(home.year).toBe(Y);
    expect(home.total).toBe(14);
    expect(home.sections.map((s) => s.phase)).toEqual(['past', 'last_call', 'peak', 'ready', 'too_young', 'unknown']);
    // last_call holds both the drinkUntil === year wine and the one past its peak
    expect(home.sections[1].rows.map((r) => r.wine.producer)).toEqual(['Dernier', 'Vite']);
  });

  it("change de phase avec l'année passée", () => {
    wine('X', [2027, null, null, 2030]);
    expect(loadHome(tdb.db, ctx, 2026).sections[0].phase).toBe('too_young');
    expect(loadHome(tdb.db, ctx, 2027).sections[0].phase).toBe('ready');
  });

  it("exclut les vins finis et ne montre que le foyer de l'utilisateur", () => {
    const done = wine('Fini', [2020, null, null, 2035], {}, 1);
    const lot = tdb.db.select().from(tdb.schema.stockLots).all().find((l) => l.wineId === done.wineId)!;
    const r = applyStockOps(tdb.db, ctx, [{ opId: 'op-1', kind: 'consume', lotId: lot.id, consumedOn: '2026-11-19' }])[0];
    expect(r.status).toBe('applied');
    wine('Encore', [2020, null, null, 2035], {}, 3);

    const h2 = makeHousehold(tdb, 'Autre');
    const ctx2: HouseholdCtx = { userId: makeUser(tdb, h2), householdId: h2, isAdmin: false };
    wine('Autre foyer', [2020, null, null, 2035], {}, 4, makeLocation(tdb, h2, 'Cave'), ctx2);

    const home = loadHome(tdb.db, ctx, Y);
    expect(home.total).toBe(3);
    expect(home.sections.flatMap((s) => s.rows.map((r) => r.wine.producer))).toEqual(['Encore']);
  });

  it('cave vide → aucune section', () => {
    expect(loadHome(tdb.db, ctx, Y)).toEqual({ sections: [], total: 0, year: Y });
  });
});

describe('loadCave', () => {
  const q = (s: string) => new URLSearchParams(s);

  it("applique les filtres d'URL", () => {
    const cave2 = makeLocation(tdb, ctx.householdId, 'Cellier');
    wine('Margaux', [2020, null, null, 2035], { color: 'red', appellation: 'Margaux' });
    wine('Chablis', [2030, null, null, 2040], { color: 'white' }, 1, cave2);
    wine('Vieux', [2000, null, null, 2010], { color: 'white' }, 5);

    const all = loadCave(tdb.db, ctx, q(''), Y);
    expect(all.rows).toHaveLength(3);
    expect(all.total).toBe(8);
    expect(all.filter).toEqual({});

    expect(loadCave(tdb.db, ctx, q('q=margaux'), Y).rows.map((r) => r.wine.producer)).toEqual(['Margaux']);
    expect(loadCave(tdb.db, ctx, q('color=white'), Y).rows).toHaveLength(2);
    expect(loadCave(tdb.db, ctx, q(`location=${cave2}`), Y).rows.map((r) => r.wine.producer)).toEqual(['Chablis']);
    expect(loadCave(tdb.db, ctx, q('phase=past'), Y).rows.map((r) => r.wine.producer)).toEqual(['Vieux']);
    const f = loadCave(tdb.db, ctx, q('color=white&phase=too_young'), Y);
    expect(f.rows.map((r) => r.wine.producer)).toEqual(['Chablis']);
    expect(f.filter).toEqual({ color: 'white', phase: 'too_young' });
  });

  it('finished=1 liste les vins finis', () => {
    const done = wine('Fini', [2020, null, null, 2035], {}, 1);
    wine('Encore', [2020, null, null, 2035]);
    const lot = tdb.db.select().from(tdb.schema.stockLots).all().find((l) => l.wineId === done.wineId)!;
    applyStockOps(tdb.db, ctx, [{ opId: 'op-2', kind: 'consume', lotId: lot.id, consumedOn: '2026-11-19' }])[0];
    const r = loadCave(tdb.db, ctx, q('finished=1'), Y);
    expect(r.rows.map((x) => x.wine.producer)).toEqual(['Fini']);
    expect(r.filter.finished).toBe(true);
  });

  it('ignore les paramètres invalides ou étrangers', () => {
    wine('A', [2020, null, null, 2035]);
    const h2 = makeHousehold(tdb, 'Autre');
    const foreign = makeLocation(tdb, h2, 'Cave');
    const r = loadCave(tdb.db, ctx, q(`color=bleu&phase=nope&location=abc&q=`), Y);
    expect(r.filter).toEqual({});
    expect(r.rows).toHaveLength(1);
    // a location of another household is ignored, not an error and not a leak
    const r2 = loadCave(tdb.db, ctx, q(`location=${foreign}`), Y);
    expect(r2.filter).toEqual({});
    expect(r2.rows).toHaveLength(1);
  });
});
