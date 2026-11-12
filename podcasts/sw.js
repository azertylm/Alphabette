// Service worker des Podcasts : garde la page et les icônes pour pouvoir ouvrir l'appli sans réseau.
// Le relais (flux.php), le son et les images des podcasts ne sont jamais mis en cache ici.
const VERSION = 'podcasts-v1';
const FICHIERS = ['/podcasts/', '/podcasts/manifest.webmanifest', '/podcasts/icone-192.png', '/podcasts/icone-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== VERSION).map((n) => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/podcasts/') || u.pathname.endsWith('flux.php')) return;
  // La page : le réseau d'abord (toujours à jour), le cache si hors ligne.
  e.respondWith(fetch(r).then((rep) => { if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(r, copie)); } return rep; }).catch(() => caches.match(r).then((c) => c || caches.match('/podcasts/'))));
});
