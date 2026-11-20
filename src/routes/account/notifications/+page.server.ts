import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { listSubscriptionsForUser } from '$lib/server/push/subscribe';
import { getNotificationSettings, saveNotificationSettings, sendTestNotification } from './_logic';

export const load: PageServerLoad = ({ locals }) => {
  const ctx = requireCtx(locals);
  const { db } = getDb();
  return {
    ...getNotificationSettings(db, ctx.userId),
    timezone: locals.user!.timezone,
    // The user's own endpoints, so this browser can tell which row is itself.
    endpoints: Object.fromEntries(listSubscriptionsForUser(db, ctx.userId).map((s) => [s.id, s.endpoint]))
  };
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    const ctx = requireCtx(locals);
    const form = await request.formData();
    const { db } = getDb();
    saveNotificationSettings(db, ctx.userId, {
      notifyPhases: form.get('notify_phases') === 'on',
      notifyMonthly: form.get('notify_monthly') === 'on'
    });
    return { saved: true };
  },

  test: async ({ locals }) => {
    const ctx = requireCtx(locals);
    const { db } = getDb();
    const r = await sendTestNotification(db, ctx.userId, locals.locale as 'fr' | 'en');
    if (r === null) return fail(429, { test: 'limit' as const });
    if (r.sent > 0) return { test: 'sent' as const };
    if (r.dead + r.failed > 0) return fail(502, { test: 'failed' as const });
    return fail(409, { test: 'none' as const });
  }
};
