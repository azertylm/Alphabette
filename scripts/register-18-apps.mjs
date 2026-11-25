#!/usr/bin/env node
/**
 * Référence les 18 applis de data/apps-catalog.json auprès de leur dépôt GitHub (azertylm).
 *  - Règle 2 : 1 appli = 1 dépôt externe → on ne copie JAMAIS le code dans le Hub.
 *  - Sanctuaires intacts : Lidarsol, Osolar, ProxiLien, Orbit, Info Perso et entrées `vitrine`.
 *  - Aucun devinette : « Introuvable » (aucun dépôt) ou « Ambigu » (plusieurs candidats).
 *
 * Liste des dépôts : API GitHub (pagination) → `gh api` → fichier `--repos-file` (JSON de noms).
 * Usage : node scripts/register-18-apps.mjs [--repos-file repos.json] [--dry]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = 'azertylm';
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const reposFile = args.includes('--repos-file') ? args[args.indexOf('--repos-file') + 1] : null;
const PROTEGEES = ['lidarsol', 'osolar', 'proxilien', 'orbit', 'infoperso', 'infosperso'];
const lire = async (f) => JSON.parse(await readFile(path.join(racine, 'data', f), 'utf8'));
const ecrire = (f, o) => DRY ? null : writeFile(path.join(racine, 'data', f), JSON.stringify(o, null, 2) + '\n');

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const mots = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((m) => m.length >= 6);
const STOP = new Set(['alphabette', 'application']);
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

async function listerDepots() {
  const noms = [];
  try {
    for (let p = 1; ; p++) {
      const r = await fetch(`https://api.github.com/users/${OWNER}/repos?per_page=100&page=${p}`, { headers: { 'User-Agent': 'alphabette-hub' } });
      if (!r.ok) throw new Error('API ' + r.status);
      const page = await r.json();
      noms.push(...page.map((x) => x.name));
      if (page.length < 100) break;
    }
    return { noms, via: 'API publique' };
  } catch (e1) {
    try {
      const out = execFileSync('gh', ['api', '--paginate', `users/${OWNER}/repos?per_page=100`, '--jq', '.[].name'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return { noms: out.split('\n').filter(Boolean), via: 'gh' };
    } catch (e2) {
      if (!reposFile) throw new Error(`Liste des dépôts inaccessible (${e1.message}). Fournir --repos-file.`);
      return { noms: JSON.parse(await readFile(reposFile, 'utf8')), via: 'fichier ' + reposFile };
    }
  }
}

const brut = async (repo, f) => {
  try { const r = await fetch(`https://raw.githubusercontent.com/${OWNER}/${repo}/HEAD/${f}`); return r.ok ? await r.text() : null; } catch { return null; }
};
const nettoie = (t) => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function extraire(repo) {
  const readme = await brut(repo, 'README.md');
  if (readme) {
    const lignes = readme.split('\n').map((l) => l.trim()).filter((l) => l && !/^(#|!\[|\[!\[|<|---|```|>|\|)/.test(l));
    const l = lignes.find((x) => x.length > 25 && !/^(this|view your|run locally)/i.test(x));
    if (l) return { texte: nettoie(l).replace(/[*_`]/g, '').slice(0, 200), source: 'README.md' };
  }
  const html = await brut(repo, 'index.html');
  if (html) {
    const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (m && m[1].trim().length > 15) return { texte: nettoie(m[1]).slice(0, 200), source: 'index.html (meta description)' };
    const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    if (og) return { texte: nettoie(og[1]).slice(0, 200), source: 'index.html (og:description)' };
  }
  return null;
}

async function stack(repo) {
  const pj = await brut(repo, 'package.json');
  if (pj) {
    try {
      const d = JSON.parse(pj); const deps = { ...d.dependencies, ...d.devDependencies };
      const s = [deps.react && 'React', deps.vite && 'Vite', deps.typescript && 'TypeScript', deps.express && 'Express', deps['@google/genai'] && 'Gemini'].filter(Boolean);
      return s.length ? s.join('/') : 'Node';
    } catch { return 'Node'; }
  }
  return (await brut(repo, 'index.html')) ? 'HTML mono-fichier' : '?';
}

const catalog = await lire('apps-catalog.json');
const sources = await lire('apps-sources.json');
const registry = await lire('apps-registry.json');
const { noms, via } = await listerDepots();
const dejaPris = new Set(Object.values(sources.apps).map((s) => s.repo.split('/')[1].toLowerCase()));
const bloques = new Set(['alphabette', 'orbit', 'orbit-v2', 'orbit-v3', 'orbit-v4', 'osolar', 'proxilien', 'lidaros', 'info-perso', 'info-perso-2', 'info-perso-v3', 'orbitvideo-', 'agent', 'news', 'touttouttout', 'autrement', 'omnilocal', 'pour-l-employ-', 'danger-de-l-intelligence-artificielle', 'les-10-infiltr-s', 'test-ton-m-tier']);
const candidats = noms.filter((n) => !/\.alphabette\.fr$|-alphabette\.fr$/i.test(n) && !bloques.has(n.toLowerCase()));

const rapport = [];
for (const app of catalog.apps) {
  const cle = app.slug.replace(/[^a-z0-9]/g, '');
  const ligne = { id: app.id, titre: app.title, slug: app.slug, cle, repo: null, entree: '—', stack: '—', statut: '', note: '' };
  if (PROTEGEES.includes(cle)) { ligne.statut = 'Protégée — non touchée'; rapport.push(ligne); continue; }

  let repo = null;
  if (app.repo && noms.some((n) => n.toLowerCase() === app.repo.toLowerCase())) repo = noms.find((n) => n.toLowerCase() === app.repo.toLowerCase());
  const notes = [];
  if (!repo) {
    const cibles = [norm(app.title), norm(app.slug)];
    const scores = candidats.map((n) => ({ n, d: Math.min(...cibles.map((c) => lev(norm(n), c))) })).filter((x) => x.d <= 2).sort((a, b) => a.d - b.d);
    if (scores.length) {
      const min = scores[0].d; const egaux = scores.filter((x) => x.d === min);
      if (egaux.length === 1) { repo = egaux[0].n; scores.filter((x) => x !== egaux[0]).forEach((x) => notes.push(`quasi-doublon ${x.n}`)); }
      else { ligne.statut = 'Ambigu'; ligne.note = 'candidats : ' + egaux.map((x) => x.n).join(', '); }
    } else {
      const mt = new Set(mots(app.title).filter((m) => !STOP.has(m)));
      const proches = candidats.filter((n) => mots(n).some((m) => mt.has(m)));
      if (proches.length) { ligne.statut = 'Ambigu'; ligne.note = 'pistes non confirmées : ' + proches.join(', '); }
      else { ligne.statut = 'Introuvable'; ligne.note = 'aucun dépôt azertylm correspondant'; }
    }
  }
  if (!repo) { rapport.push(ligne); continue; }

  ligne.repo = `${OWNER}/${repo}`;
  ligne.stack = await stack(repo);
  const ex = await extraire(repo);
  const manquante = !app.description || !app.description.trim();
  if (manquante) {
    if (ex) { app.description = ex.texte; notes.push(`description extraite de ${ex.source}`); }
    else notes.push('description manquante, rien d\'exploitable dans le dépôt');
  }
  app.repo = repo;

  if (!sources.apps[cle]) sources.apps[cle] = { repo: ligne.repo };
  else if (sources.apps[cle].repo !== ligne.repo) { ligne.statut = 'Conflit'; notes.push(`source existante : ${sources.apps[cle].repo}`); }

  const regExiste = registry.apps.find((a) => a.id === app.slug || a.slug === app.slug);
  const now = new Date().toISOString();
  if (!regExiste) {
    const e = { id: app.slug, name: app.title, slug: app.slug, icon: 'Sparkles', status: 'brouillon', url: `https://${cle}.alphabette.fr`, subdomain: cle, createdAt: now, updatedAt: now };
    if (app.description) e.description = app.description;
    registry.apps.push(e);
    ligne.entree = `\`${app.slug}\` (brouillon)`;
  } else ligne.entree = `\`${regExiste.id}\` (existante)`;
  ligne.statut ||= 'OK';
  ligne.note = notes.join(' ; ');
  rapport.push(ligne);
}

const maintenant = new Date();
catalog.updatedAt = maintenant.toISOString().slice(0, 10);
registry.updatedAt = maintenant.toISOString();
await ecrire('apps-catalog.json', catalog);
await ecrire('apps-sources.json', sources);
await ecrire('apps-registry.json', registry);

const md = ['| # | Application | Dépôt GitHub | Entrée registre | Stack | Statut & Remarques |', '|---|---|---|---|---|---|',
  ...rapport.map((r) => `| ${r.id} | ${r.titre} | ${r.repo ? '`' + r.repo + '`' : '—'} | ${r.entree} | ${r.stack} | ${[r.statut, r.note].filter(Boolean).join(' — ')} |`)].join('\n');
console.error(`Dépôts listés via : ${via} (${noms.length})${DRY ? ' [DRY]' : ''}`);
console.log(md);
