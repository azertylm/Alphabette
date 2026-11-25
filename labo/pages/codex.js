/* codex.js — pose <html data-ab-codex="oui"> avant l'affichage (alphabette.eu seulement, jamais .fr).
   Mode Codex activé par défaut ; l'interrupteur est dans « Mon compte » de la barre (localStorage alphabette.codex). */
(function () {
  try {
    var r = document.documentElement;
    var labo = /(^|\.)alphabette\.eu$/i.test(location.hostname) || /[?&]labo(=|&|$)/.test(location.search);
    if (labo && localStorage.getItem('alphabette.codex') !== 'non') r.setAttribute('data-ab-codex', 'oui');
  } catch (e) {}
})();
