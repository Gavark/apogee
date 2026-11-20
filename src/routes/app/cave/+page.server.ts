import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { currentYear } from '$lib/phase';
import { loadCave } from '../_logic';

export const load: PageServerLoad = ({ locals, url }) =>
  loadCave(getDb().db, requireCtx(locals), url.searchParams, currentYear(locals.user!.timezone));
