/* ═══════════════════════════════════════════════════
   InCulebra E-Bike Map — Service Worker v1.0
   Caches app shell + map tiles for offline use
═══════════════════════════════════════════════════ */

var CACHE_NAME = 'inculebra-v1';
var TILE_CACHE = 'inculebra-tiles-v1';

/* App shell — these get cached on install */
var APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet-routing-machine/3.2.12/leaflet-routing-machine.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet-routing-machine/3.2.12/leaflet-routing-machine.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap'
];

/* Install — cache app shell */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* Activate — clean old caches */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) {
          return n !== CACHE_NAME && n !== TILE_CACHE;
        }).map(function(n) {
          return caches.delete(n);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* Fetch — serve from cache, fallback to network */
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  /* Map tiles — cache as you browse (runtime caching) */
  if (url.indexOf('arcgisonline.com') !== -1 || url.indexOf('tile') !== -1) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function(cache) {
        return cache.match(e.request).then(function(resp) {
          if (resp) return resp;
          return fetch(e.request).then(function(netResp) {
            if (netResp && netResp.status === 200) {
              cache.put(e.request, netResp.clone());
            }
            return netResp;
          });
        });
      }).catch(function() {
        /* Offline and no cached tile — return transparent pixel */
        return new Response('', { status: 200, statusText: 'Offline' });
      })
    );
    return;
  }

  /* App shell + CDN assets — cache first, network fallback */
  e.respondWith(
    caches.match(e.request).then(function(resp) {
      if (resp) return resp;
      return fetch(e.request).then(function(netResp) {
        /* Cache successful GET responses */
        if (netResp && netResp.status === 200 && e.request.method === 'GET') {
          var clone = netResp.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return netResp;
      });
    }).catch(function() {
      /* Last resort — return cached index for navigation requests */
      if (e.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
