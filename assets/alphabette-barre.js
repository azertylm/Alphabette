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
  var app = { cle: d.cle || '', nom: d.nom || document.title, sousTitre: d.sousTitre || '', accent: d.accent || '#2563eb' };

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
    'Aller sur alphabette.fr': 'Go to alphabette.fr', 'Toutes les applis': 'All apps', 'Nouveautés': 'What’s new', 'S’abonner': 'Subscribe',
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
    '.ab-eco{display:flex;align-items:center;gap:8px;min-height:44px;padding:4px 10px;background:var(--ab-eco);color:#e6ecf7;font-size:14px;overflow-x:auto;scrollbar-width:none;}',
    '.ab-eco::-webkit-scrollbar{display:none;}',
    '.ab-eco__logo{display:inline-flex;align-items:center;gap:5px;color:#fff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.03em;white-space:nowrap;opacity:.92;}',
    '.ab-eco__logo:hover{opacity:1;text-decoration:underline;}',
    '.ab-eco__marque{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:999px;background:var(--ab-accent);color:#fff;font-size:10px;font-weight:900;}',
    '.ab-eco__icone{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 6px;border:0;border-radius:999px;background:rgba(255,255,255,.13);color:#fff;font:inherit;font-size:17px;line-height:1;cursor:pointer;}',
    '.ab-eco__icone:hover{background:rgba(255,255,255,.25);}',
    '.ab-eco__point{position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:999px;background:#ef4444;border:2px solid #0a1226;}',
    '.ab-eco__favoris{display:flex;align-items:center;gap:4px;min-width:0;}',
    '.ab-site{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;color:#cdd6ea;text-decoration:none;white-space:nowrap;font-size:13px;}',
    '.ab-site:hover{background:rgba(255,255,255,.16);color:#fff;}.ab-site--actif{background:var(--ab-accent);color:#fff;font-weight:700;}',
    '.ab-eco__droite{display:flex;align-items:center;margin-left:auto;}',
    '.ab-abonner{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:0 14px;border:0;border-radius:999px;background:#f5b50a;color:#3a2a00;font:inherit;font-size:13px;font-weight:800;white-space:nowrap;cursor:pointer;text-decoration:none;}',
    '.ab-abonner:hover{background:#dba207;}',
    '.ab-bar{position:relative;display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--ab-bar-fond);color:var(--ab-bar-encre);border-bottom:1px solid var(--ab-bar-trait);}',
    '.ab-bar__titres{display:flex;flex-direction:column;min-width:0;}',
    '.ab-bar__nom{font-size:20px;font-weight:800;line-height:1.1;color:var(--ab-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    ':root[data-ab-theme="nuit"] .ab-bar__nom{color:color-mix(in oklab,var(--ab-accent) 55%,#fff);}',
    '.ab-bar__sous{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ab-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.ab-bar__actions{display:flex;align-items:center;gap:6px;margin-left:auto;position:relative;}',
    '.ab-pico{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:38px;height:38px;padding:0 8px;border:1px solid var(--ab-bar-trait);border-radius:12px;background:var(--ab-chip);color:var(--ab-bar-encre);font:inherit;font-size:19px;font-weight:800;line-height:1;cursor:pointer;}',
    '.ab-pico:hover{background:var(--ab-chip-h);}',
    '.ab-pico--don{background:#e11d5b;border-color:transparent;color:#fff;}.ab-pico--don:hover{background:#be184d;}',
    '.ab-pico--big{background:var(--ab-accent);border-color:transparent;color:#fff;font-size:14px;letter-spacing:.04em;}.ab-pico--big:hover{background:color-mix(in oklab,var(--ab-accent) 85%,#000);}',
    '.ab-pico--actif{background:var(--ab-accent);border-color:transparent;color:#fff;}',
    '#ab-barres button:focus-visible,#ab-barres a:focus-visible,.ab-modale button:focus-visible,.ab-modale a:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px var(--ab-accent);}',
    '.ab-density{display:inline-flex;align-items:flex-end;gap:2px;height:14px;}',
    '.ab-density__bar{width:4px;border-radius:1px;background:rgba(255,255,255,.4);}',
    '.ab-density__bar:nth-child(1){height:6px;}.ab-density__bar:nth-child(2){height:10px;}.ab-density__bar:nth-child(3){height:14px;}',
    '.ab-density__bar--on{background:#fff;}',
    '.ab-menu{position:absolute;top:calc(100% + 8px);right:0;z-index:70;width:min(340px,calc(100vw - 16px));padding:10px;border:1px solid var(--ab-bar-trait);border-radius:16px;background:var(--ab-bar-fond);box-shadow:0 18px 50px rgba(0,0,0,.35);display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
    '.ab-menu__item{display:flex;align-items:center;gap:9px;min-height:52px;padding:8px 10px;border:1px solid var(--ab-bar-trait);border-radius:12px;background:var(--ab-chip);color:var(--ab-bar-encre);font:inherit;font-size:14px;font-weight:700;line-height:1.15;text-align:left;cursor:pointer;}',
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
  function decouper(t) {
    var ph = t.replace(/\s+/g, ' ').match(/[^.!?…:;]+[.!?…:;]?\s*/g) || [t], out = [];
    ph.forEach(function (p) { var r = p.trim(); while (r.length > 200) { var c = r.lastIndexOf(' ', 200); c = c > 40 ? c : 200; out.push(r.slice(0, c)); r = r.slice(c).trim(); } if (r) out.push(r); });
    return out;
  }
  function majLecture() { var b = document.getElementById('ab-lire'); if (!b) return; b.textContent = lectureEnCours ? '⏹️' : '🔊'; b.classList.toggle('ab-pico--actif', lectureEnCours); var m = T(lectureEnCours ? 'Arrêter la lecture' : 'Lire à voix haute'); b.dataset.abTip = m; b.setAttribute('aria-label', m); }
  function basculerLecture() {
    if (lectureEnCours) { jeton++; speechSynthesis.cancel(); lectureEnCours = false; return majLecture(); }
    var zone = document.querySelector('main') || document.body;
    var barres = document.getElementById('ab-barres'); var phrases = decouper((zone.innerText || '').slice(0, 30000));
    if (barres && zone === document.body) phrases = decouper((zone.innerText || '').replace(barres.innerText || '', '').slice(0, 30000));
    if (!phrases.length) return;
    speechSynthesis.cancel(); var moi = ++jeton; lectureEnCours = true; majLecture();
    (function suivante(i) {
      if (jeton !== moi) return; if (i >= phrases.length) { lectureEnCours = false; return majLecture(); }
      var u = new SpeechSynthesisUtterance(phrases[i]); u.lang = langue === 'en' ? 'en-GB' : 'fr-FR'; u.rate = 0.95;
      u.onend = function () { suivante(i + 1); }; u.onerror = function () { if (jeton === moi) { lectureEnCours = false; majLecture(); } };
      speechSynthesis.speak(u);
    })(0);
  }
  window.addEventListener('pagehide', function () { if ('speechSynthesis' in window) speechSynthesis.cancel(); });

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
  function donnerAvis() {
    location.href = 'mailto:contact@alphabette.fr?subject=' + encodeURIComponent('Avis sur ' + app.nom) + '&body=' + encodeURIComponent('Bonjour,\n\nMon avis sur ' + app.nom + ' :\n\n\n(Page : ' + location.href + ')');
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
  function ouvrirDon() {
    modale('♥ ' + T('Faire un don'), function (boite) {
      var don = configHub && configHub.donation, actions = el('div', { class: 'ab-modale__actions' });
      if (don && don.iban && !don.exemple) {
        boite.appendChild(el('p', { text: 'Le don se fait par virement depuis votre banque. Aucun paiement n’a lieu sur ce site.' }));
        var dl = el('dl'); [['Titulaire', don.titulaire], ['IBAN', don.iban], ['BIC', don.bic], ['Motif', don.objetVirement]].forEach(function (l) { if (l[1]) { dl.appendChild(el('dt', { text: l[0] })); dl.appendChild(el('dd', { text: l[1] })); } });
        boite.appendChild(dl);
        var copier = el('button', { type: 'button', class: 'ab-btn ab-btn--don', text: 'Copier l’IBAN' });
        copier.addEventListener('click', function () { (navigator.clipboard ? navigator.clipboard.writeText(don.iban.replace(/\s/g, '')) : Promise.reject()).then(function () { copier.textContent = 'IBAN copié'; }, function () { copier.textContent = 'Copie impossible ici'; }); });
        actions.appendChild(copier);
      } else {
        boite.appendChild(el('p', { text: 'Les coordonnées de don sont affichées sur alphabette.fr.' }));
        actions.appendChild(el('a', { class: 'ab-btn ab-btn--don', href: HUB, text: 'Aller sur alphabette.fr' }));
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
  function tip(b, mot) { b.dataset.abTip = mot; b.setAttribute('aria-label', mot); return b; }

  function construire() {
    favorisZone = el('nav', { class: 'ab-eco__favoris', 'aria-label': T('Mes favoris') });
    var point = el('span', { class: 'ab-eco__point', id: 'ab-point', 'aria-hidden': 'true' }); point.hidden = true;
    var eco = el('div', { class: 'ab-eco' }, [
      tip(el('a', { class: 'ab-eco__logo', href: 'https://www.alphabette.fr' }, [el('span', { class: 'ab-eco__marque', 'aria-hidden': 'true', text: 'α' }), el('span', { text: 'alphabette' })]), T('Aller sur alphabette.fr')),
      tip(el('button', { type: 'button', class: 'ab-eco__icone', text: '▦', onclick: panneauApps }), T('Toutes les applis')),
      tip(el('button', { type: 'button', class: 'ab-eco__icone', onclick: panneauNouveautes }, [el('span', { text: '🆕' }), point]), T('Nouveautés')),
      favorisZone,
      el('div', { class: 'ab-eco__droite' }, [el('a', { class: 'ab-abonner', href: HUB + '/#tarifs', text: '⭐ ' + T('S’abonner') })]),
    ]);
    var big = el('button', { type: 'button', class: 'ab-pico ab-pico--big', id: 'ab-big' }, [el('span', { text: 'BIG' }), el('span', { class: 'ab-density', 'aria-hidden': 'true' }, [el('span', { class: 'ab-density__bar' }), el('span', { class: 'ab-density__bar' }), el('span', { class: 'ab-density__bar' })])]);
    big.addEventListener('click', function () { indexTaille = (indexTaille + 1) % TAILLES.length; ecrirePrefs({ density: TAILLES[indexTaille].cle }); appliquerTaille(); cacherBulle(); montrerBulle(big, 1600); });
    var actions = el('div', { class: 'ab-bar__actions', id: 'ab-actions' }, [
      tip(el('button', { type: 'button', class: 'ab-pico ab-pico--don', text: '♥', onclick: ouvrirDon }), T('Faire un don')),
      big,
      el('button', { type: 'button', class: 'ab-pico', id: 'ab-theme', onclick: function () { theme = theme === 'nuit' ? 'jour' : 'nuit'; ecrirePrefs({ theme: theme }); appliquerTheme(true); } }),
    ]);
    if ('speechSynthesis' in window) actions.appendChild(el('button', { type: 'button', class: 'ab-pico', id: 'ab-lire', onclick: basculerLecture }));
    actions.appendChild(tip(el('button', { type: 'button', class: 'ab-pico', text: '⋯', 'aria-haspopup': 'true', onclick: function (e) { e.stopPropagation(); menuOuvert ? fermerMenu() : ouvrirMenu(); } }), T('Plus d’options')));
    var titres = [el('span', { class: 'ab-bar__nom', text: app.nom })]; if (app.sousTitre) titres.push(el('span', { class: 'ab-bar__sous', text: app.sousTitre }));
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
    function hauteur() { if (racine) document.documentElement.style.setProperty('--ab-hauteur', racine.offsetHeight + 'px'); }
    hauteur(); window.addEventListener('resize', hauteur);
    if (window.ResizeObserver) new ResizeObserver(hauteur).observe(document.body);
  }
  if (document.body) poser(); else document.addEventListener('DOMContentLoaded', poser);

  // ------------------------------------------------------------ Données du hub
  fetch(HUB + '/api/apps').then(function (r) { return r.json(); }).then(function (data) { appsHub = (data && data.apps) || []; dessinerFavoris(); majPoint(); }).catch(function () {});
  fetch(HUB + '/api/config.json').then(function (r) { return r.json(); }).then(function (cfg) { configHub = cfg; }).catch(function () {});
})();
