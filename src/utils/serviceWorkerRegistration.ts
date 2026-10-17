/**
 * SIMPEL PWA - Automated Service Worker Lifecycle & Seamless Update Manager
 * Ensures users (especially Chrome Android users) get the latest assets immediately
 * without manual cache clearing, infinite reload loops, or app disruption.
 */

let isRefreshing = false;

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // 1. Dynamic module import recovery (Vite chunk hash mismatch)
  // When a new deployment removes old chunks, any dynamic import failure
  // is caught and triggers a single clean reload to pick up the new bundles.
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[PWA] Dynamic chunk loading error detected (stale bundle). Auto-reloading...');
    event.preventDefault();
    triggerSafeReload();
  });

  // 2. Controller change listener:
  // Fires when a new Service Worker successfully activates and calls clients.claim().
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isRefreshing) return;
    console.log('[PWA] Active Service Worker controller changed. Reloading page cleanly...');
    triggerSafeReload();
  });

  // 3. Register Service Worker on window load
  window.addEventListener('load', async () => {
    try {
      // updateViaCache: 'none' tells browser to never use HTTP cache for /sw.js
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      console.log('[PWA] Service Worker registered with scope:', registration.scope);

      // Check if there is already a waiting worker from a previous background download
      if (registration.waiting) {
        console.log('[PWA] Existing waiting Service Worker detected. Requesting activation.');
        activateWaitingWorker(registration.waiting);
      }

      // Listen for newly detected Service Worker updates
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        console.log('[PWA] New Service Worker update found. Monitoring state change...');

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') {
            // If there's already an active controller, this is an UPDATE (not first install)
            if (navigator.serviceWorker.controller) {
              console.log('[PWA] New version ready in waiting state. Sending SKIP_WAITING signal...');
              activateWaitingWorker(installingWorker);
            } else {
              console.log('[PWA] Service Worker installed for the first time. Offline app shell cached.');
            }
          }
        });
      });

      // Periodically check for updates every 15 minutes while app is running
      setInterval(() => {
        if (navigator.onLine) {
          console.log('[PWA] Performing periodic Service Worker update check...');
          registration.update().catch((err) => {
            console.debug('[PWA] Periodic update check notice:', err);
          });
        }
      }, 15 * 60 * 1000);

      // Check for updates when user returns to Chrome tab or PWA window (Crucial for Android)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          console.log('[PWA] Tab resumed. Checking for Service Worker updates...');
          registration.update().catch(() => {});
        }
      });

      // Check for updates when device regains network connectivity
      window.addEventListener('online', () => {
        console.log('[PWA] Network reconnected. Checking for Service Worker updates...');
        registration.update().catch(() => {});
      });

      // Trigger an immediate check on startup
      if (navigator.onLine) {
        registration.update().catch(() => {});
      }
    } catch (error) {
      console.warn('[PWA] Service Worker registration failed:', error);
    }
  });
}

/**
 * Sends a message to the waiting Service Worker instructing it to skip waiting
 */
function activateWaitingWorker(worker: ServiceWorker): void {
  try {
    worker.postMessage({ type: 'SKIP_WAITING' });
  } catch (err) {
    console.error('[PWA] Failed to post SKIP_WAITING to worker:', err);
  }
}

/**
 * Triggers a single page reload with strict guard against infinite reload loops
 */
function triggerSafeReload(): void {
  if (isRefreshing) return;
  isRefreshing = true;

  const RELOAD_GUARD_KEY = 'simpel_pwa_last_reload_timestamp';
  const lastReload = sessionStorage.getItem(RELOAD_GUARD_KEY);
  const now = Date.now();

  // If a reload occurred less than 4 seconds ago, prevent infinite loop
  if (lastReload && now - parseInt(lastReload, 10) < 4000) {
    console.warn('[PWA] Reload loop prevented. Recent reload detected within 4s.');
    return;
  }

  sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
  window.location.reload();
}
