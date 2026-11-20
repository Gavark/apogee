// Keeps what this browser holds offline to the logged-in user. Framework-free.
import { clearPageCache } from './page-cache';
import { getActiveUser, setActiveUser } from './queue';

/**
 * Called on every authenticated load. Another account was active here (no logout, e.g. an expired
 * session): its cached pages are dropped first, so they are never shown to this user offline.
 * The previous user's queued gestures stay in IndexedDB, tied to their id, and are never sent
 * under this account.
 */
export async function becomeActiveUser(userId: number): Promise<void> {
  const previous = await getActiveUser();
  if (previous === userId) return;
  if (previous !== null) await clearPageCache();
  await setActiveUser(userId);
}

/** Logout: no cached pages left behind, and the service worker no longer syncs for anyone. */
export async function leaveActiveUser(): Promise<void> {
  await clearPageCache();
  await setActiveUser(null);
}
