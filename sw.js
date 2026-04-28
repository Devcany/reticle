// Reticle — sw.js
// Cache-First Service Worker fuer App-Shell.
// P3a: scan.js aufgenommen, Cache-Version bump.

const CACHE_NAME = 'reticle-shell-v4';

const SHELL_FILES = [
  './',
  './index.html',
  './offline.html',
  './print.html',
  './style.css',
  './app.js',
  './storage.js',
  './validator.js',
  './ui.js',
  './setup.js',
  './import.js',
  './manual.js',
  './marker.js',
  './print.js',
  './scan.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() =>
        caches.match('./offline.html')
      );
    })
  );
});
