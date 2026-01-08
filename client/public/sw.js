// Simple service worker for PWA installability
// This enables "Add to Home Screen" but doesn't implement offline caching
// since this app requires a live connection to the mixer

const CACHE_NAME = 'ui24r-mini-mixer-v1';

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  // Claim clients immediately
  event.waitUntil(clients.claim());
});

// Network-first strategy - always try to fetch fresh data
// Fall back to cache only if offline (though app won't work offline anyway)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // If network fails, you could return a cached version or offline page
        // For now, just let it fail since the app needs live mixer connection
        return new Response('Network error', { status: 503 });
      })
  );
});
