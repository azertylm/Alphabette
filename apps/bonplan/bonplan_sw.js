/* BonPlan — Service Worker
 * Mode hors-ligne de secours : l'app s'ouvre instantanément même sans réseau.
 * - App shell (HTML/CSS/JS inline + données initiales des 40 catégories) : stale-while-revalidate
 * - Google Fonts : cache-first (les polices restent disponibles hors-ligne)
 * - Externes (QR api.qrserver.com…) : réseau d'abord, repli sur le cache
 */
const VERSION = 'bonplan-v1.0.0';
const CORE = ['./', './bonplan_manifest.json', './bonplan_icon.svg', './bonplan_icon_maskable.svg'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => { /* même si le précache échoue partiellement, on active le SW */ })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts : cache-first ( hors-ligne garanti après la 1re visite )
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(cacheFirst(req)); return; }

  // Même origine : l'app + ses fichiers
  if (url.origin === location.origin) { e.respondWith(staleWhileRevalidate(req)); return; }

  // Externes : réseau d'abord, repli sur le cache si hors-ligne
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});

async function cacheFirst(req) {
  const c = await caches.open(VERSION);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    return offline();
  }
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(VERSION);
  const hit = await c.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then((res) => {
    if (res && res.ok) c.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await fresh) || (await c.match('./')) || offline();
}

function offline() {
  return new Response('Hors-ligne', { status: 503, statusText: 'Hors-ligne' });
}
