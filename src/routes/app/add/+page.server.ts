import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { getWineDetail } from '$lib/server/wines';
import { currentYear } from '$lib/phase';
import { wineErrorMessage } from '$lib/wine-labels';
import { submitAddWine } from './_logic';

const LAST_LOCATION_COOKIE = 'last_location_id';

export const load: PageServerLoad = async ({ locals, cookies, parent }) => {
  requireCtx(locals);
  const { locations } = await parent();
  const last = Number(cookies.get(LAST_LOCATION_COOKIE));
  const locationId = locations.some((l) => l.id === last) ? last : (locations[0]?.id ?? null);
  return { locationId, year: currentYear(locals.user!.timezone) };
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const ctx = requireCtx(locals);
    const { db } = getDb();
    const year = currentYear(locals.user!.timezone);
    const formData = await request.formData();
    const values = Object.fromEntries([...formData].filter(([, v]) => typeof v === 'string')) as Record<string, string>;

    const r = submitAddWine(db, ctx, formData, year);
    if ('duplicateOf' in r) {
      const existing = getWineDetail(db, ctx, r.duplicateOf, year);
      return fail(409, { values, duplicate: { wineId: existing.wine.id, bottles: existing.bottles } });
    }
    if (!r.ok) {
      return fail(400, { values, error: { field: r.error.field, message: wineErrorMessage(r.error) } });
    }
    cookies.set(LAST_LOCATION_COOKIE, values.locationId, {
      path: '/app',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });
    return { success: true, wineId: r.wineId, locationId: Number(values.locationId) };
  }
};
