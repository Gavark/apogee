import type { Actions, PageServerLoad } from './$types';
import { getDb, schema } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { createInvitation, listInvitations } from '$lib/server/auth/invitations';
import { listMembers } from '$lib/server/households';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = ({ locals, url }) => {
  const ctx = requireCtx(locals);
  const { db } = getDb();
  const household = db
    .select({ name: schema.households.name })
    .from(schema.households)
    .where(eq(schema.households.id, ctx.householdId))
    .all()[0];
  const now = Math.floor(Date.now() / 1000);
  return {
    householdName: household?.name ?? '',
    currentUserId: ctx.userId,
    members: listMembers(db, ctx.householdId),
    invitations: listInvitations(db, ctx.householdId).map((inv) => ({
      id: inv.id,
      status: inv.usedAt ? ('used' as const) : inv.expiresAt <= now ? ('expired' as const) : ('pending' as const),
      expiresAt: inv.expiresAt,
      link: `${url.origin}/signup?token=${inv.token}`
    }))
  };
};

export const actions: Actions = {
  invite: ({ locals }) => {
    const ctx = requireCtx(locals);
    const { db } = getDb();
    createInvitation(db, { createdBy: ctx.userId, householdId: ctx.householdId });
    return { invited: true };
  }
};
