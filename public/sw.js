/* FinDash service worker — Web Push notifications + PWA install.
   Kept intentionally minimal: no fetch/offline caching (the app is online-first
   and memory-tight), only push + notification handling. */

self.addEventListener("install", () => {
  // Activate this SW immediately on first install instead of waiting.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "FinDash", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "FinDash";
  const url = payload.url || "/invoices/pending";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    dir: "rtl",
    lang: "he",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url },
    // Action buttons render on Android/desktop; iOS ignores them and just opens the app.
    actions: [
      { action: "open", title: "פתח" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/invoices/pending";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab and navigate it, if one is open.
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl).catch(() => {});
          return;
        }
      }
      // Otherwise open a new window.
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
