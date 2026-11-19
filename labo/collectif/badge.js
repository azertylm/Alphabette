/*! Badge du Collectif Alphabette — https://alphabette.eu/rejoindre/
 * À placer en bas de votre application, une seule ligne :
 *   <script src="https://alphabette.eu/badge.js" defer></script>
 * Options : data-theme="clair" | "sombre" (automatique sinon), data-position="bas" (par défaut, dans le flux de la page).
 * Aucun cookie, aucun suivi, aucune donnée envoyée : c'est un simple lien.
 */
(function () {
  if (window.__alphabetteBadge) return;
  window.__alphabetteBadge = true;
  var script = document.currentScript;
  var theme = (script && script.getAttribute('data-theme')) || '';
  var sombre = theme ? theme === 'sombre' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var lien = 'https://alphabette.eu/au-hasard/?depuis=' + encodeURIComponent(location.hostname + location.pathname);

  function poser() {
    var b = document.createElement('div');
    b.setAttribute('role', 'complementary');
    b.setAttribute('aria-label', 'Collectif Alphabette');
    b.style.cssText = [
      'box-sizing:border-box', 'width:100%', 'padding:10px 14px', 'margin:0', 'text-align:center',
      'font:600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'background:' + (sombre ? '#0b1220' : '#fbf8f3'), 'color:' + (sombre ? '#cbd5e1' : '#44403c'),
      'border-top:1px solid ' + (sombre ? '#24324d' : '#e7e5e4'),
    ].join(';');
    var a = document.createElement('a');
    a.href = lien;
    a.rel = 'noopener';
    a.style.cssText = 'color:' + (sombre ? '#5eead4' : '#0f766e') + ';font-weight:800;text-decoration:underline;text-underline-offset:3px;display:inline-block;min-height:24px;padding:2px 0';
    a.textContent = 'Découvrir une autre application';
    b.appendChild(document.createTextNode('Membre du collectif '));
    var nom = document.createElement('a');
    nom.href = 'https://alphabette.eu/';
    nom.rel = 'noopener';
    nom.textContent = 'Alphabette';
    nom.style.cssText = 'color:inherit;font-weight:800';
    b.appendChild(nom);
    b.appendChild(document.createTextNode(' — '));
    b.appendChild(a);
    document.body.appendChild(b);
  }
  if (document.body) poser();
  else document.addEventListener('DOMContentLoaded', poser);
})();
