// public/service-worker.js

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Per ora non facciamo cache aggressiva (più sicuro in fase di sviluppo).
// In futuro possiamo aggiungere caching offline qui.
self.addEventListener("fetch", () => {});
