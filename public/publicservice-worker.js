// public/service-worker.js

self.addEventListener("install", (event) => {
  console.log("[CLASP SW] Install");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[CLASP SW] Activate");
  event.waitUntil(self.clients.claim());
});

// Per ora niente cache complessa.
// In futuro si può aggiungere caching offline qui.
self.addEventListener("fetch", (event) => {
  // passthrough
});
