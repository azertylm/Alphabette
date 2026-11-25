/*! alphabette-export.js — SDK d'export viral des applis Alphabette (Lot 5). Aucun traceur, aucune ressource externe.
 *
 *   <script src="https://alphabette.fr/assets/alphabette-export.js" data-app="mon-appli" data-nom="Mon Appli"></script>
 *
 *   AlphabetteExport.texte(t)              → t + signature (exports TXT, presse-papiers)
 *   AlphabetteExport.canvas(c)             → nouveau <canvas> avec un bandeau signé en bas (exports PNG)
 *   AlphabetteExport.png(c, 'nom.png')     → télécharge le PNG signé
 *   AlphabetteExport.piedPdf()             → texte du pied de page pour les PDF (jsPDF, pdf-lib…)
 *   AlphabetteExport.imprimer()            → impression avec la signature en pied de page
 *   AlphabetteExport.lien()                → https://alphabette.fr/go/<app>?ref=<code>&src=export
 *   AlphabetteExport.estAbonnePayant()     → Promise<boolean> (la signature est retirée pour les abonnés payants)
 *
 * Signature : « Créé avec <NomAppli> sur Alphabette.fr » + lien ?ref=&src=export (le code ref est l'identifiant ANONYME du
 * recommandeur, lu dans l'adresse de la page ; jamais de cookie). Dans un cadre (iframe isolé), l'appli demande à la page
 * hôte par postMessage si la personne est abonnée ; la page hôte qui charge aussi ce script répond.
 */
(function () {
  'use strict';
  var script = document.currentScript || {};
  var d = script.dataset || {};
  var cfg = { app: d.app || '', nom: d.nom || document.title || 'cette appli', ref: '' };
  try {
    var q = new URLSearchParams(location.search).get('ref');
    if (q && /^r[a-z0-9]{10}$/.test(q)) { cfg.ref = q; sessionStorage.setItem('ab5_ref', q); } else cfg.ref = sessionStorage.getItem('ab5_ref') || '';
  } catch (e) {}
  var payant = null; // inconnu tant qu'on n'a pas demandé

  function lien() {
    return 'https://alphabette.fr/go/' + encodeURIComponent(cfg.app || 'catalogue') + '?' + (cfg.ref ? 'ref=' + cfg.ref + '&' : '') + 'src=export';
  }
  function signature() { return 'Créé avec ' + cfg.nom + ' sur Alphabette.fr — ' + lien(); }

  /** Demande à l'API (même site) ou à la page hôte (postMessage) si la personne a un accès PAYANT à l'appli. */
  function estAbonnePayant() {
    if (payant !== null) return Promise.resolve(payant);
    return new Promise(function (ok) {
      var fini = false;
      function fin(v) { if (!fini) { fini = true; payant = !!v; ok(payant); } }
      setTimeout(function () { fin(false); }, 1200);
      if (window.parent && window.parent !== window) {
        window.addEventListener('message', function ecoute(e) {
          if (e.data && e.data.type === 'alphabette-export:abonnement' && e.data.app === cfg.app) { window.removeEventListener('message', ecoute); fin(e.data.payant === true); }
        });
        window.parent.postMessage({ type: 'alphabette-export:abonnement?', app: cfg.app }, '*');
        return;
      }
      verifierIci(cfg.app).then(fin, function () { fin(false); });
    });
  }
  function verifierIci(app) {
    var j = '';
    try { j = localStorage.getItem('alphabette_createur_jeton') || ''; } catch (e) {}
    if (!j || !app || !/alphabette\.(eu|fr)$|^localhost$|^127\./.test(location.hostname)) return Promise.resolve(false);
    return fetch('https://alphabette.eu/api/affiliation.php?acces=' + encodeURIComponent(app), { headers: { Authorization: 'Bearer ' + j } })
      .then(function (r) { return r.ok ? r.json() : {}; }).then(function (a) { return !!(a && a.actif && a.payant); });
  }
  // Page hôte : répond aux applis en cadre isolé (origine opaque) sans leur donner le jeton.
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.type !== 'alphabette-export:abonnement?' || typeof m.app !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(m.app) || !e.source) return;
    verifierIci(m.app).then(function (v) { e.source.postMessage({ type: 'alphabette-export:abonnement', app: m.app, payant: v }, '*'); }, function () {});
  });

  function texte(t) { return payant ? String(t) : String(t) + '\n\n— ' + signature(); }

  function canvas(source) {
    var w = source.width, bande = payant ? 0 : Math.max(28, Math.round(w / 32));
    var c = document.createElement('canvas'); c.width = w; c.height = source.height + bande;
    var x = c.getContext('2d');
    x.drawImage(source, 0, 0);
    if (!bande) return c;
    x.fillStyle = '#182334'; x.fillRect(0, source.height, w, bande);
    x.fillStyle = '#ffffff'; x.textBaseline = 'middle';
    x.font = '600 ' + Math.round(bande * 0.42) + 'px system-ui, -apple-system, Segoe UI, sans-serif';
    var t = 'Créé avec ' + cfg.nom + ' sur Alphabette.fr';
    x.fillText(t, Math.round(bande * 0.4), source.height + bande / 2);
    x.font = '500 ' + Math.round(bande * 0.34) + 'px system-ui, sans-serif'; x.textAlign = 'right';
    x.fillText(lien().replace(/^https:\/\//, ''), w - Math.round(bande * 0.4), source.height + bande / 2);
    return c;
  }
  function png(source, nom) {
    return estAbonnePayant().then(function () {
      return new Promise(function (ok) {
        canvas(source).toBlob(function (b) {
          var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nom || (cfg.app || 'export') + '.png';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); ok(true);
        }, 'image/png');
      });
    });
  }
  function piedPdf() { return payant ? '' : signature(); }
  function imprimer() {
    return estAbonnePayant().then(function (p) {
      var s = document.getElementById('ab-export-impression');
      if (!p && !s) {
        s = document.createElement('style'); s.id = 'ab-export-impression';
        s.textContent = '@media print{body::after{content:' + JSON.stringify(signature()) + ';display:block;margin-top:12mm;font:10pt system-ui,sans-serif;color:#334155;border-top:1px solid #cbd5e1;padding-top:3mm}}';
        document.head.appendChild(s);
      }
      if (p && s) s.remove();
      window.print();
    });
  }
  estAbonnePayant();
  window.AlphabetteExport = { config: cfg, lien: lien, signature: signature, texte: texte, canvas: canvas, png: png, piedPdf: piedPdf, imprimer: imprimer, estAbonnePayant: estAbonnePayant };
})();
