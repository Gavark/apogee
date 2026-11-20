import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import {
  normalizeText,
  identityKey,
  validateWineInput,
  findDuplicate,
  createWine,
  addStock,
  updateWine,
  deleteWine,
  listCellar,
  homeSections,
  getWineDetail,
  applyAiWindow,
  type WineInput,
  type AiProvenance,
  type CellarRow
} from '../../src/lib/server/wines';
import { NotFoundError, type HouseholdCtx } from '../../src/lib/server/context';
import type { Phase, WindowYears } from '../../src/lib/phase';

const NO_WINDOW = { drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null };

function wine(over: Partial<WineInput> = {}): WineInput {
  return {
    producer: 'Château Margaux',
    cuvee: null,
    appellation: 'Margaux',
    region: 'Bordeaux',
    country: 'France',
    color: 'red',
    vintage: 2015,
    grapes: null,
    formatCl: 75,
    acquiredYear: null,
    window: NO_WINDOW,
    notes: null,
    ...over
  };
}

describe('wines (pure)', () => {
  it('normalizeText : minuscules, sans accents, espaces compactés', () => {
    expect(normalizeText('  Château   Léoville  ')).toBe('chateau leoville');
    expect(normalizeText(null)).toBe('');
  });

  it('normalizeText replie les ligatures œ/æ (et Œ/Æ)', () => {
    expect(normalizeText('Cœur')).toBe('coeur');
    expect(normalizeText('ŒIL de Perdrix')).toBe('oeil de perdrix');
    expect(normalizeText('Æther')).toBe('aether');
    expect(identityKey(wine({ cuvee: 'Cœur de Cuvée' }))).toBe(identityKey(wine({ cuvee: 'Coeur de Cuvee' })));
  });

  it('identityKey ignore casse, accents et espaces', () =>
    expect(identityKey(wine({ producer: 'Château  Margaux' }))).toBe(
      identityKey(wine({ producer: 'chateau margaux ' }))
    ));

  it('un magnum a une identité distincte du 75 cl', () =>
    expect(identityKey(wine({ formatCl: 150 }))).not.toBe(identityKey(wine({ formatCl: 75 }))));

  it("NV : deux années d'entrée différentes → deux identités ; millésimé : acquiredYear ignoré", () => {
    const nv = (y: number) => identityKey(wine({ vintage: null, acquiredYear: y }));
    expect(nv(2020)).not.toBe(nv(2021));
    const v = (y: number | null) => identityKey(wine({ vintage: 2015, acquiredYear: y }));
    expect(v(2020)).toBe(v(2021));
    expect(v(2020)).toBe(v(null));
  });

  it('identityKey : format producteur|cuvée|appellation|couleur|millésime|format', () =>
    expect(identityKey(wine({ cuvee: 'Pavillon Rouge' }))).toBe(
      'chateau margaux|pavillon rouge|margaux|red|2015|75'
    ));

  describe('validateWineInput', () => {
    const Y = 2026;
    it('NV sans acquiredYear → required', () =>
      expect(validateWineInput(wine({ vintage: null, acquiredYear: null }), Y)).toEqual({
        field: 'acquiredYear',
        reason: 'required'
      }));
    it('NV avec acquiredYear → valide', () =>
      expect(validateWineInput(wine({ vintage: null, acquiredYear: 2024 }), Y)).toBeNull());
    it('fenêtre avant le millésime → before_ref', () =>
      expect(
        validateWineInput(
          wine({ window: { drinkFrom: 2010, peakFrom: null, peakTo: null, drinkUntil: 2030 } }),
          Y
        )
      ).toEqual({ field: 'drinkFrom', reason: 'before_ref' }));
    it("fenêtre d'un NV validée par rapport à acquiredYear", () =>
      expect(
        validateWineInput(
          wine({
            vintage: null,
            acquiredYear: 2024,
            window: { drinkFrom: 2020, peakFrom: null, peakTo: null, drinkUntil: 2030 }
          }),
          Y
        )
      ).toEqual({ field: 'drinkFrom', reason: 'before_ref' }));
    it('aucun de producteur/cuvée/appellation → required sur producer', () => {
      const e = { producer: null, cuvee: '  ', appellation: null };
      expect(validateWineInput(wine(e), Y)).toEqual({ field: 'producer', reason: 'required' });
      expect(validateWineInput(wine({ ...e, cuvee: 'Cuvée X' }), Y)).toBeNull();
    });
    it('millésime hors 1900..année courante → invalid', () => {
      expect(validateWineInput(wine({ vintage: 1899 }), Y)).toEqual({ field: 'vintage', reason: 'invalid' });
      expect(validateWineInput(wine({ vintage: Y + 1 }), Y)).toEqual({ field: 'vintage', reason: 'invalid' });
      expect(validateWineInput(wine({ vintage: 1900 }), Y)).toBeNull();
      expect(validateWineInput(wine({ vintage: Y }), Y)).toBeNull();
    });
    it('format hors liste → invalid ; formats valides acceptés', () => {
      expect(validateWineInput(wine({ formatCl: 70 }), Y)).toEqual({ field: 'formatCl', reason: 'invalid' });
      for (const f of [37, 50, 75, 150, 300, 600])
        expect(validateWineInput(wine({ formatCl: f }), Y)).toBeNull();
    });
    it('fenêtre partielle remontée (partial)', () =>
      expect(
        validateWineInput(
          wine({ window: { drinkFrom: 2020, peakFrom: null, peakTo: null, drinkUntil: null } }),
          Y
        )
      ).toEqual({ field: 'drinkUntil', reason: 'partial' }));
  });
});

describe('wines (db)', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let ctx: HouseholdCtx;
  let otherCtx: HouseholdCtx;
  let loc: number;
  let loc2: number;
  let otherLoc: number;

  beforeEach(() => {
    tdb = makeTestDb();
    const a = makeHousehold(tdb, 'A');
    const b = makeHousehold(tdb, 'B');
    ctx = { userId: makeUser(tdb, a, { email: 'a@x.fr' }), householdId: a, isAdmin: false };
    otherCtx = { userId: makeUser(tdb, b), householdId: b, isAdmin: false };
    loc = makeLocation(tdb, a, 'Cave');
    loc2 = makeLocation(tdb, a, 'Cellier');
    otherLoc = makeLocation(tdb, b, 'Cave B');
  });

  const lot = (over: Partial<{ locationId: number; position: string; quantity: number }> = {}) => ({
    locationId: loc,
    position: '',
    quantity: 1,
    ...over
  });
  const win = (a: number, b: number) => ({ drinkFrom: a, peakFrom: null, peakTo: null, drinkUntil: b });
  const count = (t: 'wines' | 'stockLots') => tdb.db.select().from(tdb.schema[t]).all().length;

  it('createWine puis findDuplicate retrouve le vin', () => {
    expect(findDuplicate(tdb.db, ctx, wine())).toBeNull();
    const { wineId, lotId } = createWine(tdb.db, ctx, wine(), lot({ quantity: 3 }));
    const dup = findDuplicate(tdb.db, ctx, wine({ producer: 'CHATEAU MARGAUX' }));
    expect(dup?.id).toBe(wineId);
    expect(dup?.identityKey).toBe(identityKey(wine()));
    expect(dup?.windowSource).toBe('manual');
    expect(dup?.createdBy).toBe(ctx.userId);
    const l = tdb.db.select().from(tdb.schema.stockLots).where(eq(tdb.schema.stockLots.id, lotId)).get();
    expect(l).toMatchObject({ wineId, locationId: loc, quantity: 3 });
    // autre foyer : pas de doublon
    expect(findDuplicate(tdb.db, otherCtx, wine())).toBeNull();
    // autre format : pas de doublon
    expect(findDuplicate(tdb.db, ctx, wine({ formatCl: 150 }))).toBeNull();
  });

  it("findDuplicate ne renvoie jamais le vin identique d'un autre foyer", () => {
    const mine = createWine(tdb.db, ctx, wine(), lot());
    const theirs = createWine(tdb.db, otherCtx, wine(), lot({ locationId: otherLoc }));
    expect(findDuplicate(tdb.db, ctx, wine())?.id).toBe(mine.wineId);
    expect(findDuplicate(tdb.db, otherCtx, wine())?.id).toBe(theirs.wineId);
    tdb.db.delete(tdb.schema.wines).where(eq(tdb.schema.wines.id, mine.wineId)).run();
    expect(findDuplicate(tdb.db, ctx, wine())).toBeNull();
  });

  it('createWine rejette quantity < 1 sans rien créer', () => {
    expect(() => createWine(tdb.db, ctx, wine(), lot({ quantity: 0 }))).toThrow();
    expect(count('wines')).toBe(0);
  });

  it("createWine avec un lieu d'un autre foyer → NotFoundError, rien n'est créé", () => {
    expect(() => createWine(tdb.db, ctx, wine(), lot({ locationId: otherLoc }))).toThrow(NotFoundError);
    expect(count('wines')).toBe(0);
    expect(count('stockLots')).toBe(0);
  });

  it('addStock fusionne dans le lot existant (même lieu + position) sinon crée un lot', () => {
    const { wineId, lotId } = createWine(tdb.db, ctx, wine(), lot({ position: 'A1', quantity: 2 }));
    const same = addStock(tdb.db, ctx, wineId, lot({ position: 'A1', quantity: 3 }));
    expect(same.lotId).toBe(lotId);
    expect(count('stockLots')).toBe(1);
    expect(tdb.db.select().from(tdb.schema.stockLots).get()?.quantity).toBe(5);

    const other = addStock(tdb.db, ctx, wineId, lot({ position: 'B2', quantity: 1 }));
    const elsewhere = addStock(tdb.db, ctx, wineId, lot({ locationId: loc2, position: 'A1', quantity: 1 }));
    expect(new Set([lotId, other.lotId, elsewhere.lotId]).size).toBe(3);
    expect(count('stockLots')).toBe(3);
    expect(() => addStock(tdb.db, ctx, wineId, lot({ quantity: 0 }))).toThrow();
  });

  it("addStock sur le vin d'un autre foyer → NotFoundError, photo non attachée", () => {
    const { wineId } = createWine(tdb.db, ctx, wine(), lot());
    expect(() => addStock(tdb.db, otherCtx, wineId, { locationId: otherLoc, position: '', quantity: 1 }, '2/x.jpg')).toThrow(
      NotFoundError
    );
    expect(rowOf(wineId).labelPhoto).toBeNull();
    expect(count('stockLots')).toBe(1);
  });

  it('updateWine met à jour les champs et recalcule identityKey', () => {
    const { wineId } = createWine(tdb.db, ctx, wine(), lot());
    updateWine(tdb.db, ctx, wineId, wine({ cuvee: 'Pavillon Rouge', window: win(2020, 2035) }));
    const row = tdb.db.select().from(tdb.schema.wines).where(eq(tdb.schema.wines.id, wineId)).get()!;
    expect(row.cuvee).toBe('Pavillon Rouge');
    expect(row.drinkFrom).toBe(2020);
    expect(row.drinkUntil).toBe(2035);
    expect(row.identityKey).toBe(identityKey(wine({ cuvee: 'Pavillon Rouge' })));
    expect(findDuplicate(tdb.db, ctx, wine({ cuvee: 'Pavillon Rouge' }))?.id).toBe(wineId);
    expect(findDuplicate(tdb.db, ctx, wine())).toBeNull();
  });

  const prov = (over: Partial<AiProvenance> = {}): AiProvenance => ({
    analysisId: 1,
    photoPath: '1/abc.jpg',
    window: win(2025, 2040),
    confidence: 'medium',
    rationale: 'Grand cru classé.',
    model: 'm1',
    ...over
  });
  const rowOf = (id: number) => tdb.db.select().from(tdb.schema.wines).where(eq(tdb.schema.wines.id, id)).get()!;

  describe('applyAiWindow / fiche', () => {
    const analysisRow = (c: HouseholdCtx, window: WindowYears, photoPath: string | null = null) =>
      tdb.db
        .insert(tdb.schema.labelAnalyses)
        .values({
          householdId: c.householdId,
          photoPath,
          model: 'm2',
          result: JSON.stringify({
            isWineLabel: true, producer: 'Autre', cuvee: null, appellation: null, region: null, country: null,
            color: 'white', vintage: 1999, grapes: null, formatCl: 150, window, confidence: 'high', rationale: 'Parce que.'
          })
        })
        .returning({ id: tdb.schema.labelAnalyses.id })
        .get().id;

    it("applyAiWindow écrit fenêtre + ai_* sans toucher à l'identité", () => {
      const { wineId } = createWine(tdb.db, ctx, wine({ window: win(2020, 2030) }), lot());
      const before = rowOf(wineId);
      const a = analysisRow(ctx, { drinkFrom: 2026, peakFrom: 2030, peakTo: 2036, drinkUntil: 2045 });
      applyAiWindow(tdb.db, ctx, wineId, a);
      expect(rowOf(wineId)).toMatchObject({
        drinkFrom: 2026, peakFrom: 2030, peakTo: 2036, drinkUntil: 2045,
        windowSource: 'ai', aiConfidence: 'high', aiRationale: 'Parce que.', aiModel: 'm2',
        producer: before.producer, vintage: before.vintage, color: before.color, formatCl: before.formatCl,
        identityKey: before.identityKey
      });
      expect(rowOf(wineId).aiAnalyzedAt).toBeGreaterThan(0);
    });

    it("applyAiWindow attache la photo de l'analyse si le vin n'en a pas, sans jamais écraser", () => {
      const { wineId } = createWine(tdb.db, ctx, wine(), lot());
      const w = { drinkFrom: 2026, peakFrom: null, peakTo: null, drinkUntil: 2040 };
      applyAiWindow(tdb.db, ctx, wineId, analysisRow(ctx, w, '1/new.jpg'));
      expect(rowOf(wineId).labelPhoto).toBe('1/new.jpg');
      applyAiWindow(tdb.db, ctx, wineId, analysisRow(ctx, w, '1/other.jpg'));
      expect(rowOf(wineId).labelPhoto).toBe('1/new.jpg');
    });

    it('applyAiWindow avec analyse sans fenêtre → RangeError, rien ne change', () => {
      const { wineId } = createWine(tdb.db, ctx, wine({ window: win(2020, 2030) }), lot());
      const before = rowOf(wineId);
      expect(() => applyAiWindow(tdb.db, ctx, wineId, analysisRow(ctx, NO_WINDOW, '1/x.jpg'))).toThrow(RangeError);
      expect(rowOf(wineId)).toEqual(before);
    });

    it("applyAiWindow : vin ou analyse d'un autre foyer → NotFoundError", () => {
      const mine = createWine(tdb.db, ctx, wine(), lot()).wineId;
      const theirs = createWine(tdb.db, otherCtx, wine(), lot({ locationId: otherLoc })).wineId;
      const w = win(2026, 2040);
      expect(() => applyAiWindow(tdb.db, ctx, theirs, analysisRow(ctx, w))).toThrow(NotFoundError);
      expect(() => applyAiWindow(tdb.db, ctx, mine, analysisRow(otherCtx, w))).toThrow(NotFoundError);
      expect(rowOf(mine).windowSource).toBe('manual');
      expect(rowOf(theirs).windowSource).toBe('manual');
    });

    it("getWineDetail expose windowSource, aiConfidence, aiRationale, aiModel et hasPhoto, sans le chemin de la photo", () => {
      const { wineId } = createWine(tdb.db, ctx, wine({ window: win(2025, 2040) }), lot(), prov());
      const d = getWineDetail(tdb.db, ctx, wineId, 2026);
      expect(d.wine).toMatchObject({ windowSource: 'ai', aiConfidence: 'medium', aiRationale: 'Grand cru classé.', aiModel: 'm1' });
      expect(d.hasPhoto).toBe(true);
      expect(d.wine).not.toHaveProperty('labelPhoto');
      const bare = createWine(tdb.db, ctx, wine({ vintage: 2010 }), lot()).wineId;
      expect(getWineDetail(tdb.db, ctx, bare, 2026).hasPhoto).toBe(false);
    });

    it('listCellar ne laisse pas partir le chemin de la photo', () => {
      createWine(tdb.db, ctx, wine(), lot(), prov());
      expect(listCellar(tdb.db, ctx, {}, 2026)[0].wine).not.toHaveProperty('labelPhoto');
    });
  });

  it('createWine avec provenance et fenêtre identique → windowSource ai + confiance/justification/modèle', () => {
    const { wineId } = createWine(tdb.db, ctx, wine({ window: win(2025, 2040) }), lot(), prov());
    expect(rowOf(wineId)).toMatchObject({
      windowSource: 'ai',
      aiConfidence: 'medium',
      aiRationale: 'Grand cru classé.',
      aiModel: 'm1',
      labelPhoto: '1/abc.jpg'
    });
    expect(rowOf(wineId).aiAnalyzedAt).toBeGreaterThan(0);
  });

  it('createWine avec fenêtre corrigée → manual, ai_* nuls, photo attachée', () => {
    const { wineId } = createWine(tdb.db, ctx, wine({ window: win(2026, 2040) }), lot(), prov());
    expect(rowOf(wineId)).toMatchObject({
      windowSource: 'manual',
      aiConfidence: null,
      aiRationale: null,
      aiModel: null,
      aiAnalyzedAt: null,
      labelPhoto: '1/abc.jpg'
    });
  });

  it('createWine : fenêtre IA toute nulle → manual', () => {
    const { wineId } = createWine(tdb.db, ctx, wine(), lot(), prov({ window: NO_WINDOW }));
    expect(rowOf(wineId)).toMatchObject({ windowSource: 'manual', aiConfidence: null, labelPhoto: '1/abc.jpg' });
  });

  it('updateWine sans changer la fenêtre garde ai ; en la changeant → manual et ai_* nuls', () => {
    const { wineId } = createWine(tdb.db, ctx, wine({ window: win(2025, 2040) }), lot(), prov());
    updateWine(tdb.db, ctx, wineId, wine({ cuvee: 'Pavillon', window: win(2025, 2040) }));
    expect(rowOf(wineId)).toMatchObject({ windowSource: 'ai', aiConfidence: 'medium', aiModel: 'm1' });
    updateWine(tdb.db, ctx, wineId, wine({ window: win(2025, 2041) }));
    expect(rowOf(wineId)).toMatchObject({
      windowSource: 'manual',
      aiConfidence: null,
      aiRationale: null,
      aiModel: null,
      aiAnalyzedAt: null,
      labelPhoto: '1/abc.jpg'
    });
  });

  it('deleteWine supprime le vin, ses lots et ses consommations', () => {
    const { wineId, lotId } = createWine(tdb.db, ctx, wine(), lot());
    tdb.db
      .insert(tdb.schema.consumptions)
      .values({ wineId, lotId, locationId: loc, userId: ctx.userId, consumedOn: '2026-01-01' })
      .run();
    deleteWine(tdb.db, ctx, wineId);
    expect(count('wines')).toBe(0);
    expect(count('stockLots')).toBe(0);
    expect(tdb.db.select().from(tdb.schema.consumptions).all()).toHaveLength(0);
  });

  it("isolation : getWineDetail/updateWine/deleteWine/addStock d'un autre foyer → NotFoundError", () => {
    const { wineId } = createWine(tdb.db, ctx, wine(), lot());
    expect(() => getWineDetail(tdb.db, otherCtx, wineId, 2026)).toThrow(NotFoundError);
    expect(() => updateWine(tdb.db, otherCtx, wineId, wine({ producer: 'Pirate' }))).toThrow(NotFoundError);
    expect(() => deleteWine(tdb.db, otherCtx, wineId)).toThrow(NotFoundError);
    expect(() => addStock(tdb.db, otherCtx, wineId, lot({ locationId: otherLoc }))).toThrow(NotFoundError);
    expect(() => getWineDetail(tdb.db, ctx, 9999, 2026)).toThrow(NotFoundError);
    // rien n'a bougé
    const row = tdb.db.select().from(tdb.schema.wines).get()!;
    expect(row.producer).toBe('Château Margaux');
    expect(count('stockLots')).toBe(1);
  });

  it("addStock avec un lieu d'un autre foyer → NotFoundError", () => {
    const { wineId } = createWine(tdb.db, ctx, wine(), lot());
    expect(() => addStock(tdb.db, ctx, wineId, lot({ locationId: otherLoc }))).toThrow(NotFoundError);
    expect(count('stockLots')).toBe(1);
  });

  describe('listCellar', () => {
    function seed() {
      createWine(tdb.db, ctx, wine({ producer: 'Zeta', vintage: 2010, window: win(2012, 2020) }), lot({ quantity: 2 })); // past en 2026
      const b = createWine(
        tdb.db,
        ctx,
        wine({ producer: 'Alpha', vintage: 2018, color: 'white', region: 'Alsace', window: win(2020, 2030) }),
        lot({ locationId: loc2, quantity: 1 })
      ); // ready
      createWine(tdb.db, ctx, wine({ producer: 'Alpha', vintage: 2012, window: win(2015, 2040) }), lot({ quantity: 6 })); // ready
      const fin = createWine(tdb.db, ctx, wine({ producer: 'Fini', vintage: 2000 }), lot({ quantity: 1 }));
      tdb.db.update(tdb.schema.stockLots).set({ quantity: 0 }).where(eq(tdb.schema.stockLots.wineId, fin.wineId)).run();
      createWine(tdb.db, otherCtx, wine({ producer: 'Alpha' }), lot({ locationId: otherLoc }));
      return { b };
    }
    const names = (rows: CellarRow[]) => rows.map((r) => `${r.wine.producer}-${r.wine.vintage}`);

    it('exclut les vins finis par défaut, tri producteur puis millésime, autre foyer exclu', () => {
      seed();
      const rows = listCellar(tdb.db, ctx, {}, 2026);
      expect(names(rows)).toEqual(['Alpha-2012', 'Alpha-2018', 'Zeta-2010']);
      expect(rows.find((r) => r.wine.producer === 'Alpha' && r.wine.vintage === 2012)).toMatchObject({
        bottles: 6,
        phase: 'ready'
      });
      expect(names(listCellar(tdb.db, ctx, { finished: false }, 2026))).toEqual(names(rows));
    });

    it('finished: true → seulement les vins à 0', () => {
      seed();
      const rows = listCellar(tdb.db, ctx, { finished: true }, 2026);
      expect(names(rows)).toEqual(['Fini-2000']);
      expect(rows[0].bottles).toBe(0);
    });

    it('filtre lieu / couleur / phase / q', () => {
      seed();
      expect(names(listCellar(tdb.db, ctx, { locationId: loc2 }, 2026))).toEqual(['Alpha-2018']);
      expect(names(listCellar(tdb.db, ctx, { color: 'white' }, 2026))).toEqual(['Alpha-2018']);
      expect(names(listCellar(tdb.db, ctx, { phase: 'past' }, 2026))).toEqual(['Zeta-2010']);
      expect(names(listCellar(tdb.db, ctx, { phase: 'ready' }, 2026))).toEqual(['Alpha-2012', 'Alpha-2018']);
      expect(names(listCellar(tdb.db, ctx, { q: 'ALSACE' }, 2026))).toEqual(['Alpha-2018']);
      expect(names(listCellar(tdb.db, ctx, { q: 'zéta' }, 2026))).toEqual(['Zeta-2010']);
      expect(names(listCellar(tdb.db, ctx, { q: 'margaux' }, 2026))).toHaveLength(3); // appellation
      expect(listCellar(tdb.db, ctx, { q: 'introuvable' }, 2026)).toEqual([]);
    });

    it('q trouve « Coeur » avec « Cœur » et inversement', () => {
      createWine(tdb.db, ctx, wine({ producer: 'Domaine du Cœur' }), lot());
      expect(listCellar(tdb.db, ctx, { q: 'coeur' }, 2026)).toHaveLength(1);
      expect(listCellar(tdb.db, ctx, { q: 'CŒUR' }, 2026)).toHaveLength(1);
    });

    it("le filtre de lieu ignore les lots vides (sauf avec finished)", () => {
      const { wineId } = createWine(tdb.db, ctx, wine(), lot({ locationId: loc, quantity: 2 }));
      addStock(tdb.db, ctx, wineId, lot({ locationId: loc2, quantity: 1 }));
      tdb.db
        .update(tdb.schema.stockLots)
        .set({ quantity: 0 })
        .where(eq(tdb.schema.stockLots.locationId, loc2))
        .run();
      expect(listCellar(tdb.db, ctx, { locationId: loc2 }, 2026)).toEqual([]);
      expect(listCellar(tdb.db, ctx, { locationId: loc }, 2026)).toHaveLength(1);
      // finished: vin à 0 bouteille seulement ; ici il en reste 2
      expect(listCellar(tdb.db, ctx, { locationId: loc2, finished: true }, 2026)).toEqual([]);
    });

    it("finished + lieu : un vin épuisé reste trouvable par le lieu de son lot vide", () => {
      const { wineId } = createWine(tdb.db, ctx, wine(), lot({ locationId: loc2, quantity: 1 }));
      tdb.db.update(tdb.schema.stockLots).set({ quantity: 0 }).where(eq(tdb.schema.stockLots.wineId, wineId)).run();
      expect(listCellar(tdb.db, ctx, { locationId: loc2, finished: true }, 2026)).toHaveLength(1);
      expect(listCellar(tdb.db, ctx, { locationId: loc2 }, 2026)).toEqual([]);
    });

    it('expose les lots avec nom du lieu et quantité', () => {
      const { b } = seed();
      const row = listCellar(tdb.db, ctx, {}, 2026).find((r) => r.wine.id === b.wineId)!;
      expect(row.lots).toEqual([
        { lotId: b.lotId, locationId: loc2, locationName: 'Cellier', position: '', quantity: 1 }
      ]);
    });

    it('un filtre de lieu ne change pas le total de bouteilles du vin', () => {
      const { wineId } = createWine(tdb.db, ctx, wine(), lot({ quantity: 2 }));
      addStock(tdb.db, ctx, wineId, lot({ locationId: loc2, quantity: 3 }));
      const rows = listCellar(tdb.db, ctx, { locationId: loc2 }, 2026);
      expect(rows).toHaveLength(1);
      expect(rows[0].bottles).toBe(5);
    });
  });

  it("getWineDetail : lots, phase et consommations (e-mail, lieu), plus récentes d'abord", () => {
    const { wineId, lotId } = createWine(tdb.db, ctx, wine({ window: win(2020, 2030) }), lot({ quantity: 2 }));
    const ins = (consumedOn: string, rating: number | null, userId: number | null) =>
      tdb.db
        .insert(tdb.schema.consumptions)
        .values({ wineId, lotId, locationId: loc, userId, consumedOn, rating, note: 'n' })
        .run();
    ins('2025-05-01', 4, ctx.userId);
    ins('2026-02-01', null, null);
    const d = getWineDetail(tdb.db, ctx, wineId, 2026);
    expect(d.phase).toBe('ready');
    expect(d.bottles).toBe(2);
    expect(d.consumptions.map((c) => c.consumedOn)).toEqual(['2026-02-01', '2025-05-01']);
    expect(d.consumptions[1]).toMatchObject({ rating: 4, note: 'n', userEmail: 'a@x.fr', locationName: 'Cave' });
    expect(d.consumptions[0]).toMatchObject({ userEmail: null });
  });
});

describe('homeSections', () => {
  const row = (id: number, phase: Phase, drinkUntil: number | null, vintage: number | null) =>
    ({
      wine: { id, drinkUntil, vintage } as CellarRow['wine'],
      phase,
      bottles: 1,
      lots: []
    }) satisfies CellarRow;

  it('ordre past, last_call, peak, ready, too_young, unknown ; sections vides omises', () => {
    const rows = [
      row(1, 'unknown', null, 2000),
      row(2, 'ready', 2030, 2010),
      row(3, 'past', 2020, 2005),
      row(4, 'too_young', 2050, 2022),
      row(5, 'peak', 2028, 2012),
      row(6, 'last_call', 2026, 2008)
    ];
    expect(homeSections(rows).map((s) => s.phase)).toEqual([
      'past',
      'last_call',
      'peak',
      'ready',
      'too_young',
      'unknown'
    ]);
    const some = homeSections([row(1, 'ready', 2030, 2010), row(2, 'past', 2020, 2005)]);
    expect(some.map((s) => s.phase)).toEqual(['past', 'ready']);
    expect(homeSections([])).toEqual([]);
  });

  it('tri interne : drinkUntil croissant, nuls en dernier, puis millésime', () => {
    const s = homeSections([
      row(1, 'ready', null, 2000),
      row(2, 'ready', 2032, 2015),
      row(3, 'ready', 2030, 2018),
      row(4, 'ready', 2030, 2010),
      row(5, 'ready', null, 1999)
    ]);
    expect(s[0].rows.map((r) => r.wine.id)).toEqual([4, 3, 2, 5, 1]);
  });
});
