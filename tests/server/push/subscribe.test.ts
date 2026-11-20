import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../../helpers/db';
import { makeHousehold, makeUser } from '../../helpers/fixtures';
import {
  registerSubscription,
  listSubscriptionsForUser,
  revokeSubscription,
  revokeSubscriptionByEndpoint,
  deleteSubscriptionByEndpoint
} from '../../../src/lib/server/push/subscribe';

describe('push subscription service', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let userId: number;
  let householdId: number;
  beforeEach(() => {
    tdb = makeTestDb();
    householdId = makeHousehold(tdb);
    userId = makeUser(tdb, householdId);
  });

  it('registerSubscription inserts a row', () => {
    registerSubscription(tdb.db, userId, {
      endpoint: 'https://push.example/abc',
      p256dh: 'PK1',
      auth: 'A1',
      userAgent: 'TestUA/1.0'
    });
    const rows = listSubscriptionsForUser(tdb.db, userId);
    expect(rows.length).toBe(1);
    expect(rows[0].endpoint).toBe('https://push.example/abc');
    expect(rows[0].userAgent).toBe('TestUA/1.0');
  });

  it('registerSubscription is idempotent on same endpoint (updates, no duplicate)', () => {
    registerSubscription(tdb.db, userId, { endpoint: 'https://push.example/abc', p256dh: 'PK1', auth: 'A1', userAgent: 'UA' });
    registerSubscription(tdb.db, userId, { endpoint: 'https://push.example/abc', p256dh: 'PK2', auth: 'A2', userAgent: 'UA-updated' });
    const rows = listSubscriptionsForUser(tdb.db, userId);
    expect(rows.length).toBe(1);
    expect(rows[0].p256dh).toBe('PK2');
    expect(rows[0].auth).toBe('A2');
    expect(rows[0].userAgent).toBe('UA-updated');
  });

  it('revokeSubscription deletes by id only when it belongs to the user', () => {
    const otherUser = makeUser(tdb, householdId);
    registerSubscription(tdb.db, userId, { endpoint: 'https://push.example/a', p256dh: 'P', auth: 'A', userAgent: null });
    registerSubscription(tdb.db, otherUser, { endpoint: 'https://push.example/b', p256dh: 'P', auth: 'A', userAgent: null });

    const mine = listSubscriptionsForUser(tdb.db, userId)[0];
    const theirs = listSubscriptionsForUser(tdb.db, otherUser)[0];

    expect(revokeSubscription(tdb.db, userId, theirs.id)).toBe(false);
    expect(revokeSubscription(tdb.db, userId, mine.id)).toBe(true);

    expect(listSubscriptionsForUser(tdb.db, userId).length).toBe(0);
    expect(listSubscriptionsForUser(tdb.db, otherUser).length).toBe(1);
  });

  it('deleteSubscriptionByEndpoint removes regardless of owner', () => {
    registerSubscription(tdb.db, userId, { endpoint: 'https://push.example/a', p256dh: 'P', auth: 'A', userAgent: null });
    deleteSubscriptionByEndpoint(tdb.db, 'https://push.example/a');
    expect(listSubscriptionsForUser(tdb.db, userId).length).toBe(0);
  });

  it('re-registering an endpoint under another user moves the row (shared device)', () => {
    const other = makeUser(tdb, householdId);
    registerSubscription(tdb.db, userId, { endpoint: 'https://push.example/dev', p256dh: 'P', auth: 'A', userAgent: null });
    registerSubscription(tdb.db, other, { endpoint: 'https://push.example/dev', p256dh: 'P', auth: 'A', userAgent: null });
    expect(listSubscriptionsForUser(tdb.db, userId)).toHaveLength(0);
    expect(listSubscriptionsForUser(tdb.db, other)).toHaveLength(1);
  });

  it('revokeSubscriptionByEndpoint only removes the caller own endpoint', () => {
    const other = makeUser(tdb, householdId);
    registerSubscription(tdb.db, userId, { endpoint: 'https://push.example/a', p256dh: 'P', auth: 'A', userAgent: null });
    registerSubscription(tdb.db, other, { endpoint: 'https://push.example/b', p256dh: 'P', auth: 'A', userAgent: null });
    expect(revokeSubscriptionByEndpoint(tdb.db, userId, 'https://push.example/b')).toBe(false);
    expect(listSubscriptionsForUser(tdb.db, other)).toHaveLength(1);
    expect(revokeSubscriptionByEndpoint(tdb.db, userId, 'https://push.example/a')).toBe(true);
    expect(listSubscriptionsForUser(tdb.db, userId)).toHaveLength(0);
  });
});

describe('first subscription (R6)', () => {
  it('starts the digest history now, once', async () => {
    const { makeTestDb } = await import('../../helpers/db');
    const { makeHousehold, makeUser } = await import('../../helpers/fixtures');
    const { eq } = await import('drizzle-orm');
    const tdb = makeTestDb();
    const uid = makeUser(tdb, makeHousehold(tdb));
    const lda = () => tdb.db.select().from(tdb.schema.users).where(eq(tdb.schema.users.id, uid)).get()!.lastDispatchAt;
    expect(lda()).toBeNull();
    registerSubscription(tdb.db, uid, { endpoint: 'https://p/1', p256dh: 'P', auth: 'A', userAgent: null });
    const first = lda();
    expect(first).toBeGreaterThan(0);
    tdb.db.update(tdb.schema.users).set({ lastDispatchAt: 5 }).where(eq(tdb.schema.users.id, uid)).run();
    registerSubscription(tdb.db, uid, { endpoint: 'https://p/2', p256dh: 'P', auth: 'A', userAgent: null });
    expect(lda()).toBe(5);
  });
});
