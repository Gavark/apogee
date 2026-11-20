import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx, type HouseholdCtx } from '$lib/server/context';
import { createInvitation, listInvitations } from '$lib/server/auth/invitations';
import {
  listHouseholdsForAdmin,
  listMembers,
  deleteUserAsAdmin,
  deleteHouseholdAsAdmin
} from '$lib/server/households';
import * as m from '$paraglide/messages';

/** Instance admins only; everyone else gets the same 404 as an unknown page. */
function requireAdmin(locals: App.Locals): HouseholdCtx {
  const ctx = requireCtx(locals);
  if (!ctx.isAdmin) throw error(404, 'Not found');
  return ctx;
}

export const load: PageServerLoad = ({ locals, url }) => {
  const ctx = requireAdmin(locals);
  const { db } = getDb();
  const households = listHouseholdsForAdmin(db);
  const nameById = new Map(households.map((h) => [h.id, h.name]));
  const now = Math.floor(Date.now() / 1000);
  return {
    currentUserId: ctx.userId,
    ownHouseholdId: ctx.householdId,
    // Names, members and counts only: the cellars themselves stay private.
    households: households.map((h) => ({ ...h, members: listMembers(db, h.id) })),
    invitations: listInvitations(db, null).map((inv) => ({
      id: inv.id,
      householdName: inv.householdId === null ? null : (nameById.get(inv.householdId) ?? null),
      status: inv.usedAt ? ('used' as const) : inv.expiresAt <= now ? ('expired' as const) : ('pending' as const),
      expiresAt: inv.expiresAt,
      link: `${url.origin}/signup?token=${inv.token}`
    }))
  };
};

/** A malformed id behaves like an unknown one. */
function formId(form: FormData): number {
  const n = Number(form.get('id'));
  return Number.isSafeInteger(n) ? n : -1;
}

const reasonMessage = {
  forbidden: () => m.admin_err_forbidden(),
  self: () => m.admin_err_self(),
  not_found: () => m.admin_err_not_found(),
  has_members: () => m.admin_err_has_members(),
  own_household: () => m.admin_err_own_household()
};

export const actions: Actions = {
  inviteHousehold: ({ locals }) => {
    const ctx = requireAdmin(locals);
    const { db } = getDb();
    createInvitation(db, { createdBy: ctx.userId, householdId: null });
    return { invited: true };
  },

  deleteUser: async ({ request, locals }) => {
    const ctx = requireAdmin(locals);
    const id = formId(await request.formData());
    const res = deleteUserAsAdmin(getDb().db, ctx, id);
    if (!res.ok) return fail(400, { error: reasonMessage[res.reason]() });
    return { deleted: true };
  },

  deleteHousehold: async ({ request, locals }) => {
    const ctx = requireAdmin(locals);
    const id = formId(await request.formData());
    const res = deleteHouseholdAsAdmin(getDb().db, ctx, id);
    if (!res.ok) return fail(400, { error: reasonMessage[res.reason]() });
    return { deleted: true };
  }
};
