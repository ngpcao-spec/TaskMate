/* Gestion des notifications push (Web Push) — importé par sw.js. Aucune session ici : le clic ouvre la page utile. */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'TaskMate', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'TaskMate';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || undefined, // les coches groupées d'un enfant se remplacent
      renotify: Boolean(payload.tag),
      data: { url: payload.url || '/', ...(payload.data || {}) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        await open.focus();
        if ('navigate' in open) return open.navigate(target).catch(() => self.clients.openWindow(target));
        return undefined;
      }
      return self.clients.openWindow(target);
    }),
  );
});
