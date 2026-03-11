// Service Worker for Web Push Notifications

self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title ?? "Streak Squad";
  const options = {
    body: data.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "poke",
    renotify: true,
    data: { url: data.url ?? "/squad" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        const url = event.notification.data?.url ?? "/squad";
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
