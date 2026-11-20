import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { NotFoundError, requireCtx } from '$lib/server/context';
import { getWineDetail, updateWine } from '$lib/server/wines';
import { currentYear } from '$lib/phase';
import { wineErrorMessage } from '$lib/wine-labels';
import { parseWineInput, validateParsedWine } from '../../../add/_logic';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw error(404);
  return id;
}

const str = (n: number | null) => (n === null ? '' : String(n));

export const load: PageServerLoad = ({ params, locals }) => {
  const ctx = requireCtx(locals);
  try {
    const { wine } = getWineDetail(getDb().db, ctx, parseId(params.id), currentYear(locals.user!.timezone));
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
  } catch (e) {
    if (e instanceof NotFoundError) throw error(404);
    throw e;
  }
};

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const ctx = requireCtx(locals);
    const id = parseId(params.id);
    const formData = await request.formData();
    const values = Object.fromEntries([...formData].filter(([, v]) => typeof v === 'string')) as Record<string, string>;

    const input = parseWineInput(formData);
    const err = validateParsedWine(input, currentYear(locals.user!.timezone));
    if (err) return fail(400, { values, error: { field: err.field, message: wineErrorMessage(err) } });

    try {
      updateWine(getDb().db, ctx, id, input);
    } catch (e) {
      if (e instanceof NotFoundError) throw error(404);
      throw e;
    }
    throw redirect(303, `/app/wines/${id}`);
  }
};
