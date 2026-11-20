import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getVapidKeys } from '$lib/server/push/vapid';

/** VAPID public key (base64url) for `pushManager.subscribe({ applicationServerKey })`. Public by definition. */
export const GET: RequestHandler = async () => {
  const { db } = getDb();
  const keys = await getVapidKeys(db);
  return new Response(keys.publicKey, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
