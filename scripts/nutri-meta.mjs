/**
 * nutri-meta.mjs — relève les CONSTATS réels qui alimentent le Nutri-Score Numérique (Lot 6).
 *
 * Lit les fichiers réellement publiés de chaque application (dist-static/eu/apps/<clé>/), jamais le dépôt source :
 *   - origines extérieures appelées (src/href/url()/fetch/import d'adresses https) hors alphabette.* ;
 *   - traceurs et régies connus ; cookies publicitaires ; appel direct à speechSynthesis ;
 *   - base commune (alphabette-barre.js ou @alphabette/shell), voix alphabette-audio, manifeste + service worker ;
 *   - fournisseurs d'IA cités ; poids total.
 * Écrit api/labo/nutri.json (.eu et .fr). Une appli absente ou hébergée ailleurs n'y figure pas : pas de lettre inventée.
 *
 * Le calcul de la lettre est dans packages/shell/src/nutriscore.ts (lui aussi sans rien deviner).
 * Usage : node scripts/nutri-meta.mjs [dossier-publication=dist-static]
 */
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const TRACEURS = [
  'google-analytics.com', 'googletagmanager.com', 'doubleclick.net', 'googlesyndication.com', 'facebook.net', 'facebook.com/tr',
  'connect.facebook', 'hotjar.com', 'clarity.ms', 'mixpanel.com', 'segment.com', 'segment.io', 'amplitude.com', 'fullstory.com',
  'matomo.cloud', 'plausible.io', 'sentry.io', 'adservice.google', 'criteo.', 'taboola.com', 'outbrain.com', 'tiktok.com/i18n',
  'static.ads-twitter.com', 'linkedin.com/px', 'snap.licdn.com', 'posthog.com', 'umami.is', 'cloudflareinsights.com',
];
const IA_MISTRAL = /api\.mistral\.ai|mistral/i;
const IA_AUTRES = /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.deepseek\.com|api\.x\.ai|openrouter\.ai|api\.groq\.com/i;
const EXT_TEXTE = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg']);

async function* fichiers(dossier) {
  for (const e of await readdir(dossier, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) { if (e.name !== 'beta' && e.name !== 'node_modules') yield* fichiers(p); } else yield p;
  }
}

const estAlphabette = (hote) => /(^|\.)alphabette\.(fr|eu)$/i.test(hote);

/** Hôtes https:// cités dans un texte, hors alphabette.*, localhost et espaces de noms XML/SVG (jamais chargés). */
export function originesDans(texte) {
  const hotes = new Set();
  for (const m of texte.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?/gi)) {
    const h = m[1].toLowerCase();
    if (estAlphabette(h) || /^(www\.)?w3\.org$/.test(h) || /^(www\.)?schema\.org$/.test(h) || h === 'localhost') continue;
    hotes.add(h);
  }
  return hotes;
}

/**
 * Analyse un dossier d'application publié. `chargees` = origines réellement CHARGÉES (balises, url(), fetch, import) ;
 * une simple adresse dans un texte (lien « en savoir plus ») n'est pas une connexion : on ne compte que le chargé.
 */
export async function analyserDossier(dossier) {
  const chargees = new Set();
  const traceurs = new Set();
  const ia = new Set();
  let poids = 0, nb = 0;
  let baseCommune = false, voix = false, manifeste = false, sw = false, synthese = false, cookiesPub = false;
  for await (const f of fichiers(dossier)) {
    const taille = (await stat(f)).size;
    poids += taille; nb++;
    const nom = path.basename(f).toLowerCase();
    if (nom === 'sw.js' || nom === 'service-worker.js') sw = true;
    if (nom === 'manifest.json' || nom.endsWith('.webmanifest')) manifeste = true;
    if (!EXT_TEXTE.has(path.extname(f).toLowerCase()) || taille > 6_000_000) continue;
    const t = await readFile(f, 'utf8').catch(() => '');
    if (/alphabette-barre\.js|@alphabette\/shell|data-masquer=/.test(t) || /ab-eco|ab-barres/.test(t)) baseCommune = true;
    if (/alphabette-audio\.js|alphabetteAudio/.test(t)) voix = true;
    if (/speechSynthesis/.test(t) && !/alphabetteAudio|alphabette-audio/.test(t)) synthese = true;
    if (/doubleclick|__gads|_fbp|fbq\(/.test(t)) cookiesPub = true;
    if (IA_MISTRAL.test(t)) ia.add('mistral');
    if (IA_AUTRES.test(t)) ia.add('autre');
    // Origines chargées : balises, @import/url(), import(), fetch(), XMLHttpRequest, WebSocket.
    const motifs = [
      /\b(?:src|href|action|poster|data-src)\s*=\s*["']\s*(https?:\/\/[^"'\s>]+)/gi,
      /url\(\s*["']?(https?:\/\/[^)"'\s]+)/gi,
      /@import\s+["'](https?:\/\/[^"']+)/gi,
      /\bimport\s*\(\s*["'](https?:\/\/[^"']+)/gi,
      /\bfetch\(\s*["'`](https?:\/\/[^"'`]+)/gi,
      /\.open\(\s*["'][A-Z]+["']\s*,\s*["'](https?:\/\/[^"']+)/g,
      /new\s+WebSocket\(\s*["'](wss?:\/\/[^"']+)/g,
    ];
    for (const re of motifs) for (const m of t.matchAll(re)) for (const h of originesDans(m[1])) chargees.add(h);
  }
  // Les fournisseurs d'IA contactés à la demande de l'utilisateur (avec sa propre clé) ne sont pas des « connexions cachées » :
  // ils sont comptés par le critère IA, pas par l'origine tierce.
  const hotesIA = /(^|\.)(mistral\.ai|openai\.com|anthropic\.com|googleapis\.com|deepseek\.com|x\.ai|openrouter\.ai|groq\.com)$/i;
  // Traceur = origine réellement CHARGÉE qui figure dans la liste (citer un nom dans un texte n'est pas pister).
  for (const h of chargees) if (TRACEURS.some((x) => h.includes(x.split('/')[0]))) traceurs.add(h);
  const tierces = [...chargees].filter((h) => !hotesIA.test(h)).sort();
  return {
    originesTierces: tierces.length, hotes: tierces, traceurs: traceurs.size + (cookiesPub ? 1 : 0),
    baseCommune, voix: voix && !synthese, horsLigne: manifeste && sw,
    ia: ia.has('autre') ? 'autre' : ia.has('mistral') ? 'mistral' : 'aucune',
    poidsKo: Math.round(poids / 102.4) / 10, fichiers: nb, cookiesPub, syntheseDirecte: synthese,
  };
}

async function principal() {
  const racine = process.cwd();
  const sortie = path.join(racine, process.argv[2] ?? 'dist-static');
  const dossierApps = path.join(sortie, 'eu', 'apps');
  const resultat = {};
  for (const e of await readdir(dossierApps, { withFileTypes: true }).catch(() => [])) {
    if (!e.isDirectory()) continue;
    const c = await analyserDossier(path.join(dossierApps, e.name));
    if (!c.fichiers) continue;
    resultat[e.name] = { hebergeeFrance: true, ...c };
  }
  const contenu = JSON.stringify({ version: 1, genere: new Date().toISOString(), methode: 'analyse statique des fichiers publiés', apps: resultat }, null, 2) + '\n';
  for (const dest of [path.join(sortie, 'eu', 'api', 'labo'), path.join(sortie, 'api', 'labo')]) {
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, 'nutri.json'), contenu);
  }
  console.log(`nutri-meta : ${Object.keys(resultat).length} application(s) analysée(s)`);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await principal();
