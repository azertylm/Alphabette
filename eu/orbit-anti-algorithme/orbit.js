/**
 * ORBIT — cœur « anti-algorithme » (alphabette.eu/orbit/).
 * Sans compte, sans pub, sans traceur, sans dépendance. Tout ce qui concerne le visiteur reste dans son navigateur.
 *
 *  localStorage  orbit_prefs    { themes[], bulle_decouverte, filtre_duree, sans_son }
 *                orbit_imports  [{ id, vertical, ajoute_le }]            (ses « mises en orbite »)
 *                orbit_fiches   { id: { f: fiche, a: analyse, t } }      (cache des fiches et analyses)
 *  sessionStorage orbit_session { mode, ecoule_ms, limite_ms, limite_vues, vues, terminee }
 *
 * Relais : api/orbit.php (fiches, miniatures servies depuis alphabette.eu, analyse IA gratuite et mise en cache).
 */

const API = '../api/orbit.php';
const CLE_OPENROUTER_VISITEUR = 'iadebat_openrouter_key';   // connexion OpenRouter 1 clic d'IA Débat (même site)
const PLATEFORMES = {
  youtube: { nom: 'YouTube', icone: '▶️', rang: 0 },
  tiktok: { nom: 'TikTok', icone: '🎵', rang: 1 },
  instagram: { nom: 'Instagram', icone: '📸', rang: 2 },
  facebook: { nom: 'Facebook', icone: '📘', rang: 3 },
};
const TONS = { drole: '😄 Drôle', educatif: '🎓 Éducatif', debat: '⚖️ Débat', inspirant: '✨ Inspirant' };
const LANGUES = { fr: 'Français', en: 'Anglais', es: 'Espagnol', de: 'Allemand', it: 'Italien', pt: 'Portugais', ja: 'Japonais' };
const PAR_PAGE = 12;

/* ───────────── petits outils ───────────── */

const $ = (s, r = document) => r.querySelector(s);
function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'texte') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat()) if (e !== null && e !== undefined && e !== false) n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  return n;
}
function lire(stock, cle, defaut) { try { const v = JSON.parse(stock.getItem(cle)); return v ?? defaut; } catch { return defaut; } }
function ecrire(stock, cle, v) { try { stock.setItem(cle, JSON.stringify(v)); } catch { /* stockage plein ou interdit : ORBIT continue */ } }
function duree(s) {
  if (s === null || s === undefined) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
function normaliser(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/#\w+/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}
function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 99;
  let n = 0;
  for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { n += x & 1; x >>= 1; } }
  return n;
}
function aleatoire(graine) {   // générateur déterministe : l'ordre ne change pas pendant la session
  let s = graine >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function melanger(l, hasard) { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(hasard() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ───────────── état ───────────── */

const prefs = Object.assign({ themes: [], bulle_decouverte: 30, filtre_duree: '', sans_son: false }, lire(localStorage, 'orbit_prefs', {}));
const sauverPrefs = () => ecrire(localStorage, 'orbit_prefs', prefs);
let imports = lire(localStorage, 'orbit_imports', []);
const cacheLocal = lire(localStorage, 'orbit_fiches', {});
let ORBITES = [];
const videos = new Map();   // id → { id, origine, orbite_indicative, vertical, ajoute_le, fiche, analyse }
let ongletActif = 'flux';
let combien = PAR_PAGE;
let graine = lire(sessionStorage, 'orbit_graine', 0) || (Date.now() & 0x7fffffff);
ecrire(sessionStorage, 'orbit_graine', graine);
let session = lire(sessionStorage, 'orbit_session', null);
let doublons = new Map();   // id masqué → id gardé
let sante = { ia: false, youtube_api: false };

function sauverCache() {
  const ids = Object.keys(cacheLocal);
  if (ids.length > 400) ids.sort((a, b) => (cacheLocal[a].t || 0) - (cacheLocal[b].t || 0)).slice(0, ids.length - 400).forEach((id) => delete cacheLocal[id]);
  ecrire(localStorage, 'orbit_fiches', cacheLocal);
}
function memoriser(id, champ, valeur) {
  const v = videos.get(id); if (v) v[champ === 'f' ? 'fiche' : 'analyse'] = valeur;
  cacheLocal[id] = Object.assign(cacheLocal[id] || {}, { [champ]: valeur, t: Date.now() });
  sauverCache();
}

function ajouterVideo(id, extra) {
  const c = cacheLocal[id] || {};
  const v = Object.assign({ id, fiche: c.f || null, analyse: c.a || null, vertical: false }, videos.get(id) || {}, extra);
  if (v.fiche?.vertical) v.vertical = true;
  videos.set(id, v);
  return v;
}

const PREFIXES = { yt: 'youtube', tt: 'tiktok', ig: 'instagram', fb: 'facebook' };
const plateformeDe = (v) => v.fiche?.plateforme || PREFIXES[v.id.slice(0, 2)];
const orbiteDe = (v) => v.analyse?.orbite || v.orbite_indicative || null;
const titreDe = (v) => v.analyse?.titre_propre || v.fiche?.titre || '';
const dureeDe = (v) => (v.fiche && Number.isFinite(v.fiche.duree_s) ? v.fiche.duree_s : null);
function formatDe(v) {
  const d = dureeDe(v);
  if (d === null) return 'inconnu';
  if (d < 60) return 'express';
  if (d >= 180 && d <= 600) return 'pause_cafe';
  if (d > 1200) return 'documentaire';
  return 'moyen';
}
const sansSonDe = (v) => v.analyse?.sans_son === true || (v.analyse?.sans_son !== false && v.fiche?.sous_titres === true);

/* ───────────── relais ───────────── */

async function appeler(url, options) {
  const r = await fetch(url, Object.assign({ headers: { Accept: 'application/json' }, cache: 'no-store' }, options));
  let d = {};
  try { d = await r.json(); } catch { /* réponse vide */ }
  if (!r.ok) { const e = new Error(d.erreur || `Erreur ${r.status}`); e.statut = r.status; e.donnees = d; throw e; }
  return d;
}

async function chargerFiches(ids, essai = 0) {
  for (let i = 0; i < ids.length; i += 20) {
    const lot = ids.slice(i, i + 20);
    const vert = lot.filter((id) => videos.get(id)?.vertical);
    try {
      const { fiches = [] } = await appeler(`${API}?metas=${encodeURIComponent(lot.join(','))}&verticales=${encodeURIComponent(vert.join(','))}`);
      const reste = [];
      for (const f of fiches) {
        if (!f || !f.id) continue;
        if (f.attente || f.erreur) { reste.push(f.id); continue; }
        memoriser(f.id, 'f', f);
        rafraichirCarte(f.id);
      }
      if (reste.length && essai < 3) setTimeout(() => chargerFiches(reste, essai + 1), 1500 * (essai + 1));
    } catch { /* hors ligne : les fiches en cache suffisent */ }
    calculerDoublons();
  }
  if (!lecteur) afficher();
}

/** IA de secours dans le navigateur, avec la clé OpenRouter du visiteur (jamais envoyée à Alphabette). */
async function iaVisiteur(consigne) {
  const cle = (() => { try { return localStorage.getItem(CLE_OPENROUTER_VISITEUR) || ''; } catch { return ''; } })();
  if (!cle || !consigne) return null;
  const modeles = ['meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-small-3.2-24b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'];
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json', 'X-Title': 'ORBIT - Alphabette' },
      body: JSON.stringify({ model: modeles[0], models: modeles, temperature: 0.2, max_tokens: 700,
        messages: [{ role: 'system', content: consigne.systeme }, { role: 'user', content: consigne.prompt }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const t = String(d.choices?.[0]?.message?.content || '');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    return { json: JSON.parse(t.slice(a, b + 1)), modele: d.model || modeles[0] };
  } catch { return null; }
}

function nettoyerAnalyse(j, modele) {
  const orb = ORBITES.some((o) => o.slug === j.orbite) ? j.orbite : null;
  return {
    titre_propre: typeof j.titre_propre === 'string' ? j.titre_propre.slice(0, 90) : null,
    langue: /^[a-z]{2}$/.test(j.langue || '') ? j.langue : null,
    orbite: orb, ton: TONS[j.ton] ? j.ton : null,
    sujets: Array.isArray(j.sujets) ? j.sujets.filter((s) => typeof s === 'string').slice(0, 4) : [],
    actu_debat: j.actu_debat === true, sans_son: typeof j.sans_son === 'boolean' ? j.sans_son : null,
    resume: typeof j.resume === 'string' ? j.resume.slice(0, 220) : null,
    modele, source: 'titre et description', local: true,
  };
}

let iaEnPauseJusqua = 0;
const fileIA = [];
const tentes = new Set();
let iaOccupee = false;

function demanderAnalyse(id, prioritaire = false) {
  const v = videos.get(id);
  if (!v || v.analyse || tentes.has(id) || !v.fiche || v.fiche.echec) return;
  if (prioritaire) fileIA.unshift(id); else if (!fileIA.includes(id)) fileIA.push(id);
  traiterFileIA();
}

async function analyser(id) {
  try {
    const { analyse } = await appeler(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyser', id }) });
    return analyse;
  } catch (e) {
    if (e.statut === 429 || e.statut === 503) {
      const r = await iaVisiteur(e.donnees?.consigne);
      if (r) return nettoyerAnalyse(r.json, r.modele);
      iaEnPauseJusqua = Date.now() + 90_000;
    }
    return null;
  }
}

async function traiterFileIA() {
  if (iaOccupee || !fileIA.length) return;
  if (Date.now() < iaEnPauseJusqua) { setTimeout(traiterFileIA, iaEnPauseJusqua - Date.now() + 50); return; }
  iaOccupee = true;
  const id = fileIA.shift();
  tentes.add(id);
  const a = await analyser(id);
  if (a) { memoriser(id, 'a', a); calculerDoublons(); rafraichirCarte(id); }
  else tentes.delete(id);   // on réessaiera plus tard
  iaOccupee = false;
  if (!a && Date.now() < iaEnPauseJusqua) return setTimeout(traiterFileIA, 90_000);
  traiterFileIA();
}

/* ───────────── doublons (même vidéo republiée sur TikTok, Shorts, Reels…) ───────────── */

function memeVideo(a, b) {
  const da = dureeDe(a), db = dureeDe(b);
  const dureesProches = da === null || db === null || Math.abs(da - db) <= 2;
  if (!dureesProches) return false;
  const ta = normaliser(a.fiche?.titre), tb = normaliser(b.fiche?.titre);
  if (ta.length >= 12 && ta === tb) return true;
  const pa = normaliser(a.analyse?.titre_propre), pb = normaliser(b.analyse?.titre_propre);
  if (pa.length >= 12 && pa === pb && da !== null && db !== null) return true;
  return hamming(a.fiche?.empreinte_image, b.fiche?.empreinte_image) <= 6 && (da !== null && db !== null);
}
const meilleure = (a, b) => {
  const r = (v) => (PLATEFORMES[plateformeDe(v)]?.rang ?? 9) + (v.fiche?.integrable === false ? 10 : 0);
  return r(a) <= r(b) ? a : b;
};
function calculerDoublons() {
  doublons = new Map();
  const l = [...videos.values()].filter((v) => v.fiche && !v.fiche.echec);
  for (let i = 0; i < l.length; i++) {
    for (let j = i + 1; j < l.length; j++) {
      if (doublons.has(l[i].id) || doublons.has(l[j].id)) continue;
      if (!memeVideo(l[i], l[j])) continue;
      const garde = meilleure(l[i], l[j]);
      const masque = garde === l[i] ? l[j] : l[i];
      doublons.set(masque.id, garde.id);
    }
  }
}
function doublonDe(id) {
  const v = videos.get(id);
  if (!v?.fiche) return null;
  for (const autre of videos.values()) if (autre.id !== id && autre.fiche && memeVideo(v, autre)) return meilleure(v, autre) === v ? null : autre;
  return null;
}

/* ───────────── composition du flux (sans algorithme : vos règles, visibles) ───────────── */

function filtrer(l) {
  return l.filter((v) => {
    if (doublons.has(v.id) || v.fiche?.echec || v.fiche?.integrable === false) return false;
    if (prefs.filtre_duree && formatDe(v) !== prefs.filtre_duree) return false;
    if (prefs.sans_son && !sansSonDe(v)) return false;
    return true;
  });
}

function composer() {
  const hasard = aleatoire(graine);
  const tous = filtrer([...videos.values()]);
  if (ongletActif !== 'flux') return { liste: melanger(tous.filter((v) => orbiteDe(v) === ongletActif), hasard), info: '' };
  const themes = new Set(prefs.themes);
  const ajouts = tous.filter((v) => v.origine === 'import').sort((a, b) => (b.ajoute_le || '').localeCompare(a.ajoute_le || ''));
  const reste = tous.filter((v) => v.origine !== 'import');
  if (!themes.size) return { liste: [...ajouts, ...melanger(reste, hasard)], info: 'Choisissez vos orbites (bouton ⏳ en haut) pour que le curseur Bulle / Découverte agisse.' };
  const bulle = [...ajouts.filter((v) => !orbiteDe(v) || themes.has(orbiteDe(v))), ...melanger(reste.filter((v) => themes.has(orbiteDe(v))), hasard)];
  const decouverte = melanger([...ajouts, ...reste].filter((v) => orbiteDe(v) && !themes.has(orbiteDe(v))), hasard);
  const p = prefs.bulle_decouverte / 100;
  const liste = [];
  let acc = 0, ib = 0, id = 0;
  // Dosage exact : sur 10 vidéos à 30 %, 3 viennent hors de vos orbites, régulièrement réparties.
  while (ib < bulle.length || id < decouverte.length) {
    acc += p;
    let prendreDecouverte = acc >= 1 - 1e-9;
    if (prendreDecouverte) acc -= 1;
    if (prendreDecouverte && id >= decouverte.length) { if (p === 1) break; prendreDecouverte = false; }
    if (!prendreDecouverte && ib >= bulle.length) { if (p === 0) break; prendreDecouverte = true; }
    liste.push(prendreDecouverte ? decouverte[id++] : bulle[ib++]);
  }
  return { liste, info: '' };
}

/* ───────────── lecteurs (un seul actif, chargé seulement au moment de lire) ───────────── */

let lecteur = null;   // { id, ecran, iframe, observateur }

function adresseLecteur(v) {
  const [p, x] = [v.id.slice(0, 2), v.id.slice(3)];
  const muet = prefs.sans_son ? 1 : 0;
  if (p === 'yt') return `https://www.youtube-nocookie.com/embed/${x}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&mute=${muet}&cc_load_policy=${muet}&hl=fr&cc_lang_pref=fr&origin=${encodeURIComponent(location.origin)}`;
  if (p === 'tt') return `https://www.tiktok.com/player/v1/${x}?autoplay=1&rel=0&music_info=1&description=1&muted=${muet}`;
  if (p === 'ig') return `https://www.instagram.com/p/${x}/embed/`;
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(v.fiche?.url || `https://www.facebook.com/watch/?v=${x}`)}&show_text=false&autoplay=true&mute=${muet}`;
}

function arreterLecture() {
  if (!lecteur) return;
  lecteur.observateur?.disconnect();
  lecteur.iframe.remove();
  lecteur.ecran.classList.remove('o-ecran--lecture');
  const bouton = lecteur.ecran.querySelector('.o-ecran__lecture');
  if (bouton) bouton.hidden = false;
  lecteur = null;
}

function jouer(v, ecran) {
  if (!autoriserLecture()) return;
  arreterLecture();
  session.vues += 1; sauverSession(); majMinuteur();
  const iframe = el('iframe', {
    src: adresseLecteur(v), title: `Lecture : ${titreDe(v) || 'vidéo ' + PLATEFORMES[plateformeDe(v)]?.nom}`,
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true,
    referrerpolicy: 'strict-origin-when-cross-origin', loading: 'eager',
  });
  iframe.addEventListener('load', () => {
    if (v.id.startsWith('yt:')) try { iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), 'https://www.youtube-nocookie.com'); } catch { /* */ }
  });
  ecran.querySelector('.o-ecran__lecture')?.setAttribute('hidden', '');
  ecran.classList.add('o-ecran--lecture');
  ecran.append(iframe);
  const observateur = new IntersectionObserver(([e]) => { if (e && e.intersectionRatio < 0.25) arreterLecture(); }, { threshold: [0, 0.25] });
  observateur.observe(ecran);
  lecteur = { id: v.id, ecran, iframe, observateur };
  iframe.focus?.();
}

// Fin de vidéo (YouTube et TikTok l'annoncent) : rien ne se relance, et le quota « 5 vidéos » est vérifié.
window.addEventListener('message', (e) => {
  if (!lecteur) return;
  let d = e.data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
  const finYouTube = e.origin === 'https://www.youtube-nocookie.com' && (d?.info?.playerState === 0 || (d?.event === 'onStateChange' && d?.info === 0));
  const finTikTok = e.origin === 'https://www.tiktok.com' && d?.type === 'onStateChange' && d?.value === 0;
  if (finYouTube || finTikTok) {
    if (session.limite_vues && session.vues >= session.limite_vues) terminerSession('Vos 5 vidéos sont terminées.');
  }
});

/* ───────────── minuteur doux « Zéro Doomscroll » ───────────── */

function sauverSession() { ecrire(sessionStorage, 'orbit_session', session); }
function nouvelleSession(mode) {
  session = { mode, ecoule_ms: 0, vues: 0, terminee: false,
    limite_ms: mode === '5min' ? 300_000 : mode === '15min' ? 900_000 : 0,
    limite_vues: mode === '5videos' ? 5 : 0 };
  sauverSession(); majMinuteur();
}
function autoriserLecture() {
  if (!session) { ouvrirSession(); return false; }
  if (session.terminee) { afficherCalme(); return false; }
  if (session.limite_vues && session.vues >= session.limite_vues) { terminerSession('Vos 5 vidéos sont terminées.'); return false; }
  return true;
}
function majMinuteur() {
  const b = $('#o-minuteur');
  if (!session) { b.textContent = '⏳ Choisir'; return; }
  if (session.terminee) b.textContent = '🌙 Pause';
  else if (session.limite_ms) { const r = Math.max(0, session.limite_ms - session.ecoule_ms); b.textContent = `⏳ ${Math.floor(r / 60000)}:${String(Math.floor((r % 60000) / 1000)).padStart(2, '0')}`; }
  else if (session.limite_vues) b.textContent = `🎞️ ${session.vues}/${session.limite_vues}`;
  else b.textContent = '♾️ Libre';
  b.setAttribute('aria-label', `Minuteur : ${b.textContent.slice(2)}. Changer la durée de la session.`);
}
function terminerSession(texte) {
  arreterLecture();
  session.terminee = true; sauverSession(); majMinuteur();
  $('#o-calme-texte').textContent = texte;
  afficherCalme();
}
function afficherCalme() {
  arreterLecture();
  const c = $('#o-calme');
  c.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#o-calme-plus').focus();
}
function fermerCalme() { $('#o-calme').hidden = true; document.body.style.overflow = ''; }
let dernierTic = Date.now();
setInterval(() => {
  const maintenant = Date.now(), pas = Math.min(5000, maintenant - dernierTic);
  dernierTic = maintenant;
  if (!session || session.terminee || document.visibilityState !== 'visible') return;
  session.ecoule_ms += pas;
  if (session.limite_ms && session.ecoule_ms >= session.limite_ms) {
    terminerSession(session.mode === '5min' ? 'Vos 5 minutes sont passées.' : session.mode === '15min' ? 'Vos 15 minutes sont passées.' : 'Le temps prévu est passé.');
  }
  if (session.ecoule_ms % 5000 < pas) sauverSession();
  majMinuteur();
}, 1000);

function ouvrirSession() {
  const zone = $('#o-themes');
  zone.replaceChildren(...ORBITES.map((o) => el('button', {
    type: 'button', class: 'o-puce', 'aria-pressed': String(prefs.themes.includes(o.slug)),
    onclick: (e) => {
      const b = e.currentTarget, oui = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(oui));
      prefs.themes = oui ? [...new Set([...prefs.themes, o.slug])] : prefs.themes.filter((s) => s !== o.slug);
      sauverPrefs();
    },
  }, `${o.icone} ${o.nom}`)));
  $('#o-session').showModal();
}

/* ───────────── affichage ───────────── */

function onglets() {
  const nav = $('#o-orbites');
  const b = (id, texte) => el('button', { type: 'button', class: 'o-orbite', 'aria-current': String(ongletActif === id),
    onclick: () => { ongletActif = id; combien = PAR_PAGE; onglets(); afficher(); $('#o-flux').focus({ preventScroll: true }); } }, texte);
  nav.replaceChildren(b('flux', '🪐 Mon flux'), ...ORBITES.filter((o) => o.active).map((o) => b(o.slug, `${o.icone} ${o.nom}`)));
  const curseur = $('#o-curseur');
  curseur.disabled = ongletActif !== 'flux';
  $('#o-curseur-aide').textContent = ongletActif === 'flux'
    ? '0 % : seulement vos orbites. 100 % : seulement ce qui sort de vos habitudes.'
    : 'Le curseur agit sur « Mon flux ». Ici : toute l\'orbite, toutes plateformes.';
}

function ecranVideo(v, mini = false) {
  const p = PLATEFORMES[plateformeDe(v)] || PLATEFORMES.youtube;
  const d = dureeDe(v);
  const titre = titreDe(v) || `Vidéo ${p.nom}`;
  const ecran = el('div', { class: 'o-ecran' },
    v.fiche?.miniature ? el('img', { src: '../' + v.fiche.miniature, alt: '', loading: 'lazy', decoding: 'async' }) : el('span', { class: 'o-ecran__vide', 'aria-hidden': 'true' }, p.icone),
    el('span', { class: 'o-badge o-badge--plateforme' }, `${p.icone} ${p.nom}`),
    d !== null && !mini ? el('span', { class: 'o-badge o-badge--duree' }, duree(d)) : null,
  );
  ecran.append(el('button', { type: 'button', class: 'o-ecran__lecture', 'aria-label': `Lire : ${titre}${d !== null ? ', ' + duree(d) : ''}`, onclick: () => jouer(v, ecran) }, '▶'));
  return ecran;
}

function carte(v) {
  const p = PLATEFORMES[plateformeDe(v)] || PLATEFORMES.youtube;
  const a = v.analyse, f = v.fiche;
  const d = dureeDe(v);
  const orb = ORBITES.find((o) => o.slug === orbiteDe(v));
  const titre = titreDe(v);
  const corps = el('div', { class: 'o-corps' },
    titre ? el('h3', { class: 'o-titre' }, titre) : f ? el('h3', { class: 'o-titre' }, `Vidéo ${p.nom}`) : el('span', { class: 'o-squelette', 'aria-label': 'Titre en chargement' }),
    f?.auteur ? el('p', { class: 'o-auteur' }, `${f.auteur}${a?.titre_propre && f.titre && normaliser(a.titre_propre) !== normaliser(f.titre) ? ' · titre d\'origine : « ' + f.titre.slice(0, 80) + ' »' : ''}`) : null,
  );
  // Résumé en 1 phrase avant de cliquer (vidéos longues YouTube).
  if (a?.resume && plateformeDe(v) === 'youtube' && d !== null && d >= 480) {
    corps.append(el('p', { class: 'o-resume' }, a.resume, el('small', {}, `Résumé IA d'après ${a.source || 'le titre et la description'} — ${String(a.modele || '').split('/').pop()}`)));
  }
  const tags = el('div', { class: 'o-tags' },
    orb ? el('span', { class: 'o-tag' }, `${orb.icone} ${orb.nom}`) : null,
    a?.ton ? el('span', { class: 'o-tag' }, TONS[a.ton]) : null,
    a?.langue ? el('span', { class: 'o-tag' }, LANGUES[a.langue] || a.langue.toUpperCase()) : null,
    sansSonDe(v) ? el('span', { class: 'o-tag' }, '🔇 Sans son OK') : null,
    d === null && f ? el('span', { class: 'o-tag' }, 'Durée inconnue') : null,
  );
  if (tags.childElementCount) corps.append(tags);
  const masques = [...doublons.entries()].filter(([, garde]) => garde === v.id).map(([m]) => PLATEFORMES[plateformeDe(videos.get(m))]?.nom).filter(Boolean);
  if (masques.length) corps.append(el('p', { class: 'o-auteur' }, `♻️ Même vidéo aussi vue sur ${masques.join(', ')} : version la plus fluide gardée.`));
  const actions = el('div', { class: 'o-actions' },
    el('button', { type: 'button', class: 'o-bouton', onclick: () => panneau(v, 'plongee') }, '🐇 Plongée'),
    a?.actu_debat || a?.ton === 'debat' ? el('button', { type: 'button', class: 'o-bouton', onclick: () => panneau(v, 'angle') }, '🔄 Autre point de vue') : null,
    f?.url ? el('a', { class: 'o-bouton', href: f.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Ouvrir sur ${p.nom} (nouvel onglet)` }, '↗') : null,
  );
  corps.append(actions);
  const art = el('article', { class: 'o-carte' + (v.vertical ? ' o-carte--vertical' : ''), 'data-id': v.id, 'aria-label': titre || `Vidéo ${p.nom}` }, ecranVideo(v), corps);
  observateurCartes.observe(art);
  return art;
}

const observateurCartes = new IntersectionObserver((entrees) => {
  for (const e of entrees) if (e.isIntersecting) demanderAnalyse(e.target.dataset.id);
}, { rootMargin: '300px 0px' });

function rafraichirCarte(id) {
  const ancienne = document.querySelector(`.o-carte[data-id="${CSS.escape(id)}"]`);
  if (!ancienne || (lecteur && lecteur.id === id)) return;
  const v = videos.get(id);
  if (!v) return;
  observateurCartes.unobserve(ancienne);
  ancienne.replaceWith(carte(v));
}

function afficher() {
  arreterLecture();
  const flux = $('#o-flux');
  const { liste, info } = composer();
  const enfants = [];
  if (info) enfants.push(el('p', { class: 'o-note' }, info));
  if (prefs.filtre_duree && [...videos.values()].some((v) => formatDe(v) === 'inconnu' && v.fiche)) {
    enfants.push(el('p', { class: 'o-note' }, 'Les vidéos dont la durée est inconnue (Instagram, Facebook, TikTok) sont masquées par ce filtre.'));
  }
  if (!liste.length) {
    enfants.push(el('p', { class: 'o-vide' }, videos.size ? 'Aucune vidéo ne correspond à ces réglages. Élargissez un filtre ou mettez une vidéo en orbite.' : 'Chargement des vidéos…'));
  }
  enfants.push(...liste.slice(0, combien).map(carte));
  if (liste.length > combien) {
    enfants.push(el('button', { type: 'button', class: 'o-bouton', onclick: () => { combien += PAR_PAGE; afficher(); } },
      `Afficher ${Math.min(PAR_PAGE, liste.length - combien)} vidéos de plus (${liste.length - combien} restantes)`));
  } else if (liste.length) enfants.push(el('p', { class: 'o-vide' }, '🌙 Vous êtes au bout du flux. Pas de défilement infini ici.'));
  flux.replaceChildren(...enfants);
  flux.setAttribute('aria-busy', 'false');
}

/* ───────────── plongée / autre point de vue ───────────── */

function candidatsPour(v) {
  const orb = orbiteDe(v);
  return [...videos.values()]
    .filter((x) => x.id !== v.id && !doublons.has(x.id) && titreDe(x) && x.fiche?.integrable !== false)
    .sort((x, y) => (orbiteDe(y) === orb) - (orbiteDe(x) === orb))
    .slice(0, 60).map((x) => ({ id: x.id, titre: titreDe(x) }));
}

function etapeVideo(id, titreSecours) {
  const v = videos.get(id) || ajouterVideo(id, { origine: 'suggestion' });
  const mini = el('div', { class: 'o-mini' });
  const remplir = () => {
    mini.replaceChildren(ecranVideo(v, true), el('div', {}, el('strong', {}, titreDe(v) || titreSecours || 'Vidéo YouTube'), v.fiche?.auteur ? el('p', { class: 'o-auteur' }, v.fiche.auteur) : null));
    mini.querySelector('.o-ecran__lecture').addEventListener('click', () => mini.classList.add('o-mini--lecture'));
  };
  remplir();
  if (!v.fiche) chargerFiches([id]).then(() => { if (!mini.classList.contains('o-mini--lecture')) remplir(); });
  return mini;
}
const lienRecherche = (q) => el('a', { class: 'o-bouton', href: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, target: '_blank', rel: 'noopener noreferrer' }, `🔎 Chercher « ${q} » sur YouTube ↗`);

async function panneau(v, action) {
  const dlg = $('#o-panneau'), corps = $('#o-panneau-corps');
  $('#o-panneau-titre').textContent = action === 'plongee' ? '🐇 Plongée : 5 vidéos de plus en plus pointues' : '🔄 Même sujet, autre point de vue';
  corps.replaceChildren(el('p', { class: 'o-aide', role: 'status' }, 'L\'IA prépare la sélection…'));
  arreterLecture();
  dlg.showModal();
  const cle = `orbit_${action}_${v.id}`;
  let res = lire(sessionStorage, cle, null);
  if (!res) {
    try {
      res = await appeler(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id: v.id, candidats: candidatsPour(v) }) });
    } catch (e) {
      const r = (e.statut === 429 || e.statut === 503) ? await iaVisiteur(e.donnees?.consigne) : null;
      if (r) {
        const ids = new Set(candidatsPour(v).map((c) => c.id));
        const ok = (x) => (typeof x === 'string' && ids.has(x) ? x : null);
        res = action === 'angle'
          ? { angle: String(r.json.angle || ''), id: ok(r.json.id), recherche: String(r.json.recherche || ''), modele: r.modele }
          : { sujet: String(r.json.sujet || ''), etapes: (r.json.etapes || []).slice(0, 5).map((x, i) => ({ niveau: i + 1, titre: String(x.titre || ''), id: ok(x.id), recherche: String(x.recherche || '') })), modele: r.modele };
      } else {
        corps.replaceChildren(el('p', { class: 'o-note' }, `${e.message} ${e.statut === 429 || e.statut === 503 ? 'Réessayez dans quelques minutes, ou connectez votre compte OpenRouter dans IA Débat (même site) pour utiliser votre propre accès gratuit.' : ''}`),
          titreDe(v) ? lienRecherche(titreDe(v)) : null);
        return;
      }
    }
    ecrire(sessionStorage, cle, res);
  }
  const signature = el('p', { class: 'o-aide' }, `Sélection proposée par l'IA (${String(res.modele || '').split('/').pop() || 'modèle gratuit'}) d'après les titres. Les liens « Chercher » ouvrent YouTube.`);
  if (action === 'angle') {
    corps.replaceChildren(
      res.angle ? el('p', {}, res.angle) : null,
      res.id ? etapeVideo(res.id) : res.trouve ? etapeVideo(res.trouve.id, res.trouve.titre) : el('p', { class: 'o-note' }, 'Aucune vidéo du catalogue ne présente un autre angle sur ce sujet.'),
      res.recherche ? lienRecherche(res.recherche) : null, signature);
  } else {
    const ol = el('ol', { class: 'o-etapes' }, ...(res.etapes || []).map((e) => el('li', { class: 'o-etape' },
      el('span', { class: 'o-etape__niveau' }, `Niveau ${e.niveau} / 5`), el('strong', {}, e.titre || ''),
      e.id ? etapeVideo(e.id) : e.trouve ? etapeVideo(e.trouve.id, e.trouve.titre) : (e.recherche ? lienRecherche(e.recherche) : null))));
    corps.replaceChildren(res.sujet ? el('p', {}, `Sujet : ${res.sujet}`) : null, ol, signature);
  }
}
$('#o-panneau-fermer').addEventListener('click', () => $('#o-panneau').close());
$('#o-panneau').addEventListener('close', arreterLecture);

/* ───────────── import en 1 clic « Mettre en orbite » ───────────── */

async function importer(adresse) {
  const etat = $('#o-import-etat');
  const bouton = $('#o-import-form button[type="submit"]');
  bouton.disabled = true;
  etat.textContent = '🔍 Lecture de la vidéo…';
  try {
    const { fiche } = await appeler(`${API}?meta=${encodeURIComponent(adresse)}`);
    if (!fiche || fiche.erreur === 'quota') throw new Error('Limite du jour atteinte, réessayez demain.');
    if (fiche.echec) throw new Error('Cette vidéo est introuvable, privée ou retirée.');
    if (fiche.integrable === false) throw new Error('Son auteur interdit la lecture en dehors de la plateforme : ouvrez-la directement.');
    const deja = videos.get(fiche.id);
    if (deja && (deja.origine === 'import' || deja.origine === 'catalogue')) throw Object.assign(new Error('Elle est déjà en orbite.'), { info: true });
    const v = ajouterVideo(fiche.id, { origine: 'import', vertical: !!fiche.vertical, ajoute_le: new Date().toISOString() });
    memoriser(fiche.id, 'f', fiche);
    const copie = doublonDe(fiche.id);
    if (copie) { videos.delete(fiche.id); throw Object.assign(new Error(`Doublon : la même vidéo est déjà là sur ${PLATEFORMES[plateformeDe(copie)]?.nom}, version gardée.`), { info: true }); }
    etat.textContent = '🤖 L\'IA détecte la langue, le titre propre, l\'orbite et le ton…';
    const a = v.analyse || await analyser(fiche.id);
    if (a) memoriser(fiche.id, 'a', a);
    imports = [{ id: fiche.id, vertical: !!fiche.vertical, ajoute_le: v.ajoute_le }, ...imports.filter((i) => i.id !== fiche.id)].slice(0, 300);
    ecrire(localStorage, 'orbit_imports', imports);
    const orb = ORBITES.find((o) => o.slug === a?.orbite);
    etat.textContent = a
      ? `✅ En orbite : « ${a.titre_propre || fiche.titre} » · ${orb ? orb.icone + ' ' + orb.nom : 'orbite ?'} · ${TONS[a.ton] || 'ton ?'} · ${LANGUES[a.langue] || a.langue || 'langue ?'}`
      : `✅ En orbite. L'IA gratuite est occupée : l'analyse se fera plus tard.`;
    $('#o-import-url').value = '';
    calculerDoublons();
    ongletActif = 'flux'; combien = PAR_PAGE; onglets(); afficher();
  } catch (e) {
    etat.textContent = (e.info ? 'ℹ️ ' : '⚠️ ') + e.message;
  } finally { bouton.disabled = false; }
}

/* ───────────── démarrage ───────────── */

function brancherControles() {
  const curseur = $('#o-curseur'), sortie = $('#o-curseur-valeur');
  const majCurseur = () => { sortie.textContent = `${prefs.bulle_decouverte} % de découverte`; curseur.setAttribute('aria-valuetext', sortie.textContent); };
  curseur.value = prefs.bulle_decouverte; majCurseur();
  let attente;
  curseur.addEventListener('input', () => { prefs.bulle_decouverte = Number(curseur.value); majCurseur(); clearTimeout(attente); attente = setTimeout(() => { sauverPrefs(); combien = PAR_PAGE; afficher(); }, 250); });

  for (const b of document.querySelectorAll('#o-durees [data-duree]')) {
    b.setAttribute('aria-checked', String(b.dataset.duree === prefs.filtre_duree));
    b.addEventListener('click', () => {
      prefs.filtre_duree = b.dataset.duree; sauverPrefs();
      for (const x of document.querySelectorAll('#o-durees [data-duree]')) x.setAttribute('aria-checked', String(x === b));
      combien = PAR_PAGE; afficher();
    });
  }
  const sansSon = $('#o-sans-son');
  sansSon.setAttribute('aria-pressed', String(prefs.sans_son));
  sansSon.addEventListener('click', () => { prefs.sans_son = !prefs.sans_son; sansSon.setAttribute('aria-pressed', String(prefs.sans_son)); sauverPrefs(); combien = PAR_PAGE; afficher(); });

  $('#o-minuteur').addEventListener('click', ouvrirSession);
  $('#o-session-form').addEventListener('submit', (e) => {
    const mode = e.submitter?.value;
    if (mode) { nouvelleSession(mode); fermerCalme(); }
    afficher();
  });
  $('#o-session').addEventListener('cancel', (e) => { if (!session) { e.preventDefault(); } });
  $('#o-calme-plus').addEventListener('click', () => {
    session.terminee = false; session.limite_vues = 0; session.limite_ms = session.ecoule_ms + 300_000; session.mode = 'prolonge';
    sauverSession(); majMinuteur(); fermerCalme();
  });
  $('#o-calme-fin').addEventListener('click', () => {
    $('#o-calme-texte').textContent = 'À bientôt. ORBIT sera là quand vous voudrez, sans rien vous réclamer.';
    $('#o-calme-fin').hidden = true;
    $('#o-calme-plus').textContent = 'Nouvelle session';
    $('#o-calme-plus').onclick = () => { $('#o-calme-fin').hidden = false; $('#o-calme-plus').textContent = 'Encore 5 minutes'; $('#o-calme-plus').onclick = null; fermerCalme(); session = null; ouvrirSession(); };
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#o-calme').hidden) e.preventDefault(); });

  $('#o-ouvrir-import').addEventListener('click', () => { $('#o-import-etat').textContent = ''; $('#o-import').showModal(); $('#o-import-url').focus(); });
  $('#o-import-annuler').addEventListener('click', () => $('#o-import').close());
  $('#o-import-form').addEventListener('submit', (e) => { e.preventDefault(); importer($('#o-import-url').value); });
  // Partage depuis une autre appli : /orbit/?url=…
  const partage = new URLSearchParams(location.search).get('url') || new URLSearchParams(location.search).get('text');
  if (partage && /^https?:\/\//.test(partage.trim())) { $('#o-import').showModal(); $('#o-import-url').value = partage.trim(); }

  // En-tête qui s'efface quand on descend, revient quand on remonte.
  let dernierY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY, tete = $('#o-tete');
    if (Math.abs(y - dernierY) < 8) return;
    tete.classList.toggle('o-tete--cache', y > dernierY && y > 200 && !tete.contains(document.activeElement));
    dernierY = y;
  }, { passive: true });
}

async function demarrer() {
  brancherControles();
  try { navigator.serviceWorker?.getRegistrations?.().then((l) => l.forEach((r) => r.unregister())); } catch { /* ancienne version installée */ }
  const [cat, orb] = await Promise.all([
    fetch('./catalogue.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({ videos: [] })),
    fetch('./orbites.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({ orbites: [] })),
  ]);
  ORBITES = orb.orbites || [];
  for (const c of cat.videos || []) ajouterVideo(c.id, { origine: 'catalogue', orbite_indicative: c.orbite_indicative, vertical: !!c.vertical, ajoute_le: c.ajoute_le });
  for (const i of imports) ajouterVideo(i.id, { origine: 'import', vertical: !!i.vertical, ajoute_le: i.ajoute_le });
  onglets();
  calculerDoublons();
  majMinuteur();
  afficher();
  if (!session) ouvrirSession(); else if (session.terminee) afficherCalme();
  appeler(`${API}?sante`).then((s) => { sante = s; }).catch(() => {});
  const aCharger = [...videos.values()].filter((v) => !v.fiche || (Date.now() - (cacheLocal[v.id]?.t || 0)) > 7 * 86400_000).map((v) => v.id);
  if (aCharger.length) chargerFiches(aCharger);
}

demarrer();
