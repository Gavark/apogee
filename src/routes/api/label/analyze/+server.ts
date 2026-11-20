import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getAiProvider, aiDailyLimit } from '$lib/server/ai/config';
import { photosDir } from '$lib/server/photos';
import { currentYear } from '$lib/phase';
import { handleAnalyze } from './_logic';

export const POST: RequestHandler = async ({ request, locals }) => {
  // API route: answer 401 JSON instead of redirecting to /login.
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'invalid_request' }, { status: 400 });
  }

  const { db } = getDb();
  const ctx = { userId: user.id, householdId: user.householdId, isAdmin: user.isAdmin === 1 };
  const { status, body } = await handleAnalyze(db, ctx, getAiProvider(), form, {
    timeZone: user.timezone,
    locale: locals.locale,
    currentYear: currentYear(user.timezone),
    dailyLimit: aiDailyLimit(process.env),
    photosDir: photosDir()
  });
  return json(body, { status });
};
