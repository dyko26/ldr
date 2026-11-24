// ============================================================================
// SERVICE WORKER (sw.js) — "Under the Same Night Sky"
// Handles offline asset caching, real Web Push notifications, and deep-linking
// Compatible with iOS Safari PWA (16.4+) & Huawei (Firefox / Huawei Browser)
// ============================================================================

const CACHE_NAME = "night-sky-pwa-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./js/config.js",
  "./js/supabase.js",
  "./js/weather.js",
  "./js/push.js",
  "./js/app.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

// Install event: pre-cache core application shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Partial cache warning:", err);
      });
    })
  );
});

// Activate event: clean up older cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch event: network-first for API requests, stale-while-revalidate for shell assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Bypass caching for Supabase API, Realtime, or Open-Meteo weather calls
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("open-meteo.com")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            url.origin === self.location.origin
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

// Push event: display native notification when a Silent Pulse, Daily Answer, or Letter arrives
self.addEventListener("push", (event) => {
  let payload = {
    title: "Under the Same Night Sky ✨",
    body: "A quiet moment just arrived across the stars.",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: "night-sky-moment",
    renotify: true,
    vibrate: [120, 60, 140],
    data: {
      url: "./index.html",
      tab: "presence"
    }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
        data: {
          ...payload.data,
          ...(parsed.data || {})
        }
      };
    } catch (_e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "./icons/icon-192.png",
    badge: payload.badge || "./icons/icon-192.png",
    tag: payload.tag || "night-sky-moment",
    renotify: payload.renotify !== false,
    vibrate: payload.vibrate || [120, 60, 140],
    data: payload.data
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options).then(() => {
      // Also notify any open window clients so the constellation arc glows immediately
      return self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: "PUSH_RECEIVED",
              payload
            });
          });
        });
    })
  );
});

// Notification click: focus existing PWA window or open a new one to the target tab
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetTab = event.notification.data?.tab || "presence";
  const targetUrl = `./index.html?tab=${encodeURIComponent(targetTab)}`;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.postMessage({
              type: "NAVIGATE_TAB",
              tab: targetTab
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
