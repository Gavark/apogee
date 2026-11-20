import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { orNotFound, parseRouteId } from '$lib/server/http';
import { deleteWine, getWineDetail } from '$lib/server/wines';
import { currentYear } from '$lib/phase';

export const load: PageServerLoad = ({ params, locals }) => {
  const ctx = requireCtx(locals);
  const id = parseRouteId(params.id);
  return orNotFound(() => ({ detail: getWineDetail(getDb().db, ctx, id, currentYear(locals.user!.timezone)) }));
};

export const actions: Actions = {
  delete: ({ params, locals }) => {
    const ctx = requireCtx(locals);
    const id = parseRouteId(params.id);
    orNotFound(() => deleteWine(getDb().db, ctx, id));
    throw redirect(303, '/app');
  }
};
