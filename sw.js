// Service worker for Jain Vivah.
// Network-first: every request tries the network first, so a deploy shows up
// on the very next reload with no version bump needed. The cache is kept
// purely as an offline fallback (updated with whatever last loaded
// successfully) - not the primary source of truth. This app changes too
// often during active development for a cache-first shell to be safe; a
// whole session on 25 Sep 2026 was spent debugging pages that looked
// "unfixed" only because the old cache-first strategy (version "MT_V3"/
// "MT_V4") kept serving stale copies of files that had already been fixed.
const CACHE_NAME = "MT_V5";

const SHELL_FILES = [
  "index.html",
  "privacy.html",
  "terms.html",
  "register.html",
  "myprofile.html",
  "browse.html",
  "profile-view.html",
  "admin.html",
  "reset.html",
  "styles.css",
  "app.js",
  "config.js",
  "profile-shared.js",
  "manifest.json"
];

self.addEventListener("install", (event) => {
  // Best-effort initial offline fallback - failure here must never block
  // install (e.g. a single 404 used to abort the whole addAll).
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(SHELL_FILES.map((file) => cache.add(file).catch(() => {})))
    )
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

  // Browser extensions (ad blockers, password managers, etc.) can trigger
  // this fetch handler for their own chrome-extension:// requests - the
  // Cache API throws on any non-http(s) scheme, which was showing up as a
  // benign but noisy "Uncaught (in promise)" error on every page load.
  if (!event.request.url.startsWith("http")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy).catch(() => {}));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
