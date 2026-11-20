#!/usr/bin/env node
/**
 * scripts/labo/atelier.mjs — l'Atelier qualité d'alphabette.eu : un seul passage de navigateur par application,
 * sept agents qui lisent la même page (voir docs/labo/ATELIER-QUALITE.md).
 *
 *   NODE_PATH=/tmp/pw/node_modules node scripts/labo/atelier.mjs controler [--base https://alphabette.eu]
 *        [--app id1,id2] [--cibles cibles.json] [--sortie atelier] [--precedent dossier-des-captures-précédentes]
 *   node scripts/labo/atelier.mjs jury <dossier atelier>      → <dossier>/jury.json (badge « Testé au Labo »)
 *
 * Agents : Douanier (traceurs, secrets, mineurs, appels non déclarés, http://), Pouce (360 px, une main),
 * Opticien (contraste, tailles, noms, étiquettes, focus clavier, mode sombre), Poids Plume (poids, requêtes,
 * EcoIndex, polices externes, compression, durée), Phare (titre, description, Open Graph, h1, liens morts),
 * Parapluie (cookies tiers, liens légaux, avertissement IA, données sensibles), Témoin (capture 390 px,
 * page blanche, erreurs JavaScript, changement visuel depuis la veille).
 *
 * On ne clique sur rien et on ne saisit rien : seules la touche Tab et la bascule clair / sombre sont utilisées.
 * Le code des applications ne s'exécute que dans le navigateur (aucun accès aux secrets du dépôt) : le workflow
 * qui lance ce contrôle n'a aucun droit d'écriture (.github/workflows/labo-atelier.yml).
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyser, jury, nouvellesAlertes } from './atelier/analyse.mjs';
import { focusVisible, fondPrincipal, mesurerPage } from './atelier/mesures.mjs';
import { comparerCaptures } from './atelier/temoin.mjs';
import { MINEURS, SECRETS, estAlphabette, estExemple, hoteDe, traceurDe } from './atelier/listes.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const commande = args[0] && !args[0].startsWith('--') ? args[0] : 'controler';
const lireJson = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const ecrireJson = (f, d) => { mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); };

if (commande === 'jury') {
  const dossier = args[1] || 'atelier';
  const hist = path.join(dossier, 'historique');
  const jours = existsSync(hist) ? readdirSync(hist).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => lireJson(path.join(hist, f), {})) : [];
  const apps = jury(jours);
  ecrireJson(path.join(dossier, 'jury.json'), { date: new Date().toISOString(), regle: 'Dernier contrôle sans point bloquant ni point important de sécurité ou légal, contrôle technique ≥ 85/100 (Pouce, Opticien et Poids Plume ≥ 75), aucune erreur JavaScript, et au moins 3 jours de contrôle réussi sur les 7 derniers.', apps });
  console.log(`Jury : ${Object.values(apps).filter((a) => a.teste_au_labo).length}/${Object.keys(apps).length} application(s) « Testé au Labo ».`);
  process.exit(0);
}
if (commande !== 'controler') {
  console.error('Usage : atelier.mjs controler [--base …] [--app …] [--cibles …] [--sortie …] [--precedent …] | atelier.mjs jury <dossier>');
  process.exit(2);
}

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = (opt('base', 'https://alphabette.eu')).replace(/\/$/, '');
const SORTIE = opt('sortie', 'atelier');
const PRECEDENT = opt('precedent');
const filtre = opt('app')?.split(',').filter(Boolean);
const masquer = (t) => String(t ?? '').replace(/\b((?:https?|wss?):\/\/[^\s?#"'<>)]+)[?#][^\s"'<>)]*/gi, '$1?…').replace(/\b[A-Za-z0-9_\-+/=]{32,}\b/g, '[masqué]').slice(0, 200);

/** Applications à contrôler : celles publiées sur le Laboratoire (eu/api/apps.json), ou une liste fournie. */
async function cibles() {
  if (opt('cibles')) return lireJson(opt('cibles'), []);
  const r = await fetch(`${BASE}/api/apps.json?t=${Date.now()}`).then((x) => x.json()).catch(() => ({ apps: [] }));
  return (r.apps ?? [])
    .filter((a) => a.status === 'actif' && a.url && a.url !== '#')
    .map((a) => ({
      id: a.id, nom: a.name, url: new URL(a.url_app || a.url, BASE).href, url_publique: new URL(a.url, BASE).href,
      communaute: Boolean(a.communaute), heberge: Boolean(a.heberge), ref: a.ref ?? undefined, reseau_autorise: a.reseau_autorise ?? [],
    }));
}

/** Liens morts (Phare) : 20 liens internes et 8 externes au plus, en parallèle par 6. */
async function liensMorts(liens, urlApp) {
  const choix = [...liens.filter((l) => l.interne).slice(0, 20), ...liens.filter((l) => !l.interne).slice(0, 8)].filter((l) => l.url.split('#')[0] !== urlApp.split('#')[0]);
  const morts = [];
  const tester = async (l) => {
    const essai = async (methode) => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      try { return (await fetch(l.url, { method: methode, redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Atelier Alphabette ; contrôle des liens)' } })).status; }
      catch { return 0; }
      finally { clearTimeout(t); }
    };
    let s = await essai('HEAD');
    if (s === 0 || s === 403 || s === 405 || s === 501) s = await essai('GET');
    // 401/403/429 : le lien existe mais demande une connexion ou limite les robots — pas un lien mort.
    if (s === 0 || s === 404 || s === 410 || s >= 500) morts.push({ url: l.url, statut: s || 'injoignable' });
  };
  for (let i = 0; i < choix.length; i += 6) await Promise.all(choix.slice(i, i + 6).map(tester));
  return morts;
}

async function controlerUne(navigateur, cible) {
  const m = { cible, date: new Date().toISOString(), erreurs: [], traceurs: [], mineurs: [], secrets: [], statique: cible.statique ?? [], reseau: { requetes: [] } };
  const ctx = await navigateur.newContext({
    viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR',
    colorScheme: 'light', serviceWorkers: 'block', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 AtelierAlphabette',
  });
  const page = await ctx.newPage();
  const hoteApp = hoteDe(cible.url);
  const enCours = [];
  const vusTraceurs = new Set();
  const vusSecrets = new Set();
  const noterUrl = (url) => {
    const t = traceurDe(url);
    if (t && !vusTraceurs.has(t)) { vusTraceurs.add(t); m.traceurs.push({ hote: hoteDe(url), liste: t }); }
    if (MINEURS.test(url) && m.mineurs.length < 3) m.mineurs.push(masquer(url));
  };
  page.on('request', (req) => noterUrl(req.url()));
  page.on('requestfinished', (req) => enCours.push((async () => {
    const url = req.url();
    if (!/^https?:/.test(url)) return;
    const rep = await req.response().catch(() => null);
    const tailles = await req.sizes().catch(() => ({}));
    const h = rep ? rep.headers() : {};
    const hote = hoteDe(url);
    const type = req.resourceType();
    m.reseau.requetes.push({ url: masquer(url), hote, type, taille: tailles.responseBodySize ?? 0, statut: rep?.status() ?? 0, encodage: h['content-encoding'] || '', mime: (h['content-type'] || '').split(';')[0] });
    const premier = hote === hoteApp || estAlphabette(hote) || hote === '127.0.0.1' || hote === 'localhost';
    if (rep && ['script', 'document'].includes(type) && (tailles.responseBodySize ?? 0) < 3 * 1024 * 1024) {
      const texte = await rep.text().catch(() => '');
      if (MINEURS.test(texte) && m.mineurs.length < 3) m.mineurs.push(`${url.split('/').pop().split('?')[0] || hote} (code de minage)`);
      if (premier) {
        for (const s of SECRETS) {
          for (const x of texte.matchAll(s.re)) {
            if (estExemple(x[0]) || m.secrets.length >= 6 || vusSecrets.has(x[0])) continue;
            vusSecrets.add(x[0]);
            const autour = texte.slice(Math.max(0, x.index - 300), x.index + 300);
            m.secrets.push({ nom: s.nom, fichier: url.split('/').pop().split('?')[0] || 'index.html', extrait: `${x[0].slice(0, 6)}…${x[0].slice(-3)}`, publique: Boolean(s.publique?.test(autour)) });
          }
        }
      }
    }
  })()));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (/^https?:/.test(url)) m.reseau.requetes.push({ url: masquer(url), hote: hoteDe(url), type: req.resourceType(), taille: 0, statut: 0, echec: req.failure()?.errorText ?? '' });
  });
  page.on('pageerror', (e) => { if (m.erreurs.length < 8) m.erreurs.push(masquer(`${e.name}: ${e.message}`)); });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    if (/Failed to load resource|net::ERR_|Content Security Policy|Refused to (load|connect|frame)/.test(t)) return; // ressources absentes et blocages voulus du bac à sable
    if (m.erreurs.length < 8) m.erreurs.push(masquer(t));
  });
  await ctx.addInitScript(() => {
    window.__abLcp = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__abLcp = Math.max(window.__abLcp, e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch { /* ancien navigateur */ }
  });

  try {
    const rep = await page.goto(cible.url, { waitUntil: 'load', timeout: 45000 });
    const statut = rep?.status() ?? 0;
    m.chargement = { ok: statut > 0 && statut < 400, statut };
    if (!m.chargement.ok) m.chargement.erreur = `réponse HTTP ${statut}`;
  } catch (e) {
    m.chargement = { ok: false, statut: 0, erreur: masquer(e.message.split('\n')[0]) };
  }

  if (m.chargement.ok) {
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    const perf = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      return { duree: n ? Math.round(n.loadEventEnd || n.domContentLoadedEventEnd || 0) : null, lcp: Math.round(window.__abLcp || 0) };
    }).catch(() => ({ duree: null, lcp: 0 }));
    m.chargement.duree = Math.max(perf.duree ?? 0, perf.lcp ?? 0) || perf.duree;
    m.page = await page.evaluate(mesurerPage).catch((e) => { m.erreurs.push(masquer(`Mesure impossible : ${e.message}`)); return null; });

    // Opticien : parcours au clavier (12 Tab) — le contour de focus est-il visible ?
    const vus = new Map();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab').catch(() => {});
      const f = await page.evaluate(focusVisible).catch(() => null);
      if (f && !vus.has(f.nom + i)) vus.set(f.nom + i, f);
    }
    const focus = [...vus.values()];
    m.focus = { atteints: focus.length, visibles: focus.filter((f) => f.visible).length };
    await page.evaluate(() => document.activeElement?.blur?.()).catch(() => {});

    // Opticien : le fond change-t-il en mode sombre ?
    const clair = await page.evaluate(fondPrincipal).catch(() => null);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500);
    const sombre = await page.evaluate(fondPrincipal).catch(() => null);
    await page.emulateMedia({ colorScheme: 'light' });
    m.sombre = { change: Boolean(clair && sombre && clair !== sombre) };

    // Parapluie : cookies déposés par d'autres domaines que l'application.
    m.cookiesTiers = [...new Set((await ctx.cookies()).map((c) => c.domain.replace(/^\./, '')).filter((d) => d && d !== hoteApp && !hoteApp.endsWith('.' + d) && !estAlphabette(d)))];

    // Témoin : capture 390 × 844 de l'écran d'accueil, comparée à la précédente.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    const image = await page.screenshot({ type: 'jpeg', quality: 70 }).catch(() => null);
    if (image) {
      const fichier = path.join(SORTIE, 'captures', `${cible.id}.jpg`);
      mkdirSync(path.dirname(fichier), { recursive: true });
      writeFileSync(fichier, image);
      const avant = PRECEDENT && existsSync(path.join(PRECEDENT, `${cible.id}.jpg`)) ? readFileSync(path.join(PRECEDENT, `${cible.id}.jpg`)).toString('base64') : null;
      const c = await comparerCaptures(navigateur, image.toString('base64'), avant).catch(() => ({ dominante: null, changement: null }));
      m.temoin = { capture: `captures/${cible.id}.jpg`, ...c };
    }
  }
  await Promise.all(enCours);
  await ctx.close();
  if (m.page) m.liensMorts = await liensMorts(m.page.phare.liens, cible.url);
  return analyser(m);
}

/* ------------------------------------------------------------------------ */

const liste = (await cibles()).filter((c) => !filtre || filtre.includes(c.id));
// Rien à contrôler (par exemple une appli du collectif pas encore publiée) : ce n'est pas une erreur.
if (!liste.length) { console.error(`Aucune application à contrôler${filtre ? ` parmi : ${filtre.join(', ')}` : ''}.`); process.exit(0); }
const navigateur = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--disable-dev-shm-usage'] });
const indexF = path.join(SORTIE, 'index.json');
const precedentIndex = lireJson(indexF, { apps: {} });
const index = { date: new Date().toISOString(), base: BASE, apps: filtre ? { ...(precedentIndex.apps ?? {}) } : {} };
const resume = ['## Atelier qualité', '', '| Application | Note | Contrôle technique | Bloquants | Importants |', '|---|---|---|---|---|'];
for (const cible of liste) {
  let r;
  try {
    r = await controlerUne(navigateur, cible);
  } catch (e) {
    console.error(`⚠ ${cible.id} : ${e.message}`);
    continue;
  }
  ecrireJson(path.join(SORTIE, 'rapports', `${cible.id}.json`), r);
  index.apps[cible.id] = {
    id: r.id, nom: r.nom, url: cible.url_publique ?? r.url, communaute: r.communaute, heberge: r.heberge, ...(r.ref ? { ref: r.ref } : {}),
    date: r.date, note: r.note, controle_technique: r.controle_technique, scores: r.scores, apte: r.apte, compte: r.compte,
    bloquants: r.problemes.filter((p) => p.gravite === 'bloquant').map((p) => p.titre),
  };
  resume.push(`| ${r.nom} | ${r.note}/100 | ${r.controle_technique}/100 | ${r.compte.bloquant} | ${r.compte.important} |`);
  console.error(`${r.compte.bloquant ? '⛔' : r.apte ? '✅' : '•'} ${r.nom} : note ${r.note}, contrôle technique ${r.controle_technique} (${r.compte.bloquant} bloquant, ${r.compte.important} important, ${r.compte.conseil} conseil)`);
}
await navigateur.close();

ecrireJson(indexF, index);
ecrireJson(path.join(SORTIE, 'historique', `${index.date.slice(0, 10)}.json`), index);
const alertes = nouvellesAlertes(precedentIndex, index);
ecrireJson(path.join(SORTIE, 'alertes.json'), { date: index.date, alertes });
if (alertes.length) resume.push('', '### Nouveaux points bloquants', ...alertes.map((a) => `- ${a.nom} : ${a.titre}`));
writeFileSync(path.join(SORTIE, 'resume.md'), resume.join('\n') + '\n');
console.log(JSON.stringify({ controlees: Object.keys(index.apps).length, alertes: alertes.length }));
