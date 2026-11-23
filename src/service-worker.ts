/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

// Deliberately a separate, minimal Firebase init from src/firebase-config.ts
// rather than importing it - that file calls getAnalytics() unconditionally
// at module load, which needs `window` and throws in a service worker's
// context. Only messaging is needed here. These values are the same public,
// safe-to-commit config already in firebase-config.ts (see CLAUDE.md).
const messagingApp = initializeApp({
  apiKey: "AIzaSyAnTyORfOZdmU8GqK7MRof2aAy2JUgTPKM",
  authDomain: "toystrader-a494f.firebaseapp.com",
  projectId: "toystrader-a494f",
  storageBucket: "toystrader-a494f.appspot.com",
  messagingSenderId: "267868385149",
  appId: "1:267868385149:web:96d5672eabeba4b4efe614",
});
const messaging = getMessaging(messagingApp);

// Shown when a push arrives while no tab has focus - a foreground message
// (tab open and focused) is handled instead by onForegroundMessage in
// src/hooks/helper.ts, which shows the app's normal in-app toast.
onBackgroundMessage(messaging, (payload) => {
  self.registration.showNotification(payload.notification?.title ?? 'ToyTrader', {
    body: payload.notification?.body,
    icon: '/logo192.png',
  });
});

// Precaches every asset the build process generates. The __WB_MANIFEST
// placeholder is replaced at build time by the InjectManifest webpack
// plugin (react-scripts auto-enables this for production builds once this
// file exists at src/service-worker.ts - see react-scripts/config/webpack.config.js).
precacheAndRoute(self.__WB_MANIFEST);

// App-shell routing: any same-origin navigation not caught by a static
// asset's own extension is served index.html from the cache, so client-side
// routing (react-router) keeps working offline on a fresh/direct load of
// any route, not just the ones already visited.
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }: { request: Request; url: URL }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/_')) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// Runtime cache for same-origin images (toy photos resolved through
// Firebase Storage are cross-origin and deliberately NOT covered here -
// this is just for the app's own static assets like logo/icons).
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 50 })],
  })
);

// Web Share Target (manifest.json's share_target) - on Android/ChromeOS,
// once installed, this app shows up in the OS "Share" sheet for images and
// videos. The browser POSTs the shared file here as multipart form data -
// a service worker is the only place that can read that POST body (there's
// no server behind this SPA to receive it), so the file is stashed in the
// Cache API, keyed by a fixed URL, for addNewToy.tsx to pick up once the
// ensuing redirect lands the user on /addNew. Cache (not postMessage) is
// used because no client page exists yet to receive a message at this point.
const SHARE_TARGET_CACHE = 'share-target-v1';
const SHARE_TARGET_CACHE_KEY = '/__shared-file';

registerRoute(
  ({ url, request }: { url: URL; request: Request }) =>
    request.method === 'POST' && url.pathname === '/share-target',
  async ({ request }: { request: Request }) => {
    try {
      const formData = await request.formData();
      const file = formData.get('media');
      if (file instanceof File) {
        const cache = await caches.open(SHARE_TARGET_CACHE);
        await cache.put(SHARE_TARGET_CACHE_KEY, new Response(file, {
          headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) },
        }));
      }
    } catch {
      // Falls through to the redirect either way - addNewToy.tsx simply
      // won't find anything cached, same as a normal manual visit.
    }
    return Response.redirect('/addNew?shared=1', 303);
  },
  'POST'
);

// Lets the app trigger an immediate update via
// registration.waiting.postMessage({ type: 'SKIP_WAITING' }).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
