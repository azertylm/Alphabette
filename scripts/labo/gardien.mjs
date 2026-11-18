#!/usr/bin/env node
/**
 * scripts/labo/gardien.mjs — Agent « Gardien Ergonomie & Sobriété ».
 * Passe obligatoire avant tout transfert d'une appli d'alphabette.eu vers alphabette.fr.
 *
 *   node scripts/labo/gardien.mjs audit <app_id> [--url <adresse>] [--dist <dossier du build>]
 *        [--precedent <rapport.json> | --precedent-url <adresse .fr>] [--enregistrer] [--sortie <eco-score.json>]
 *
 * 1. Grille Senior-Friendly (Playwright, page réellement rendue, thème sombre « Onyx ») :
 *    - zones interactives ≥ 48×48 px (liens dans une phrase signalés à part) ;
 *    - contraste WCAG AAA : 7:1 (texte courant), 4,5:1 (grand texte ≥ 24 px ou ≥ 18,66 px gras) ;
 *    - zoom 200 % : fenêtre de 1280 px zoomée (= 640 px CSS) et texte agrandi à 200 % sur téléphone :
 *      pas de défilement horizontal ni de texte coupé ;
 *    - anglicismes, jargon technique et fuites techniques (« undefined », « [object Object] »…).
 * 2. Cure d'amaigrissement & Eco-Index :
 *    - poids transféré, requêtes, nœuds DOM → EcoIndex (méthode GreenIT) → note de Sobriété A à E ;
 *    - code JavaScript chargé mais jamais exécuté (couverture Chromium) ;
 *    - SVG compressés sans perte dans le build (--dist) ;
 *    - fonctionnement 100 % hors ligne du service worker (PWA).
 *    → eco-score.json (affiché sur la fiche de alphabette.fr).
 * 3. Verrou anti-régression : comparaison avec la version précédente (dernier rapport enregistré dans
 *    data/labo/gardien/<app_id>.json, sinon la version actuellement en ligne sur alphabette.fr).
 *    Code de sortie 1 si l'accessibilité ou la sobriété régresse → le transfert est bloqué.
 *
 * Playwright est installé à part : NODE_PATH=/tmp/pw/node_modules (voir .github/workflows/gardien-transfert.yml).
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compresserSvgDossier, ecoIndex, noteSobriete, ORDRE_NOTES, poidsBuild } from './sobriete.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

/* Tolérances : en dessous, c'est du bruit de mesure, pas une régression. */
const TOLERANCE_SENIOR = 2;   // points sur 100
const TOLERANCE_ECO = 3;      // points d'EcoIndex
const CIBLE_MIN = 48;

/* Anglicismes / jargon → proposition en français simple. Les fuites techniques sont « graves ». */
const LEXIQUE = [
  [/\b(log ?in|sign ?in)\b/i, 'se connecter'], [/\b(log ?out|sign ?out)\b/i, 'se déconnecter'], [/\bsign ?up\b/i, "s'inscrire"],
  [/\bsettings?\b/i, 'réglages'], [/\bdashboard\b/i, 'tableau de bord'], [/\bfeedbacks?\b/i, 'avis'], [/\bupload(er)?\b/i, 'envoyer un fichier'],
  [/\bdownload(er)?\b/i, 'télécharger'], [/\bloading\b/i, 'chargement'], [/\bsubmit\b/i, 'envoyer'], [/\bcancel\b/i, 'annuler'],
  [/\bsave\b/i, 'enregistrer'], [/\bdelete\b/i, 'supprimer'], [/\bsearch\b/i, 'rechercher'], [/\bhome\b/i, 'accueil'],
  [/\bpassword\b/i, 'mot de passe'], [/\busername\b/i, "nom d'utilisateur"], [/\bnewsletter\b/i, "lettre d'information"],
  [/\bprompts?\b/i, 'consigne'], [/\bBYOK\b/, 'votre propre clé'], [/\btokens?\b/i, 'jeton'], [/\bAPI\b/, 'service'],
  [/\bplug-?ins?\b/i, 'extension'], [/\bwidgets?\b/i, 'module'], [/\btimeline\b/i, 'fil'], [/\bswipe[rz]?\b/i, 'faire glisser'],
  [/\bscroll(er|ez)?\b/i, 'faire défiler'], [/\b(tap|tapez)\b/i, 'touchez'], [/\bupdate\b/i, 'mise à jour'], [/\bshare\b/i, 'partager'],
  [/\bfollow\b/i, 'suivre'], [/\bspoiler\b/i, 'divulgâcher'], [/\bstreaming\b/i, 'diffusion'], [/\bbackend|frontend\b/i, '(à retirer)'],
  [/\b(localStorage|WebGPU|JSON|cache|cookies? tiers)\b/, '(jargon technique)'],
];
const FUITES = /\b(undefined|NaN|null)\b|\[object Object\]|\{\{.*?\}\}|Error:|TypeError|stack trace/;

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const [commande, appId] = args;
if (commande !== 'audit' || !appId) {
  console.error('Usage : node scripts/labo/gardien.mjs audit <app_id> [--url …] [--dist …] [--precedent …|--precedent-url …] [--enregistrer]');
  process.exit(2);
}

async function adresseApp(base, id) {
  const r = await fetch(`${base}/api/apps.json?t=${Date.now()}`).then((x) => x.json()).catch(() => ({}));
  const a = (r.apps ?? []).find((x) => x.id === id);
  return a?.url ? new URL(a.url, base).href : null;
}

/* ------------------------- 1. Grille Senior-Friendly ------------------------- */

async function grilleSenior(navigateur, url) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', locale: 'fr-FR' });
  await ctx.addInitScript(() => {
    try {
      const p = JSON.parse(localStorage.getItem('alphabette.prefs') || '{}');
      localStorage.setItem('alphabette.prefs', JSON.stringify({ ...p, theme: 'nuit' }));
    } catch { /* rien */ }
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);

  const mesures = await page.evaluate(({ CIBLE_MIN }) => {
    const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
    const nom = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList[0] ? '.' + e.classList[0] : ''}`;
    const texteDe = (e) => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || '').trim().slice(0, 40);

    // Zones interactives.
    const interactifs = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=checkbox], [role=radio], [role=switch], [tabindex]:not([tabindex="-1"])')]
      .filter(visible).filter((e) => !e.closest('[aria-hidden="true"]') && !e.closest('.labo__piege'));
    let ok = 0; const petits = []; let enLigne = 0;
    for (const e of interactifs) {
      const r = e.getBoundingClientRect();
      // Une case à cocher dans un libellé cliquable : c'est le libellé qui compte.
      const zone = e.matches('input[type=checkbox], input[type=radio]') && e.closest('label') ? e.closest('label').getBoundingClientRect() : r;
      if (zone.width >= CIBLE_MIN - 0.5 && zone.height >= CIBLE_MIN - 0.5) { ok++; continue; }
      const parent = e.parentElement;
      if (e.tagName === 'A' && parent && /^(P|LI|SPAN|TD|DD)$/.test(parent.tagName) && (parent.innerText || '').length > (e.innerText || '').length + 20) { enLigne++; ok++; continue; }
      petits.push(`${nom(e)} « ${texteDe(e)} » ${Math.round(zone.width)}×${Math.round(zone.height)}`);
    }

    // Contraste AAA.
    const lum = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
    const fond = (e) => {
      let couches = [];
      for (let x = e; x; x = x.parentElement) {
        const s = getComputedStyle(x);
        if (s.backgroundImage !== 'none' && !/gradient/.test(s.backgroundImage)) return null; // image : non mesurable
        const c = rgba(s.backgroundColor);
        if (c && c[3] > 0) { couches.push(c); if (c[3] >= 1) break; }
      }
      let res = [255, 255, 255];
      if (!couches.length || couches[couches.length - 1][3] < 1) res = [255, 255, 255];
      for (const c of couches.reverse()) res = res.map((v, i) => c[i] * c[3] + v * (1 - c[3]));
      return res;
    };
    const textes = [];
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const vus = new Set();
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      const e = n.parentElement;
      if (!e || vus.has(e) || !n.textContent.trim() || !visible(e) || e.closest('[aria-hidden="true"], script, style, noscript')) continue;
      vus.add(e);
      textes.push(e);
    }
    let cOk = 0, cMesures = 0; const faibles = [];
    for (const e of textes) {
      const s = getComputedStyle(e);
      const c = rgba(s.color); const f = fond(e);
      if (!c || !f) continue;
      const couleur = c.slice(0, 3).map((v, i) => v * c[3] + f[i] * (1 - c[3]));
      const l1 = lum(couleur), l2 = lum(f);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(s.fontSize), gras = Number(s.fontWeight) >= 700;
      const seuil = px >= 24 || (gras && px >= 18.66) ? 4.5 : 7;
      cMesures++;
      if (ratio >= seuil) cOk++;
      else if (faibles.length < 12) faibles.push(`${nom(e)} « ${e.textContent.trim().slice(0, 30)} » ${ratio.toFixed(2)}:1 (AAA ${seuil}:1)`);
    }

    // Textes visibles pour le lexique.
    const lexique = [...textes.map((e) => e.textContent), ...[...document.querySelectorAll('[aria-label],[placeholder],[title]')].flatMap((e) => [e.getAttribute('aria-label'), e.getAttribute('placeholder'), e.getAttribute('title')])]
      .filter(Boolean).map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => t.length > 1);
    return { interactifs: interactifs.length, ciblesOk: ok, enLigne, petits: petits.slice(0, 15), nbPetits: petits.length, cOk, cMesures, faibles, lexique, dom: document.getElementsByTagName('*').length };
  }, { CIBLE_MIN });

  // Zoom 200 % : (a) fenêtre 1280 px zoomée = 640 px CSS ; (b) texte agrandi à 200 % sur téléphone.
  const zoom = [];
  const verifierZoom = async (p, cas) => {
    const r = await p.evaluate(() => {
      const largeur = document.documentElement.clientWidth;
      const exces = document.documentElement.scrollWidth - largeur;
      const coupes = [...document.querySelectorAll('body *')].filter((e) => {
        const s = getComputedStyle(e);
        return e.children.length === 0 && (e.innerText || '').trim().length > 3 && /hidden|clip/.test(s.overflow + s.overflowX) && e.scrollWidth > e.clientWidth + 2 && s.textOverflow !== 'ellipsis';
      }).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}${e.classList[0] ? '.' + e.classList[0] : ''}`);
      return { exces, coupes };
    });
    zoom.push({ cas, ok: r.exces <= 1 && r.coupes.length === 0, defilement_horizontal_px: Math.max(0, r.exces), textes_coupes: r.coupes });
  };
  await page.setViewportSize({ width: 640, height: 400 });
  await page.waitForTimeout(600);
  await verifierZoom(page, 'Fenêtre 1280 px zoomée à 200 %');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: 'html{font-size:200% !important} body{font-size:200% !important}' });
  await page.waitForTimeout(600);
  await verifierZoom(page, 'Texte agrandi à 200 % sur téléphone');
  await ctx.close();

  // Lexique.
  const trouvailles = new Map();
  let fuites = 0;
  for (const t of new Set(mesures.lexique)) {
    if (FUITES.test(t)) { fuites++; trouvailles.set(`fuite:${t.slice(0, 40)}`, { terme: t.match(FUITES)[0], propose: 'fuite technique à corriger', extrait: t.slice(0, 80), grave: true }); }
    for (const [re, propose] of LEXIQUE) {
      const m = t.match(re);
      if (m && !trouvailles.has(m[0].toLowerCase())) trouvailles.set(m[0].toLowerCase(), { terme: m[0], propose, extrait: t.slice(0, 80) });
    }
  }
  const jargon = [...trouvailles.values()];

  const pCibles = mesures.interactifs ? mesures.ciblesOk / mesures.interactifs : 1;
  const pContraste = mesures.cMesures ? mesures.cOk / mesures.cMesures : 1;
  const pZoom = zoom.filter((z) => z.ok).length / zoom.length;
  const pointsJargon = Math.max(0, 15 - jargon.filter((j) => !j.grave).length * 1.5 - fuites * 5);
  const score = Math.round(35 * pCibles + 35 * pContraste + 15 * pZoom + pointsJargon);

  return {
    score,
    cibles: { total: mesures.interactifs, conformes_pct: Math.round(pCibles * 100), trop_petites: mesures.nbPetits, liens_dans_le_texte: mesures.enLigne, exemples: mesures.petits },
    contraste_aaa: { mesures: mesures.cMesures, conformes_pct: Math.round(pContraste * 100), exemples: mesures.faibles, theme: 'sombre (Onyx)' },
    zoom_200: zoom,
    langage: { a_corriger: jargon.length, fuites_techniques: fuites, termes: jargon.slice(0, 20) },
    dom: mesures.dom,
  };
}

/* ------------------------- 2. Sobriété & Eco-Index ------------------------- */

async function sobrieteEnLigne(navigateur, url) {
  const ctx = await navigateur.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  let requetes = 0, octets = 0;
  page.on('requestfinished', async (req) => {
    requetes++;
    try { const s = await req.sizes(); octets += s.responseBodySize + s.responseHeadersSize; } catch { /* rien */ }
  });
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(3000);
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(1000);
  const dom = await page.evaluate(() => [...document.getElementsByTagName('*')].filter((e) => !e.closest('svg') || e.tagName.toLowerCase() === 'svg').length);
  const couverture = await page.coverage.stopJSCoverage();
  let total = 0, utilise = 0;
  const parFichier = [];
  for (const c of couverture) {
    if (!c.url.startsWith('http')) continue;
    const n = c.source?.length ?? 0;
    const plages = c.functions.flatMap((f) => f.ranges.filter((r) => r.count > 0));
    // Union des plages exécutées.
    const tri = plages.map((r) => [r.startOffset, r.endOffset]).sort((a, b) => a[0] - b[0]);
    let fait = 0, fin = -1;
    for (const [d, f] of tri) { if (f <= fin) continue; fait += f - Math.max(d, fin); fin = f; }
    total += n; utilise += Math.min(n, fait);
    parFichier.push({ fichier: c.url.split('/').pop().split('?')[0], ko: Math.round(n / 1024), inutilise_pct: n ? Math.round((1 - Math.min(n, fait) / n) * 100) : 0 });
  }

  // Hors ligne : on laisse le service worker s'installer, puis on coupe le réseau et on recharge.
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'non';
    const r = await Promise.race([navigator.serviceWorker.ready.then(() => 'pret'), new Promise((ok) => setTimeout(() => ok('absent'), 8000))]);
    return r;
  });
  let horsLigne = { service_worker: sw !== 'absent' && sw !== 'non', fonctionne: false, detail: '' };
  if (horsLigne.service_worker) {
    await page.reload({ waitUntil: 'load' }).catch(() => undefined);
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    try {
      await page.reload({ waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(1500);
      const t = await page.evaluate(() => (document.body?.innerText || '').trim().length);
      horsLigne.fonctionne = t > 40;
      horsLigne.detail = horsLigne.fonctionne ? 'Page rechargée sans réseau.' : 'Page vide sans réseau.';
    } catch (e) {
      horsLigne.detail = `Échec sans réseau : ${String(e.message).split('\n')[0].slice(0, 120)}`;
    }
  } else {
    horsLigne.detail = "Pas de service worker : l'appli ne marche pas sans réseau.";
  }
  await ctx.close();

  const ko = Math.round(octets / 102.4) / 10;
  const eco = ecoIndex(dom, requetes, ko);
  return {
    transfert_ko: ko, requetes, dom, ecoindex: eco, note_sobriete: noteSobriete(eco.score),
    code_js: { charge_ko: Math.round(total / 1024), jamais_execute_pct: total ? Math.round((1 - utilise / total) * 100) : 0, fichiers: parFichier.sort((a, b) => b.ko - a.ko).slice(0, 6) },
    hors_ligne: horsLigne,
  };
}

/* ------------------------- 3. Comparaison ------------------------- */

function comparer(actuel, precedent) {
  if (!precedent) return { reference: null, regressions: [] };
  const r = [];
  const sa = actuel.senior.score, sp = precedent.senior?.score;
  if (typeof sp === 'number' && sa < sp - TOLERANCE_SENIOR) r.push(`Accessibilité seniors : ${sp} → ${sa}/100`);
  if (precedent.senior?.contraste_aaa && actuel.senior.contraste_aaa.conformes_pct < precedent.senior.contraste_aaa.conformes_pct - 5) {
    r.push(`Contraste AAA : ${precedent.senior.contraste_aaa.conformes_pct} % → ${actuel.senior.contraste_aaa.conformes_pct} %`);
  }
  if (precedent.senior?.zoom_200?.every((z) => z.ok) && !actuel.senior.zoom_200.every((z) => z.ok)) r.push("Zoom 200 % : l'interface casse alors qu'elle tenait");
  if ((actuel.senior.langage.fuites_techniques ?? 0) > (precedent.senior?.langage?.fuites_techniques ?? 0)) r.push('Nouvelles fuites techniques dans les textes');
  const ea = actuel.sobriete.ecoindex.score, ep = precedent.sobriete?.ecoindex?.score;
  if (typeof ep === 'number' && ea < ep - TOLERANCE_ECO) r.push(`EcoIndex : ${ep} → ${ea}`);
  const na = actuel.sobriete.note_sobriete, np = precedent.sobriete?.note_sobriete;
  if (np && ORDRE_NOTES.indexOf(na) > ORDRE_NOTES.indexOf(np)) r.push(`Note de sobriété : ${np} → ${na}`);
  if (precedent.sobriete?.hors_ligne?.fonctionne && !actuel.sobriete.hors_ligne.fonctionne) r.push("Hors ligne : l'appli ne marche plus sans réseau");
  return { reference: precedent.date ?? null, reference_url: precedent.url ?? null, regressions: r };
}

/* ------------------------- Exécution ------------------------- */

const base = 'https://alphabette.eu';
const url = opt('url') ?? (await adresseApp(base, appId));
if (!url) { console.error(`Adresse introuvable pour ${appId} sur ${base}.`); process.exit(2); }
const fichierRef = path.join(RACINE, 'data', 'labo', 'gardien', `${appId}.json`);

const navigateur = await chromium.launch();
async function auditComplet(u) {
  const senior = await grilleSenior(navigateur, u);
  const sobriete = await sobrieteEnLigne(navigateur, u);
  return { app_id: appId, url: u, date: new Date().toISOString(), senior, sobriete };
}

let precedent = null;
if (opt('precedent')) precedent = JSON.parse(readFileSync(opt('precedent'), 'utf8'));
else if (existsSync(fichierRef)) precedent = JSON.parse(readFileSync(fichierRef, 'utf8'));
else {
  // Première fois : la référence est la version actuellement en ligne sur alphabette.fr, s'il y en a une.
  const urlFr = opt('precedent-url') ?? (await adresseApp('https://alphabette.fr', appId));
  if (urlFr && !urlFr.startsWith(base)) {
    try { precedent = await auditComplet(urlFr); } catch (e) { console.error(`Référence .fr non mesurable : ${e.message.split('\n')[0]}`); }
  }
}

let actuel;
try { actuel = await auditComplet(url); } finally { await navigateur.close(); }
if (opt('dist')) {
  actuel.sobriete.build = { poids_ko: await poidsBuild(opt('dist')), svg: await compresserSvgDossier(opt('dist')) };
}
const verdict = comparer(actuel, precedent);
actuel.comparaison = verdict;
actuel.transfert_autorise = verdict.regressions.length === 0;

const eco = {
  app_id: appId,
  audite_le: actuel.date,
  url,
  poids_transfere_ko: actuel.sobriete.transfert_ko,
  ...(actuel.sobriete.build ? { poids_build_ko: actuel.sobriete.build.poids_ko } : {}),
  requetes: actuel.sobriete.requetes,
  elements_dom: actuel.sobriete.dom,
  ecoindex: actuel.sobriete.ecoindex,
  note_sobriete: actuel.sobriete.note_sobriete,
  code_jamais_execute_pct: actuel.sobriete.code_js.jamais_execute_pct,
  hors_ligne: actuel.sobriete.hors_ligne.fonctionne,
  accessibilite_seniors: actuel.senior.score,
  methode: 'EcoIndex (GreenIT.fr) mesuré sur la page d’accueil de l’appli, 1920×1080, premier chargement. Note A–E : F et G de l’EcoIndex comptent comme E.',
};
writeFileSync(opt('sortie') ?? 'eco-score.json', JSON.stringify(eco, null, 2) + '\n');

if (args.includes('--enregistrer') && actuel.transfert_autorise) {
  mkdirSync(path.dirname(fichierRef), { recursive: true });
  writeFileSync(fichierRef, JSON.stringify(actuel, null, 2) + '\n');
  const f = path.join(RACINE, 'data', 'labo', 'eco_scores.json');
  const d = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { apps: {} };
  d.apps[appId] = { ...eco, vitrine: d.apps[appId]?.vitrine ?? false };
  writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
}

console.log(JSON.stringify(actuel, null, 2));
if (!actuel.transfert_autorise) {
  console.error(`\n⛔ Transfert bloqué (${appId}) — régression par rapport à la version précédente :\n - ${verdict.regressions.join('\n - ')}`);
  process.exit(1);
}
console.error(`\n✅ ${appId} : seniors ${actuel.senior.score}/100, sobriété ${actuel.sobriete.note_sobriete} (EcoIndex ${actuel.sobriete.ecoindex.score}), aucune régression.`);
