export type PushSupportInput = {
  ua: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission?: NotificationPermission | 'unavailable';
};

export type PushSupportState = 'ios-install' | 'unsupported' | 'denied' | 'ready';

/** iPhone, iPod, iPad, and iPadOS (which reports a desktop Mac UA but has touch points). */
export function isIOSDevice(ua: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/**
 * What the enable-notifications control should show. iOS exposes no PushManager/Notification
 * in a Safari tab (only in the installed app), so the install hint must be decided BEFORE the
 * feature check.
 */
export function pushSupportState(i: PushSupportInput): PushSupportState {
  if (isIOSDevice(i.ua, i.maxTouchPoints) && !i.standalone) return 'ios-install';
  if (!i.hasPushManager || !i.hasNotification) return 'unsupported';
  if (i.permission === 'denied') return 'denied';
  return 'ready';
}
