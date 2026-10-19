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

// Lets the app trigger an immediate update via
// registration.waiting.postMessage({ type: 'SKIP_WAITING' }).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
