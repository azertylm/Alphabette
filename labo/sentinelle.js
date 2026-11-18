/*
 * sentinelle.js — sonde anonyme injectée dans les applis de alphabette.fr (scripts/collect-apps.mjs).
 * Surveille les 100 premières sessions d'une nouvelle version : erreur fatale oui/non, temps du
 * premier rendu. Une seule mesure par session, aucun cookie, aucun identifiant, aucune donnée saisie.
 * Dès que le serveur répond « assez de sessions », la sonde se tait pour cette version.
 */
(function () {
  'use strict';
  var s = document.currentScript;
  if (!s || !window.fetch) return;
  var app = s.getAttribute('data-app'), version = s.getAttribute('data-version');
  if (!app || !version) return;
  var CLE = 'sentinelle_fin_' + app + '_' + version;
  try { if (localStorage.getItem(CLE) || sessionStorage.getItem('sentinelle_' + app)) return; sessionStorage.setItem('sentinelle_' + app, '1'); } catch (e) { return; }
  var fatale = 0, erreur = '', rendu = 0, envoye = false;
  function nettoyer(t) {
    return String(t || '').replace(/\b((?:https?):\/\/[^\s?#"'<>)]+)[?#][^\s"'<>)]*/gi, '$1?…')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-mail]').replace(/\b[A-Za-z0-9_\-+/=]{24,}\b/g, '[masqué]').slice(0, 160);
  }
  function memeOrigine(f) { return !f || f.indexOf(location.origin) === 0; }
  window.addEventListener('error', function (e) {
    if (!e || !e.message || !memeOrigine(e.filename)) return; // extensions, scripts tiers : ignorés
    if (/\[Incident API Tiers\]|IncidentApiTiers/.test(e.message)) return; // fournisseur d'IA, pas l'appli
    fatale = 1; if (!erreur) erreur = nettoyer(e.message + ' (' + String(e.filename).split('/').pop().split('?')[0] + ':' + e.lineno + ')');
  });
  window.addEventListener('unhandledrejection', function (e) {
    var m = e && e.reason && e.reason.message ? e.reason.message : String(e && e.reason);
    if (/\[Incident API Tiers\]|IncidentApiTiers|AbortError/.test(m)) return;
    fatale = 1; if (!erreur) erreur = nettoyer('Promesse rejetée : ' + m);
  });
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (p) { if (p.name === 'first-contentful-paint') rendu = Math.round(p.startTime); });
    }).observe({ type: 'paint', buffered: true });
  } catch (e) { /* navigateur ancien */ }
  // Les applis sont aussi servies sur <clé>.alphabette.fr : le service est toujours celui du domaine principal.
  var API = /(^|\.)alphabette\.fr$/.test(location.hostname) ? 'https://alphabette.fr/api/sentinelle.php' : '/api/sentinelle.php';
  function envoyer(fin) {
    if (envoye) return; envoye = true;
    if (!rendu && performance.timing) rendu = Math.max(0, performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart);
    var corps = JSON.stringify({ app: app, version: version, fatale: fatale, rendu_ms: rendu || null, erreur: erreur || null });
    if (fin && navigator.sendBeacon) { navigator.sendBeacon(API, new Blob([corps], { type: 'text/plain' })); return; }
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: corps, keepalive: true })
      .then(function (r) { return r.json(); }).then(function (d) { if (d && d.assez) try { localStorage.setItem(CLE, '1'); } catch (e) {} })
      .catch(function () {});
  }
  setTimeout(function () { envoyer(false); }, 15000);
  addEventListener('pagehide', function () { envoyer(true); });
})();
