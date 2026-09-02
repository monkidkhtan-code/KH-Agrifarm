/**
 * KH AGRIFARM - SERVICE WORKER (NETWORK FIRST STRATEGY)
 */
const CACHE_NAME = 'kh-agrifarm-v11.44';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './data/soil_sensors.json',
  './data/soil_moisture_history.json',
  './data/tapo_sensors.json',
  './data/tapo_history.json',
  './js/config.js',
  './js/sampleData.js',
  './js/googleSheetsService.js',
  './js/drainageService.js',
  './js/weatherService.js',
  './js/sprayAdvisory.js',
  './js/soilMoistureService.js',
  './js/tapoService.js',
  './js/radarService.js',
  './js/app.js',
  './assets/kh-logo-navbar.png',
  './assets/kh-logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/chili-leaves-bg.jpg',
  './assets/weather/accu_clear_day.png',
  './assets/weather/accu_clear_night.png',
  './assets/weather/accu_partly_cloudy_day.png',
  './assets/weather/accu_partly_cloudy_night.png',
  './assets/weather/accu_overcast_day.png',
  './assets/weather/accu_overcast_night.png',
  './assets/weather/accu_fog_day.png',
  './assets/weather/accu_fog_night.png',
  './assets/weather/accu_drizzle_day.png',
  './assets/weather/accu_drizzle_night.png',
  './assets/weather/accu_rain_day.png',
  './assets/weather/accu_rain_night.png',
  './assets/weather/accu_shower_day.png',
  './assets/weather/accu_shower_night.png',
  './assets/weather/accu_thunderstorm_day.png',
  './assets/weather/accu_thunderstorm_night.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network first: always fetch latest version from Netlify; fall back to cache when offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
