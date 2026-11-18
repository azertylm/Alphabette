/*
 * capteur.js — injecté en tête de chaque application publiée sur alphabette.eu
 * (scripts/collect-apps.mjs). Garde en mémoire, dans le navigateur du visiteur
 * seulement, les 3 dernières erreurs JavaScript de l'application. Quand le
 * visiteur envoie un avis depuis l'accueil du Laboratoire (même site), elles
 * accompagnent son avis pour aider à corriger. Rien n'est envoyé d'ici.
 */
(function () {
  'use strict';
  var CLE = 'labo_erreurs_v1';
  var m = location.pathname.match(/^\/apps\/[^/]+\/|^\/[^/]+\/?/);
  var chemin = m ? (/\/$|\.html$/.test(m[0]) ? m[0] : m[0] + '/') : location.pathname;
  function nettoyer(t) {
    return String(t || '')
      .replace(/\?[^\s"')]*/g, '?…')
      .replace(/[A-Za-z0-9_\-]{28,}/g, '[masqué]')
      .slice(0, 300);
  }
  function noter(message) {
    try {
      var toutes = JSON.parse(localStorage.getItem(CLE) || '{}');
      var liste = (toutes[chemin] || []).concat([{ t: Date.now(), m: nettoyer(message) }]).slice(-3);
      toutes[chemin] = liste;
      localStorage.setItem(CLE, JSON.stringify(toutes));
    } catch (e) {
      /* stockage indisponible : on ne fait rien */
    }
  }
  window.addEventListener('error', function (e) {
    if (!e || !e.message) return; // erreurs de chargement de ressources : ignorées
    var fichier = e.filename ? String(e.filename).split('/').pop() : '';
    noter(e.message + (fichier ? ' (' + fichier + ':' + (e.lineno || 0) + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    noter('Promesse rejetée : ' + (r && r.message ? r.message : String(r)));
  });
})();
