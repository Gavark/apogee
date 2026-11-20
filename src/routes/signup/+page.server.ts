import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { findUsableInvitation } from '$lib/server/auth/invitations';
import { signupWithToken } from './_logic';
import * as m from '$paraglide/messages';

// Signup is invitation-only: DISABLE_SIGNUP (closed by default) means there
// is no open registration, and a valid token is always required.
export const load: PageServerLoad = ({ url, locals }) => {
  if (locals.user) throw redirect(303, '/app');
  const token = url.searchParams.get('token') ?? '';
  const { db } = getDb();
  const inv = findUsableInvitation(db, token);
  // Only an invitation without household makes the invitee name a new one.
  return { tokenValid: !!inv, token, needsHousehold: !!inv && inv.householdId === null };
};

export const actions: Actions = {
  default: async ({ request, url, locals }) => {
    const form = await request.formData();
    const token = String(form.get('token') ?? url.searchParams.get('token') ?? '');
    const email = String(form.get('email') ?? '');
    const householdName = String(form.get('householdName') ?? '');
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    const values = { email, householdName };

    if (password !== confirm) {
      return fail(400, { ...values, errors: { confirm: m.auth_err_password_mismatch() } });
    }
    const { db } = getDb();
    const res = await signupWithToken(db, {
      token,
      email,
      password,
      householdName,
      locale: locals.locale
    });
    if (!res.ok) {
      const errors = {
        'bad-token': { form: m.auth_err_bad_token() },
        'weak-password': { password: m.auth_err_password_short() },
        'duplicate-email': { email: m.auth_err_duplicate_email() },
        'invalid-email': { email: m.auth_err_invalid_email() },
        'household-name-required': { householdName: m.auth_err_household_required() },
        'household-name-too-long': { householdName: m.auth_err_household_too_long() }
      }[res.reason];
      return fail(400, { ...values, errors });
    }
    throw redirect(303, '/login');
  }
};
