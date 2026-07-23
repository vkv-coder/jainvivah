// Service worker for Jain Vivah.
// Caches the app shell so the site opens fast and works offline-ish.
// Supabase API calls are always fetched fresh from the network — matrimonial
// data must never be served stale from a cache.

const CACHE_NAME = "MT_V1";

const SHELL_FILES = [
  "index.html",
  "privacy.html",
  "terms.html",
  "register.html",
  "myprofile.html",
  "reset.html",
  "styles.css",
  "app.js",
  "config.js",
  "profile-shared.js",
  "manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Never cache Supabase API/auth traffic — always go straight to the network.
  if (url.includes("supabase.co")) {
    return;
  }

  // Only handle GET requests for our own shell files; let everything else pass through.
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
