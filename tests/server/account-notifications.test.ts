import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser } from '../helpers/fixtures';
import { registerSubscription, findSubscriptionIdByEndpoint } from '../../src/lib/server/push/subscribe';
import { clearRateLimit } from '../../src/lib/server/rate-limit';
import type { PushSender } from '../../src/lib/server/push/send';
import {
  getNotificationSettings,
  saveNotificationSettings,
  sendTestNotification,
  TEST_LIMIT_PER_HOUR,
  testRateKey
} from '../../src/routes/account/notifications/_logic';

describe('account notifications', () => {
  let tdb: ReturnType<typeof makeTestDb>;
  let userId: number;
  let otherId: number;
  beforeEach(() => {
    tdb = makeTestDb();
    const hid = makeHousehold(tdb);
    userId = makeUser(tdb, hid);
    otherId = makeUser(tdb, hid);
    clearRateLimit(testRateKey(userId));
    clearRateLimit(testRateKey(otherId));
  });
  const sub = (endpoint: string, ua: string | null = 'UA') => ({ endpoint, p256dh: 'p', auth: 'a', userAgent: ua });

  it('both toggles are on by default, no devices', () => {
    expect(getNotificationSettings(tdb.db, userId)).toEqual({ notifyPhases: true, notifyMonthly: true, devices: [] });
  });

  it('saves the two toggles independently per user', () => {
    saveNotificationSettings(tdb.db, userId, { notifyPhases: false, notifyMonthly: true });
    expect(getNotificationSettings(tdb.db, userId)).toMatchObject({ notifyPhases: false, notifyMonthly: true });
    saveNotificationSettings(tdb.db, userId, { notifyPhases: true, notifyMonthly: false });
    expect(getNotificationSettings(tdb.db, userId)).toMatchObject({ notifyPhases: true, notifyMonthly: false });
    expect(getNotificationSettings(tdb.db, otherId)).toMatchObject({ notifyPhases: true, notifyMonthly: true });
  });

  it("lists only the user's own devices, without endpoint secrets", () => {
    registerSubscription(tdb.db, userId, sub('https://push.test/a', 'Phone'));
    registerSubscription(tdb.db, otherId, sub('https://push.test/b', 'Other'));
    const { devices } = getNotificationSettings(tdb.db, userId);
    expect(devices).toHaveLength(1);
    expect(Object.keys(devices[0]).sort()).toEqual(['createdAt', 'id', 'lastSeenAt', 'userAgent']);
    expect(devices[0].userAgent).toBe('Phone');
  });

  it('sends a localized test notification through the injected sender', async () => {
    registerSubscription(tdb.db, userId, sub('https://push.test/a'));
    const sender = vi.fn<PushSender>(async () => ({ statusCode: 201 }));
    const r = await sendTestNotification(tdb.db, userId, 'en', sender);
    expect(r).toEqual({ sent: 1, dead: 0, failed: 0 });
    expect(sender.mock.calls[0][1]).toMatchObject({ title: 'Apogée', url: '/app', tag: 'apogee-test' });
    expect(sender.mock.calls[0][1].body).toMatch(/work on this device/i);
    await sendTestNotification(tdb.db, userId, 'fr', sender);
    expect(sender.mock.calls[1][1].body).toMatch(/fonctionnent sur cet appareil/);
  });

  it('finds a device by endpoint, only for its owner', () => {
    registerSubscription(tdb.db, userId, sub('https://push.test/a'));
    const id = getNotificationSettings(tdb.db, userId).devices[0].id;
    expect(findSubscriptionIdByEndpoint(tdb.db, userId, 'https://push.test/a')).toBe(id);
    expect(findSubscriptionIdByEndpoint(tdb.db, otherId, 'https://push.test/a')).toBeNull();
    expect(findSubscriptionIdByEndpoint(tdb.db, userId, 'https://push.test/zzz')).toBeNull();
  });

  it('limits test notifications to 3 per hour per user', async () => {
    registerSubscription(tdb.db, userId, sub('https://push.test/a'));
    const sender = vi.fn<PushSender>(async () => ({ statusCode: 201 }));
    for (let i = 0; i < TEST_LIMIT_PER_HOUR; i++) expect(await sendTestNotification(tdb.db, userId, 'fr', sender)).not.toBeNull();
    expect(await sendTestNotification(tdb.db, userId, 'fr', sender)).toBeNull();
    expect(sender).toHaveBeenCalledTimes(3);
    // another user is unaffected
    registerSubscription(tdb.db, otherId, sub('https://push.test/b'));
    expect(await sendTestNotification(tdb.db, otherId, 'fr', sender)).toEqual({ sent: 1, dead: 0, failed: 0 });
  });

  it('without any device, a test notification does not consume the rate-limit slot', async () => {
    const sender = vi.fn<PushSender>(async () => ({ statusCode: 201 }));
    for (let i = 0; i < TEST_LIMIT_PER_HOUR + 2; i++) {
      expect(await sendTestNotification(tdb.db, userId, 'fr', sender)).toEqual({ sent: 0, dead: 0, failed: 0 });
    }
    registerSubscription(tdb.db, userId, sub('https://push.test/a'));
    expect(await sendTestNotification(tdb.db, userId, 'fr', sender)).toEqual({ sent: 1, dead: 0, failed: 0 });
  });
});
