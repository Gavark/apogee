import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import { parseWineForm, submitAddWine } from '../../src/routes/app/add/_logic';
import type { HouseholdCtx } from '../../src/lib/server/context';

const Y = 2026;

function formOf(over: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    producer: 'Château Margaux',
    cuvee: '',
    appellation: 'Margaux',
    region: '',
    country: '',
    color: 'red',
    vintage: '2015',
    grapes: '',
    formatCl: '75',
    acquiredYear: '',
    drinkFrom: '',
    peakFrom: '',
    peakTo: '',
    drinkUntil: '',
    notes: '',
    locationId: '1',
    position: '',
    quantity: '2',
    ...over
  };
  const f = new FormData();
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  return f;
}

describe('parseWineForm', () => {
  it('convertit les champs vides en null et les années en nombres', () => {
    const { input, lot } = parseWineForm(
      formOf({ producer: '  Dugat-Py ', drinkFrom: '2025', peakFrom: '2028', peakTo: '2032', drinkUntil: '2040', locationId: '7', position: ' A3 ' })
    );
    expect(input.producer).toBe('Dugat-Py');
    expect(input.cuvee).toBeNull();
    expect(input.region).toBeNull();
    expect(input.notes).toBeNull();
    expect(input.color).toBe('red');
    expect(input.vintage).toBe(2015);
    expect(input.formatCl).toBe(75);
    expect(input.acquiredYear).toBeNull();
    expect(input.window).toEqual({ drinkFrom: 2025, peakFrom: 2028, peakTo: 2032, drinkUntil: 2040 });
    expect(lot).toEqual({ locationId: 7, position: 'A3', quantity: 2 });
  });

  it('couleur vide ou inconnue → null', () => {
    expect(parseWineForm(formOf({ color: '' })).input.color).toBeNull();
    expect(parseWineForm(formOf({ color: 'bleu' })).input.color).toBeNull();
  });
});

describe('submitAddWine', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let ctx: HouseholdCtx;
  let loc: number;

  beforeEach(() => {
    tdb = makeTestDb();
    const h = makeHousehold(tdb);
    ctx = { userId: makeUser(tdb, h), householdId: h, isAdmin: false };
    loc = makeLocation(tdb, h, 'Cave');
  });

  const lots = () => tdb.db.select().from(tdb.schema.stockLots).all();
  const wines = () => tdb.db.select().from(tdb.schema.wines).all();

  it('crée le vin et son lot', () => {
    const r = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), position: 'A1' }), Y);
    expect(r.ok).toBe(true);
    const w = wines();
    expect(w).toHaveLength(1);
    expect(lots()).toMatchObject([{ wineId: w[0].id, locationId: loc, position: 'A1', quantity: 2 }]);
  });

  it('sur un doublon renvoie duplicateOf, puis add-stock ajoute au vin existant', () => {
    const first = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc) }), Y);
    if (!first.ok) throw new Error('first add failed');
    const again = formOf({ producer: 'chateau  margaux', locationId: String(loc), quantity: '3' });
    expect(submitAddWine(tdb.db, ctx, again, Y)).toEqual({ ok: false, duplicateOf: first.wineId });
    expect(lots()).toHaveLength(1);

    again.set('confirmDuplicate', 'add-stock');
    expect(submitAddWine(tdb.db, ctx, again, Y)).toEqual({ ok: true, wineId: first.wineId });
    expect(wines()).toHaveLength(1);
    expect(lots()[0].quantity).toBe(5);
  });

  it('confirmDuplicate=new crée une fiche séparée', () => {
    submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc) }), Y);
    const again = formOf({ locationId: String(loc) });
    again.set('confirmDuplicate', 'new');
    const r = submitAddWine(tdb.db, ctx, again, Y);
    expect(r.ok).toBe(true);
    expect(wines()).toHaveLength(2);
  });

  it("renvoie l'erreur de fenêtre sur le bon champ et n'enregistre rien", () => {
    const r = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), drinkFrom: '2025' }), Y);
    expect(r).toEqual({ ok: false, error: { field: 'drinkUntil', reason: 'partial' } });
    expect(wines()).toHaveLength(0);
  });

  it('quantité < 1 ou invalide → erreur sur quantity', () => {
    for (const q of ['0', '-2', '', 'x', '1.5']) {
      const r = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), quantity: q }), Y);
      expect(r).toEqual({ ok: false, error: { field: 'quantity', reason: 'invalid' } });
    }
    expect(wines()).toHaveLength(0);
  });

  it('année non entière → invalid sur le champ, rien enregistré', () => {
    const r = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), drinkFrom: '20x5', drinkUntil: '2040' }), Y);
    expect(r).toEqual({ ok: false, error: { field: 'drinkFrom', reason: 'invalid' } });
    expect(wines()).toHaveLength(0);
  });

  it("millésime vide sans année d'entrée → acquiredYear required", () => {
    const r = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), vintage: '' }), Y);
    expect(r).toEqual({ ok: false, error: { field: 'acquiredYear', reason: 'required' } });
  });

  it('lieu étranger → erreur locationId, rien enregistré', () => {
    const other = makeHousehold(tdb, 'B');
    const foreign = makeLocation(tdb, other, 'Cave B');
    const r = submitAddWine(tdb.db, ctx, formOf({ locationId: String(foreign) }), Y);
    expect(r).toEqual({ ok: false, error: { field: 'locationId', reason: 'invalid' } });
    expect(tdb.db.select().from(tdb.schema.wines).where(eq(tdb.schema.wines.householdId, ctx.householdId)).all()).toHaveLength(0);
  });
});
