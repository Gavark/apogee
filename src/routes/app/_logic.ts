import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from '$lib/server/db/schema';
import type { HouseholdCtx } from '$lib/server/context';
import { listCellar, homeSections, type CellarFilter, type CellarRow, type Color } from '$lib/server/wines';
import { listLocations } from '$lib/server/locations';
import { HOME_SECTION_ORDER, type Phase } from '$lib/phase';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export const COLORS: Color[] = ['red', 'white', 'rose', 'sparkling', 'sweet', 'fortified'];

const totalBottles = (rows: CellarRow[]) => rows.reduce((n, r) => n + r.bottles, 0);

/** "Quoi ouvrir": the household's wines still in stock, grouped by urgency. */
export function loadHome(db: DB, ctx: HouseholdCtx, year: number) {
  const rows = listCellar(db, ctx, {}, year);
  return { sections: homeSections(rows), total: totalBottles(rows), year };
}

/** Reads the cellar filter from the URL. Anything invalid or foreign is dropped, never an error. */
export function parseCaveFilter(db: DB, ctx: HouseholdCtx, params: URLSearchParams): CellarFilter {
  const filter: CellarFilter = {};
  const q = params.get('q')?.trim();
  if (q) filter.q = q;

  const location = params.get('location');
  if (location && /^\d+$/.test(location)) {
    const id = Number(location);
    if (listLocations(db, ctx).some((l) => l.id === id)) filter.locationId = id;
  }

  const color = params.get('color');
  if (COLORS.includes(color as Color)) filter.color = color as Color;

  const phase = params.get('phase');
  if (HOME_SECTION_ORDER.includes(phase as Phase)) filter.phase = phase as Phase;

  const finished = params.get('finished');
  if (finished === '1' || finished === 'true') filter.finished = true;
  return filter;
}

export function loadCave(db: DB, ctx: HouseholdCtx, params: URLSearchParams, year: number) {
  const filter = parseCaveFilter(db, ctx, params);
  const rows = listCellar(db, ctx, filter, year);
  return { rows, filter, total: totalBottles(rows) };
}
