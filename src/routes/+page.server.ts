import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rootRedirectTarget } from './_logic';

export const load: PageServerLoad = ({ locals }) => {
  throw redirect(303, rootRedirectTarget(locals.user));
};
