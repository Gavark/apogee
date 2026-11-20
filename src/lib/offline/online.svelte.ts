/** Network state shown to the user (offline banner). Client state; always online during SSR. */

export const network = $state({ online: true });

/** Mirrors `nav.onLine` into `network.online`, following the online/offline events. Returns the stop function. */
export function watchNetwork(target: EventTarget, nav: { onLine: boolean }): () => void {
  network.online = nav.onLine;
  const on = () => (network.online = true);
  const off = () => (network.online = false);
  target.addEventListener('online', on);
  target.addEventListener('offline', off);
  return () => {
    target.removeEventListener('online', on);
    target.removeEventListener('offline', off);
  };
}

if (typeof window !== 'undefined' && typeof navigator !== 'undefined') watchNetwork(window, navigator);

const PROBE_TIMEOUT_MS = 5_000;

/**
 * Whether the server answers at all (any status). `navigator.onLine` can be true with no way to
 * reach the server (captive portal, server down): then the service worker served cached pages.
 * /healthz is never cached by the service worker.
 */
export async function probeServer(doFetch: typeof fetch = fetch): Promise<boolean> {
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(PROBE_TIMEOUT_MS)
        : undefined;
    await doFetch('/healthz', { cache: 'no-store', credentials: 'same-origin', signal });
    return true;
  } catch {
    return false;
  }
}

const lastOnlineKey = (userId: number) => `apogee:last-online:${userId}`;
const defaultStorage = (): Storage | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined; // blocked storage
  }
};

/** Remembers when the user last loaded a page from the server (ms since epoch). Best effort. */
export function recordOnlineLoad(userId: number, at: number, storage = defaultStorage()): void {
  try {
    storage?.setItem(lastOnlineKey(userId), String(at));
  } catch {
    // storage full or blocked: the banner just shows no date
  }
}

/** When the user last loaded a page from the server, or null when never recorded. */
export function lastOnlineLoad(userId: number, storage = defaultStorage()): number | null {
  try {
    const raw = storage?.getItem(lastOnlineKey(userId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
