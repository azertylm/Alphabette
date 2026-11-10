/*
 * alphabette-barre.js — la double barre Alphabette pour les pages HTML simples.
 *
 * Les applications React utilisent la base commune (@alphabette/shell). Une page
 * HTML sans construction ajoute seulement cette ligne, juste après <body> :
 *
 *   <script src="https://alphabette.fr/assets/alphabette-barre.js"
 *           data-cle="kurate" data-nom="Kurate"
 *           data-sous-titre="Votre sélection du jour" data-accent="#4F46E5"></script>
 *
 * Barre 1 (écosystème) : ALPHABETTE · ♥ DON · applications · compteur · Pass.
 * Barre 2 (application) : nom + sous-titre · ♥ DON · BIG · Plein écran.
 *
 * BIG agrandit TOUTE la page (trois tailles), et le choix est gardé pour toutes
 * les pages servies par alphabette.fr. Applications, tarifs et coordonnées de don
 * viennent du hub (/api/apps, /api/config.json) : rien n'est écrit en dur ici.
 */
(function () {
  'use strict';
  if (window.__alphabetteBarre) return;
  window.__alphabetteBarre = true;

  var script = document.currentScript;
  var d = (script && script.dataset) || {};
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var HUB = local ? location.origin : 'https://alphabette.fr';
  var app = {
    cle: d.cle || '',
    nom: d.nom || document.title,
    sousTitre: d.sousTitre || '',
    accent: d.accent || '#2563eb',
  };

  // ------------------------------------------------------------------ BIG
  var TAILLES = [
    { cle: 'normal', zoom: 1, nom: 'normale' },
    { cle: 'grand', zoom: 1.25, nom: 'grande' },
    { cle: 'tres-grand', zoom: 1.5, nom: 'très grande' },
  ];
  var CLE_TAILLE = 'alphabette.barre.taille';
  function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }
  function ecrire(cle, v) { try { localStorage.setItem(cle, v); } catch (e) {} }
  var indexTaille = Math.max(0, TAILLES.findIndex(function (t) { return t.cle === lire(CLE_TAILLE); }));
  function appliquerTaille() {
    var t = TAILLES[indexTaille];
    // « zoom » agrandit textes, boutons et images ensemble, quelle que soit l'unité utilisée par la page.
    document.documentElement.style.zoom = t.zoom === 1 ? '' : String(t.zoom);
    document.documentElement.dataset.abTaille = t.cle;
    var b = document.getElementById('ab-big');
    if (b) {
      b.title = 'Taille d’affichage : ' + t.nom + ' (cliquer pour changer)';
      b.setAttribute('aria-label', 'BIG, taille d’affichage : ' + t.nom);
      b.querySelectorAll('.ab-density__bar').forEach(function (barre, i) {
        barre.classList.toggle('ab-density__bar--on', i <= indexTaille);
      });
    }
  }
  appliquerTaille(); // tout de suite, avant l'affichage, pour éviter un saut de taille

  // ------------------------------------------------------------------ Style
  var css = [
    '.ab-eco,.ab-bar,.ab-don-fond{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-sizing:border-box;line-height:1.2;}',
    '.ab-eco *,.ab-bar *,.ab-don-fond *{box-sizing:border-box;}',
    '.ab-eco{display:flex;align-items:center;gap:8px;min-height:44px;padding:4px 12px;background:color-mix(in oklab,var(--ab-accent) 32%,#0a1226);color:#e6ecf7;font-size:14px;overflow-x:auto;scrollbar-width:none;}',
    '.ab-eco::-webkit-scrollbar{display:none;}',
    '.ab-eco__brand{display:inline-flex;align-items:center;gap:6px;font-weight:800;letter-spacing:.02em;color:#fff;text-decoration:none;white-space:nowrap;}',
    '.ab-eco__brand-mark{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:var(--ab-accent);color:#fff;font-size:12px;font-weight:900;}',
    '.ab-eco__sites{display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none;flex:1 1 auto;min-width:0;}',
    '.ab-eco__sites::-webkit-scrollbar{display:none;}',
    '.ab-site{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;color:#b9c4da;text-decoration:none;white-space:nowrap;}',
    '.ab-site:hover,.ab-site:focus-visible{background:rgba(255,255,255,.14);color:#fff;}',
    '.ab-site--active{background:var(--ab-accent);color:#fff;font-weight:600;}',
    '.ab-eco__right{display:flex;align-items:center;gap:6px;margin-left:auto;white-space:nowrap;}',
    '.ab-counter{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.1);color:#e6ecf7;text-decoration:none;font-variant-numeric:tabular-nums;}',
    '.ab-counter:hover{background:rgba(255,255,255,.2);}',
    '.ab-btn{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:6px 12px;border:1px solid transparent;border-radius:999px;background:#f1f5f9;color:#0f172a;font:inherit;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;text-decoration:none;}',
    '.ab-btn:hover{background:#e2e8f0;}',
    '.ab-btn:focus-visible,.ab-site:focus-visible,.ab-eco__brand:focus-visible{outline:2px solid #fff;outline-offset:2px;}',
    '.ab-bar .ab-btn:focus-visible{outline-color:var(--ab-accent);}',
    '.ab-btn--don{background:#e11d5b;color:#fff;}.ab-btn--don:hover{background:#be184d;}',
    '.ab-btn--pass{background:#f5b50a;color:#3a2a00;}.ab-btn--pass:hover{background:#dba207;}',
    '.ab-btn--big{background:var(--ab-accent);color:#fff;font-weight:800;letter-spacing:.04em;}.ab-btn--big:hover{background:color-mix(in oklab,var(--ab-accent) 85%,#000);}',
    '.ab-bar{display:flex;align-items:center;gap:12px;padding:8px 12px;background:#fff;color:#0f172a;border-bottom:1px solid #e2e8f0;}',
    '.ab-bar__titles{display:flex;flex-direction:column;min-width:0;}',
    '.ab-bar__name{font-size:20px;font-weight:800;line-height:1.1;color:var(--ab-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.ab-bar__tagline{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.ab-bar__actions{display:flex;align-items:center;gap:6px;margin-left:auto;}',
    '.ab-density{display:inline-flex;align-items:flex-end;gap:2px;height:14px;}',
    '.ab-density__bar{width:4px;border-radius:1px;background:rgba(255,255,255,.4);}',
    '.ab-density__bar:nth-child(1){height:6px;}.ab-density__bar:nth-child(2){height:10px;}.ab-density__bar:nth-child(3){height:14px;}',
    '.ab-density__bar--on{background:#fff;}',
    '@media (prefers-color-scheme:dark){.ab-bar{background:#111a2e;color:#e2e8f0;border-color:#1e293b;}.ab-bar__tagline{color:#94a3b8;}.ab-bar__name{color:color-mix(in oklab,var(--ab-accent) 60%,#fff);}}',
    '@media (max-width:640px){.ab-eco__sites,.ab-counter,.ab-bar .ab-btn--don,.ab-plein{display:none;}.ab-eco{justify-content:space-between;}.ab-bar__name{font-size:18px;}}',
    '.ab-don-fond{position:fixed;inset:0;z-index:2147483000;background:rgba(2,6,23,.7);display:flex;align-items:center;justify-content:center;padding:16px;}',
    '.ab-don{background:#fff;color:#0f172a;border-radius:16px;max-width:460px;width:100%;max-height:90vh;overflow:auto;padding:20px;font-size:16px;}',
    '.ab-don h2{margin:0 0 8px;font-size:22px;}.ab-don p{margin:0 0 12px;line-height:1.5;}',
    '.ab-don dl{margin:0 0 12px;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;}.ab-don dt{color:#64748b;}.ab-don dd{margin:0;font-weight:700;word-break:break-word;}',
    '.ab-don__actions{display:flex;flex-wrap:wrap;gap:8px;}',
  ].join('\n');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ------------------------------------------------------------------ Barres
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  var sites = el('nav', { class: 'ab-eco__sites', 'aria-label': 'Autres applications Alphabette' });
  var compteur = el('a', { class: 'ab-counter', href: HUB + '/#nos-applications', title: 'Voir toutes les applications', text: 'Les applis' });
  var pass = el('a', { class: 'ab-btn ab-btn--pass', href: HUB + '/#tarifs', title: 'Voir l’offre', text: '⭐ Pass' });
  function boutonDon() {
    var b = el('button', { type: 'button', class: 'ab-btn ab-btn--don', title: 'Soutenir le projet', text: '♥ DON' });
    b.addEventListener('click', ouvrirDon);
    return b;
  }

  var eco = el('div', { class: 'ab-eco' }, [
    el('a', { class: 'ab-eco__brand', href: HUB, title: 'alphabette.fr, toutes les applications' }, [
      el('span', { class: 'ab-eco__brand-mark', 'aria-hidden': 'true', text: 'α' }),
      el('span', { text: 'ALPHABETTE' }),
    ]),
    boutonDon(),
    sites,
    el('div', { class: 'ab-eco__right' }, [compteur, pass]),
  ]);

  var big = el('button', { type: 'button', class: 'ab-btn ab-btn--big', id: 'ab-big' }, [
    el('span', { text: 'BIG' }),
    el('span', { class: 'ab-density', 'aria-hidden': 'true' }, [
      el('span', { class: 'ab-density__bar' }), el('span', { class: 'ab-density__bar' }), el('span', { class: 'ab-density__bar' }),
    ]),
  ]);
  big.addEventListener('click', function () {
    indexTaille = (indexTaille + 1) % TAILLES.length;
    ecrire(CLE_TAILLE, TAILLES[indexTaille].cle);
    appliquerTaille();
  });

  var plein = el('button', { type: 'button', class: 'ab-btn ab-plein', title: 'Afficher en plein écran', text: '⛶ Plein écran' });
  plein.addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });
  if (!document.documentElement.requestFullscreen) plein.style.display = 'none';

  var titres = [el('span', { class: 'ab-bar__name', text: app.nom })];
  if (app.sousTitre) titres.push(el('span', { class: 'ab-bar__tagline', text: app.sousTitre }));
  var barre = el('div', { class: 'ab-bar' }, [
    el('div', { class: 'ab-bar__titles' }, titres),
    el('div', { class: 'ab-bar__actions' }, [boutonDon(), big, plein]),
  ]);

  var racine = el('div', { id: 'ab-barres', style: '--ab-accent:' + app.accent });
  racine.appendChild(eco);
  racine.appendChild(barre);
  function poser() {
    document.body.insertBefore(racine, document.body.firstChild);
    // Si la page donne une marge intérieure à <body>, les barres restent quand même bord à bord.
    // La marge par défaut du navigateur (8 px) laisserait un liseré autour des barres.
    if (getComputedStyle(document.body).marginTop === '8px') document.body.style.margin = '0';
    var cs = getComputedStyle(document.body);
    if (parseFloat(cs.paddingTop) || parseFloat(cs.paddingLeft) || parseFloat(cs.paddingRight)) {
      racine.style.margin = '-' + cs.paddingTop + ' -' + cs.paddingRight + ' ' + cs.paddingTop + ' -' + cs.paddingLeft;
    }
    appliquerTaille();
  }
  if (document.body) poser(); else document.addEventListener('DOMContentLoaded', poser);

  // ------------------------------------------------------------------ Données du hub
  var don = null;
  fetch(HUB + '/api/apps').then(function (r) { return r.json(); }).then(function (data) {
    var apps = (data && data.apps) || [];
    if (!apps.length) return;
    compteur.textContent = apps.length + ' applis';
    apps.slice().sort(function (a, b) { return (b.badge === 'Populaire') - (a.badge === 'Populaire'); }).slice(0, 6).forEach(function (a) {
      if (!a.url || !/^https?:\/\//.test(a.url)) return;
      var courant = a.slug === app.cle || a.id === app.cle;
      var nom = a.name.charAt(0) + a.name.slice(1).toLowerCase();
      sites.appendChild(courant
        ? el('span', { class: 'ab-site ab-site--active', 'aria-current': 'page', text: nom })
        : el('a', { class: 'ab-site', href: a.url, text: nom }));
    });
  }).catch(function () {});
  fetch(HUB + '/api/config.json').then(function (r) { return r.json(); }).then(function (cfg) {
    don = cfg && cfg.donation;
    var prix = cfg && cfg.pricing && cfg.pricing.ecosystem;
    if (prix) pass.textContent = '⭐ Pass ' + prix + ' €/an';
  }).catch(function () {});

  // ------------------------------------------------------------------ Dons (virement, aucun paiement en ligne)
  function ouvrirDon() {
    var fond = el('div', { class: 'ab-don-fond', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Soutenir Alphabette' });
    var boite = el('div', { class: 'ab-don' });
    boite.appendChild(el('h2', { text: '♥ Soutenir Alphabette' }));
    var fermer = el('button', { type: 'button', class: 'ab-btn', text: 'Fermer' });
    function clore() { fond.remove(); document.removeEventListener('keydown', echap); }
    function echap(e) { if (e.key === 'Escape') clore(); }
    fermer.addEventListener('click', clore);
    fond.addEventListener('click', function (e) { if (e.target === fond) clore(); });
    document.addEventListener('keydown', echap);

    var actions = el('div', { class: 'ab-don__actions' });
    if (don && don.iban && !don.exemple) {
      boite.appendChild(el('p', { text: 'Le don se fait par virement depuis votre banque. Aucun paiement n’a lieu sur ce site.' }));
      var dl = el('dl');
      [['Titulaire', don.titulaire], ['IBAN', don.iban], ['BIC', don.bic], ['Motif', don.objetVirement]].forEach(function (l) {
        if (!l[1]) return;
        dl.appendChild(el('dt', { text: l[0] }));
        dl.appendChild(el('dd', { text: l[1] }));
      });
      boite.appendChild(dl);
      var copier = el('button', { type: 'button', class: 'ab-btn ab-btn--don', text: 'Copier l’IBAN' });
      copier.addEventListener('click', function () {
        (navigator.clipboard ? navigator.clipboard.writeText(don.iban.replace(/\s/g, '')) : Promise.reject())
          .then(function () { copier.textContent = 'IBAN copié'; }, function () { copier.textContent = 'Copie impossible ici'; });
      });
      actions.appendChild(copier);
    } else {
      boite.appendChild(el('p', { text: 'Les coordonnées de don sont affichées sur alphabette.fr.' }));
      actions.appendChild(el('a', { class: 'ab-btn ab-btn--don', href: HUB, text: 'Aller sur alphabette.fr' }));
    }
    actions.appendChild(fermer);
    boite.appendChild(actions);
    fond.appendChild(boite);
    document.body.appendChild(fond);
    fermer.focus();
  }
})();
