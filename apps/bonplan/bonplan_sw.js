/* Généré par scripts/collect-apps.mjs : cette appli a rejoint le Laboratoire alphabette.eu. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.map((c) => caches.delete(c)));
    await self.registration.unregister();
    const fenetres = await self.clients.matchAll({ type: 'window' });
    fenetres.forEach((f) => f.navigate(f.url));
  })());
});
