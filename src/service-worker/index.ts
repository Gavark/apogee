/// <reference lib="webworker" />
/* eslint-disable */
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';
import { safeNotificationUrl } from '../lib/push-url';

declare const self: ServiceWorkerGlobalScope;

// Precache the hashed app assets plus the static files the shell needs
// (icons, manifest). HTML is never cached, so pages still need the network.
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

// Drop the caches of previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !PRECACHED.has(url.pathname)) return;
  event.respondWith(caches.match(event.request).then((hit) => hit ?? fetch(event.request)));
});

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
      data: { url: safeNotificationUrl(p.url, self.location.origin) }
    })
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
