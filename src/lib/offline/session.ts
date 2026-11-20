// Keeps what this browser holds offline to the logged-in user. Framework-free.
import { clearPageCache } from './page-cache';
import { getActiveUser, setActiveUser } from './queue';

/**
 * Called on every authenticated load. Whenever this user was not the active one (another account,
 * or nobody: a tab of the previous user left open after its logout may have cached pages since),
 * the cached pages are dropped first, so another account's are never shown to this user offline.
 * The previous user's queued gestures stay in IndexedDB, tied to their id; the server refuses them
 * under this account (x-apogee-user).
 */
export async function becomeActiveUser(userId: number): Promise<void> {
  if ((await getActiveUser()) === userId) return;
  await clearPageCache();
  await setActiveUser(userId);
}

/** Logout: no cached pages left behind, and the service worker no longer syncs for anyone. */
export async function leaveActiveUser(): Promise<void> {
  await clearPageCache();
  await setActiveUser(null);
}
