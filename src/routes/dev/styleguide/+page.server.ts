import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Developer page: every shared component on one screen. Never shipped live.
export const load: PageServerLoad = () => {
  if (process.env.NODE_ENV === 'production') throw error(404, 'Not found');
  return {};
};
