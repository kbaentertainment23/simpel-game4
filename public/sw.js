// ============================================================================
// SIMPEL PWA Service Worker
// Automated Cache Versioning & Safe Lifecycle Update Engine
// ============================================================================

// Build-time injected version placeholder. Replaced during 'vite build'
const RAW_VERSION = '__SW_CACHE_VERSION__';
const CACHE_VERSION = (RAW_VERSION && !RAW_VERSION.startsWith('__')) ? RAW_VERSION : 'v-dev';

const APP_SHELL_CACHE = 'simpel-app-shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'simpel-runtime-' + CACHE_VERSION;

// Core static assets for initial offline shell
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/web-icon.png',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/pwa-maskable-192.png',
  '/pwa-maskable-512.png',
  '/apple-touch-icon.png',
  '/splash-screen.png',
  '/apple-splash-1170-2532.png',
  '/apple-splash-1284-2778.png',
  '/apple-splash-750-1334.png',
  '/apple-splash-2048-2732.png'
];

// 1. Install Event: Pre-cache core app shell
// NOTE: We deliberately do NOT call self.skipWaiting() here blindly.
// The new Service Worker remains in the "waiting" state until the client coordinates activation,
// preventing running sessions from breaking due to mismatched JavaScript chunks.
self.addEventListener('install', (event) => {
  console.log('[PWA SW] Installing Service Worker version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      console.log('[PWA SW] Pre-caching core app shell assets');
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[PWA SW] Core assets pre-caching notice:', err);
      });
    })
  );
});

// 2. Message Event: Safe activation trigger from client
// When the active tab is ready to update, it sends { type: 'SKIP_WAITING' }
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[PWA SW] Received SKIP_WAITING from client. Activating new version immediately...');
    self.skipWaiting();
  }
});

// 3. Activate Event: Clean up outdated caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[PWA SW] Activating Service Worker version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Strictly delete only SIMPEL app caches from previous versions.
          // NEVER touch Firebase, IndexedDB, or external storage!
          const isSimpelCache =
            cacheName.startsWith('simpel-app-shell-') ||
            cacheName.startsWith('simpel-runtime-') ||
            cacheName.startsWith('simpel-pwa-');

          if (isSimpelCache && cacheName !== APP_SHELL_CACHE && cacheName !== RUNTIME_CACHE) {
            console.log('[PWA SW] Deleting obsolete cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[PWA SW] Outdated caches purged. Claiming clients for version:', CACHE_VERSION);
      return self.clients.claim();
    })
  );
});

// Helper: Identify dynamic endpoints that must NEVER be cached
function isRealtimeOrApiRequest(url) {
  const urlString = url.toString().toLowerCase();

  // 1. Internal serverless API endpoints (/api/*)
  if (urlString.includes('/api/')) {
    return true;
  }

  // 2. Firebase Authentication, Firestore Database, Cloud Storage & Google Identity
  if (
    urlString.includes('firestore.googleapis.com') ||
    urlString.includes('identitytoolkit.googleapis.com') ||
    urlString.includes('securetoken.googleapis.com') ||
    urlString.includes('firebaseinstallations.googleapis.com') ||
    urlString.includes('firebaseio.com') ||
    urlString.includes('apis.google.com') ||
    urlString.includes('googleapis.com') ||
    urlString.includes('firebaseapp.com') ||
    urlString.includes('google-analytics.com')
  ) {
    return true;
  }

  // 3. Browser extensions and developer tooling
  if (urlString.includes('chrome-extension') || urlString.includes('moz-extension')) {
    return true;
  }

  return false;
}

// 4. Fetch Event: Differentiated caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET HTTP/HTTPS requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // Never intercept Service Worker script itself so browser can check for updates directly
  if (url.pathname === '/sw.js') {
    return;
  }

  // Strictly bypass API and Firebase requests (always live real-time network)
  if (isRealtimeOrApiRequest(request.url)) {
    return;
  }

  // STRATEGY A: HTML Navigation (Page Loads / SPA entry)
  // Network First with Cache Fallback
  // Guarantees online users always receive the latest index.html pointing to latest chunk hashes
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback
          const cached = await caches.match(request);
          if (cached) return cached;
          return (await caches.match('/index.html')) || (await caches.match('/'));
        })
    );
    return;
  }

  // STRATEGY B: Manifest file
  // Network First to catch any app metadata or icon updates
  if (url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // STRATEGY C: Hashed Build Assets (/assets/*.js, /assets/*.css)
  // Cache First with Network Fallback
  // Vite build produces content-hashed filenames. Once cached, a specific hash is immutable.
  // When a new version deploys, index.html requests new hashes, bypassing stale entries cleanly.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // STRATEGY D: Other static assets (images, icons, fonts)
  // Stale-While-Revalidate for instant loading with background update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          if (cachedResponse) return cachedResponse;
          return new Response('', { status: 404, statusText: 'Not Found' });
        });

      return cachedResponse || networkFetch;
    })
  );
});
