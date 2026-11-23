/// <reference lib="webworker" />
/* eslint-disable */
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';
import { safeNotificationUrl } from '../lib/push-url';
import {
  PAGE_CACHE,
  cacheKeyFor,
  dataBodyToServe,
  dataBodyToStore,
  invalidatedBits,
  isDataRequest,
  isOfflineReadable,
  isStorable,
  networkDeadlineFor,
  networkOrCopy,
  offlineRedirectFor,
  stampedHeaders,
  trimPageCache
} from '../lib/offline/page-cache';
import { getActiveUser } from '../lib/offline/queue';
import { syncNow } from '../lib/offline/sync';

declare const self: ServiceWorkerGlobalScope;

/** Background Sync is not in the TypeScript DOM typings yet. */
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

/** Same tag as requestBackgroundSync() in the pages. */
const SYNC_TAG = 'apogee-stock-sync';

// Precache the hashed app assets plus the static files the shell needs
// (icons, manifest). The reading pages are kept apart, in PAGE_CACHE (see below).
const CACHE = `apogee-${version}`;
// $app/manifest paths are relative to the base path. Resolve them against the
// service worker's own URL, which sits at the base path, so the fetch handler
// below compares absolute pathnames.
const toPathname = (path: string) => new URL(path, self.location.href).pathname;
const PRECACHE = [
  ...immutable.map((f) => toPathname(f.path)),
  ...assets.map((f) => toPathname(f.path))
];
const PRECACHED = new Set(PRECACHE);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Drop the caches of previous versions. The offline pages are not tied to a version, except their
// HTML, which points at the previous version's assets: dropped here, fetched again just after.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE && key !== PAGE_CACHE) await caches.delete(key);
      }
      const stale = await dropCachedHtml().catch((): URL[] => []);
      await self.clients.claim();
      // Best effort, outside waitUntil: fetches wait for the activation to finish.
      for (const url of stale) void refetch(url);
    })()
  );
});

async function dropCachedHtml(): Promise<URL[]> {
  const cache = await caches.open(PAGE_CACHE);
  const urls: URL[] = [];
  for (const req of await cache.keys()) {
    const url = new URL(req.url);
    if (isDataRequest(url)) continue; // version-independent: dataBodyToServe checks the node count
    await cache.delete(req);
    urls.push(url);
  }
  return urls;
}

async function refetch(url: URL): Promise<void> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (isStorable(res)) await store(url, res);
  } catch {
    // offline or logged out: cached again on the next visit
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (PRECACHED.has(url.pathname)) {
    event.respondWith(caches.match(event.request).then((hit) => hit ?? fetch(event.request)));
    return;
  }
  if (isOfflineReadable(url, self.location.origin)) {
    event.respondWith(networkFirst(event, url));
    return;
  }
  const redirectTo = event.request.mode === 'navigate' ? offlineRedirectFor(url, self.location.origin) : null;
  if (redirectTo) event.respondWith(orRedirect(event.request, redirectTo));
});

/**
 * A page with nothing to keep (`/`, which only redirects): the network, else (failure or deadline)
 * a redirect to a reading page the copy can answer. The installed app may still start there offline.
 */
function orRedirect(request: Request, to: string): Promise<Response> {
  const fallback = Response.redirect(new URL(to, self.location.origin).href, 302);
  return networkOrCopy(fetch(request), fallback, networkDeadlineFor(request));
}

const pageKey = (url: URL) => new URL(cacheKeyFor(url), self.location.origin).href;

/**
 * The reading pages (HTML and __data.json): the network first, a copy of every plain 200 kept
 * for later; the copy when the network fails, or when opening a page (HTML) takes too long
 * (networkDeadlineFor: never for __data.json, whose slow answer must not be replaced by older data).
 * With no copy, the network whatever it takes, and its failure goes through: SvelteKit shows its
 * offline error.
 * Errors, redirects (an expired session sends to /login) and 401s always reach the page, never
 * replaced by the copy.
 */
async function networkFirst(event: FetchEvent, url: URL): Promise<Response> {
  const network = fetch(event.request);
  // Kept even when it arrives after the deadline (the copy was shown meanwhile). Registered before
  // anything reads the response, so the clone is taken first.
  event.waitUntil(network.then((res) => (isStorable(res) ? store(url, res.clone()) : undefined)).catch(() => {}));
  const copy = await fromCache(url).catch(() => null);
  return networkOrCopy(network, copy, networkDeadlineFor(event.request));
}

async function store(url: URL, res: Response): Promise<void> {
  const cache = await caches.open(PAGE_CACHE);
  const key = pageKey(url);
  if (!isDataRequest(url)) {
    if (res.headers.get('content-type')?.includes('text/html')) {
      const stamped = new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: stampedHeaders(res.headers, Date.now())
      });
      await cache.put(key, stamped);
      await trimPageCache(cache);
    }
    return;
  }
  const previous = await cache.match(key, { ignoreVary: true });
  const body = dataBodyToStore(await res.text(), previous ? await previous.text() : null);
  if (body === null) return; // a redirect in disguise ({ type: 'redirect' }), an error or a stream
  await cache.put(key, new Response(body, { headers: stampedHeaders({ 'content-type': 'application/json' }, Date.now()) }));
  await trimPageCache(cache);
}

async function fromCache(url: URL): Promise<Response | null> {
  const cache = await caches.open(PAGE_CACHE);
  const hit = await cache.match(pageKey(url), { ignoreVary: true });
  if (!hit || !isDataRequest(url)) return hit ?? null;
  const body = dataBodyToServe(await hit.text(), invalidatedBits(url));
  return body === null ? null : new Response(body, { headers: { 'content-type': 'application/json' } });
}

// Gestures queued offline, sent once the browser sees the network again, even with no tab open.
self.addEventListener('sync', (e) => {
  const event = e as SyncEvent;
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(backgroundSync());
});

async function backgroundSync(): Promise<void> {
  const userId = await getActiveUser(); // whoever is logged in: never another user's queue
  if (userId === null) return;
  const outcome = await syncNow(userId); // takes the same 'apogee-sync' lock as the tabs
  // Open tabs record the results (for "Annuler") and reload their data.
  if (outcome.status !== 'busy' && outcome.status !== 'idle') {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of windows) w.postMessage({ type: 'sync-outcome', userId, outcome });
  }
  // Rejecting asks the browser to try again later. `busy`: a tab is sending, it may not finish.
  if (outcome.status === 'retry' || outcome.status === 'offline' || outcome.status === 'busy') {
    throw new Error(`background sync: ${outcome.status}`);
  }
}

// Always show the notification: the server already limits it to one a day.
self.addEventListener('push', (event) => {
  // userVisibleOnly requires showing something, even for an unreadable payload.
  let p: Record<string, unknown> = {};
  try {
    const parsed: unknown = event.data?.json();
    if (parsed && typeof parsed === 'object') p = parsed as Record<string, unknown>;
  } catch {
    /* generic notification below */
  }
  const known = typeof p.title === 'string' && p.title !== '';
  event.waitUntil(
    self.registration.showNotification(known ? (p.title as string) : 'Apogée', {
      body: known && typeof p.body === 'string' ? p.body : 'Apogée',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: typeof p.tag === 'string' && p.tag ? p.tag : 'apogee',
      // A fixed tag would otherwise replace yesterday's notification silently.
      renotify: true, // not yet in the DOM lib typings
      data: { url: safeNotificationUrl(p.url, self.location.origin) }
    } as NotificationOptions)
  );
});

// Focus an open Apogée window and send it to the target, else open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data as { url?: unknown } | undefined)?.url;
  const path = safeNotificationUrl(raw, self.location.origin);
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin) as
        | WindowClient
        | undefined;
      if (existing) {
        try {
          await existing.focus();
          if (existing.url !== target) await existing.navigate(target);
          return;
        } catch {
          /* fall through to a new window */
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
