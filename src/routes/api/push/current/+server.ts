import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { findSubscriptionIdByEndpoint } from '$lib/server/push/subscribe';

/** Which of the caller's own subscriptions has this endpoint: `{ id }` or `{ id: null }`. */
export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint) return json({ error: 'endpoint required' }, { status: 400 });
  const { db } = getDb();
  return json({ id: findSubscriptionIdByEndpoint(db, user.id, endpoint) });
};
