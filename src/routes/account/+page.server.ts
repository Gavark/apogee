import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb, schema } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { listSessionsForUser } from '$lib/server/auth/session';
import { changePassword, changeTimezone } from './_logic';
import { timeZoneOptions } from '$lib/server/timezone';
import * as m from '$paraglide/messages';

export const load: PageServerLoad = ({ locals }) => {
  const ctx = requireCtx(locals);
  const { db } = getDb();
  const household = db
    .select({ name: schema.households.name })
    .from(schema.households)
    .where(eq(schema.households.id, ctx.householdId))
    .all()[0];
  const sessions = listSessionsForUser(db, ctx.userId)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === locals.session?.id
    }));
  const timezone = locals.user!.timezone;
  const known = timeZoneOptions();
  // A zone stored before validation existed (e.g. an alias taken from TZ) stays selectable.
  const options = known.some((o) => o.id === timezone) ? known : [{ id: timezone, label: timezone }, ...known];
  return {
    account: { email: locals.user!.email, isAdmin: ctx.isAdmin, householdName: household?.name ?? '' },
    sessions,
    timezone: { current: timezone, options }
  };
};

export const actions: Actions = {
  changePassword: async ({ request, locals }) => {
    const ctx = requireCtx(locals);
    if (!locals.session) throw redirect(303, '/login');
    const form = await request.formData();
    const { db } = getDb();
    const r = await changePassword(db, ctx.userId, locals.session.id, {
      current: String(form.get('current_password') ?? ''),
      next: String(form.get('new_password') ?? ''),
      confirm: String(form.get('confirm') ?? '')
    });
    if (!r.ok) {
      const errors = {
        'wrong-current': { current: m.account_err_wrong_current() },
        mismatch: { confirm: m.auth_err_password_mismatch() },
        weak: { next: m.auth_err_password_short() }
      }[r.reason];
      return fail(400, { errors });
    }
    return { success: m.account_password_success() };
  },

  setTimezone: async ({ request, locals }) => {
    const ctx = requireCtx(locals);
    const form = await request.formData();
    const r = changeTimezone(getDb().db, ctx.userId, form.get('timezone'));
    if (!r.ok) return fail(400, { timezoneError: m.account_timezone_invalid() });
    return { timezoneSuccess: m.account_timezone_success({ timezone: r.timezone }) };
  }
};
