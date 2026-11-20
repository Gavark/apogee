import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { orNotFound, parseRouteId } from '$lib/server/http';
import { getAiProvider } from '$lib/server/ai/config';
import { deleteWine, getWineDetail } from '$lib/server/wines';
import { applyAiFromForm } from './_logic';
import * as m from '$paraglide/messages';
import { currentYear } from '$lib/phase';

export const load: PageServerLoad = ({ params, locals }) => {
  const ctx = requireCtx(locals);
  const id = parseRouteId(params.id);
  return orNotFound(() => ({
    detail: getWineDetail(getDb().db, ctx, id, currentYear(locals.user!.timezone)),
    aiEnabled: getAiProvider() !== null
  }));
};

export const actions: Actions = {
  applyAi: async ({ params, locals, request }) => {
    const ctx = requireCtx(locals);
    const id = parseRouteId(params.id);
    const form = await request.formData();
    const r = orNotFound(() => applyAiFromForm(getDb().db, ctx, id, form));
    if (r.status === 400) return fail(400, { error: m.ai_est_apply_error() });
    return { applied: true };
  },
  delete: ({ params, locals }) => {
    const ctx = requireCtx(locals);
    const id = parseRouteId(params.id);
    orNotFound(() => deleteWine(getDb().db, ctx, id));
    throw redirect(303, '/app');
  }
};
