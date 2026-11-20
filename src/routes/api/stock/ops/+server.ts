import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { applyStockOps, parseStockOps } from '$lib/server/stock';

export const POST: RequestHandler = async ({ request, locals }) => {
  // API route: answer 401 JSON instead of redirecting to /login.
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = parseStockOps(body);
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });

  const { db } = getDb();
  const ctx = { userId: user.id, householdId: user.householdId, isAdmin: user.isAdmin === 1 };
  return json({ results: applyStockOps(db, ctx, parsed.ops) });
};
