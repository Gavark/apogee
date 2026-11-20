import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { currentYear } from '$lib/phase';
import { loadHome } from './_logic';

export const load: PageServerLoad = ({ locals }) =>
  loadHome(getDb().db, requireCtx(locals), currentYear(locals.user!.timezone));
