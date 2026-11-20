import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './db/schema';
import { NotFoundError, type HouseholdCtx } from './context';
import type { Wine } from './db/schema';
import { getOwnedAnalysis } from './label-analyses';
import { cleanupQuietly, deletePhoto, photosDir } from './photos';
import type { AiConfidence } from './ai/types';
import {
  HOME_SECTION_ORDER,
  computePhase,
  validateWindow,
  type Phase,
  type WindowError,
  type WindowYears
} from '../phase';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

const { wines, stockLots, locations, consumptions, users } = schema;

export type Color = 'red' | 'white' | 'rose' | 'sparkling' | 'sweet' | 'fortified';

export type WineInput = {
  producer: string | null;
  cuvee: string | null;
  appellation: string | null;
  region: string | null;
  country: string | null;
  color: Color | null;
  vintage: number | null;
  grapes: string | null;
  formatCl: number;
  acquiredYear: number | null;
  window: WindowYears;
  notes: string | null;
};

/** What an accepted label analysis contributes to a new wine. */
export type AiProvenance = {
  analysisId: number;
  photoPath: string | null;
  window: WindowYears | null;
  confidence: AiConfidence | null;
  rationale: string | null;
  model: string | null;
};

export type LotInput = { locationId: number; position: string; quantity: number };

export type WineInputError = { field: string; reason: 'required' | 'invalid' | WindowError['reason'] };

export const WINE_FORMATS_CL = [37, 50, 75, 150, 300, 600];
export const MIN_VINTAGE = 1900;
export const MAX_LOT_QUANTITY = 10000;
export const MAX_TEXT_LEN = 200;
export const MAX_NOTES_LEN = 2000;

/** Lowercase, ligatures folded (œ→oe, æ→ae), accent-stripped (NFD), whitespace collapsed and trimmed. */
export function normalizeText(s: string | null): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function identityKey(
  w: Pick<WineInput, 'producer' | 'cuvee' | 'appellation' | 'color' | 'vintage' | 'formatCl' | 'acquiredYear'>
): string {
  const parts = [
    normalizeText(w.producer),
    normalizeText(w.cuvee),
    normalizeText(w.appellation),
    w.color ?? '',
    w.vintage ?? '',
    w.formatCl
  ];
  // A non-vintage wine is told apart by the year it entered the cellar.
  if (w.vintage === null) parts.push(w.acquiredYear ?? '');
  return parts.join('|');
}

export function validateWineInput(input: WineInput, currentYear: number): WineInputError | null {
  if (!normalizeText(input.producer) && !normalizeText(input.cuvee) && !normalizeText(input.appellation))
    return { field: 'producer', reason: 'required' };
  const { vintage } = input;
  if (vintage !== null && (!Number.isInteger(vintage) || vintage < MIN_VINTAGE || vintage > currentYear))
    return { field: 'vintage', reason: 'invalid' };
  if (!WINE_FORMATS_CL.includes(input.formatCl)) return { field: 'formatCl', reason: 'invalid' };
  if (vintage === null && input.acquiredYear === null) return { field: 'acquiredYear', reason: 'required' };
  return validateWindow(input.window, vintage ?? input.acquiredYear);
}

/**
 * validateWineInput plus the checks it assumes upstream: every year field is a whole number, and the
 * cellar-entry year lies within 1900..currentYear (window years are ordered by validateWindow).
 */
export function validateParsedWine(input: WineInput, currentYear: number): WineInputError | null {
  const years: [string, number | null][] = [
    ['vintage', input.vintage],
    ['acquiredYear', input.acquiredYear],
    ['drinkFrom', input.window.drinkFrom],
    ['peakFrom', input.window.peakFrom],
    ['peakTo', input.window.peakTo],
    ['drinkUntil', input.window.drinkUntil]
  ];
  for (const [field, v] of years) if (v !== null && !Number.isInteger(v)) return { field, reason: 'invalid' };
  const texts: [string, string | null, number][] = [
    ['producer', input.producer, MAX_TEXT_LEN],
    ['cuvee', input.cuvee, MAX_TEXT_LEN],
    ['appellation', input.appellation, MAX_TEXT_LEN],
    ['region', input.region, MAX_TEXT_LEN],
    ['country', input.country, MAX_TEXT_LEN],
    ['grapes', input.grapes, MAX_TEXT_LEN],
    ['notes', input.notes, MAX_NOTES_LEN]
  ];
  for (const [field, v, max] of texts) if (v !== null && v.length > max) return { field, reason: 'invalid' };
  const { acquiredYear } = input;
  if (acquiredYear !== null && (acquiredYear < MIN_VINTAGE || acquiredYear > currentYear))
    return { field: 'acquiredYear', reason: 'invalid' };
  return validateWineInput(input, currentYear);
}

function assertQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_LOT_QUANTITY)
    throw new RangeError(`quantity must be an integer between 1 and ${MAX_LOT_QUANTITY}`);
}

export function findOwnedWine(db: DB, ctx: HouseholdCtx, wineId: number): Wine {
  const row = db
    .select()
    .from(wines)
    .where(and(eq(wines.id, wineId), eq(wines.householdId, ctx.householdId)))
    .get();
  if (!row) throw new NotFoundError('wine not found');
  return row;
}

function assertOwnedLocation(db: DB, ctx: HouseholdCtx, locationId: number): void {
  const row = db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.householdId, ctx.householdId)))
    .get();
  if (!row) throw new NotFoundError('location not found');
}

function wineColumns(input: WineInput) {
  return {
    producer: input.producer,
    cuvee: input.cuvee,
    appellation: input.appellation,
    region: input.region,
    country: input.country,
    color: input.color,
    vintage: input.vintage,
    grapes: input.grapes,
    formatCl: input.formatCl,
    acquiredYear: input.acquiredYear,
    drinkFrom: input.window.drinkFrom,
    peakFrom: input.window.peakFrom,
    peakTo: input.window.peakTo,
    drinkUntil: input.window.drinkUntil,
    notes: input.notes,
    identityKey: identityKey(input)
  };
}

export function findDuplicate(db: DB, ctx: HouseholdCtx, input: WineInput): Wine | null {
  return (
    db
      .select()
      .from(wines)
      .where(and(eq(wines.householdId, ctx.householdId), eq(wines.identityKey, identityKey(input))))
      .orderBy(asc(wines.id))
      .get() ?? null
  );
}

/** Adds bottles to the lot at (location, position), creating it when absent. */
function upsertLot(db: DB, wineId: number, lot: LotInput): number {
  const existing = db
    .select()
    .from(stockLots)
    .where(
      and(
        eq(stockLots.wineId, wineId),
        eq(stockLots.locationId, lot.locationId),
        eq(stockLots.position, lot.position)
      )
    )
    .get();
  if (existing) {
    db.update(stockLots)
      .set({ quantity: existing.quantity + lot.quantity })
      .where(eq(stockLots.id, existing.id))
      .run();
    return existing.id;
  }
  return db
    .insert(stockLots)
    .values({ wineId, locationId: lot.locationId, position: lot.position, quantity: lot.quantity })
    .returning({ id: stockLots.id })
    .get().id;
}

/** Strict field-by-field equality (null equals null). */
function sameWindow(a: WindowYears, b: WindowYears): boolean {
  return (
    a.drinkFrom === b.drinkFrom && a.peakFrom === b.peakFrom && a.peakTo === b.peakTo && a.drinkUntil === b.drinkUntil
  );
}

const hasYears = (w: WindowYears) =>
  w.drinkFrom !== null || w.peakFrom !== null || w.peakTo !== null || w.drinkUntil !== null;

const NO_AI = { aiConfidence: null, aiRationale: null, aiModel: null, aiAnalyzedAt: null } as const;

export function createWine(
  db: DB,
  ctx: HouseholdCtx,
  input: WineInput,
  lot: LotInput,
  provenance: AiProvenance | null = null
): { wineId: number; lotId: number } {
  assertQuantity(lot.quantity);
  // The window counts as the AI's only when it was proposed and kept as is.
  const fromAi = !!provenance?.window && hasYears(provenance.window) && sameWindow(provenance.window, input.window);
  return db.transaction((tx) => {
    assertOwnedLocation(tx, ctx, lot.locationId);
    const wineId = tx
      .insert(wines)
      .values({
        ...wineColumns(input),
        householdId: ctx.householdId,
        windowSource: fromAi ? 'ai' : 'manual',
        ...(fromAi
          ? {
              aiConfidence: provenance!.confidence,
              aiRationale: provenance!.rationale,
              aiModel: provenance!.model,
              aiAnalyzedAt: Math.floor(Date.now() / 1000)
            }
          : NO_AI),
        labelPhoto: provenance?.photoPath ?? null,
        createdBy: ctx.userId
      })
      .returning({ id: wines.id })
      .get().id;
    return { wineId, lotId: upsertLot(tx, wineId, lot) };
  });
}

/** `photoPath` is attached only when the wine has no photo yet. */
export function addStock(
  db: DB,
  ctx: HouseholdCtx,
  wineId: number,
  lot: LotInput,
  photoPath: string | null = null
): { lotId: number } {
  assertQuantity(lot.quantity);
  return db.transaction((tx) => {
    const wine = findOwnedWine(tx, ctx, wineId);
    assertOwnedLocation(tx, ctx, lot.locationId);
    if (photoPath && !wine.labelPhoto)
      tx.update(wines)
        .set({ labelPhoto: photoPath })
        .where(and(eq(wines.id, wineId), eq(wines.householdId, ctx.householdId)))
        .run();
    return { lotId: upsertLot(tx, wineId, lot) };
  });
}

export function updateWine(db: DB, ctx: HouseholdCtx, wineId: number, input: WineInput): void {
  db.transaction((tx) => {
    const current = findOwnedWine(tx, ctx, wineId);
    // An untouched window keeps its provenance; any change makes it the user's own. The photo stays.
    const unchanged = sameWindow(windowOf(current), input.window);
    tx.update(wines)
      .set({
        ...wineColumns(input),
        ...(unchanged ? {} : { windowSource: 'manual' as const, ...NO_AI }),
        updatedAt: Math.floor(Date.now() / 1000)
      })
      .where(and(eq(wines.id, wineId), eq(wines.householdId, ctx.householdId)))
      .run();
  });
}

/** Applies an analysis' proposed window to a wine as the AI's own; identity and stock are untouched. */
export function applyAiWindow(db: DB, ctx: HouseholdCtx, wineId: number, analysisId: number): void {
  db.transaction((tx) => {
    const wine = findOwnedWine(tx, ctx, wineId);
    const found = getOwnedAnalysis(tx, ctx, analysisId);
    const proposed = found.analysis?.window;
    if (!proposed || !hasYears(proposed)) throw new RangeError('analysis has no window');
    const check = validateWindow(proposed, wine.vintage ?? wine.acquiredYear);
    if (check) throw new RangeError(`analysis window is not valid: ${check.reason}`);
    const now = Math.floor(Date.now() / 1000);
    tx.update(wines)
      .set({
        drinkFrom: proposed.drinkFrom,
        peakFrom: proposed.peakFrom,
        peakTo: proposed.peakTo,
        drinkUntil: proposed.drinkUntil,
        windowSource: 'ai',
        aiConfidence: found.analysis!.confidence,
        aiRationale: found.analysis!.rationale,
        aiModel: found.model,
        aiAnalyzedAt: now,
        // Never replaces a photo the wine already has.
        ...(found.photoPath && !wine.labelPhoto ? { labelPhoto: found.photoPath } : {}),
        updatedAt: now
      })
      .where(and(eq(wines.id, wineId), eq(wines.householdId, ctx.householdId)))
      .run();
  });
}

export function deleteWine(
  db: DB,
  ctx: HouseholdCtx,
  wineId: number,
  photosDirPath: string = photosDir()
): void {
  const photo = db.transaction((tx) => {
    const wine = findOwnedWine(tx, ctx, wineId);
    // lots and consumptions go with the wine (ON DELETE CASCADE)
    tx.delete(wines)
      .where(and(eq(wines.id, wineId), eq(wines.householdId, ctx.householdId)))
      .run();
    if (!wine.labelPhoto) return null;
    const stillUsed = tx.select({ id: wines.id }).from(wines).where(eq(wines.labelPhoto, wine.labelPhoto)).get();
    return stillUsed ? null : wine.labelPhoto;
  });
  // Only once the delete has committed; a photo another wine still points to is kept.
  cleanupQuietly(() => deletePhoto(photosDirPath, photo));
}

export type CellarLot = {
  lotId: number;
  locationId: number;
  locationName: string;
  position: string;
  quantity: number;
};
/** The photo path stays on the server: the browser only learns whether there is one (`hasPhoto`). */
export type PublicWine = Omit<Wine, 'labelPhoto'>;
export type CellarRow = { wine: PublicWine; phase: Phase; bottles: number; lots: CellarLot[] };
export type CellarFilter = {
  q?: string;
  locationId?: number;
  color?: Color;
  phase?: Phase;
  finished?: boolean;
};

function windowOf(w: PublicWine): WindowYears {
  return { drinkFrom: w.drinkFrom, peakFrom: w.peakFrom, peakTo: w.peakTo, drinkUntil: w.drinkUntil };
}

function loadLots(db: DB, wineIds: number[]): Map<number, CellarLot[]> {
  const byWine = new Map<number, CellarLot[]>();
  if (wineIds.length === 0) return byWine;
  const rows = db
    .select({
      wineId: stockLots.wineId,
      lotId: stockLots.id,
      locationId: stockLots.locationId,
      locationName: locations.name,
      position: stockLots.position,
      quantity: stockLots.quantity
    })
    .from(stockLots)
    .innerJoin(locations, eq(locations.id, stockLots.locationId))
    .where(inArray(stockLots.wineId, wineIds))
    .orderBy(asc(locations.sortOrder), asc(locations.id), asc(stockLots.position), asc(stockLots.id))
    .all();
  for (const { wineId, ...lot } of rows) {
    const list = byWine.get(wineId);
    if (list) list.push(lot);
    else byWine.set(wineId, [lot]);
  }
  return byWine;
}

function toRow(full: Wine, lots: CellarLot[], year: number): CellarRow {
  const { labelPhoto: _photo, ...wine } = full;
  return {
    wine,
    phase: computePhase(windowOf(wine), year),
    bottles: lots.reduce((n, l) => n + l.quantity, 0),
    lots
  };
}

function cmpNullsLast(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export function listCellar(db: DB, ctx: HouseholdCtx, filter: CellarFilter, year: number): CellarRow[] {
  const conds = [eq(wines.householdId, ctx.householdId)];
  if (filter.color) conds.push(eq(wines.color, filter.color));
  const found = db
    .select()
    .from(wines)
    .where(and(...conds))
    .all();
  const lotsByWine = loadLots(
    db,
    found.map((w) => w.id)
  );
  const q = normalizeText(filter.q ?? '');
  const wantFinished = filter.finished === true;

  const rows: CellarRow[] = [];
  for (const w of found) {
    const lots = lotsByWine.get(w.id) ?? [];
    const row = toRow(w, lots, year);
    if (wantFinished !== (row.bottles === 0)) continue;
    // An empty lot is not "in" a location, except when browsing finished wines (all their lots are empty).
    if (
      filter.locationId !== undefined &&
      !lots.some((l) => l.locationId === filter.locationId && (wantFinished || l.quantity > 0))
    )
      continue;
    if (filter.phase && row.phase !== filter.phase) continue;
    if (q && ![w.producer, w.cuvee, w.appellation, w.region].some((f) => normalizeText(f).includes(q))) continue;
    rows.push(row);
  }
  return rows.sort(
    (a, b) =>
      normalizeText(a.wine.producer).localeCompare(normalizeText(b.wine.producer)) ||
      cmpNullsLast(a.wine.vintage, b.wine.vintage) ||
      a.wine.id - b.wine.id
  );
}

export function homeSections(rows: CellarRow[]): { phase: Phase; rows: CellarRow[] }[] {
  return HOME_SECTION_ORDER.map((phase) => ({
    phase,
    rows: rows
      .filter((r) => r.phase === phase)
      .sort(
        (a, b) =>
          cmpNullsLast(a.wine.drinkUntil, b.wine.drinkUntil) ||
          cmpNullsLast(a.wine.vintage, b.wine.vintage) ||
          a.wine.id - b.wine.id
      )
  })).filter((s) => s.rows.length > 0);
}

export type WineDetail = CellarRow & {
  hasPhoto: boolean;
  consumptions: {
    id: number;
    consumedOn: string;
    rating: number | null;
    note: string | null;
    userEmail: string | null;
    locationName: string | null;
  }[];
};

export function getWineDetail(db: DB, ctx: HouseholdCtx, wineId: number, year: number): WineDetail {
  const wine = findOwnedWine(db, ctx, wineId);
  const lots = loadLots(db, [wineId]).get(wineId) ?? [];
  const history = db
    .select({
      id: consumptions.id,
      consumedOn: consumptions.consumedOn,
      rating: consumptions.rating,
      note: consumptions.note,
      userEmail: users.email,
      locationName: locations.name
    })
    .from(consumptions)
    .leftJoin(users, eq(users.id, consumptions.userId))
    .leftJoin(locations, eq(locations.id, consumptions.locationId))
    .where(eq(consumptions.wineId, wineId))
    .orderBy(desc(consumptions.consumedOn), desc(consumptions.id))
    .all();
  return { ...toRow(wine, lots, year), hasPhoto: wine.labelPhoto !== null, consumptions: history };
}
