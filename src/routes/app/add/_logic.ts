import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from '$lib/server/db/schema';
import { NotFoundError, type HouseholdCtx } from '$lib/server/context';
import {
  addStock,
  createWine,
  findDuplicate,
  validateParsedWine,
  MAX_LOT_QUANTITY,
  MAX_TEXT_LEN,
  type Color,
  type LotInput,
  type WineInput,
  type WineInputError
} from '$lib/server/wines';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

const COLORS: Color[] = ['red', 'white', 'rose', 'sparkling', 'sweet', 'fortified'];

export type AddResult =
  | { ok: true; wineId: number }
  | { ok: false; error: WineInputError }
  | { ok: false; duplicateOf: number };

function text(form: FormData, name: string): string | null {
  const v = form.get(name);
  if (typeof v !== 'string') return null;
  return v.trim() || null;
}

/** Empty -> null; a whole number -> that number; anything else -> NaN (rejected by validation). */
function whole(form: FormData, name: string): number | null {
  const v = text(form, name);
  if (v === null) return null;
  return /^-?\d+$/.test(v) ? Number(v) : NaN;
}

/** Wine fields only (shared by the add and edit forms). */
export function parseWineInput(form: FormData): WineInput {
  const color = text(form, 'color');
  return {
    producer: text(form, 'producer'),
    cuvee: text(form, 'cuvee'),
    appellation: text(form, 'appellation'),
    region: text(form, 'region'),
    country: text(form, 'country'),
    color: COLORS.includes(color as Color) ? (color as Color) : null,
    vintage: whole(form, 'vintage'),
    grapes: text(form, 'grapes'),
    formatCl: whole(form, 'formatCl') ?? 75,
    acquiredYear: whole(form, 'acquiredYear'),
    window: {
      drinkFrom: whole(form, 'drinkFrom'),
      peakFrom: whole(form, 'peakFrom'),
      peakTo: whole(form, 'peakTo'),
      drinkUntil: whole(form, 'drinkUntil')
    },
    notes: text(form, 'notes')
  };
}

export function parseWineForm(form: FormData): { input: WineInput; lot: LotInput } {
  return {
    input: parseWineInput(form),
    lot: {
      locationId: whole(form, 'locationId') ?? NaN,
      position: text(form, 'position') ?? '',
      quantity: whole(form, 'quantity') ?? NaN
    }
  };
}

export function submitAddWine(db: DB, ctx: HouseholdCtx, form: FormData, year: number): AddResult {
  const { input, lot } = parseWineForm(form);
  const error = validateParsedWine(input, year);
  if (error) return { ok: false, error };
  if (lot.position.length > MAX_TEXT_LEN) return { ok: false, error: { field: 'position', reason: 'invalid' } };
  if (!Number.isSafeInteger(lot.quantity) || lot.quantity < 1 || lot.quantity > MAX_LOT_QUANTITY)
    return { ok: false, error: { field: 'quantity', reason: 'invalid' } };
  if (!Number.isSafeInteger(lot.locationId)) return { ok: false, error: { field: 'locationId', reason: 'invalid' } };

  try {
    const confirm = form.get('confirmDuplicate');
    const duplicate = findDuplicate(db, ctx, input);
    if (duplicate && confirm !== 'add-stock' && confirm !== 'new') return { ok: false, duplicateOf: duplicate.id };
    if (duplicate && confirm === 'add-stock') {
      addStock(db, ctx, duplicate.id, lot);
      return { ok: true, wineId: duplicate.id };
    }
    return { ok: true, wineId: createWine(db, ctx, input, lot).wineId };
  } catch (e) {
    // A location of another household looks exactly like one that does not exist.
    if (e instanceof NotFoundError) return { ok: false, error: { field: 'locationId', reason: 'invalid' } };
    throw e;
  }
}
