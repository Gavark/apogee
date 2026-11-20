import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import { parseWineForm, submitAddWine } from '../../src/routes/app/add/_logic';
import type { HouseholdCtx } from '../../src/lib/server/context';
import { validateParsedWine } from '../../src/lib/server/wines';

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

  it("le vin identique d'un autre foyer n'est pas un doublon et reste intact", () => {
    const other = makeHousehold(tdb, 'B');
    const otherCtx: HouseholdCtx = { userId: makeUser(tdb, other), householdId: other, isAdmin: false };
    const otherLoc = makeLocation(tdb, other, 'Cave B');
    const theirs = submitAddWine(tdb.db, otherCtx, formOf({ locationId: String(otherLoc), quantity: '4' }), Y);
    if (!theirs.ok) throw new Error('their add failed');
    const mine = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc) }), Y);
    expect(mine.ok).toBe(true);
    if (!mine.ok) return;
    expect(mine.wineId).not.toBe(theirs.wineId);
    // confirmer add-stock ne peut pas non plus atteindre le vin de l'autre foyer
    const again = formOf({ locationId: String(loc), quantity: '1' });
    again.set('confirmDuplicate', 'add-stock');
    const r = submitAddWine(tdb.db, ctx, again, Y);
    expect(r).toEqual({ ok: true, wineId: mine.wineId });
    const theirLot = tdb.db.select().from(tdb.schema.stockLots).where(eq(tdb.schema.stockLots.wineId, theirs.wineId)).all();
    expect(theirLot).toMatchObject([{ quantity: 4 }]);
  });

  it('quantité > 10000 ou non sûre → erreur sur quantity', () => {
    for (const q of ['10001', '99999999999999999999']) {
      const r = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), quantity: q }), Y);
      expect(r).toEqual({ ok: false, error: { field: 'quantity', reason: 'invalid' } });
    }
    expect(submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), quantity: '10000' }), Y).ok).toBe(true);
  });

  it('champs texte > 200 caractères → invalid sur le champ, notes > 2000', () => {
    const long = (n: number) => 'x'.repeat(n);
    for (const field of ['producer', 'cuvee', 'appellation', 'region', 'country', 'grapes', 'position']) {
      const r = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), [field]: long(201) }), Y);
      expect(r).toEqual({ ok: false, error: { field, reason: 'invalid' } });
    }
    const n = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), notes: long(2001) }), Y);
    expect(n).toEqual({ ok: false, error: { field: 'notes', reason: 'invalid' } });
    expect(wines()).toHaveLength(0);
    const ok = submitAddWine(tdb.db, ctx, formOf({ locationId: String(loc), cuvee: long(200), notes: long(2000) }), Y);
    expect(ok.ok).toBe(true);
  });

  it('lieu étranger → erreur locationId, rien enregistré', () => {
    const other = makeHousehold(tdb, 'B');
    const foreign = makeLocation(tdb, other, 'Cave B');
    const r = submitAddWine(tdb.db, ctx, formOf({ locationId: String(foreign) }), Y);
    expect(r).toEqual({ ok: false, error: { field: 'locationId', reason: 'invalid' } });
    expect(tdb.db.select().from(tdb.schema.wines).where(eq(tdb.schema.wines.householdId, ctx.householdId)).all()).toHaveLength(0);
  });
});

describe('validateParsedWine', () => {
  const base = {
    producer: 'X', cuvee: null, appellation: null, region: null, country: null, color: null,
    vintage: null as number | null, grapes: null, formatCl: 75, acquiredYear: 2020 as number | null,
    window: { drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null }, notes: null
  };
  it("année d'entrée hors 1900..année courante → invalid sur acquiredYear", () => {
    for (const y of [1899, Y + 1, 0, -5])
      expect(validateParsedWine({ ...base, acquiredYear: y }, Y)).toEqual({ field: 'acquiredYear', reason: 'invalid' });
    expect(validateParsedWine({ ...base, acquiredYear: Y }, Y)).toBeNull();
    expect(validateParsedWine({ ...base, acquiredYear: 1900 }, Y)).toBeNull();
  });
  it('champ texte trop long → invalid (validateParsedWine)', () =>
    expect(validateParsedWine({ ...base, region: 'x'.repeat(201) }, Y)).toEqual({ field: 'region', reason: 'invalid' }));
  it('année non entière → invalid', () =>
    expect(validateParsedWine({ ...base, vintage: NaN }, Y)).toEqual({ field: 'vintage', reason: 'invalid' }));
});
