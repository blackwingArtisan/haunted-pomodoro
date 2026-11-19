import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';

/**
 * Emits /sw.js after the bundle is written: a small offline-first service worker that precaches
 * every built file (scripts, styles, fonts, icons) so the timer opens with no network at all.
 */
function serviceWorker(): Plugin {
  return {
    name: 'haunted-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Old-format .woff fonts are only for browsers without service workers, so they are not precached.
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.woff'));
      const assets = ['/', ...files.map((f) => `/${f}`), '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);
      const source = `/* Generated at build time by vite.config.ts. */
const CACHE = 'haunted-pomodoro-${version}';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('haunted-pomodoro-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Network first for the page itself, so a new deploy shows up; the cached shell when offline.
    event.respondWith(fetch(request).catch(() => caches.match('/', { cacheName: CACHE, ignoreVary: true })));
    return;
  }
  // Cache first for hashed assets. ignoreVary: the dev server varies on Origin, which module scripts send.
  event.respondWith(
    caches.match(request, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: {
    rollupOptions: {
      // The app, plus the sound check page that measures and plays every synthesized sound.
      input: { main: 'index.html', soundCheck: 'sound-check.html' },
    },
  },
  server: { port: 3180, strictPort: true },
  preview: { port: 3181, strictPort: true },
});
