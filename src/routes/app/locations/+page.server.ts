import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { NotFoundError, requireCtx } from '$lib/server/context';
import {
  createLocation,
  renameLocation,
  reorderLocations,
  deleteLocation,
  listLocations
} from '$lib/server/locations';
import * as m from '$paraglide/messages';

// The parent layout already loads the locations; this page reads them from there.
export const load: PageServerLoad = ({ locals }) => {
  requireCtx(locals);
  return {};
};

const nameError = (reason: 'empty' | 'duplicate') =>
  reason === 'empty' ? m.loc_err_empty() : m.loc_err_duplicate();

function parseId(form: FormData): number {
  const id = Number(form.get('id'));
  if (!Number.isInteger(id)) throw new NotFoundError();
  return id;
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const ctx = requireCtx(locals);
    const form = await request.formData();
    const r = createLocation(getDb().db, ctx, String(form.get('name') ?? ''));
    if (!r.ok) return fail(400, { action: 'create', error: nameError(r.reason) });
    return { action: 'create', success: true };
  },

  rename: async ({ request, locals }) => {
    const ctx = requireCtx(locals);
    const form = await request.formData();
    try {
      const id = parseId(form);
      const r = renameLocation(getDb().db, ctx, id, String(form.get('name') ?? ''));
      if (!r.ok) return fail(400, { action: 'rename', id, error: nameError(r.reason) });
      return { action: 'rename', success: true };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(404, { action: 'rename', error: m.loc_err_not_found() });
      throw e;
    }
  },

  move: async ({ request, locals }) => {
    const ctx = requireCtx(locals);
    const form = await request.formData();
    const { db } = getDb();
    try {
      const id = parseId(form);
      const ids = listLocations(db, ctx).map((l) => l.id);
      const from = ids.indexOf(id);
      if (from === -1) throw new NotFoundError();
      const to = form.get('dir') === 'up' ? from - 1 : from + 1;
      if (to >= 0 && to < ids.length) {
        [ids[from], ids[to]] = [ids[to], ids[from]];
        reorderLocations(db, ctx, ids);
      }
      return { action: 'move', success: true };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(404, { action: 'move', error: m.loc_err_not_found() });
      throw e;
    }
  },

  delete: async ({ request, locals }) => {
    const ctx = requireCtx(locals);
    const form = await request.formData();
    const { db } = getDb();
    try {
      const id = parseId(form);
      const r = deleteLocation(db, ctx, id);
      if (!r.ok) {
        const count = listLocations(db, ctx).find((l) => l.id === id)?.bottleCount ?? 0;
        return fail(409, { action: 'delete', id, error: m.loc_err_not_empty({ count }) });
      }
      return { action: 'delete', success: true, message: m.loc_toast_deleted() };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(404, { action: 'delete', error: m.loc_err_not_found() });
      throw e;
    }
  }
};
