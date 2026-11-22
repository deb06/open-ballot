'use strict';

/* ==========================================================================
   Open Ballot — service worker
   ==========================================================================
   Strategy:
     • API requests are never cached.
     • Everything else is network-first, so edits appear immediately, with
       the cached copy used only when the network is unavailable.
     • The app shell is precached so the install prompt and offline reload
       work.

   Bump CACHE_VERSION whenever the precache list changes.
   ========================================================================== */

const CACHE_VERSION = 'openballot-v5';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/styles.css?v=5',
  '/styles/tokens.css?v=5',
  '/styles/components.css?v=5',
  '/js/theme.js?v=5',
  '/js/core.js?v=5',
  '/js/components.js?v=5',
  '/js/public.js?v=5',
  '/js/admin.js?v=5',
  '/js/design.js?v=5',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        throw error;
      }
    })(),
  );
});
