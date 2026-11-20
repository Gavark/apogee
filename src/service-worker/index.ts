/// <reference lib="webworker" />
/* eslint-disable */
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

declare const self: ServiceWorkerGlobalScope;

// Precache the hashed app assets plus the static files the shell needs
// (icons, manifest). HTML is never cached, so pages still need the network.
// Push handlers arrive with the notifications plan.
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
