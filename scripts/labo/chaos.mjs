/**
 * scripts/labo/chaos.mjs — « Agent Chaos » (l'Avocat du Diable) : audit nocturne des applis d'alphabette.eu.
 *
 *   node scripts/labo/chaos.mjs [https://alphabette.eu] > chaos.json
 *
 * Pour chaque appli du Laboratoire (eu/api/apps.json) et chaque petit écran (320×568, 280×653) :
 *  - écoute : exceptions non gérées, promesses rejetées, console.error, débordement horizontal ;
 *  - « rage clicking » : 12 clics en rafale sur les premiers boutons sans risque ;
 *  - clés BYOK : champ de clé vide puis clé invalide (« sk-chaos-invalide-0000 »), validation au clavier ;
 *  - hors-ligne brutal : coupure du réseau puis rechargement (test PWA : la page doit rester utilisable).
 * Aucun bouton qui paie, envoie, supprime ou publie n'est touché. Aucune vraie clé n'est utilisée.
 * Sortie : un rapport JSON (schéma `RapportChaos`, docs/labo/AGENT-CHAOS.md), rangé chaque nuit sur la branche
 * labo-donnees par .github/workflows/labo-chaos.yml, où les agents du Laboratoire le lisent comme des tickets.
 */
import { createRequire } from 'node:module';
// Playwright est installé à part (NODE_PATH), pas dans les dépendances du site.
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = (process.argv[2] || 'https://alphabette.eu').replace(/\/$/, '');
const ECRANS = [{ largeur: 320, hauteur: 568 }, { largeur: 280, hauteur: 653 }];
const INTERDITS = /(payer|paiement|acheter|achat|commander|envoyer|publier|poster|supprimer|effacer|vider|réinitialiser|reinitialiser|déconnexion|deconnexion|don\b|virement|stripe|delete|remove|pay|buy|send|publish|logout|reset)/i;
const CLE_INVALIDE = 'sk-chaos-invalide-0000';

const masquer = (t) => String(t ?? '').replace(/\b((?:https?|wss?):\/\/[^\s?#"'<>)]+)[?#][^\s"'<>)]*/gi, '$1?…').replace(/\b[A-Za-z0-9_\-+/=]{32,}\b/g, '[masqué]').slice(0, 300);

async function auditer(navigateur, app, ecran) {
  const contexte = await navigateur.newContext({ viewport: { width: ecran.largeur, height: ecran.hauteur }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'fr-FR' });
  const page = await contexte.newPage();
  const anomalies = [];
  let etape = 'chargement';
  const noter = (type, detail, extra = {}) => {
    const cle = `${type}|${etape}|${detail}`;
    if (!anomalies.some((a) => a._cle === cle)) anomalies.push({ _cle: cle, type, etape, detail: masquer(detail), ...extra });
  };
  page.on('pageerror', (e) => noter('exception', `${e.name}: ${e.message}`, { pile: masquer((e.stack || '').split('\n').slice(0, 3).join(' | ')) }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR_/.test(t)) return; // ressources manquantes (icônes…) et coupures voulues : bruit
    noter(/Uncaught \(in promise\)|Unhandled/.test(t) ? 'promesse_rejetee' : 'console_error', t);
  });

  const url = new URL(app.url, BASE).href;
  const debordement = async () => {
    const d = await page.evaluate(() => {
      const largeur = document.documentElement.clientWidth;
      const fautifs = [...document.querySelectorAll('body *')]
        .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > largeur + 1 && getComputedStyle(e).position !== 'fixed'; })
        .filter((e) => ![...e.children].some((c) => c.getBoundingClientRect().right > largeur + 1))
        .slice(0, 3)
        .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList[0] ? '.' + e.classList[0] : ''} (${Math.round(e.getBoundingClientRect().right)}px)`);
      return { exces: document.documentElement.scrollWidth - largeur, fautifs };
    }).catch(() => null);
    if (d && d.exces > 1) noter('debordement', `Défilement horizontal de ${d.exces}px à ${ecran.largeur}px de large`, { elements: d.fautifs });
  };

  try {
    // « load » + pause : les applis à flux continu (actualités, vidéos) n'atteignent jamais « networkidle ».
    const r = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(2500);
    if (!r || r.status() >= 400) noter('chargement', `Statut HTTP ${r ? r.status() : 'aucun'}`);
    await page.waitForTimeout(1500);
    await debordement();

    etape = 'rage-click';
    const boutons = await page.$$('button:visible, [role=button]:visible');
    let testes = 0;
    for (const b of boutons) {
      if (testes >= 4) break;
      const texte = ((await b.innerText().catch(() => '')) + ' ' + ((await b.getAttribute('aria-label')) || '')).trim();
      if (!texte || INTERDITS.test(texte)) continue;
      testes++;
      for (let i = 0; i < 12; i++) await b.click({ timeout: 800, force: true, noWaitAfter: true }).catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
    await debordement();

    etape = 'cle-byok';
    const champs = await page.$$('input[type=password]:visible, input[name*="key" i]:visible, input[placeholder*="clé" i]:visible, input[placeholder*="key" i]:visible, input[aria-label*="clé" i]:visible');
    for (const champ of champs.slice(0, 2)) {
      for (const valeur of ['', CLE_INVALIDE]) {
        await champ.fill(valeur).catch(() => {});
        await champ.press('Enter').catch(() => {});
        await page.waitForTimeout(800);
      }
    }
    const vide = await page.evaluate(() => (document.body?.innerText || '').trim().length < 20).catch(() => true);
    if (vide) noter('ecran_blanc', 'La page est vide après la saisie de clés vides ou invalides');

    etape = 'hors-ligne';
    await contexte.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const horsLigne = await page.evaluate(() => (document.body?.innerText || '').trim().length).catch(() => 0);
    const aUnSw = await page.evaluate(() => navigator.serviceWorker?.controller != null).catch(() => false);
    if (aUnSw && horsLigne < 20) noter('pwa_hors_ligne', "Appli installable (service worker) mais page vide hors ligne");
    await contexte.setOffline(false);
  } catch (e) {
    noter('audit_interrompu', String(e.message || e));
  }
  await contexte.close();
  return anomalies.map(({ _cle, ...a }) => a);
}

const navigateur = await chromium.launch();
const { apps = [] } = await fetch(`${BASE}/api/apps.json?t=${Date.now()}`).then((r) => r.json());
const rapport = { genere_le: new Date().toISOString(), base: BASE, agent: 'Agent Chaos', apps: [] };
const cibles = apps
  .filter((a) => a.status === 'actif' && a.url && (!/^https?:/.test(a.url) || a.url.startsWith(BASE)))
  .slice(0, Number(process.env.CHAOS_MAX) || Infinity);
for (const app of cibles) {
  const resultats = [];
  for (const ecran of ECRANS) resultats.push(...(await auditer(navigateur, app, ecran)).map((a) => ({ ...a, ecran: `${ecran.largeur}x${ecran.hauteur}` })));
  // Un même problème vu sur les deux écrans ne compte qu'une fois.
  const uniques = [];
  for (const a of resultats) if (!uniques.some((u) => u.type === a.type && u.detail.replace(/\d+px/g, '') === a.detail.replace(/\d+px/g, ''))) uniques.push(a);
  rapport.apps.push({
    app_id: app.id,
    nom: app.name,
    url: new URL(app.url, BASE).href,
    anomalies: uniques.map((a) => ({
      ...a,
      ticket: `[Agent Chaos] ${app.name} — ${a.type.replace(/_/g, ' ')} (${a.etape}, ${a.ecran}) : ${a.detail}`.slice(0, 1000),
    })),
  });
  console.error(`${uniques.length ? '✘' : '✔'} ${app.name} : ${uniques.length} anomalie(s)`);
}
await navigateur.close();
rapport.total = rapport.apps.reduce((n, a) => n + a.anomalies.length, 0);
console.log(JSON.stringify(rapport, null, 2));
