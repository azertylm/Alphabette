// ORBIT (alphabette.eu) — interrupteur : l'ancienne version installait un service worker.
// Celui-ci vide les caches, se désinscrit et recharge les onglets ouverts : plus rien n'est intercepté.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try { for (const k of await caches.keys()) await caches.delete(k); } catch {}
    try { await self.registration.unregister(); } catch {}
    try { for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url); } catch {}
  })());
});
