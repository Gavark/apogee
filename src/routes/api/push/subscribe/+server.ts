import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { registerSubscription } from '$lib/server/push/subscribe';
import { rateLimit } from '$lib/server/rate-limit';

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  // 5 attempts per hour per (user, IP): bounds a hijacked session flooding subscriptions.
  if (!rateLimit(`push-subscribe:${user.id}:${getClientAddress()}`, 5, 3600)) {
    return json({ error: 'too many subscription attempts' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body?.p256dh === 'string' ? body.p256dh.trim() : '';
  const auth = typeof body?.auth === 'string' ? body.auth.trim() : '';
  const userAgent = typeof body?.userAgent === 'string' ? body.userAgent.slice(0, 500) : null;

  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    return json({ error: 'invalid subscription payload' }, { status: 400 });
  }
  if (endpoint.length > 1024) return json({ error: 'endpoint too long' }, { status: 400 });

  const { db } = getDb();
  registerSubscription(db, user.id, { endpoint, p256dh, auth, userAgent });
  return new Response(null, { status: 204 });
};
