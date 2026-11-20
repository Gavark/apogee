import type { LayoutServerLoad } from './$types';
import { toPublicUser } from '$lib/server/auth/public-user';

export const load: LayoutServerLoad = ({ locals }) => {
  return { user: toPublicUser(locals.user), theme: locals.theme, locale: locals.locale };
};
