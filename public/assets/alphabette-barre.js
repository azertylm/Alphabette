/*
 * alphabette-barre.js — la double barre Alphabette pour les pages HTML simples.
 *
 * Les applications React utilisent la base commune (@alphabette/shell) ; une page
 * HTML sans construction ajoute seulement cette ligne, juste après <body> :
 *
 *   <script src="https://alphabette.fr/assets/alphabette-barre.js"
 *           data-cle="kurate" data-nom="Kurate"
 *           data-sous-titre="Votre sélection du jour" data-accent="#4F46E5"></script>
 *
 * Barre 1 : α alphabette (petit, vers www.alphabette.fr) · ▦ toutes les applis ·
 *           🆕 nouveautés · favoris · S'abonner.
 * Barre 2 : nom de l'appli · ♥ don · BIG · ☀️/🌙 · 🔊 · ⋯ (favori, mode simple,
 *           installer, avis, imprimer, langue).
 *
 * Option data-masquer="defilement" : les barres se masquent quand on descend dans le contenu.
 *
 * Chaque pictogramme affiche son nom au survol, au clavier et au doigt.
 * Les réglages (taille BIG, jour/nuit, langue, favoris) sont mémorisés dans un petit
 * cookie partagé par tous les sites alphabette.fr : on les règle une seule fois.
 * Applis, tarifs et coordonnées de don viennent du hub (/api/apps, /api/config.json).
 */
(function () {
  'use strict';
  if (window.__alphabetteBarre) return;
  window.__alphabetteBarre = true;

  var script = document.currentScript;
  var d = (script && script.dataset) || {};
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var HUB = local ? location.origin : 'https://alphabette.fr';
  var app = { cle: d.cle || '', nom: d.nom || document.title, sousTitre: d.sousTitre || '', accent: d.accent || '#2563eb', categorie: d.categorie || '' };

  // ------------------------------------------------------------ Lien recommandé (Lot 5)
  // /go/<appli>?ref=… ajoute ?clic=clk_… à l'adresse : gardé pour CET onglet seulement (sessionStorage, jamais de cookie),
  // pour que l'abonnement éventuel dans les 7 jours remercie la personne qui a recommandé l'appli.
  try {
    var clic = new URLSearchParams(location.search).get('clic');
    if (clic && /^clk_[a-f0-9]{24}$/.test(clic)) sessionStorage.setItem('ab5_clic', clic);
  } catch (e) {}

  // ------------------------------------------------------------ Design Pop / Néon (Lot 4)
  // Univers posé tout de suite (avant l'affichage) : alphabette.eu = « Labo Pop Électrique », sinon « Vitrine Solaire ».
  // Mode Calme (localStorage) : coupe les animations. Feuille et effets chargés à côté de ce script, sans bloquer.
  (function designPop() {
    var r = document.documentElement;
    r.dataset.univers = /(^|\.)alphabette\.eu$/i.test(location.hostname) || /[?&]labo(=|&|$)/.test(location.search) ? 'labo' : 'vitrine';
    try { if (localStorage.getItem('alphabette.calme') === 'oui') r.dataset.calme = 'oui'; } catch (e) {}
    var base = (script && script.src) ? script.src.replace(/alphabette-barre\.js(\?.*)?$/, '') : 'https://alphabette.fr/assets/';
    if (!document.getElementById('ab-pop-css')) {
      var l = document.createElement('link'); l.id = 'ab-pop-css'; l.rel = 'stylesheet'; l.href = base + 'alphabette-pop.css';
      (document.head || r).appendChild(l);
    }
    if (!window.alphabetteEffets && !document.getElementById('ab-effets-js')) {
      var s = document.createElement('script'); s.id = 'ab-effets-js'; s.src = base + 'alphabette-effets.js'; s.async = true;
      (document.head || r).appendChild(s);
    }
    var cat = (app.categorie || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    if (cat) r.dataset.abCategorie = cat;
  })();

  // ------------------------------------------------------------ Inscription (code d'invitation)
  // Écrite par https://alphabette.fr/inscription/ dans un cookie de tout le domaine : chaque appli la lit.
  var INSCRIPTION = 'https://alphabette.fr/inscription/';
  function lireMembre() {
    var m = null;
    try { var c = document.cookie.match(/(?:^|; )ab_membre=([^;]*)/); if (c) m = JSON.parse(decodeURIComponent(c[1])); } catch (e) { m = null; }
    if (!m) { try { m = JSON.parse(localStorage.getItem('alphabette.membre') || 'null'); } catch (e) { m = null; } }
    return m && typeof m.prenom === 'string' && m.prenom.trim() ? m : null;
  }
  var membre = lireMembre();
  var ROLES = { fondateur: 'Fondateur', ami: 'Ami(e) d’alphabette', invite: 'Invité(e)' };
  function lienInscription() { return INSCRIPTION + '?retour=' + encodeURIComponent(location.href); }

  // ------------------------------------------------------------ Préférences partagées
  var COOKIE = 'ab_prefs', CLE_LOCALE = 'alphabette.prefs';
  function domaine() { var m = location.hostname.match(/(?:^|\.)(alphabette\.(?:fr|eu))$/); return m ? '.' + m[1] : null; }
  function lirePrefs() {
    try { var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)')); if (m) return JSON.parse(decodeURIComponent(m[1])); } catch (e) {}
    try { return JSON.parse(localStorage.getItem(CLE_LOCALE) || '{}'); } catch (e) { return {}; }
  }
  function ecrirePrefs(chg) {
    var p = lirePrefs(); Object.keys(chg).forEach(function (k) { p[k] = chg[k]; });
    var json = JSON.stringify(p);
    try { localStorage.setItem(CLE_LOCALE, json); } catch (e) {}
    try {
      var dom = domaine();
      document.cookie = COOKIE + '=' + encodeURIComponent(json) + '; Path=/; Max-Age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '') + (dom ? '; Domain=' + dom : '');
    } catch (e) {}
    return p;
  }
  var prefs = lirePrefs();

  // ------------------------------------------------------------ Langue de la barre
  var EN = {
    'Aller sur alphabette.fr': 'Go to alphabette.fr', 'Laboratoire': 'Lab', 'Laboratoire d’Octet : tester et proposer des idées': 'Octet’s Lab: test apps and suggest ideas', 'Toutes les applis': 'All apps', 'Nouveautés': 'What’s new', 'S’abonner': 'Subscribe', 'Mon inscription': 'My membership', 'S’inscrire avec un code': 'Join with a code',
    'Faire un don': 'Donate', 'Passer en mode nuit': 'Switch to night mode', 'Passer en mode jour': 'Switch to day mode',
    'Lire à voix haute': 'Read aloud', 'Arrêter la lecture': 'Stop reading', 'Plus d’options': 'More options', 'Taille du texte': 'Text size',
    'Normale': 'Normal', 'Grande': 'Large', 'Très grande': 'Extra large', 'Épingler cette appli': 'Pin this app', 'Retirer de mes favoris': 'Remove from favorites',
    'Mode simple': 'Simple mode', 'Quitter le mode simple': 'Leave simple mode', 'Installer sur mon téléphone': 'Install on my phone', 'Donner mon avis': 'Send feedback',
    'Imprimer': 'Print', 'Langue': 'Language', 'Fermer': 'Close', 'Mes favoris': 'My favorites', 'Gratuit': 'Free',
  };
  var langue = prefs.lang === 'en' ? 'en' : 'fr';
  function T(mot) { return langue === 'en' && EN[mot] ? EN[mot] : mot; }

  // ------------------------------------------------------------ Taille (BIG) et thème
  var TAILLES = [
    { cle: 'normal', ancien: 'normal', zoom: 1, nom: 'Normale' },
    { cle: 'large', ancien: 'grand', zoom: 1.25, nom: 'Grande' },
    { cle: 'xlarge', ancien: 'tres-grand', zoom: 1.5, nom: 'Très grande' },
  ];
  var indexTaille = Math.max(0, TAILLES.findIndex(function (t) { return t.cle === prefs.density; }));
  function appliquerTaille() {
    var t = TAILLES[indexTaille], r = document.documentElement;
    // data-big="police" : pour les applis plein écran (vidéo…), on agrandit la police de la page plutôt que de zoomer.
    var parPolice = d.big === 'police';
    r.style.zoom = parPolice || t.zoom === 1 ? '' : String(t.zoom);
    r.style.fontSize = parPolice && t.zoom !== 1 ? String(t.zoom * 100) + '%' : '';
    r.style.setProperty('--ab-zoom', parPolice ? '1' : String(t.zoom));
    r.dataset.abDensity = t.cle; r.dataset.abTaille = t.ancien; // « abTaille » : ancien nom, encore lu par certaines pages
    var b = document.getElementById('ab-big');
    if (b) {
      var tip = T('Taille du texte') + ' : ' + T(t.nom);
      b.dataset.abTip = tip; b.setAttribute('aria-label', 'BIG, ' + tip);
      b.querySelectorAll('.ab-density__bar').forEach(function (barre, i) { barre.classList.toggle('ab-density__bar--on', i <= indexTaille); });
    }
  }
  var theme = prefs.theme === 'nuit' || prefs.theme === 'jour' ? prefs.theme : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'nuit' : 'jour');
  function appliquerTheme(notifier) {
    var r = document.documentElement; r.dataset.abTheme = theme; r.style.colorScheme = theme === 'nuit' ? 'dark' : 'light';
    var b = document.getElementById('ab-theme');
    if (b) { b.textContent = theme === 'nuit' ? '🌙' : '☀️'; var m = T(theme === 'nuit' ? 'Passer en mode jour' : 'Passer en mode nuit'); b.dataset.abTip = m; b.setAttribute('aria-label', m); }
    // Les pages qui ont leur propre habillage (Info, Wikicom…) écoutent cet événement.
    if (notifier) window.dispatchEvent(new CustomEvent('alphabette:theme', { detail: theme }));
  }
  var simple = prefs.simple === true;
  function appliquerSimple() { if (simple) document.documentElement.dataset.abSimple = 'oui'; else delete document.documentElement.dataset.abSimple; }
  appliquerTaille(); appliquerTheme(false); appliquerSimple(); // tout de suite, avant l'affichage
  document.addEventListener('DOMContentLoaded', function () { window.dispatchEvent(new CustomEvent('alphabette:theme', { detail: theme })); });

  // ------------------------------------------------------------ Style
  var css = [
    '#ab-barres{--ab-accent:' + app.accent + ';--ab-bar-fond:#fff;--ab-bar-encre:#0f172a;--ab-bar-trait:#e2e8f0;--ab-chip:#f1f5f9;--ab-chip-h:#e2e8f0;--ab-muted:#64748b;--ab-eco:color-mix(in oklab,var(--ab-accent) 32%,#0a1226);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.2;}',
    ':root[data-ab-theme="nuit"] #ab-barres{--ab-bar-fond:#111a2e;--ab-bar-encre:#e2e8f0;--ab-bar-trait:#1e293b;--ab-chip:#1b2540;--ab-chip-h:#26324f;--ab-muted:#94a3b8;}',
    '#ab-barres *,.ab-modale-fond *,.ab-tip{box-sizing:border-box;}',
    '.ab-eco{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 10px;background:var(--ab-eco);color:#e6ecf7;font-size:14px;overflow-x:auto;scrollbar-width:none;}',
    '.ab-eco::-webkit-scrollbar{display:none;}',
    '.ab-eco__logo{display:inline-flex;align-items:center;gap:6px;min-height:44px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.03em;white-space:nowrap;opacity:.92;}',
    '.ab-eco__logo:hover{opacity:1;text-decoration:underline;}',
    '.ab-eco__marque{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;background:var(--ab-accent);color:#fff;font-size:12px;font-weight:900;}',
    '.ab-eco__icone{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;padding:0 6px;border:0;border-radius:999px;background:rgba(255,255,255,.13);color:#fff;font:inherit;font-size:17px;line-height:1;cursor:pointer;}',
    '.ab-eco__icone:hover{background:rgba(255,255,255,.25);}',
    '.ab-eco__labo--txt .ab-eco__labo-txt{display:inline;}.ab-eco__labo{text-decoration:none;gap:6px;font-size:14px;font-weight:700;padding:0 10px;}.ab-eco__octet{width:28px;height:28px;border-radius:999px;background:#fffaf0;object-fit:cover;}.ab-eco__labo-txt{display:none;}@media (min-width:760px){.ab-eco__labo-txt{display:inline;}}',
    '.ab-eco__point{position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:999px;background:#ef4444;border:2px solid #0a1226;}',
    '.ab-eco__favoris{display:flex;align-items:center;gap:4px;min-width:0;}',
    '.ab-site{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;color:#cdd6ea;text-decoration:none;white-space:nowrap;font-size:13px;}',
    '.ab-site:hover{background:rgba(255,255,255,.16);color:#fff;}.ab-site--actif{background:var(--ab-accent);color:#fff;font-weight:700;}',
    '.ab-eco__droite{display:flex;align-items:center;margin-left:auto;}',
    '.ab-abonner{display:inline-flex;align-items:center;gap:5px;min-height:44px;padding:0 14px;border:0;border-radius:999px;background:#f5b50a;color:#3a2a00;font:inherit;font-size:13px;font-weight:800;white-space:nowrap;cursor:pointer;text-decoration:none;}',
    '.ab-abonner:hover{background:#dba207;}',
    '.ab-abonner--membre{background:rgba(245,181,10,.18);color:#fff;border:1px solid rgba(245,181,10,.7);max-width:150px;overflow:hidden;text-overflow:ellipsis;}',
    '.ab-abonner--membre:hover{background:rgba(245,181,10,.32);}',
    '.ab-bar{position:relative;display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--ab-bar-fond);color:var(--ab-bar-encre);border-bottom:1px solid var(--ab-bar-trait);}',
    '.ab-bar__titres{display:flex;flex-direction:column;min-width:0;}',
    '.ab-bar__nom{font-size:20px;font-weight:800;line-height:1.1;color:var(--ab-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    ':root[data-ab-theme="nuit"] .ab-bar__nom{color:color-mix(in oklab,var(--ab-accent) 55%,#fff);}',
    '.ab-bar__sous{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--ab-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.ab-bar__actions{display:flex;align-items:center;gap:8px;margin-left:auto;position:relative;}',
    '.ab-pico{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:44px;height:44px;padding:0 8px;border:1px solid var(--ab-bar-trait);border-radius:12px;background:var(--ab-chip);color:var(--ab-bar-encre);font:inherit;font-size:19px;font-weight:800;line-height:1;cursor:pointer;}',
    '.ab-pico:hover{background:var(--ab-chip-h);}',
    '@media (max-width:400px){.ab-bar__actions{gap:4px;}.ab-pico{min-width:40px;padding:0 6px;}}',
    '.ab-pico--don{background:#e11d5b;border-color:transparent;color:#fff;}.ab-pico--don:hover{background:#be184d;}',
    '.ab-pico--big{background:var(--ab-accent);border-color:transparent;color:#fff;font-size:14px;letter-spacing:.04em;}.ab-pico--big:hover{background:color-mix(in oklab,var(--ab-accent) 85%,#000);}',
    '.ab-pico--actif{background:var(--ab-accent);border-color:transparent;color:#fff;}',
    '#ab-barres button:focus-visible,#ab-barres a:focus-visible,.ab-modale button:focus-visible,.ab-modale a:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px var(--ab-accent);}',
    '.ab-density{display:inline-flex;align-items:flex-end;gap:2px;height:14px;}',
    '.ab-density__bar{width:4px;border-radius:1px;background:rgba(255,255,255,.4);}',
    '.ab-density__bar:nth-child(1){height:6px;}.ab-density__bar:nth-child(2){height:10px;}.ab-density__bar:nth-child(3){height:14px;}',
    '.ab-density__bar--on{background:#fff;}',
    '.ab-menu{position:absolute;top:calc(100% + 8px);right:0;z-index:70;width:min(340px,calc((100vw - 16px) / var(--ab-zoom,1)));max-height:calc((100dvh - 130px) / var(--ab-zoom,1));overflow-y:auto;overscroll-behavior:contain;padding:10px;border:1px solid var(--ab-bar-trait);border-radius:16px;background:var(--ab-bar-fond);box-shadow:0 18px 50px rgba(0,0,0,.35);display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
    '.ab-menu__item{display:flex;align-items:center;gap:9px;min-width:0;min-height:52px;padding:8px 10px;border:1px solid var(--ab-bar-trait);border-radius:12px;background:var(--ab-chip);color:var(--ab-bar-encre);font:inherit;font-size:14px;font-weight:700;line-height:1.15;text-align:left;cursor:pointer;overflow-wrap:anywhere;}',
    '.ab-menu__item:hover{background:var(--ab-chip-h);}.ab-menu__item[aria-pressed="true"]{border-color:var(--ab-accent);}',
    '.ab-menu__emoji{font-size:24px;line-height:1;flex:none;}',
    '.ab-tip{position:fixed;z-index:2147483600;max-width:min(288px,calc(100vw - 16px));padding:7px 11px;border-radius:10px;background:#0f172a;color:#fff;font:600 14px/1.25 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.35);transform:translateX(-50%);}',
    '.ab-modale-fond{position:fixed;inset:0;z-index:2147483000;background:rgba(2,6,23,.7);display:flex;align-items:center;justify-content:center;padding:14px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}',
    '.ab-modale{background:#fff;color:#0f172a;border-radius:18px;max-width:480px;width:100%;max-height:90vh;overflow:auto;padding:18px;font-size:16px;line-height:1.45;}',
    ':root[data-ab-theme="nuit"] .ab-modale{background:#111a2e;color:#e2e8f0;}',
    '.ab-modale h2{margin:0 0 8px;font-size:22px;}.ab-modale p{margin:0 0 12px;}',
    '.ab-modale dl{margin:0 0 12px;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;}.ab-modale dt{opacity:.7;}.ab-modale dd{margin:0;font-weight:700;word-break:break-word;}',
    '.ab-modale__actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}',
    '.ab-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:8px 14px;border:1px solid #cbd5e1;border-radius:12px;background:#f1f5f9;color:#0f172a;font:inherit;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;}',
    ':root[data-ab-theme="nuit"] .ab-btn{background:#1b2540;color:#e2e8f0;border-color:#2c3a5c;}',
    '.ab-btn--don{background:#e11d5b!important;color:#fff!important;border-color:transparent!important;}.ab-btn--accent{background:var(--ab-accent,#2563eb)!important;color:#fff!important;border-color:transparent!important;}',
    '.ab-liste{list-style:none;margin:0;padding:0;display:grid;gap:8px;}',
    '.ab-liste li{display:flex;align-items:center;gap:8px;}',
    '.ab-liste__lien{flex:1;display:block;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;color:inherit;text-decoration:none;font-weight:700;min-width:0;}',
    ':root[data-ab-theme="nuit"] .ab-liste__lien{border-color:#2c3a5c;}',
    '.ab-liste__lien small{display:block;font-weight:400;opacity:.75;font-size:13px;margin-top:2px;}',
    '.ab-liste__lien:hover{border-color:var(--ab-accent,#2563eb);}',
    '.ab-etoile{flex:none;width:42px;height:42px;border:1px solid #cbd5e1;border-radius:12px;background:transparent;color:inherit;font-size:20px;cursor:pointer;}',
    '.ab-etoile[aria-pressed="true"]{background:#f5b50a;color:#3a2a00;border-color:transparent;}',
    '.ab-choix{display:grid;grid-template-columns:1fr 1fr;gap:8px;}.ab-choix .ab-btn[aria-pressed="true"]{background:var(--ab-accent,#2563eb);color:#fff;border-color:transparent;}',
    // Mode simple, impression, téléphone
    'html[data-ab-simple] *,html[data-ab-simple] *::before,html[data-ab-simple] *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;}',
    'html[data-ab-simple] aside,html[data-ab-simple] [data-ab-secondaire]{display:none!important;}',
    'html[data-ab-simple] main{max-width:760px;margin-inline:auto;line-height:1.7;}',
    '@media print{#ab-barres,.ab-modale-fond,.ab-tip{display:none!important;}html{zoom:1!important;}}',
    ':root[data-ab-density="large"] .ab-menu,:root[data-ab-density="xlarge"] .ab-menu{grid-template-columns:1fr;}',
    // Barres masquées au défilement (data-masquer="defilement") : elles remontent hors de l'écran.
    '#ab-barres{transition:margin-top .25s ease;}:root[data-ab-barres="cachees"] #ab-barres{margin-top:calc(-1 * var(--ab-hauteur-barres,0px));}',
    '@media (prefers-reduced-motion:reduce){#ab-barres{transition:none;}}',
    '@media (max-width:480px){:root[data-ab-density="xlarge"] .ab-bar{gap:6px;padding:6px 8px;}:root[data-ab-density="xlarge"] .ab-bar__actions{gap:3px;}:root[data-ab-density="xlarge"] .ab-pico{min-width:32px;height:34px;padding:0 4px;font-size:17px;}}',
    '@media (max-width:760px){.ab-eco__favoris{display:none;}.ab-menu{grid-template-columns:1fr;}.ab-bar__nom{font-size:18px;}.ab-pico{min-width:36px;height:36px;padding:0 6px;}.ab-bar__actions{gap:4px;}}',
  ].join('\n');
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ------------------------------------------------------------ Outils DOM
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'onclick') n.addEventListener('click', attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function lisible(nom) { return nom !== nom.toUpperCase() ? nom : nom.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); }); }
  var appsHub = [], configHub = null;

  // ------------------------------------------------------------ Bulle d'aide (souris, clavier, doigt)
  var bulle = null, minuterieBulle = null;
  function montrerBulle(cible, duree) {
    var texte = cible.dataset.abTip; if (!texte) return;
    cacherBulle();
    var r = cible.getBoundingClientRect();
    bulle = el('div', { class: 'ab-tip', role: 'tooltip', text: texte });
    document.body.appendChild(bulle);
    var x = Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90);
    bulle.style.left = x + 'px'; bulle.style.top = (r.bottom + 8 > window.innerHeight - 40 ? r.top - 42 : r.bottom + 8) + 'px';
    if (duree) minuterieBulle = setTimeout(cacherBulle, duree);
  }
  function cacherBulle() { clearTimeout(minuterieBulle); if (bulle) { bulle.remove(); bulle = null; } }
  function cibleBulle(e) { return e.target instanceof Element ? e.target.closest('[data-ab-tip]') : null; }
  document.addEventListener('mouseover', function (e) { var c = cibleBulle(e); if (c) montrerBulle(c); });
  document.addEventListener('mouseout', function (e) { if (cibleBulle(e)) cacherBulle(); });
  document.addEventListener('focusin', function (e) { var c = cibleBulle(e); if (c) montrerBulle(c); });
  document.addEventListener('focusout', function (e) { if (cibleBulle(e)) cacherBulle(); });
  document.addEventListener('touchstart', function (e) { var c = cibleBulle(e); if (c) montrerBulle(c, 1600); }, { passive: true });
  document.addEventListener('scroll', cacherBulle, true);

  // ------------------------------------------------------------ Fenêtres
  function modale(titre, contenu) {
    var fond = el('div', { class: 'ab-modale-fond', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre });
    var boite = el('div', { class: 'ab-modale' });
    function clore() { fond.remove(); document.removeEventListener('keydown', echap); }
    function echap(e) { if (e.key === 'Escape') clore(); }
    boite.appendChild(el('h2', { text: titre }));
    contenu(boite, clore);
    var fermer = el('button', { type: 'button', class: 'ab-btn', text: T('Fermer'), onclick: clore });
    var actions = boite.querySelector('.ab-modale__actions');
    if (!actions) { actions = el('div', { class: 'ab-modale__actions' }); boite.appendChild(actions); }
    actions.appendChild(fermer);
    fond.addEventListener('click', function (e) { if (e.target === fond) clore(); });
    document.addEventListener('keydown', echap);
    fond.appendChild(boite); document.body.appendChild(fond); fermer.focus();
    return clore;
  }

  // ------------------------------------------------------------ Favoris et nouveautés
  var favoris = (prefs.favoris || []).slice(0, 3);
  function basculerFavori(cle) {
    favoris = favoris.indexOf(cle) >= 0 ? favoris.filter(function (k) { return k !== cle; }) : favoris.concat(cle).slice(-3);
    ecrirePrefs({ favoris: favoris }); dessinerFavoris(); majMenu();
  }
  var vus = prefs.vus || [];
  function nouveautes() { return appsHub.filter(function (a) { return a.badge === 'Nouveau' && a.slug !== app.cle && a.url && /^https?:/.test(a.url); }).slice(0, 6); }
  function majPoint() {
    var n = nouveautes().filter(function (a) { return vus.indexOf(a.slug) < 0; }).length;
    var p = document.getElementById('ab-point'); if (p) p.hidden = n === 0;
  }
  function ligneApp(a, avecDescription) {
    var lien = el('a', { class: 'ab-liste__lien', href: a.url }, [el('span', { text: lisible(a.name) + (a.gratuit ? ' · ' + T('Gratuit') : '') })]);
    if (avecDescription && a.description) lien.appendChild(el('small', { text: a.description }));
    var etoile = el('button', { type: 'button', class: 'ab-etoile', 'aria-pressed': String(favoris.indexOf(a.slug) >= 0), 'aria-label': T('Épingler cette appli'), 'data-ab-tip': T('Épingler cette appli'), text: favoris.indexOf(a.slug) >= 0 ? '★' : '☆' });
    etoile.addEventListener('click', function () { basculerFavori(a.slug); var on = favoris.indexOf(a.slug) >= 0; etoile.textContent = on ? '★' : '☆'; etoile.setAttribute('aria-pressed', String(on)); });
    return el('li', {}, [lien, etoile]);
  }
  function panneauApps() {
    modale(T('Toutes les applis'), function (boite) {
      var liste = el('ul', { class: 'ab-liste' });
      var tri = appsHub.slice().sort(function (a, b) { return (favoris.indexOf(b.slug) >= 0) - (favoris.indexOf(a.slug) >= 0) || (a.ordre || 999) - (b.ordre || 999); });
      tri.filter(function (a) { return a.url && /^https?:/.test(a.url) && !a.groupe; }).forEach(function (a) { liste.appendChild(ligneApp(a, false)); });
      if (!tri.length) boite.appendChild(el('p', { text: 'La liste des applications n’a pas pu être chargée. Rendez-vous sur alphabette.fr.' }));
      boite.appendChild(liste);
    });
  }
  function panneauNouveautes() {
    vus = Array.from(new Set(vus.concat(nouveautes().map(function (a) { return a.slug; })))); ecrirePrefs({ vus: vus }); majPoint();
    modale(T('Nouveautés'), function (boite) {
      var n = nouveautes();
      if (!n.length) { boite.appendChild(el('p', { text: 'Pas de nouveauté pour l’instant. Revenez bientôt !' })); return; }
      var liste = el('ul', { class: 'ab-liste' }); n.forEach(function (a) { liste.appendChild(ligneApp(a, true)); }); boite.appendChild(liste);
    });
  }

  // ------------------------------------------------------------ Lecture à voix haute
  var lectureEnCours = false, jeton = 0;
  // Voix Alphabette unique (Gemini « Kore ») : alphabette-audio.js, chargé à côté de ce script.
  // Jamais de speechSynthesis en direct ici (CLAUDE.md) : un clic arrivé avant la voix attend son chargement.
  (function chargerVoix() {
    if (window.alphabetteAudio || document.getElementById('ab-audio-js')) return;
    var src = (script && script.src) ? script.src.replace(/alphabette-barre\.js(\?.*)?$/, 'alphabette-audio.js') : 'https://alphabette.fr/assets/alphabette-audio.js';
    var s = document.createElement('script'); s.id = 'ab-audio-js'; s.src = src; s.async = true;
    (document.head || document.documentElement).appendChild(s);
  })();
  function etatVoix() { var a = window.alphabetteAudio; return a ? a.lireEtat().etat : (lectureEnCours ? 'preparation' : 'repos'); }
  function majLecture() {
    var b = document.getElementById('ab-lire'); if (!b) return; var e = etatVoix();
    b.textContent = e === 'preparation' ? '⏳' : e === 'lecture' ? '🔇' : '🔊';
    // Égaliseur 4 barres, animé seulement pendant la lecture d'alphabetteAudio (aucune place prise).
    b.dataset.abAudioEtat = e;
    var eq = el('span', { class: 'ab-egaliseur', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i'), el('i')]); b.appendChild(eq);
    b.classList.toggle('ab-pico--actif', e !== 'repos'); b.classList.toggle('ab-pico--audio-lecture', e === 'lecture');
    b.setAttribute('aria-busy', String(e === 'preparation'));
    var m = T(e === 'preparation' ? 'Préparation... (toucher pour annuler)' : e === 'lecture' ? 'Arrêter la lecture' : 'Lire à voix haute');
    b.dataset.abTip = m; b.setAttribute('aria-label', m);
  }
  window.addEventListener('alphabette:audio', majLecture);
  function texteDeLaPage() {
    var zone = document.querySelector('main') || document.body;
    var barres = document.getElementById('ab-barres'); var t = (zone.innerText || '');
    if (barres && zone === document.body) t = t.replace(barres.innerText || '', '');
    return t.slice(0, 30000);
  }
  function basculerLecture() {
    var a = window.alphabetteAudio;
    if (a) {
      // Une lecture (ou une préparation) en cours n'importe où sur l'écran : on l'arrête.
      if (a.actif) return a.stop();
      return a.play(a.texteDeLaPage ? a.texteDeLaPage() : texteDeLaPage(), a.ID_BARRE, { langue: langue === 'en' ? 'en' : 'fr' });
    }
    // La voix n'est pas encore arrivée : « préparation », puis lecture dès qu'elle est là (second clic = annuler).
    if (lectureEnCours) { jeton++; lectureEnCours = false; return majLecture(); }
    var moi = ++jeton; lectureEnCours = true; majLecture();
    var fini = false, sc = document.getElementById('ab-audio-js');
    function fin() {
      if (fini || jeton !== moi) return; fini = true;
      lectureEnCours = false; majLecture();
      if (window.alphabetteAudio) return basculerLecture();
      var b = document.getElementById('ab-lire'); if (b) { b.dataset.abTip = T('Lecture indisponible : réessayez'); b.setAttribute('aria-label', b.dataset.abTip); }
    }
    if (sc) { sc.addEventListener('load', fin); sc.addEventListener('error', fin); }
    setTimeout(fin, 8000);
  }
  window.addEventListener('pagehide', function () { if (window.alphabetteAudio) window.alphabetteAudio.stop(); });

  // ------------------------------------------------------------ Installer, avis, imprimer, langue
  var installation = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installation = e; });
  window.addEventListener('appinstalled', function () { installation = null; });
  function dejaInstallee() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function installer() {
    if (installation) { installation.prompt(); installation = null; return; }
    var ua = navigator.userAgent, plate = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'pc';
    var etapes = {
      ios: ['Ouvrez cette page dans Safari.', 'Touchez le bouton Partager (le carré avec une flèche vers le haut).', 'Choisissez « Sur l’écran d’accueil », puis « Ajouter ».'],
      android: ['Touchez les trois points ⋮ en haut à droite du navigateur.', 'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».', 'Validez : l’icône apparaît parmi vos applications.'],
      pc: ['Dans la barre d’adresse, cherchez l’icône « Installer » (un écran avec une flèche).', 'Sinon, ouvrez le menu du navigateur et choisissez « Installer » ou « Créer un raccourci ».'],
    }[plate];
    modale(T('Installer sur mon téléphone'), function (boite) {
      var ol = el('ol', { style: 'padding-left:20px;display:grid;gap:8px;margin:0 0 12px;' }); etapes.forEach(function (t) { ol.appendChild(el('li', { text: t })); }); boite.appendChild(ol);
      boite.appendChild(el('p', { text: 'L’installation ajoute un raccourci sur l’écran d’accueil : l’application s’ouvre ensuite en plein écran, sans passer par un magasin d’applications.' }));
    });
  }
  function avisParMail() {
    location.href = 'mailto:contact@alphabette.fr?subject=' + encodeURIComponent('Avis sur ' + app.nom) + '&body=' + encodeURIComponent('Bonjour,\n\nMon avis sur ' + app.nom + ' :\n\n\n(Page : ' + location.href + ')');
  }
  // Retour en 3 touches, sans compte ni e-mail : alphabette.eu (le Laboratoire) l'enregistre ; ailleurs, repli sur l'e-mail.
  var surLabo = /(^|\.)alphabette\.eu$/.test(location.hostname) || local;
  function donnerAvis() {
    if (!surLabo) { avisParMail(); return; }
    modale('Votre retour', function (boite, clore) {
      var genre = '', info = el('p', { class: 'ab-note', role: 'status', 'aria-live': 'polite', style: 'margin:8px 0 0;font-size:14px;' });
      var CHOIX = [['Bug', '😕 Ça m’a bloqué', 'Qu’est-ce qui n’a pas marché ?'], ['Autre', '👍 Ça m’a été utile', 'Qu’est-ce qui vous a plu ? (facultatif)'], ['Idée', '💡 J’ai une idée', 'Quelle amélioration proposez-vous ?']];
      var rang = el('div', { class: 'ab-choix', style: 'grid-template-columns:1fr;' });
      var zone = el('textarea', { rows: '4', maxlength: '800', 'aria-label': 'Votre message', style: 'width:100%;font:inherit;font-size:16px;padding:10px;border:1px solid #94a3b8;border-radius:12px;margin-top:10px;background:transparent;color:inherit;' });
      var piege = el('input', { type: 'text', name: 'site_web', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', style: 'position:absolute;left:-9999px;' });
      var consigne = el('p', { class: 'ab-note', style: 'margin:10px 0 0;', text: 'Touchez un choix ci-dessus.' });
      CHOIX.forEach(function (c) {
        rang.appendChild(el('button', { type: 'button', class: 'ab-btn', 'aria-pressed': 'false', text: c[1], onclick: function (e) {
          genre = c[0]; Array.prototype.forEach.call(rang.children, function (b) { b.setAttribute('aria-pressed', 'false'); });
          e.currentTarget.setAttribute('aria-pressed', 'true'); consigne.textContent = c[2]; zone.focus();
        } }));
      });
      var envoyer = el('button', { type: 'button', class: 'ab-btn ab-btn--accent', text: 'Envoyer', onclick: function () {
        if (!genre) { info.textContent = 'Choisissez d’abord l’une des trois propositions.'; return; }
        var texte = zone.value.trim();
        if (genre !== 'Autre' && texte.length < 5) { info.textContent = 'Écrivez quelques mots pour que l’on comprenne.'; zone.focus(); return; }
        envoyer.disabled = true; info.textContent = 'Envoi…';
        var corps = { action: 'avis', app_id: app.cle, chemin: location.pathname, category: genre, comment: texte, version_tested: 'main', source: 'formulaire', site_web: piege.value,
          telemetry: { viewport: innerWidth + 'x' + innerHeight, platform: String(navigator.platform || '').slice(0, 40) } };
        if (genre === 'Autre') corps.rating = 5;
        fetch('/api/feedback.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || j.erreur || ''); }); })
          .then(function () { boite.textContent = ''; boite.appendChild(el('h2', { text: 'Merci !' })); boite.appendChild(el('p', { text: 'Votre retour est bien arrivé. Les corrections sont publiées au fil des jours.' }));
            var f = el('button', { type: 'button', class: 'ab-btn', text: T('Fermer'), onclick: clore }); boite.appendChild(f); f.focus(); })
          .catch(function (err) { envoyer.disabled = false; info.textContent = (err && err.message) || 'L’envoi a échoué. Réessayez, ou écrivez-nous par e-mail ci-dessous.'; });
      } });
      boite.appendChild(el('p', { text: 'Dites-nous en une touche ce qui s’est passé. Pas de compte, pas d’e-mail demandé : n’écrivez pas d’informations personnelles.' }));
      boite.appendChild(rang); boite.appendChild(consigne); boite.appendChild(zone); boite.appendChild(piege);
      var actions = el('div', { class: 'ab-modale__actions', style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;' });
      actions.appendChild(envoyer);
      actions.appendChild(el('button', { type: 'button', class: 'ab-btn', text: '✉️ Par e-mail', onclick: avisParMail }));
      boite.appendChild(actions); boite.appendChild(info);
    });
  }
  function panneauLangue() {
    modale(T('Langue'), function (boite, clore) {
      var choix = el('div', { class: 'ab-choix' });
      [['fr', '🇫🇷 Français'], ['en', '🇬🇧 English']].forEach(function (l) {
        choix.appendChild(el('button', { type: 'button', class: 'ab-btn', 'aria-pressed': String(langue === l[0]), text: l[1], onclick: function () { langue = l[0]; ecrirePrefs({ lang: langue }); clore(); reconstruire(); } }));
      });
      boite.appendChild(el('p', { text: 'Langue de la barre :' })); boite.appendChild(choix);
      boite.appendChild(el('p', { style: 'margin-top:14px;', text: 'Les applications sont écrites en français. Pour les lire en anglais, une traduction automatique par Google Traduction s’ouvre dans un nouvel onglet : la page lui est alors transmise, et vos données restent sur l’original.' }));
      var a = el('div', { class: 'ab-modale__actions' }, [el('a', { class: 'ab-btn ab-btn--accent', href: 'https://translate.google.com/translate?sl=fr&tl=en&u=' + encodeURIComponent(location.href), target: '_blank', rel: 'noopener noreferrer', text: '🌍 Open in English' })]);
      boite.appendChild(a);
    });
  }

  // ------------------------------------------------------------ Dons (virement, aucun paiement en ligne)
  function copierTexte(texte, bouton, libelle) {
    var avant = bouton.textContent;
    var ok = function () { bouton.textContent = 'Copié ✓'; setTimeout(function () { bouton.textContent = avant; }, 2200); };
    var secours = function () {
      try { var t = el('textarea', { style: 'position:fixed;opacity:0' }); t.value = texte; document.body.appendChild(t); t.select(); var r = document.execCommand('copy'); t.remove(); if (r) return ok(); } catch (e) {}
      bouton.textContent = 'Copie impossible : sélectionnez le texte';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(ok, secours); else secours();
  }
  function chargerConfig() {
    if (configHub) return Promise.resolve(configHub);
    return fetch(HUB + '/api/config.json').then(function (r) { return r.json(); }).then(function (c) { configHub = c; return c; }).catch(function () { return null; });
  }
  function ouvrirDon() {
    chargerConfig().then(function () {
      modale('♥ ' + T('Faire un don'), function (boite) {
        var don = configHub && configHub.donation, actions = el('div', { class: 'ab-modale__actions' });
        if (don && don.iban && !don.exemple) {
          boite.appendChild(el('p', { text: 'Le don se fait par virement depuis votre banque (SEPA, 0 % de frais). Aucun paiement n’a lieu sur ce site.' }));
          var dl = el('dl');
          [['Titulaire', don.titulaire], ['Banque', don.banque], ['Code banque', don.codeBanque], ['Code guichet', don.codeGuichet], ['N° de compte', don.numeroCompte], ['Clé RIB', don.cleRib], ['IBAN', don.iban], ['BIC', don.bic], ['Motif du virement', don.objetVirement]].forEach(function (l) { if (l[1]) { dl.appendChild(el('dt', { text: l[0] })); dl.appendChild(el('dd', { text: l[1] })); } });
          boite.appendChild(dl);
          var tout = ['Don à l’écosystème alphabette', don.titulaire && 'Titulaire : ' + don.titulaire, don.banque && 'Banque : ' + don.banque, 'IBAN : ' + don.iban, don.bic && 'BIC : ' + don.bic, don.objetVirement && 'Motif : ' + don.objetVirement].filter(Boolean).join('\n');
          var cIban = el('button', { type: 'button', class: 'ab-btn ab-btn--don', text: 'Copier l’IBAN' });
          cIban.addEventListener('click', function () { copierTexte(don.iban.replace(/\s/g, ''), cIban, 'IBAN'); });
          actions.appendChild(cIban);
          if (don.bic) { var cBic = el('button', { type: 'button', class: 'ab-btn', text: 'Copier le BIC' }); cBic.addEventListener('click', function () { copierTexte(don.bic, cBic, 'BIC'); }); actions.appendChild(cBic); }
          var cTout = el('button', { type: 'button', class: 'ab-btn', text: 'Copier tout le RIB' });
          cTout.addEventListener('click', function () { copierTexte(tout, cTout, 'tout le RIB'); });
          actions.appendChild(cTout);
          if (don.contact) actions.appendChild(el('a', { class: 'ab-btn', href: 'mailto:' + don.contact + '?subject=' + encodeURIComponent('Don alphabette') + '&body=' + encodeURIComponent('Bonjour,\n\nJe viens de faire un don par virement SEPA (motif : ' + (don.objetVirement || 'DON ALPHABETTE') + ').\n'), text: 'J’ai fait mon virement' }));
        } else {
          boite.appendChild(el('p', { text: 'Les coordonnées de don n’ont pas pu être chargées. Elles sont affichées sur alphabette.fr.' }));
          actions.appendChild(el('a', { class: 'ab-btn ab-btn--don', href: HUB, text: 'Aller sur alphabette.fr' }));
        }
        boite.appendChild(actions);
      });
    });
  }

  // ------------------------------------------------------------ Panneau « Mon inscription »
  function panneauMembre() {
    membre = lireMembre();
    modale(membre ? '👤 ' + membre.prenom : '🎟️ ' + T('S’inscrire avec un code'), function (boite) {
      var actions = el('div', { class: 'ab-modale__actions' });
      if (membre) {
        var depuis = ''; try { depuis = new Date(membre.depuis).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
        boite.appendChild(el('p', { text: (ROLES[membre.role] || 'Inscrit(e)') + (depuis ? ' · inscrit(e) le ' + depuis : '') }));
        boite.appendChild(el('p', { text: 'Inscription gratuite, sur invitation : toutes les applications alphabette vous reconnaissent sur cet appareil, et l’accès vous est offert.' }));
        boite.appendChild(el('p', { style: 'color:var(--ab-muted);font-size:14px;', text: 'Votre inscription est gardée dans ce navigateur, rien n’est envoyé à un serveur. Sur un autre appareil, entrez à nouveau votre code.' }));
        actions.appendChild(el('a', { class: 'ab-btn ab-btn--accent', href: INSCRIPTION, text: 'Gérer mon inscription' }));
      } else {
        boite.appendChild(el('p', { text: 'L’inscription est gratuite avec un code d’invitation. Une fois inscrit(e), toutes les applications alphabette vous reconnaissent sur cet appareil.' }));
        boite.appendChild(el('p', { style: 'color:var(--ab-muted);font-size:14px;', text: 'Pas de code ? Les applications s’utilisent librement en attendant.' }));
        actions.appendChild(el('a', { class: 'ab-btn ab-btn--accent', href: lienInscription(), text: '🎟️ M’inscrire avec un code' }));
      }
      boite.appendChild(actions);
    });
  }

  // ------------------------------------------------------------ Les deux barres
  var racine = null, favorisZone = null, menuOuvert = false, menuEl = null;
  function entreeMenu(emoji, mot, action, etat) {
    var b = el('button', { type: 'button', class: 'ab-menu__item', role: 'menuitem' }, [el('span', { class: 'ab-menu__emoji', 'aria-hidden': 'true', text: emoji }), el('span', { text: mot })]);
    if (etat !== undefined) b.setAttribute('aria-pressed', String(etat));
    b.addEventListener('click', function () { fermerMenu(); action(); });
    return b;
  }
  function majMenu() { if (menuOuvert) { fermerMenu(); ouvrirMenu(); } }
  function fermerMenu() { menuOuvert = false; if (menuEl) { menuEl.remove(); menuEl = null; } }
  function ouvrirMenu() {
    fermerMenu(); menuOuvert = true;
    var epingle = favoris.indexOf(app.cle) >= 0;
    menuEl = el('div', { class: 'ab-menu', role: 'menu' });
    menuEl.appendChild(entreeMenu(epingle ? '★' : '⭐', T(epingle ? 'Retirer de mes favoris' : 'Épingler cette appli'), function () { basculerFavori(app.cle || location.pathname); }, epingle));
    menuEl.appendChild(membre ? entreeMenu('👤', T('Mon inscription'), panneauMembre) : entreeMenu('🎟️', T('S’inscrire avec un code'), function () { location.href = lienInscription(); }));
    menuEl.appendChild(entreeMenu('🧘', T(simple ? 'Quitter le mode simple' : 'Mode simple'), function () { simple = !simple; ecrirePrefs({ simple: simple }); appliquerSimple(); }, simple));
    if (!dejaInstallee()) menuEl.appendChild(entreeMenu('📲', T('Installer sur mon téléphone'), installer));
    menuEl.appendChild(entreeMenu('💬', T('Donner mon avis'), donnerAvis));
    menuEl.appendChild(entreeMenu('🖨️', T('Imprimer'), function () { window.print(); }));
    menuEl.appendChild(entreeMenu('🌍', T('Langue'), panneauLangue));
    document.getElementById('ab-actions').appendChild(menuEl);
  }
  document.addEventListener('mousedown', function (e) { if (menuOuvert && racine && !document.getElementById('ab-actions').contains(e.target)) fermerMenu(); });
  document.addEventListener('touchstart', function (e) { if (menuOuvert && racine && !document.getElementById('ab-actions').contains(e.target)) fermerMenu(); }, { passive: true });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerMenu(); });

  function dessinerFavoris() {
    if (!favorisZone) return; favorisZone.textContent = '';
    favoris.forEach(function (cle) {
      var a = appsHub.filter(function (x) { return x.slug === cle; })[0]; if (!a || !a.url) return;
      favorisZone.appendChild(cle === app.cle ? el('span', { class: 'ab-site ab-site--actif', text: '★ ' + lisible(a.name) }) : el('a', { class: 'ab-site', href: a.url, text: '★ ' + lisible(a.name) }));
    });
  }
  /** Lien vers le Laboratoire d'Octet : jamais relatif depuis un autre domaine (on ne veut pas tomber sur une page inexistante de .fr). */
  function lienLabo() { return (/(^|\.)alphabette\.eu$/.test(location.hostname) || local) ? '/#idees' : 'https://alphabette.eu/#idees'; }
  /** Octet (la petite souris) : vraie illustration, sans image de remplacement : si elle ne charge pas, le libellé « Laboratoire » reste affiché. */
  function iconeOctet() {
    var base = (script && script.src) ? script.src.replace(/alphabette-barre\.js(\?.*)?$/, '') : 'https://alphabette.fr/assets/';
    var img = el('img', { class: 'ab-eco__octet', src: base + 'octet/octet-icone.webp', alt: '', width: '28', height: '28', decoding: 'async', 'aria-hidden': 'true' });
    img.onerror = function () { var a = img.parentNode; if (a) { a.classList.add('ab-eco__labo--txt'); a.removeChild(img); } };
    return img;
  }
  function tip(b, mot) { b.dataset.abTip = mot; b.setAttribute('aria-label', mot); return b; }

  function construire() {
    favorisZone = el('nav', { class: 'ab-eco__favoris', 'aria-label': T('Mes favoris') });
    var point = el('span', { class: 'ab-eco__point', id: 'ab-point', 'aria-hidden': 'true' }); point.hidden = true;
    var eco = el('div', { class: 'ab-eco' }, [
      tip(el('a', { class: 'ab-eco__logo', href: 'https://www.alphabette.fr' }, [el('span', { class: 'ab-eco__marque', 'aria-hidden': 'true', text: 'α' }), el('span', { text: 'alphabette' })]), T('Aller sur alphabette.fr')),
      tip(el('button', { type: 'button', class: 'ab-eco__icone', text: '▦', onclick: panneauApps }), T('Toutes les applis')),
      tip(el('button', { type: 'button', class: 'ab-eco__icone', onclick: panneauNouveautes }, [el('span', { text: '🆕' }), point]), T('Nouveautés')),
      // Laboratoire d'Octet : depuis alphabette.fr il mène à alphabette.eu (on y teste et on y contribue) ; sur .eu il ouvre la section d'idées.
      tip(el('a', { class: 'ab-eco__icone ab-eco__labo', href: lienLabo(), 'data-ab-labo': '' }, [iconeOctet(), el('span', { class: 'ab-eco__labo-txt', text: T('Laboratoire') })]), T('Laboratoire d’Octet : tester et proposer des idées')),
      favorisZone,
      el('div', { class: 'ab-eco__droite' }, [membre
        ? tip(el('button', { type: 'button', class: 'ab-abonner ab-abonner--membre', text: '👤 ' + membre.prenom, onclick: panneauMembre }), T('Mon inscription'))
        : el('a', { class: 'ab-abonner', href: HUB + '/#tarifs', text: '⭐ ' + T('S’abonner') })]),
    ]);
    var big = el('button', { type: 'button', class: 'ab-pico ab-pico--big', id: 'ab-big' }, [el('span', { text: 'BIG' }), el('span', { class: 'ab-density', 'aria-hidden': 'true' }, [el('span', { class: 'ab-density__bar' }), el('span', { class: 'ab-density__bar' }), el('span', { class: 'ab-density__bar' })])]);
    big.addEventListener('click', function () { indexTaille = (indexTaille + 1) % TAILLES.length; ecrirePrefs({ density: TAILLES[indexTaille].cle }); appliquerTaille(); cacherBulle(); montrerBulle(big, 1600); });
    var actions = el('div', { class: 'ab-bar__actions', id: 'ab-actions' }, [
      tip(el('button', { type: 'button', class: 'ab-pico ab-pico--don', text: '♥', onclick: ouvrirDon }), T('Faire un don')),
      big,
      el('button', { type: 'button', class: 'ab-pico', id: 'ab-theme', onclick: function (ev) {
        var suivant = theme === 'nuit' ? 'jour' : 'nuit';
        var faire = function () { theme = suivant; ecrirePrefs({ theme: theme }); appliquerTheme(true); };
        // Onde circulaire depuis le bouton (repli : fondu 300 ms ; Mode Calme : instantané).
        if (window.alphabetteEffets) window.alphabetteEffets.vagueTheme(ev.currentTarget, faire); else faire();
      } }),
    ]);
    actions.appendChild(el('button', { type: 'button', class: 'ab-pico', id: 'ab-lire', onclick: basculerLecture }));
    actions.appendChild(tip(el('button', { type: 'button', class: 'ab-pico', text: '⋯', 'aria-haspopup': 'true', onclick: function (e) { e.stopPropagation(); menuOuvert ? fermerMenu() : ouvrirMenu(); } }), T('Plus d’options')));
    // Même nom de transition que la carte cliquée sur le hub : la vignette « vole » jusqu'au titre (View Transitions).
    var vt = (app.cle || '').replace(/[^a-z0-9-]/gi, '');
    var titres = [el('span', vt ? { class: 'ab-bar__nom', text: app.nom, style: 'view-transition-name:vt-' + vt } : { class: 'ab-bar__nom', text: app.nom })]; if (app.sousTitre) titres.push(el('span', { class: 'ab-bar__sous', text: app.sousTitre }));
    var barre = el('div', { class: 'ab-bar' }, [el('div', { class: 'ab-bar__titres' }, titres), actions]);
    var r = el('div', { id: 'ab-barres' }); r.appendChild(eco); r.appendChild(barre);
    return r;
  }
  function reconstruire() { fermerMenu(); var neuf = construire(); racine.replaceWith(neuf); racine = neuf; appliquerTaille(); appliquerTheme(false); majLecture(); dessinerFavoris(); majPoint(); }

  function poser() {
    racine = construire(); document.body.insertBefore(racine, document.body.firstChild);
    // La marge par défaut du navigateur laisserait un liseré autour des barres ; une marge voulue par la page est compensée.
    if (getComputedStyle(document.body).marginTop === '8px') document.body.style.margin = '0';
    var cs = getComputedStyle(document.body);
    if (parseFloat(cs.paddingTop) || parseFloat(cs.paddingLeft) || parseFloat(cs.paddingRight)) racine.style.margin = '-' + cs.paddingTop + ' -' + cs.paddingRight + ' ' + cs.paddingTop + ' -' + cs.paddingLeft;
    appliquerTaille(); appliquerTheme(false); majLecture();
    // Hauteur des deux barres, pour les applications à hauteur d'écran fixe : height: calc(100dvh - var(--ab-hauteur, 0px)).
    function hauteur() {
      if (!racine) return;
      var r = document.documentElement;
      r.style.setProperty('--ab-hauteur-barres', racine.offsetHeight + 'px');
      r.style.setProperty('--ab-hauteur', r.dataset.abBarres === 'cachees' ? '0px' : racine.offsetHeight + 'px');
    }
    window.__abHauteur = hauteur;
    hauteur(); window.addEventListener('resize', hauteur);
    if (window.ResizeObserver) new ResizeObserver(hauteur).observe(document.body);
  }
  if (document.body) poser(); else document.addEventListener('DOMContentLoaded', poser);

  // ------------------------------------------------------------ Barres masquées au défilement
  // <script … data-masquer="defilement"> : en descendant dans le contenu, les barres remontent hors
  // de l'écran (toute la hauteur pour lire) ; elles reviennent dès qu'on remonte ou en haut de page.
  // L'appli peut masquer ses propres bandeaux avec html[data-ab-barres="cachees"] (événement alphabette:barres).
  if (d.masquer === 'defilement') {
    var derniers = new WeakMap(), pause = 0;
    function montrerBarres(cachees) {
      var r = document.documentElement, avant = r.dataset.abBarres === 'cachees';
      if (avant === cachees || (cachees && menuOuvert)) return;
      if (cachees) r.dataset.abBarres = 'cachees'; else delete r.dataset.abBarres;
      pause = Date.now() + 350; // le changement de hauteur provoque lui-même un défilement : on l'ignore
      if (window.__abHauteur) window.__abHauteur();
      window.dispatchEvent(new CustomEvent('alphabette:barres', { detail: { cachees: cachees } }));
    }
    document.addEventListener('scroll', function (e) {
      var cible = e.target === document ? document.scrollingElement || document.documentElement : e.target;
      if (!cible || !cible.clientHeight || (cible.closest && cible.closest('#ab-barres,.ab-modale-fond'))) return;
      // Seuls les grands blocs de lecture comptent (pas une liste déroulante ni un menu latéral étroit).
      if (cible !== document.scrollingElement && cible.clientHeight < window.innerHeight / (parseFloat(getComputedStyle(document.documentElement).zoom) || 1) * 0.45) return;
      var pos = cible.scrollTop, avant = derniers.has(cible) ? derniers.get(cible) : pos;
      derniers.set(cible, pos);
      if (Date.now() < pause) return;
      if (pos < 12) montrerBarres(false);
      else if (pos - avant > 6 && pos > 48) montrerBarres(true);
      else if (avant - pos > 10) montrerBarres(false);
    }, true);
  }
  function relireMembre() { var m = lireMembre(); if (JSON.stringify(m) !== JSON.stringify(membre)) { membre = m; if (racine) reconstruire(); } }
  window.addEventListener('focus', relireMembre);
  window.addEventListener('alphabette:membre', relireMembre);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) relireMembre(); });

  // ------------------------------------------------------------ Données du hub
  fetch(HUB + '/api/apps').then(function (r) { return r.json(); }).then(function (data) { appsHub = (data && data.apps) || []; dessinerFavoris(); majPoint(); }).catch(function () {});
  fetch(HUB + '/api/config.json').then(function (r) { return r.json(); }).then(function (cfg) { configHub = cfg; }).catch(function () {});
})();
