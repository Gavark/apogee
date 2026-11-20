import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '../../helpers/db';
import { makeHousehold, makeUser } from '../../helpers/fixtures';
import { registerSubscription, listSubscriptionsForUser } from '../../../src/lib/server/push/subscribe';
import { sendToUser, type PushSender, type PushPayload } from '../../../src/lib/server/push/send';

const payload: PushPayload = { title: 'T', body: 'B', url: '/app', tag: 'x' };

describe('sendToUser', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let userId: number;
  beforeEach(() => {
    tdb = makeTestDb();
    userId = makeUser(tdb, makeHousehold(tdb));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  function sub(endpoint: string) {
    registerSubscription(tdb.db, userId, { endpoint, p256dh: 'P', auth: 'A', userAgent: null });
  }

  it('removes a 410 subscription and counts the 201 one as sent', async () => {
    sub('https://push.example/dead');
    sub('https://push.example/ok');
    const sender: PushSender = async (s) => ({ statusCode: s.endpoint.endsWith('dead') ? 410 : 201 });
    const res = await sendToUser(tdb.db, userId, payload, sender);
    expect(res).toEqual({ sent: 1, dead: 1, failed: 0 });
    const rows = listSubscriptionsForUser(tdb.db, userId);
    expect(rows.map((r) => r.endpoint)).toEqual(['https://push.example/ok']);
  });

  it('treats 404 as dead too', async () => {
    sub('https://push.example/gone');
    const res = await sendToUser(tdb.db, userId, payload, async () => ({ statusCode: 404 }));
    expect(res).toEqual({ sent: 0, dead: 1, failed: 0 });
    expect(listSubscriptionsForUser(tdb.db, userId)).toHaveLength(0);
  });

  it('counts a network error as failed and keeps the subscription', async () => {
    sub('https://push.example/flaky');
    const res = await sendToUser(tdb.db, userId, payload, async () => {
      throw new Error('ECONNRESET');
    });
    expect(res).toEqual({ sent: 0, dead: 0, failed: 1 });
    expect(listSubscriptionsForUser(tdb.db, userId)).toHaveLength(1);
  });

  it('counts a non-2xx non-dead status (e.g. 500) as failed', async () => {
    sub('https://push.example/err');
    const res = await sendToUser(tdb.db, userId, payload, async () => ({ statusCode: 500 }));
    expect(res).toEqual({ sent: 0, dead: 0, failed: 1 });
    expect(listSubscriptionsForUser(tdb.db, userId)).toHaveLength(1);
  });

  it('a thrown error carrying statusCode 410 is dead', async () => {
    sub('https://push.example/thrown');
    const res = await sendToUser(tdb.db, userId, payload, async () => {
      throw Object.assign(new Error('Gone'), { statusCode: 410 });
    });
    expect(res).toEqual({ sent: 0, dead: 1, failed: 0 });
  });

  it('bumps lastSeenAt on success and never logs the endpoint on failure', async () => {
    sub('https://push.example/secret-capability');
    tdb.sqlite.prepare('UPDATE push_subscriptions SET last_seen_at = 1').run();
    await sendToUser(tdb.db, userId, payload, async () => ({ statusCode: 201 }));
    expect(listSubscriptionsForUser(tdb.db, userId)[0].lastSeenAt).toBeGreaterThan(1);

    await sendToUser(tdb.db, userId, payload, async () => {
      throw new Error('boom');
    });
    const logged = JSON.stringify((console.error as any).mock.calls);
    expect(logged).not.toContain('secret-capability');
  });

  it('passes the payload and VAPID details to the sender', async () => {
    sub('https://push.example/a');
    const sender = vi.fn<PushSender>(async () => ({ statusCode: 201 }));
    await sendToUser(tdb.db, userId, payload, sender);
    const [s, p, v] = sender.mock.calls[0];
    expect(s).toEqual({ endpoint: 'https://push.example/a', p256dh: 'P', auth: 'A' });
    expect(p).toEqual(payload);
    expect(v.publicKey.length).toBeGreaterThan(60);
  });

  it('returns zeros when the user has no subscription', async () => {
    const res = await sendToUser(tdb.db, userId, payload, async () => ({ statusCode: 201 }));
    expect(res).toEqual({ sent: 0, dead: 0, failed: 0 });
  });
});
