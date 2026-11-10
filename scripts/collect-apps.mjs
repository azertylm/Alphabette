/**
 * collect-apps.mjs — rassemble les applications dans dist-static/apps/<clé>/.
 *
 * L'offre OVH Perso n'autorise qu'UN site relié à GitHub : le hub publie donc
 * aussi les applications, chacune dans son dossier. Chaque dossier est servi à
 * la fois sur https://alphabette.fr/apps/<clé>/ et sur son sous-domaine
 * (multisite OVH pointant sur alphabette/apps/<clé>).
 *
 * Source : data/apps-sources.json  →  { "apps": { "<clé>": { "repo": "owner/nom", "branch"?: "main", "dir"?: "dist" } } }
 *  - dépôt avec package.json : installé puis construit — `bun run build:static` s'il existe,
 *    sinon `vite build --base=./` — on publie `dir` (dist par défaut) ;
 *  - dépôt sans package.json (HTML simple) : publié tel quel.
 * Une application en échec n'empêche pas la publication des autres.
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const racine = process.cwd();
const sortie = path.join(racine, 'dist-static', 'apps');
const { apps } = JSON.parse(await readFile(path.join(racine, 'data', 'apps-sources.json'), 'utf8'));
const tmp = path.join(os.tmpdir(), 'alphabette-apps');
const existe = (p) => stat(p).then(() => true, () => false);
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const IGNORES = new Set(['.git', '.github', 'node_modules', 'README.md', 'LICENSE']);

await rm(tmp, { recursive: true, force: true });
await mkdir(sortie, { recursive: true });
const echecs = [];

for (const [cle, src] of Object.entries(apps)) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(cle)) { echecs.push(`${cle} (clé invalide)`); continue; }
  try {
    const depot = path.join(tmp, cle);
    const jeton = process.env.APPS_TOKEN ? `x-access-token:${process.env.APPS_TOKEN}@` : '';
    const args = ['clone', '--depth', '1'];
    if (src.branch) args.push('--branch', src.branch);
    run('git', [...args, `https://${jeton}github.com/${src.repo}.git`, depot]);

    let aPublier = depot;
    if (await existe(path.join(depot, 'package.json'))) {
      run('bun', ['install'], depot);
      const { scripts = {} } = JSON.parse(await readFile(path.join(depot, 'package.json'), 'utf8'));
      // Une appli qui fournit « build:static » sait se construire sans serveur (API figée, clé utilisateur).
      if (scripts['build:static']) run('bun', ['run', 'build:static'], depot);
      else run('bunx', ['vite', 'build', '--base=./'], depot);
      aPublier = path.join(depot, src.dir ?? 'dist');
    }
    if (!(await existe(path.join(aPublier, 'index.html')))) throw new Error('index.html introuvable');

    const cible = path.join(sortie, cle);
    await rm(cible, { recursive: true, force: true });
    await cp(aPublier, cible, { recursive: true, filter: (f) => !IGNORES.has(path.basename(f)) });
    console.log(`✔ ${cle}  ←  ${src.repo}`);
  } catch (err) {
    echecs.push(`${cle} (${err.message.split('\n')[0]})`);
    console.error(`✘ ${cle} : ${err.message.split('\n')[0]}`);
  }
}

if (echecs.length) console.warn(`\nApplications non publiées : ${echecs.join(', ')}`);
