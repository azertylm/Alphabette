/*
 * capteur.js — injecté en tête de chaque application publiée sur alphabette.eu
 * (scripts/collect-apps.mjs). Garde, dans le navigateur du visiteur seulement, les 10 dernières
 * erreurs de l'application (window.onerror, promesses rejetées, console.error), avec fichier,
 * ligne et colonne pour retrouver le code. Rien n'est envoyé d'ici : les erreurs accompagnent un
 * avis seulement si le visiteur en donne un, après passage du filtre de confidentialité.
 */
(function () {
  'use strict';
  var CLE = 'labo_erreurs_v1';
  var MAX = 10;
  var m = location.pathname.match(/^\/apps\/[^/]+\/|^\/[^/]+\/?/);
  var chemin = m ? (/\/$|\.html$/.test(m[0]) ? m[0] : m[0] + '/') : location.pathname;
  var dernier = '';
  function nettoyer(t) {
    return String(t || '')
      .replace(/\b((?:https?|wss?):\/\/[^\s?#"'<>)]+)[?#][^\s"'<>)]*/gi, '$1?…')
      .replace(/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/g, '[clé masquée]')
      .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, '[clé masquée]')
      .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jeton masqué]')
      .replace(/\b(?:Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '[jeton masqué]')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-mail masqué]')
      .replace(/\b[A-Za-z0-9_\-+/=]{32,}\b/g, '[masqué]')
      .slice(0, 300);
  }
  function noter(message) {
    var propre = nettoyer(message);
    if (!propre || propre === dernier) return; // même erreur en boucle : une seule fois
    dernier = propre;
    try {
      var toutes = JSON.parse(localStorage.getItem(CLE) || '{}');
      toutes[chemin] = (toutes[chemin] || []).concat([{ t: Date.now(), m: propre }]).slice(-MAX);
      localStorage.setItem(CLE, JSON.stringify(toutes));
    } catch (e) {
      /* stockage indisponible : on ne fait rien */
    }
  }
  function lieu(fichier, ligne, colonne) {
    if (!fichier) return '';
    return ' (' + String(fichier).split('/').pop().split('?')[0] + ':' + (ligne || 0) + ':' + (colonne || 0) + ')';
  }
  window.addEventListener('error', function (e) {
    if (!e || !e.message) return; // erreurs de chargement de ressources : ignorées
    noter(e.message + lieu(e.filename, e.lineno, e.colno));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    var pile = r && r.stack ? String(r.stack).split('\n')[1] || '' : '';
    noter('Promesse rejetée : ' + (r && r.message ? r.message : String(r)) + (pile ? ' ' + pile.trim() : ''));
  });
  var origine = console.error;
  console.error = function () {
    try {
      var morceaux = [];
      for (var i = 0; i < arguments.length && i < 3; i++) {
        var a = arguments[i];
        morceaux.push(a && a.message ? a.message : typeof a === 'string' ? a : (function () { try { return JSON.stringify(a); } catch (x) { return String(a); } })());
      }
      noter('console.error : ' + morceaux.join(' '));
    } catch (e) {
      /* jamais bloquer l'appli */
    }
    return origine.apply(console, arguments);
  };
})();
