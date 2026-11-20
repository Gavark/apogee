import { describe, it, expect } from 'vitest';
import { pushSupportState } from '../../src/lib/push-support';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';
const base = { maxTouchPoints: 0, standalone: false, hasPushManager: true, hasNotification: true, permission: 'default' as const };

describe('pushSupportState', () => {
  it('iPhone Safari tab (no PushManager) -> ios-install', () => {
    expect(pushSupportState({ ...base, ua: IPHONE, maxTouchPoints: 5, hasPushManager: false, hasNotification: false })).toBe('ios-install');
  });
  it('iPad with desktop UA in a tab -> ios-install', () => {
    expect(pushSupportState({ ...base, ua: IPAD_DESKTOP, maxTouchPoints: 5, hasPushManager: false, hasNotification: false })).toBe('ios-install');
  });
  it('installed iOS app -> ready', () => {
    expect(pushSupportState({ ...base, ua: IPHONE, maxTouchPoints: 5, standalone: true })).toBe('ready');
  });
  it('a touchless Mac is not iOS', () => {
    expect(pushSupportState({ ...base, ua: IPAD_DESKTOP })).toBe('ready');
  });
  it('Android Chrome -> ready', () => {
    expect(pushSupportState({ ...base, ua: ANDROID, maxTouchPoints: 5 })).toBe('ready');
  });
  it('desktop Firefox without push -> unsupported', () => {
    expect(pushSupportState({ ...base, ua: FIREFOX, hasPushManager: false })).toBe('unsupported');
  });
  it('permission denied -> denied', () => {
    expect(pushSupportState({ ...base, ua: ANDROID, permission: 'denied' })).toBe('denied');
  });
});
