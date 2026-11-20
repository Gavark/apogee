import type { LayoutServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { listLocations } from '$lib/server/locations';

export const load: LayoutServerLoad = ({ locals }) => {
  const ctx = requireCtx(locals);
  const { db } = getDb();
  return {
    locations: listLocations(db, ctx),
    isAdmin: ctx.isAdmin,
    locale: locals.locale,
    theme: locals.theme
  };
};
