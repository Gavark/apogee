import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { hasNoUsers } from '$lib/server/auth/bootstrap';
import { setupFirstAdmin } from './_logic';
import * as m from '$paraglide/messages';

export const load: PageServerLoad = () => {
  const { db } = getDb();
  if (!hasNoUsers(db)) throw redirect(303, '/login');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const { db } = getDb();
    if (!hasNoUsers(db)) throw redirect(303, '/login');

    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const householdName = String(form.get('householdName') ?? '');
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    const values = { email, householdName };

    if (password !== confirm) {
      return fail(400, { ...values, errors: { confirm: m.auth_err_password_mismatch() } });
    }
    const res = await setupFirstAdmin(db, { email, password, householdName, locale: locals.locale });
    if (!res.ok) {
      const errors = {
        'already-setup': { form: m.auth_err_already_setup() },
        'invalid-email': { email: m.auth_err_invalid_email() },
        'weak-password': { password: m.auth_err_password_short() },
        'household-name-required': { householdName: m.auth_err_household_required() },
        'household-name-too-long': { householdName: m.auth_err_household_too_long() }
      }[res.reason];
      return fail(400, { ...values, errors });
    }
    throw redirect(303, '/login');
  }
};
