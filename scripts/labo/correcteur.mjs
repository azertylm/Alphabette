/**
 * scripts/labo/correcteur.mjs — outils de l'Agent Correcteur (.claude/agents/agent-correcteur.md).
 * Schémas des données : docs/labo/AGENT-CORRECTEUR.md.
 *
 *   node scripts/labo/correcteur.mjs candidats /tmp/feedbacks.json
 *       → JSON { bugs: [BugAPatcher…], prompts: [PromptAAjuster…] } sur la sortie standard
 *   node scripts/labo/correcteur.mjs localiser <clé> "<fichier.js:ligne:colonne>" [dossier]
 *       → construit l'appli (branche main) avec cartes de sources et retrouve le fichier,
 *         la ligne et la fonction d'origine d'une position du code publié.
 *
 * Aucune modification de code ici : l'agent lit, puis propose une branche et une Pull Request.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const lireJson = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const [commande, ...args] = process.argv.slice(2);

/* ------------------------------------------------------------------ candidats */

/** Bug « critique » : erreurs JavaScript jointes, ou au moins 3 « +1 ». */
const SEUIL_PLUS1 = 3;
/** Ajustement de prompt : au moins 3 notes < 3/5 sur 14 jours pour une appli à IA, avec au moins 2 commentaires. */
const SEUIL_NOTES_BASSES = 3;
const FENETRE_JOURS = 14;

function candidats(fichier) {
  const { feedbacks = [] } = lireJson(fichier, {});
  const { decisions = {} } = lireJson('data/labo/decisions.json', {});
  const { apps: sources = {} } = lireJson('data/apps-sources.json', {});
  const { apps: prompts = {} } = lireJson('data/labo/prompts.json', {});
  const { apps: registre = [] } = lireJson('data/apps-registry.json', {});
  const { apps: appsEu = [] } = lireJson('dist-static/eu/api/apps.json', {});
  const cleDe = (id) => {
    const deEu = appsEu.find((a) => a.id === id)?.cle;
    if (deEu) return deEu;
    const app = registre.find((a) => a.id === id);
    if (!app) return null;
    let hote = '';
    try { hote = new URL(app.url).hostname.replace(/^www\./, ''); } catch {}
    for (const [cle, s] of Object.entries(sources)) if (hote === `${cle}.alphabette.fr` || (s.domains ?? []).includes(hote)) return cle;
    return app.subdomain && sources[app.subdomain] ? app.subdomain : null;
  };
  const statut = (a) => decisions[a.id]?.status ?? a.status ?? 'pending';
  const ouvert = (a) => ['pending', 'approved_auto'].includes(statut(a)) && !decisions[a.id]?.correcteur;

  const bugs = feedbacks
    .filter((a) => a.category === 'Bug' && ouvert(a))
    .filter((a) => (a.telemetry?.console_errors?.length ?? 0) > 0 || a.upvotes >= SEUIL_PLUS1)
    .sort((x, y) => y.upvotes - x.upvotes)
    .map((a) => {
      const cle = cleDe(a.app_id);
      const positions = (a.telemetry?.console_errors ?? [])
        .map((e) => e.match(/\(([\w.-]+\.js):(\d+):(\d+)\)/))
        .filter(Boolean)
        .map((m) => `${m[1]}:${m[2]}:${m[3]}`);
      return {
        type: 'bug_a_patcher',
        ticket_id: a.id,
        app_id: a.app_id,
        cle,
        depot: cle ? sources[cle]?.repo ?? null : null,
        priorite: a.upvotes > 5 ? 'haute' : a.telemetry?.console_errors?.length ? 'critique' : 'normale',
        upvotes: a.upvotes,
        description: a.comment,
        version_testee: a.version_tested,
        telemetrie: a.telemetry,
        positions_a_localiser: [...new Set(positions)],
      };
    });

  const limite = Date.now() - FENETRE_JOURS * 86400 * 1000;
  const parApp = new Map();
  for (const a of feedbacks) {
    if (!prompts[a.app_id] || !Number.isInteger(a.rating) || Date.parse(a.timestamp) < limite || statut(a) === 'rejected') continue;
    const s = parApp.get(a.app_id) ?? { toutes: [], basses: [] };
    s.toutes.push(a);
    if (a.rating < 3) s.basses.push(a);
    parApp.set(a.app_id, s);
  }
  const promptsAAjuster = [...parApp.entries()]
    .filter(([, s]) => s.basses.length >= SEUIL_NOTES_BASSES && s.basses.filter((a) => a.comment).length >= 2)
    .map(([id, s]) => ({
      type: 'prompt_a_ajuster',
      app_id: id,
      cle: prompts[id].cle,
      depot: sources[prompts[id].cle]?.repo ?? null,
      prompt: prompts[id],
      fenetre_jours: FENETRE_JOURS,
      moyenne: Math.round((s.toutes.reduce((t, a) => t + a.rating, 0) / s.toutes.length) * 10) / 10,
      notes_basses: s.basses.map((a) => ({ ticket_id: a.id, rating: a.rating, comment: a.comment, declencheur: a.declencheur ?? null, version_tested: a.version_tested })),
      beta_en_cours: Boolean(sources[prompts[id].cle]?.beta),
    }));

  console.log(JSON.stringify({ genere_le: new Date().toISOString(), bugs, prompts: promptsAAjuster }, null, 2));
}

/* ------------------------------------------------------------------ localiser */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function vlq(segment) {
  const valeurs = [];
  let n = 0, decalage = 0;
  for (const c of segment) {
    const d = B64.indexOf(c);
    n += (d & 31) << decalage;
    if (d & 32) decalage += 5;
    else { valeurs.push(n & 1 ? -(n >> 1) : n >> 1); n = 0; decalage = 0; }
  }
  return valeurs;
}

/** Position d'origine d'une ligne/colonne (1-basées) du fichier généré, d'après sa carte de sources. */
function retrouver(carte, ligne, colonne) {
  let src = 0, lo = 0, co = 0, nom = 0, trouve = null;
  const lignes = carte.mappings.split(';');
  for (let l = 0; l < lignes.length && l < ligne; l++) {
    let col = 0;
    for (const seg of lignes[l].split(',')) {
      if (!seg) continue;
      const v = vlq(seg);
      col += v[0];
      if (v.length >= 4) { src += v[1]; lo += v[2]; co += v[3]; }
      if (v.length >= 5) nom += v[4];
      if (l === ligne - 1 && col <= colonne - 1 && v.length >= 4) {
        trouve = { fichier: carte.sources[src], ligne: lo + 1, colonne: co + 1, nom: v.length >= 5 ? carte.names[nom] : null };
      }
    }
  }
  return trouve;
}

function localiser(cle, position, dossierDonne) {
  const m = String(position).match(/^([\w.-]+\.js):(\d+):(\d+)$/);
  if (!m) throw new Error('Position attendue : fichier.js:ligne:colonne');
  const { apps: sources = {} } = lireJson('data/apps-sources.json', {});
  const src = sources[cle];
  if (!src) throw new Error(`Appli inconnue : ${cle}`);
  const depot = dossierDonne ?? path.join(mkdtempSync(path.join(os.tmpdir(), 'correcteur-')), cle);
  if (!dossierDonne) execFileSync('git', ['clone', '-q', '--depth', '1', `https://github.com/${src.repo}.git`, depot], { stdio: ['ignore', 2, 2] });
  if (!existsSync(path.join(depot, 'package.json'))) {
    // Appli en HTML simple : le fichier publié EST la source, la position se lit directement.
    const fichierSource = path.join(depot, m[1]);
    const ligne = Number(m[2]);
    const lignes = existsSync(fichierSource) ? readFileSync(fichierSource, 'utf8').split('\n') : [];
    console.log(JSON.stringify({ cle, position, depot, origine: lignes.length ? { fichier: m[1], ligne, colonne: Number(m[3]), nom: null } : null,
      extrait: lignes.slice(Math.max(0, ligne - 6), ligne + 5).map((l, i) => `${Math.max(1, ligne - 5) + i}: ${l.slice(0, 200)}`).join('\n') || null }, null, 2));
    return;
  }
  {
    execFileSync('bun', ['install'], { cwd: depot, stdio: ['ignore', 2, 2] });
    const { scripts = {} } = lireJson(path.join(depot, 'package.json'), {});
    execFileSync('bunx', ['vite', 'build', '--base=./', '--sourcemap', '--outDir', 'dist-correcteur'], {
      cwd: depot, stdio: ['ignore', 2, 2], env: { ...process.env, ...(scripts['build:static'] ? { VITE_ALPHABETTE_STATIC: '1' } : {}) },
    });
  }
  // Même fichier publié, ou à défaut même préfixe de morceau (index-xxxx.js) si l'empreinte diffère.
  const sortie = path.join(depot, 'dist-correcteur');
  const tous = [];
  const parcourir = (d) => readdirSync(d).forEach((f) => { const p = path.join(d, f); statSync(p).isDirectory() ? parcourir(p) : tous.push(p); });
  if (existsSync(sortie)) parcourir(sortie);
  const prefixe = m[1].replace(/-[\w]{6,}\.js$/, '-');
  const js = tous.find((p) => path.basename(p) === m[1]) ?? tous.find((p) => path.basename(p).startsWith(prefixe) && p.endsWith('.js'));
  const resultat = { cle, position, depot, fichier_construit: js ? path.relative(depot, js) : null, empreinte_identique: js ? path.basename(js) === m[1] : false, origine: null, extrait: null };
  if (js && existsSync(`${js}.map`)) {
    const carte = lireJson(`${js}.map`, null);
    const o = carte && retrouver(carte, Number(m[2]), Number(m[3]));
    if (o) {
      const fichierSource = path.resolve(path.dirname(js), carte.sourceRoot ?? '', o.fichier);
      resultat.origine = { ...o, fichier: path.relative(depot, fichierSource) };
      if (existsSync(fichierSource)) {
        const lignes = readFileSync(fichierSource, 'utf8').split('\n');
        resultat.extrait = lignes.slice(Math.max(0, o.ligne - 6), o.ligne + 5).map((l, i) => `${Math.max(1, o.ligne - 5) + i}: ${l}`).join('\n');
      }
    }
  }
  console.log(JSON.stringify(resultat, null, 2));
}

if (commande === 'candidats') candidats(args[0] ?? '/tmp/feedbacks.json');
else if (commande === 'localiser') localiser(args[0], args[1], args[2]);
else {
  console.error('Usage : candidats <feedbacks.json> | localiser <clé> <fichier.js:ligne:colonne> [dossier déjà cloné]');
  process.exit(1);
}
