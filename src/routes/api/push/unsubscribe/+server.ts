import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { revokeSubscription, revokeSubscriptionByEndpoint } from '$lib/server/push/subscribe';

/** Remove one of the caller's own subscriptions by `{ id }` or `{ endpoint }`. 204 whether or not it existed. */
export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { db } = getDb();

  if (Number.isInteger(body?.id)) {
    revokeSubscription(db, user.id, body.id);
  } else if (typeof body?.endpoint === 'string' && body.endpoint.trim()) {
    revokeSubscriptionByEndpoint(db, user.id, body.endpoint.trim());
  } else {
    return json({ error: 'id or endpoint required' }, { status: 400 });
  }
  return new Response(null, { status: 204 });
};
