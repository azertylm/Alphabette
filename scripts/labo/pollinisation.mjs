#!/usr/bin/env node
/**
 * scripts/labo/pollinisation.mjs — Agent de Pollinisation croisée.
 * Quand un bug STRUCTUREL est corrigé dans une appli du Laboratoire (localStorage, thème Onyx, export de
 * fichiers, routage PWA…), on cherche le même défaut dans les applis sœurs pour leur proposer une Pull
 * Request préventive (prompt système : .claude/agents/pollinisateur.md).
 *
 *   node scripts/labo/pollinisation.mjs signatures <owner/repo> <sha>
 *        → motifs tirés du correctif : lignes retirées (le code fautif) + familles de bugs reconnues.
 *   node scripts/labo/pollinisation.mjs scanner (--depuis <owner/repo>@<sha> | --famille <nom>) [--dossier /tmp/pollen]
 *        → clone (superficiel) chaque appli de data/apps-sources.json et liste les endroits suspects, en JSON.
 *
 * Familles connues : stockage, theme, export, pwa. Chaque trouvaille a une confiance (haute / moyenne / basse) :
 * l'agent relit le code avant toute PR ; « basse » n'est jamais proposée sans vérification humaine du contexte.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const [cmd, ...args] = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

/* Familles de bugs structurels : motif suspect + pourquoi + piste de correction. */
const FAMILLES = {
  stockage: [
    { id: 'json-parse-localstorage-sans-try', re: /JSON\.parse\(\s*(?:window\.)?localStorage\.getItem\(/, sansContexte: /try\s*\{/, confiance: 'haute',
      pourquoi: "Une valeur abîmée dans le localStorage fait planter l'appli au démarrage (écran blanc).", piste: 'Entourer de try/catch avec une valeur par défaut.' },
    { id: 'setitem-sans-try', re: /localStorage\.setItem\(/, sansContexte: /try\s*\{|catch/, confiance: 'moyenne',
      pourquoi: 'Navigation privée ou stockage plein : setItem lève une exception (QuotaExceededError).', piste: 'Entourer de try/catch.' },
  ],
  theme: [
    { id: 'matchmedia-sans-ecoute', re: /matchMedia\(\s*['"]\(prefers-color-scheme:\s*dark\)['"]\s*\)\.matches/, sansFichier: /addEventListener\(\s*['"]change['"]|addListener\(/, confiance: 'moyenne',
      pourquoi: "Le thème sombre (Onyx) ne suit pas le changement jour/nuit du système pendant l'utilisation.", piste: "Écouter l'événement change de matchMedia." },
    { id: 'fond-blanc-code-en-dur', re: /background(?:-color)?\s*:\s*(?:#fff\b|#ffffff\b|white\b)/i, sansFichier: /prefers-color-scheme|data-theme|\.dark\b|\[data-ab-theme|--ab-/, extensions: ['.css'], confiance: 'basse',
      pourquoi: 'Fond blanc codé en dur : éblouit en thème sombre (Onyx).', piste: 'Utiliser les variables --ab-* de la base commune.' },
  ],
  export: [
    { id: 'objecturl-sans-revoke', re: /URL\.createObjectURL\(/, sansFichier: /revokeObjectURL/, confiance: 'haute',
      pourquoi: "Chaque export garde le fichier en mémoire (fuite) ; sur téléphone l'appli ralentit puis plante.", piste: 'Appeler URL.revokeObjectURL après le clic (setTimeout).' },
    { id: 'lien-telechargement-hors-document', re: /\.download\s*=/, sansFichier: /appendChild\(|\.append\(/, confiance: 'moyenne',
      pourquoi: "Firefox n'ouvre pas un lien de téléchargement qui n'est pas dans la page : l'export ne fait rien.", piste: 'Ajouter le lien au document avant click(), le retirer après.' },
  ],
  pwa: [
    { id: 'sw-chemin-absolu', re: /serviceWorker\.register\(\s*['"`]\/(?!\/)/, confiance: 'haute',
      pourquoi: "Chemin absolu : sous alphabette.eu/apps/<clé>/ le service worker est cherché à la racine du site (404, pas de hors-ligne).", piste: "Chemin relatif ('./sw.js') ou import.meta.env.BASE_URL." },
    { id: 'manifest-start-url-absolu', re: /"start_url"\s*:\s*"\/"/, extensions: ['.json', '.webmanifest'], confiance: 'haute',
      pourquoi: "L'appli installée s'ouvre sur l'accueil du site au lieu de l'appli.", piste: '"start_url": "./" et "scope": "./".' },
    { id: 'manifest-scope-absolu', re: /"scope"\s*:\s*"\/"/, extensions: ['.json', '.webmanifest'], confiance: 'moyenne',
      pourquoi: "Portée trop large : l'appli installée capte tout alphabette.eu.", piste: '"scope": "./".' },
  ],
};
const DETECTEURS_FAMILLE = { stockage: /localStorage|sessionStorage/, theme: /prefers-color-scheme|theme|onyx|dark/i, export: /createObjectURL|download|Blob\(/, pwa: /serviceWorker|manifest|start_url|workbox|sw\.js/ };

const gh = (a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const normaliser = (l) => l.trim().replace(/\s+/g, ' ').replace(/["'`]/g, "'").replace(/;$/, '');

function signatures(repo, sha) {
  const c = JSON.parse(gh(['api', `repos/${repo}/commits/${sha}`]));
  const retirees = [], familles = new Set();
  for (const f of c.files ?? []) {
    if (/(^|\/)(dist|node_modules|package-lock\.json|bun\.lock)/.test(f.filename)) continue;
    for (const l of (f.patch ?? '').split('\n')) {
      if (!l.startsWith('-') || l.startsWith('---')) continue;
      const n = normaliser(l.slice(1));
      if (n.length >= 18 && /[.(=]/.test(n) && !/^(\/\/|\*|import |export \{)/.test(n)) retirees.push({ fichier: f.filename, ligne: n });
    }
    for (const [fam, re] of Object.entries(DETECTEURS_FAMILLE)) if (re.test(f.patch ?? '') || re.test(f.filename)) familles.add(fam);
  }
  return { repo, sha, message: c.commit?.message?.split('\n')[0] ?? '', familles: [...familles], lignes_retirees: retirees.slice(0, 40) };
}

function fichiers(dossier) {
  const sortie = [];
  const marcher = (d) => {
    for (const n of readdirSync(d)) {
      if (/^(node_modules|dist|build|\.git|coverage|\.next|vendor)$/.test(n)) continue;
      const p = path.join(d, n);
      const s = statSync(p);
      if (s.isDirectory()) marcher(p);
      else if (/\.(tsx?|jsx?|mjs|html|css|json|webmanifest)$/.test(n) && s.size < 400_000 && !/lock|\.min\./.test(n)) sortie.push(p);
    }
  };
  marcher(dossier);
  return sortie;
}

function scanner() {
  const depuis = opt('depuis');
  let sig = null, familles = opt('famille') ? [opt('famille')] : [];
  if (depuis) {
    const [repo, sha] = depuis.split('@');
    sig = signatures(repo, sha);
    familles = [...new Set([...familles, ...sig.familles])];
  }
  if (!sig && !familles.length) throw new Error('--depuis <repo>@<sha> ou --famille <stockage|theme|export|pwa>');
  const regles = familles.flatMap((f) => (FAMILLES[f] ?? []).map((r) => ({ ...r, famille: f })));
  const sources = JSON.parse(readFileSync(path.join(RACINE, 'data/apps-sources.json'), 'utf8')).apps;
  const base = opt('dossier') ?? '/tmp/pollen';
  const trouvailles = [];
  const lignesFautives = new Set((sig?.lignes_retirees ?? []).map((x) => x.ligne));
  for (const [cle, s] of Object.entries(sources)) {
    if (!s.repo || (sig && s.repo.toLowerCase() === sig.repo.toLowerCase())) continue;
    const dossier = path.join(base, cle);
    try {
      // git clone (et non « gh repo clone ») : fonctionne en session Claude comme dans GitHub Actions.
      const jeton = process.env.APPS_TOKEN || process.env.GH_TOKEN || '';
      const adresse = jeton ? `https://x-access-token:${jeton}@github.com/${s.repo}.git` : `https://github.com/${s.repo}.git`;
      if (!existsSync(dossier)) execFileSync('git', ['clone', '--depth', '1', '-q', ...(s.branch ? ['-b', s.branch] : []), adresse, dossier], { stdio: 'ignore' });
    } catch { trouvailles.push({ cle, repo: s.repo, erreur: 'clonage impossible' }); continue; }
    for (const f of fichiers(dossier)) {
      const texte = readFileSync(f, 'utf8');
      const lignes = texte.split('\n');
      const rel = path.relative(dossier, f);
      lignes.forEach((l, i) => {
        const n = normaliser(l);
        if (lignesFautives.has(n)) trouvailles.push({ cle, repo: s.repo, fichier: rel, ligne: i + 1, extrait: n.slice(0, 160), regle: 'meme-code-que-le-bug-corrige', confiance: 'haute', pourquoi: `Ligne identique au code corrigé dans ${sig.repo} (${sig.sha.slice(0, 7)} : ${sig.message}).` });
        for (const r of regles) {
          if (r.extensions && !r.extensions.some((e) => f.endsWith(e))) continue;
          if (!r.re.test(l)) continue;
          if (r.sansFichier && r.sansFichier.test(texte)) continue;
          if (r.sansContexte && r.sansContexte.test(lignes.slice(Math.max(0, i - 4), i + 1).join('\n'))) continue;
          trouvailles.push({ cle, repo: s.repo, fichier: rel, ligne: i + 1, extrait: n.slice(0, 160), regle: r.id, famille: r.famille, confiance: r.confiance, pourquoi: r.pourquoi, piste: r.piste });
        }
      });
    }
  }
  const parApp = {};
  for (const t of trouvailles) (parApp[t.cle] ??= []).push(t);
  return { genere_le: new Date().toISOString(), source: sig, familles, applis_touchees: Object.keys(parApp).length, trouvailles: trouvailles.length, par_app: parApp };
}

if (cmd === 'signatures') console.log(JSON.stringify(signatures(args[0], args[1]), null, 2));
else if (cmd === 'scanner') console.log(JSON.stringify(scanner(), null, 2));
else { console.error('Usage : signatures <owner/repo> <sha> | scanner (--depuis <repo>@<sha> | --famille <nom>)'); process.exit(2); }
