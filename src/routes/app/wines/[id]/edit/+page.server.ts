import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { orNotFound, parseRouteId } from '$lib/server/http';
import { getWineDetail, updateWine, validateParsedWine } from '$lib/server/wines';
import { currentYear } from '$lib/phase';
import { wineErrorMessage } from '$lib/wine-labels';
import { parseWineInput } from '../../../add/_logic';

const str = (n: number | null) => (n === null ? '' : String(n));

export const load: PageServerLoad = ({ params, locals }) => {
  const ctx = requireCtx(locals);
  const id = parseRouteId(params.id);
  const { wine } = orNotFound(() => getWineDetail(getDb().db, ctx, id, currentYear(locals.user!.timezone)));
  const values: Record<string, string> = {
    producer: wine.producer ?? '',
    cuvee: wine.cuvee ?? '',
    appellation: wine.appellation ?? '',
    region: wine.region ?? '',
    country: wine.country ?? '',
    color: wine.color ?? '',
    vintage: str(wine.vintage),
    grapes: wine.grapes ?? '',
    formatCl: String(wine.formatCl),
    acquiredYear: str(wine.acquiredYear),
    drinkFrom: str(wine.drinkFrom),
    peakFrom: str(wine.peakFrom),
    peakTo: str(wine.peakTo),
    drinkUntil: str(wine.drinkUntil),
    notes: wine.notes ?? ''
  };
  return { wineId: wine.id, values };
};

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const ctx = requireCtx(locals);
    const id = parseRouteId(params.id);
    const formData = await request.formData();
    const values = Object.fromEntries([...formData].filter(([, v]) => typeof v === 'string')) as Record<string, string>;

    const input = parseWineInput(formData);
    const err = validateParsedWine(input, currentYear(locals.user!.timezone));
    if (err) return fail(400, { values, error: { field: err.field, message: wineErrorMessage(err) } });

    orNotFound(() => updateWine(getDb().db, ctx, id, input));
    throw redirect(303, `/app/wines/${id}`);
  }
};
