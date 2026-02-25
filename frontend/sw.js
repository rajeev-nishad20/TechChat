const CACHE_NAME = 'techchat-v2';
const STATIC_CACHE = 'static-cache-v2';
const DYNAMIC_CACHE = 'dynamic-cache-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './install.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/atom-one-dark.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js',
  './offline.html'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE)
        .then(cache => cache.addAll(STATIC_ASSETS)),
      caches.open(DYNAMIC_CACHE)
    ])
  );
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map(key => caches.delete(key))
        );
      })
  );
});

// Fetch Event Strategy
self.addEventListener('fetch', event => {
  // Network with Cache Fallback Strategy
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(event.request, clonedResponse));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache with Network Fallback Strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Return cached response
          return response;
        }
        
        // Fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Cache new responses for static assets
            if (event.request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$/)) {
              const clonedResponse = networkResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(event.request, clonedResponse));
            }
            return networkResponse;
          })
          .catch(() => {
            // Show offline page for document requests
            if (event.request.mode === 'navigate') {
              return caches.match('./offline.html');
            }
            return null;
          });
      })
  );
});

// Handle push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [100, 50, 100]
  };

  event.waitUntil(
    self.registration.showNotification('TechChat', options)
  );
});