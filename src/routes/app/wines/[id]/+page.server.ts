import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { NotFoundError, requireCtx } from '$lib/server/context';
import { deleteWine, getWineDetail } from '$lib/server/wines';
import { currentYear } from '$lib/phase';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw error(404);
  return id;
}

export const load: PageServerLoad = ({ params, locals }) => {
  const ctx = requireCtx(locals);
  try {
    return { detail: getWineDetail(getDb().db, ctx, parseId(params.id), currentYear(locals.user!.timezone)) };
  } catch (e) {
    if (e instanceof NotFoundError) throw error(404);
    throw e;
  }
};

export const actions: Actions = {
  delete: ({ params, locals }) => {
    const ctx = requireCtx(locals);
    try {
      deleteWine(getDb().db, ctx, parseId(params.id));
    } catch (e) {
      if (e instanceof NotFoundError) throw error(404);
      throw e;
    }
    throw redirect(303, '/app');
  }
};
