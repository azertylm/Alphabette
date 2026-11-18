#!/usr/bin/env node
/**
 * scripts/labo/audit-reseau.mjs — Preuve « Zéro connaissance » : Certificat d'Audit Réseau.
 *
 *   NODE_PATH=/tmp/pw/node_modules node scripts/labo/audit-reseau.mjs <app_id> --url <adresse>
 *        [--autorises domaine1,domaine2] [--sortie certificats/]
 *
 * Environnement isolé : navigateur neuf (aucun cookie, aucune extension, aucun cache, service workers
 * autorisés car ils peuvent eux aussi émettre). On écoute TOUT ce qui sort : fetch, XHR, sendBeacon,
 * images / scripts, WebSocket (trames envoyées), y compris depuis les service workers.
 *
 * Méthode des « canaris » :
 *   - le localStorage est prérempli de valeurs uniques (CANARI-LS-…, dont une fausse clé d'API) ;
 *   - chaque champ de saisie visible reçoit une valeur unique (CANARI-SAISIE-…), puis on valide ;
 *   - à la fin, toutes les valeurs que l'appli a elle-même écrites dans le localStorage sont ajoutées.
 * Toute requête vers un domaine TIERS non autorisé qui contient l'une de ces valeurs (brute, encodée
 * en URL ou en Base64), dans l'adresse, les en-têtes ou le corps, est une fuite → certificat « NON CONFORME ».
 * Les requêtes vers un tiers non autorisé sont interceptées (bloquées) après avoir été enregistrées :
 * l'audit n'envoie jamais rien chez un tiers.
 *
 * Autorisés : alphabette.fr / alphabette.eu (et sous-domaines), les fournisseurs d'IA du routeur BYOK
 * (la clé de l'utilisateur n'est envoyée qu'à son fournisseur), et les domaines déclarés pour l'appli
 * dans data/apps-registry.json (`reseau_autorise`) ou par --autorises.
 *
 * Sorties : <sortie>/<app_id>.json (certificat) et <sortie>/<app_id>.svg (badge). La signature est
 * apposée par GitHub (attestation Sigstore, .github/workflows/audit-reseau.yml) :
 *   gh attestation verify <app_id>.json --repo azertylm/Alphabette
 * Limite honnête : une valeur chiffrée ou hachée par l'appli avant l'envoi n'est pas reconnaissable.
 */
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const appId = args[0];
if (!appId || appId.startsWith('--')) { console.error('Usage : audit-reseau.mjs <app_id> --url <adresse> [--autorises a,b] [--sortie dossier]'); process.exit(2); }

const FOURNISSEURS_IA = ['generativelanguage.googleapis.com', 'api.mistral.ai', 'api.anthropic.com', 'api.openai.com', 'api.deepseek.com', 'api.x.ai'];
const INTERDITS = /(payer|paiement|acheter|achat|commander|supprimer|effacer|vider|réinitialiser|déconnexion|don\b|virement|stripe|delete|remove|pay|buy|logout|reset)/i;

const registre = JSON.parse(readFileSync(path.join(RACINE, 'data/apps-registry.json'), 'utf8'));
const fiche = (registre.apps ?? []).find((a) => a.id === appId) ?? {};
async function adresse() {
  if (opt('url')) return opt('url');
  for (const base of ['https://alphabette.fr', 'https://alphabette.eu']) {
    const r = await fetch(`${base}/api/apps.json?t=${Date.now()}`).then((x) => x.json()).catch(() => ({}));
    const a = (r.apps ?? []).find((x) => x.id === appId);
    if (a?.url) return new URL(a.url, base).href;
  }
  return null;
}
const url = await adresse();
if (!url) { console.error(`Adresse introuvable pour ${appId}`); process.exit(2); }
const origine = new URL(url).hostname;
const autorises = [...new Set([...FOURNISSEURS_IA, ...(fiche.reseau_autorise ?? []), ...(opt('autorises')?.split(',').filter(Boolean) ?? [])])];
const premierePartie = (h) => /(^|\.)alphabette\.(fr|eu)$/i.test(h) || h === origine || h === 'localhost' || h === '127.0.0.1';
const estAutorise = (h) => autorises.some((d) => h === d || h.endsWith('.' + d));

/* Canaris */
const jeton = () => randomBytes(6).toString('hex');
const canarisLS = {
  audit_canari_note: `CANARI-LS-${jeton()}`,
  audit_canari_profil: JSON.stringify({ nom: `CANARI-NOM-${jeton()}`, email: `canari.${jeton()}@exemple.invalid` }),
  audit_canari_cle_api: `sk-CANARI${jeton()}${jeton()}`,
};
const canariSaisie = `CANARI-SAISIE-${jeton()}`;

const requetes = [];
const navigateur = await chromium.launch({ args: ['--disable-extensions'] });
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'allow' });
await ctx.addInitScript((c) => { try { for (const [k, v] of Object.entries(c)) localStorage.setItem(k, v); } catch { /* rien */ } }, canarisLS);

await ctx.route('**/*', async (route) => {
  const req = route.request();
  let h = '';
  try { h = new URL(req.url()).hostname; } catch { /* data:, blob: */ }
  const enr = { url: req.url(), hote: h, methode: req.method(), type: req.resourceType(), corps: req.postData() ?? '', entetes: JSON.stringify(await req.allHeaders().catch(() => ({}))) };
  if (h) requetes.push(enr);
  if (!h || premierePartie(h) || estAutorise(h)) return route.continue();
  enr.bloquee = true;
  return route.abort('blockedbyclient');
});
const page = await ctx.newPage();
page.on('websocket', (ws) => {
  let h = ''; try { h = new URL(ws.url()).hostname; } catch { /* rien */ }
  ws.on('framesent', (f) => requetes.push({ url: ws.url(), hote: h, methode: 'WS', type: 'websocket', corps: String(f.payload ?? ''), entetes: '' }));
});

await page.goto(url, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(3000);

// Saisies : chaque champ visible reçoit un canari, puis Entrée.
const champs = await page.$$('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=submit]):not([type=button]), textarea, [contenteditable="true"]');
let remplis = 0;
for (const c of champs.slice(0, 12)) {
  try {
    if (!(await c.isVisible()) || !(await c.isEditable())) continue;
    await c.fill(canariSaisie, { timeout: 2000 });
    await c.press('Enter', { timeout: 1000 }).catch(() => undefined);
    remplis++;
    await page.waitForTimeout(400);
  } catch { /* champ capricieux : suivant */ }
}
// Quelques boutons sans risque (jamais payer, supprimer, se déconnecter…).
const boutons = await page.$$('button, [role=button], input[type=submit]');
let cliques = 0;
for (const b of boutons.slice(0, 15)) {
  try {
    const t = ((await b.innerText().catch(() => '')) + ' ' + ((await b.getAttribute('aria-label')) ?? '')).trim();
    if (INTERDITS.test(t) || !(await b.isVisible())) continue;
    await b.click({ timeout: 1500, trial: false });
    cliques++;
    await page.waitForTimeout(500);
    if (new URL(page.url()).hostname !== origine) await page.goBack().catch(() => undefined);
  } catch { /* suivant */ }
}
await page.waitForTimeout(3000);

// Valeurs écrites par l'appli elle-même dans le localStorage.
const lsApp = await page.evaluate((exclus) => {
  const v = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || exclus.includes(k)) continue;
      const val = localStorage.getItem(k) ?? '';
      if (val.length >= 8 && val.length <= 4000) v.push({ cle: k, valeur: val });
      // Morceaux significatifs (≥ 8 caractères, pas de simples booléens / nombres / dates).
      for (const m of val.match(/[^"{}\[\],:]{8,}/g) ?? []) if (!/^(true|false|null|\d+(\.\d+)?|\d{4}-\d\d-\d\d.*)$/.test(m.trim())) v.push({ cle: k, valeur: m.trim().slice(0, 200) });
    }
  } catch { /* rien */ }
  return v.slice(0, 300);
}, Object.keys(canarisLS)).catch(() => []);
const pageHtml = await page.content();
await navigateur.close();

/* Analyse */
// Base64 « glissant » : la valeur est reconnue même au milieu d'un texte plus long encodé en Base64.
const b64Glissant = (s) => [0, 1, 2].map((k) => {
  const b = Buffer.from('x'.repeat(k) + s).toString('base64');
  return b.slice(k ? 4 : 0, b.length - 4);
});
const variantes = (s) => [s, encodeURIComponent(s), ...b64Glissant(s), ...b64Glissant(s).map((b) => b.replace(/\+/g, '-').replace(/\//g, '_'))]
  .filter((x) => x.length >= 8);
const temoins = [
  ...Object.entries(canarisLS).flatMap(([k, v]) => [v, ...(v.startsWith('{') ? Object.values(JSON.parse(v)) : [])].map((x) => ({ origine: `localStorage « ${k} » (canari)`, valeur: String(x) }))),
  { origine: 'saisie utilisateur (canari)', valeur: canariSaisie },
  ...lsApp.map((x) => ({ origine: `localStorage « ${x.cle} » (écrit par l'appli)`, valeur: x.valeur })),
];
const fuites = [];
const parHote = {};
for (const r of requetes) {
  const classe = premierePartie(r.hote) ? 'premiere_partie' : estAutorise(r.hote) ? 'autorisee' : 'tierce';
  (parHote[r.hote] ??= { hote: r.hote, classe, requetes: 0, bloquees: 0, types: new Set() });
  parHote[r.hote].requetes++; if (r.bloquee) parHote[r.hote].bloquees++; parHote[r.hote].types.add(r.type);
  if (classe === 'premiere_partie') continue;
  const tout = `${r.url}\n${r.entetes}\n${r.corps}`;
  for (const t of temoins) {
    if (classe === 'autorisee' && FOURNISSEURS_IA.some((d) => r.hote === d || r.hote.endsWith('.' + d)) && t.origine.includes('saisie')) continue; // le texte saisi part vers l'IA choisie : c'est le service
    if (variantes(t.valeur).some((v) => tout.includes(v))) {
      if (!fuites.some((f) => f.vers === r.hote && f.donnee === t.origine && f.type === r.type)) fuites.push({ vers: r.hote, classe, type: r.type, methode: r.methode, donnee: t.origine, interceptee: !!r.bloquee });
    }
  }
}
const fuitesTierces = fuites.filter((f) => f.classe === 'tierce');
const destinations = Object.values(parHote).map((d) => ({ ...d, types: [...d.types] })).sort((a, b) => a.classe.localeCompare(b.classe) || b.requetes - a.requetes);

const certificat = {
  type: "Certificat d'Audit Réseau — Alphabette",
  version_format: 1,
  app_id: appId,
  nom: fiche.name ?? appId,
  url,
  audite_le: new Date().toISOString(),
  empreinte_page_sha256: createHash('sha256').update(pageHtml).digest('hex'),
  methode: {
    environnement: 'Chromium neuf, sans cookie ni extension, 390×844, service workers actifs',
    canaris: { localStorage: Object.keys(canarisLS).length, champs_remplis: remplis, boutons_actives: cliques, valeurs_de_l_appli: lsApp.length },
    ecoute: ['fetch', 'XMLHttpRequest', 'sendBeacon', 'ressources', 'WebSocket', 'service workers'],
    autorises: autorises,
    limite: "Une donnée chiffrée ou hachée par l'appli avant l'envoi n'est pas reconnaissable par cette méthode.",
  },
  destinations,
  resultat: {
    conforme: fuitesTierces.length === 0,
    verdict: fuitesTierces.length === 0 ? 'CONFORME — aucune donnée locale ni saisie envoyée à un tiers non autorisé' : 'NON CONFORME — données envoyées à un tiers non autorisé',
    fuites_tierces: fuitesTierces,
    envois_autorises: fuites.filter((f) => f.classe === 'autorisee'),
    tiers_contactes: destinations.filter((d) => d.classe === 'tierce').map((d) => d.hote),
  },
  verification: "Signé par GitHub (attestation Sigstore du dépôt azertylm/Alphabette) : gh attestation verify <fichier>.json --repo azertylm/Alphabette",
};
const canonique = JSON.stringify(certificat);
certificat.empreinte_certificat_sha256 = createHash('sha256').update(canonique).digest('hex');

/* Badge SVG */
const echapper = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ok = certificat.resultat.conforme;
const date = certificat.audite_le.slice(0, 10);
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="236" height="40" role="img" aria-label="Audit réseau ${ok ? 'conforme' : 'non conforme'} — ${echapper(certificat.nom)} — ${date}">
<title>Certificat d'Audit Réseau Alphabette — ${echapper(certificat.nom)} — ${ok ? 'conforme' : 'non conforme'} le ${date} — SHA-256 ${certificat.empreinte_certificat_sha256}</title>
<rect width="236" height="40" rx="6" fill="#14161c"/><rect x="118" width="118" height="40" rx="6" fill="${ok ? '#1f6f43' : '#9b1c1c'}"/><rect x="118" width="8" height="40" fill="${ok ? '#1f6f43' : '#9b1c1c'}"/>
<g font-family="system-ui,sans-serif" font-size="12" fill="#fff"><text x="10" y="17" font-weight="700">🔒 Audit réseau</text><text x="10" y="32" font-size="10" fill="#c9ccd4">zéro connaissance</text>
<text x="128" y="17" font-weight="700">${ok ? 'Conforme' : 'Non conforme'}</text><text x="128" y="32" font-size="10">${date} · ${certificat.empreinte_certificat_sha256.slice(0, 8)}</text></g>
<metadata>{"app_id":"${appId}","conforme":${ok},"audite_le":"${certificat.audite_le}","empreinte_certificat_sha256":"${certificat.empreinte_certificat_sha256}"}</metadata></svg>
`;

const dossier = opt('sortie') ?? path.join(RACINE, 'certificats');
mkdirSync(dossier, { recursive: true });
writeFileSync(path.join(dossier, `${appId}.json`), JSON.stringify(certificat, null, 2) + '\n');
writeFileSync(path.join(dossier, `${appId}.svg`), badge);
const indexF = path.join(dossier, 'index.json');
const index = existsSync(indexF) ? JSON.parse(readFileSync(indexF, 'utf8')) : { apps: {} };
index.apps[appId] = { conforme: ok, audite_le: certificat.audite_le, empreinte: certificat.empreinte_certificat_sha256 };
writeFileSync(indexF, JSON.stringify(index, null, 2) + '\n');
console.error(`${ok ? '✅' : '⛔'} ${appId} : ${certificat.resultat.verdict} (${requetes.length} requêtes, ${destinations.length} destinations, ${fuitesTierces.length} fuite(s))`);
process.exit(ok ? 0 : 1);
