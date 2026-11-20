import { eq, and, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '../db/schema';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export type NewSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
};

/**
 * Insert OR update by endpoint. We re-write p256dh/auth/userAgent and bump
 * lastSeenAt so a returning device "renewing" its subscription doesn't pile
 * up rows. Endpoint is unique-indexed at the schema level.
 */
export function registerSubscription(db: DB, userId: number, sub: NewSubscription): void {
  const t = Math.floor(Date.now() / 1000);
  // A first subscription starts the digest history now: no dump of changes from before it existed.
  if (listSubscriptionsForUser(db, userId).length === 0)
    db.update(schema.users)
      .set({ lastDispatchAt: t })
      .where(and(eq(schema.users.id, userId), isNull(schema.users.lastDispatchAt)))
      .run();
  db.insert(schema.pushSubscriptions).values({
    userId,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    userAgent: sub.userAgent,
    createdAt: t,
    lastSeenAt: t
  }).onConflictDoUpdate({
    target: schema.pushSubscriptions.endpoint,
    set: {
      userId,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: sub.userAgent,
      lastSeenAt: t
    }
  }).run();
}

export function listSubscriptionsForUser(db: DB, userId: number) {
  return db.select().from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))
    .all();
}

/**
 * Delete one row by id, but ONLY if it belongs to the given user. Returns
 * true if a row was deleted, false otherwise. Used by the user-facing
 * revoke endpoint.
 */
export function revokeSubscription(db: DB, userId: number, id: number): boolean {
  const row = db.select().from(schema.pushSubscriptions)
    .where(and(
      eq(schema.pushSubscriptions.id, id),
      eq(schema.pushSubscriptions.userId, userId)
    )).all()[0];
  if (!row) return false;
  db.delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.id, id))
    .run();
  return true;
}

/**
 * Delete by endpoint regardless of owner. Used by the push delivery layer
 * when the push service returns 404/410 — the subscription is dead and
 * must be cleaned up.
 */
export function deleteSubscriptionByEndpoint(db: DB, endpoint: string): void {
  db.delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint))
    .run();
}

/** Delete by endpoint only if it belongs to the given user. Returns true if a row was deleted. */
export function revokeSubscriptionByEndpoint(db: DB, userId: number, endpoint: string): boolean {
  return (
    db.delete(schema.pushSubscriptions)
      .where(and(eq(schema.pushSubscriptions.endpoint, endpoint), eq(schema.pushSubscriptions.userId, userId)))
      .returning({ id: schema.pushSubscriptions.id })
      .all().length > 0
  );
}
