/**
 * collect-apps.mjs — rassemble les applications pour les deux sites.
 *
 * L'offre OVH Perso n'autorise qu'UN site relié à GitHub : le hub publie donc
 * aussi les applications. Un seul dossier OVH sert deux sites (voir build-static.mjs) :
 *
 *  - dist-static/eu/apps/<clé>/  → alphabette.eu/apps/<clé>/ (Laboratoire) :
 *      branche principale de chaque dépôt (ou « branch »), avec le capteur d'erreurs ;
 *      « beta » : { "branch": "…" } publie aussi alphabette.eu/apps/<clé>/beta/.
 *  - dist-static/apps/<clé>/     → alphabette.fr/apps/<clé>/ et <clé>.alphabette.fr (vitrine) :
 *      « vitrine » : { "ref": "<commit>" } → version FIGÉE à ce commit ;
 *      sans « vitrine » → page de redirection vers alphabette.eu (le .htaccess du hub redirige le reste)
 *      (sauf une appli qui a son propre nom de domaine, ex. proxilien.fr : elle y reste servie).
 *
 * Source : data/apps-sources.json  →  { "apps": { "<clé>": { "repo": "owner/nom", "branch"?, "dir"?, "vitrine"?, "beta"? } } }
 *  - dépôt avec package.json : installé puis construit — `bun run build:static` s'il existe,
 *    sinon `vite build --base=./` — on publie `dir` (dist par défaut) ;
 *  - dépôt sans package.json (HTML simple) : publié tel quel.
 * Une application du laboratoire en échec n'empêche pas la publication des autres.
 * Une application de la VITRINE en échec arrête tout : alphabette.fr garde alors sa version en ligne.
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const racine = process.cwd();
const sortieFr = path.join(racine, 'dist-static', 'apps');
const sortieEu = path.join(racine, 'dist-static', 'eu', 'apps');
const { apps } = JSON.parse(await readFile(path.join(racine, 'data', 'apps-sources.json'), 'utf8'));
const tmp = path.join(os.tmpdir(), 'alphabette-apps');
const existe = (p) => stat(p).then(() => true, () => false);
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const lire = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim();
const IGNORES = new Set(['.git', '.github', 'node_modules', 'README.md', 'LICENSE']);

await rm(tmp, { recursive: true, force: true });
await mkdir(sortieFr, { recursive: true });
await mkdir(sortieEu, { recursive: true });
const echecs = [];
const echecsVitrine = [];

/** Récupère `ref` (branche ou commit) du dépôt, le construit, renvoie { dossier, sha }. */
async function construire(cle, src, ref, nomDossier) {
  const depot = path.join(tmp, nomDossier);
  const jeton = process.env.APPS_TOKEN ? `x-access-token:${process.env.APPS_TOKEN}@` : '';
  const url = `https://${jeton}github.com/${src.repo}.git`;
  if (/^[0-9a-f]{40}$/.test(ref ?? '')) {
    // Commit exact (version figée) : récupération ciblée de ce seul commit.
    run('git', ['init', '-q', depot]);
    run('git', ['remote', 'add', 'origin', url], depot);
    run('git', ['fetch', '-q', '--depth', '1', 'origin', ref], depot);
    run('git', ['checkout', '-q', 'FETCH_HEAD'], depot);
  } else {
    const args = ['clone', '-q', '--depth', '1'];
    if (ref) args.push('--branch', ref);
    run('git', [...args, url, depot]);
  }
  const sha = lire('git', ['rev-parse', 'HEAD'], depot);

  let dossier = depot;
  if (await existe(path.join(depot, 'package.json'))) {
    run('bun', ['install'], depot);
    const { scripts = {} } = JSON.parse(await readFile(path.join(depot, 'package.json'), 'utf8'));
    // Une appli qui fournit « build:static » sait se construire sans serveur (API figée, clé utilisateur).
    if (scripts['build:static']) run('bun', ['run', 'build:static'], depot);
    else run('bunx', ['vite', 'build', '--base=./'], depot);
    dossier = path.join(depot, src.dir ?? 'dist');
  }
  if (!(await existe(path.join(dossier, 'index.html')))) throw new Error('index.html introuvable');
  return { dossier, sha };
}

async function publier(dossier, cible) {
  await rm(cible, { recursive: true, force: true });
  await cp(dossier, cible, { recursive: true, filter: (f) => !IGNORES.has(path.basename(f)) });
}

/** Ajoute le capteur d'erreurs du laboratoire en tête de la page (copie .eu uniquement). */
async function injecterCapteur(fichier) {
  let html;
  try { html = await readFile(fichier, 'utf8'); } catch { return; }
  if (html.includes('/labo/capteur.js')) return;
  const balise = '<script src="/labo/capteur.js"></script>';
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n    ${balise}`) : balise + html;
  await writeFile(fichier, html);
}

/**
 * Service worker « interrupteur » : remplace celui d'une appli installée (PWA) sur son ancienne adresse .fr.
 * Il se désinscrit et recharge la page, qui redirige alors vers alphabette.eu (sinon l'ancienne copie
 * enregistrée dans le navigateur resterait affichée).
 */
const SW_INTERRUPTEUR = `/* Généré par scripts/collect-apps.mjs : cette appli a rejoint le Laboratoire alphabette.eu. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.map((c) => caches.delete(c)));
    await self.registration.unregister();
    const fenetres = await self.clients.matchAll({ type: 'window' });
    fenetres.forEach((f) => f.navigate(f.url));
  })());
});
`;

/** Sur alphabette.fr : l'application est au Laboratoire, on y envoie le visiteur (jamais une 404). */
async function redirection(cle, dossierApp) {
  const cible = path.join(sortieFr, cle);
  const adresse = `https://alphabette.eu/apps/${cle}/`;
  await rm(cible, { recursive: true, force: true });
  await mkdir(cible, { recursive: true });
  // Pas de .htaccess ici : il empêcherait le .htaccess du hub d'envoyer alphabette.eu/apps/<clé>/
  // vers eu/apps/<clé>/ (boucle de redirection). Les adresses alphabette.fr/apps/<clé>/… sont
  // redirigées par le .htaccess du hub ; le sous-domaine <clé>.alphabette.fr par cette page.
  await writeFile(
    path.join(cible, 'index.html'),
    `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Cette application est au Laboratoire Alphabette</title>
<meta http-equiv="refresh" content="0;url=${adresse}">
<script>location.replace(${JSON.stringify(adresse)} + location.search + location.hash);</script>
<style>body{font:1.25rem/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;color:#1c1917;background:#fbf8f3}a{color:#0f766e;font-weight:800}</style>
</head>
<body>
<p>Cette application est en test sur le <strong>Laboratoire Alphabette</strong>, où vous pouvez l'essayer et donner votre avis :</p>
<p><a href="${adresse}">${adresse.replace('https://', '')}</a></p>
</body>
</html>
`,
  );
  // Même nom que le service worker de l'appli (bonplan_sw.js, sw.js…) : l'ancien est remplacé puis effacé.
  if (dossierApp) {
    for (const nom of await readdir(dossierApp).catch(() => [])) {
      if (/(^|[-_.])(sw|service-?worker)\.js$/i.test(nom)) await writeFile(path.join(cible, nom), SW_INTERRUPTEUR);
    }
  }
}

for (const [cle, src] of Object.entries(apps)) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(cle)) { echecs.push(`${cle} (clé invalide)`); continue; }

  // 1. Laboratoire (.eu) : dernière version.
  let principal = null;
  try {
    principal = await construire(cle, src, src.branch, cle);
    await publier(principal.dossier, path.join(sortieEu, cle));
    await injecterCapteur(path.join(sortieEu, cle, 'index.html'));
    console.log(`✔ .eu  ${cle}  ←  ${src.repo} (${principal.sha.slice(0, 7)})`);
  } catch (err) {
    echecs.push(`${cle} (${err.message.split('\n')[0]})`);
    console.error(`✘ .eu  ${cle} : ${err.message.split('\n')[0]}`);
  }

  // 2. Bêta (.eu/apps/<clé>/beta/) : variante proposée par les agents.
  if (src.beta?.branch) {
    try {
      const beta = await construire(cle, src, src.beta.branch, `${cle}--beta`);
      await publier(beta.dossier, path.join(sortieEu, cle, 'beta'));
      await injecterCapteur(path.join(sortieEu, cle, 'beta', 'index.html'));
      console.log(`✔ .eu  ${cle}/beta  ←  ${src.beta.branch} (${beta.sha.slice(0, 7)})`);
    } catch (err) {
      echecs.push(`${cle}/beta (${err.message.split('\n')[0]})`);
      console.error(`✘ .eu  ${cle}/beta : ${err.message.split('\n')[0]}`);
    }
  }

  // 3. Vitrine (.fr).
  const domainePropre = (src.domains ?? []).some((d) => !d.endsWith('.alphabette.fr'));
  try {
    if (src.vitrine?.ref) {
      // Version figée : même commit que la branche principale → même construction, sinon on construit ce commit.
      const fige = principal && principal.sha === src.vitrine.ref ? principal : await construire(cle, src, src.vitrine.ref, `${cle}--vitrine`);
      await publier(fige.dossier, path.join(sortieFr, cle));
      console.log(`✔ .fr  ${cle}  ←  version figée ${src.vitrine.ref.slice(0, 7)}`);
    } else if (domainePropre && principal) {
      // Appli avec son propre domaine (proxilien.fr) : elle y reste servie ; ses adresses .fr vont au Laboratoire (.htaccess).
      await publier(principal.dossier, path.join(sortieFr, cle));
      console.log(`✔ .fr  ${cle}  (domaine propre : ${src.domains.join(', ')})`);
    } else {
      await redirection(cle, principal?.dossier);
      console.log(`↪ .fr  ${cle}  →  alphabette.eu/apps/${cle}/`);
    }
  } catch (err) {
    (src.vitrine ? echecsVitrine : echecs).push(`${cle} (${err.message.split('\n')[0]})`);
    console.error(`✘ .fr  ${cle} : ${err.message.split('\n')[0]}`);
  }
}

if (echecs.length) console.warn(`\nApplications non publiées : ${echecs.join(', ')}`);
if (echecsVitrine.length) {
  console.error(`\nVitrine alphabette.fr incomplète (${echecsVitrine.join(', ')}) : publication arrêtée, la version en ligne est conservée.`);
  process.exit(1);
}
