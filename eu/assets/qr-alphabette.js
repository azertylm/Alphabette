/*! QR codes d'Alphabette — dessinés dans le navigateur (SVG), sans service extérieur.
 * Utilise qrcode.js (Kazuhiko Arase, licence MIT, /assets/qrcode.js).
 *   <div data-qr="https://alphabette.eu" data-qr-titre="Le Laboratoire"></div>  → SVG inséré
 *   window.qrSvg(texte) → chaîne SVG (carrés noirs sur fond blanc, lisible imprimé)
 */
(function () {
  // UTF-8 : les accents d'un titre restent justes une fois scannés.
  qrcode.stringToBytes = function (s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); };
  function qrSvg(texte) {
    var q = qrcode(0, 'M');
    q.addData(String(texte), 'Byte');
    q.make();
    var n = q.getModuleCount(), m = 4, d = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) d += 'M' + (x + m) + ' ' + (y + m) + 'h1v1h-1z';
    var t = n + 2 * m;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + ' ' + t + '" shape-rendering="crispEdges" role="img">'
      + '<rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  function dessiner(racine) {
    (racine || document).querySelectorAll('[data-qr]').forEach(function (el) {
      el.innerHTML = qrSvg(el.getAttribute('data-qr'));
      var svg = el.querySelector('svg');
      svg.setAttribute('aria-label', 'QR code : ' + (el.getAttribute('data-qr-titre') || el.getAttribute('data-qr')));
    });
  }
  window.qrSvg = qrSvg;
  window.qrDessiner = dessiner;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { dessiner(); }); else dessiner();
})();
