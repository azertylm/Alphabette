#!/usr/bin/env node
/**
 * scripts/labo/bac-a-sable.mjs — hébergement isolé, sur alphabette.eu, des applications de créateurs qui n'ont
 * pas d'hébergement (« Hébergée par Alphabette »). Règles (docs/labo/ATELIER-QUALITE.md) :
 *
 *  1. On ne lance JAMAIS le code d'un créateur dans une chaîne qui détient des accès : on télécharge l'archive
 *     d'un commit figé (codeload GitHub), on ne fait ni `npm install` ni build. Le créateur publie ses fichiers
 *     déjà construits (HTML, CSS, JS, images…) dans un dépôt public.
 *  2. Filtre : seulement des fichiers statiques d'une liste fermée ; aucun PHP, aucun fichier caché, aucun lien
 *     symbolique, aucun SVG qui contient du script ; 25 Mo et 2 000 fichiers au plus.
 *  3. Isolement : l'appli est servie avec l'en-tête « Content-Security-Policy: sandbox » (origine opaque) dans un
 *     cadre <iframe sandbox> : elle ne peut lire ni les cookies ni le stockage d'alphabette.eu (clés IA des
 *     visiteurs, avis…). Elle ne peut joindre que les domaines déclarés (connect-src, script-src…).
 *     Un coffre (labo/createurs/coffre.js) lui rend un localStorage gardé par le cadre.
 *  4. Publication seulement si le Douanier a validé CE commit (atelier/prepublication/<id>.json, branche labo-donnees).
 *
 *   node scripts/labo/bac-a-sable.mjs preparer <id>[,<id>…] --site <dossier> [--origine http://127.0.0.1:4173] [--local <dossier-source>]
 *        → <site>/createurs/<id>/ + <site>/cibles.json (pour atelier.mjs --cibles)
 *   node scripts/labo/bac-a-sable.mjs verdicts <dossier-atelier> <site>/cibles.json --sortie <dossier>
 *        → <sortie>/prepublication/<id>.json (conforme = aucun point bloquant)
 */
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MINEURS, SECRETS, TRACEURS, estExemple, hoteDe } from './atelier/listes.mjs';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const ORIGINE_EU = 'https://alphabette.eu';
export const EXTENSIONS = new Set(['html', 'htm', 'css', 'js', 'mjs', 'json', 'map', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'svg',
  'woff', 'woff2', 'ttf', 'otf', 'mp3', 'ogg', 'oga', 'wav', 'm4a', 'mp4', 'webm', 'webmanifest', 'wasm', 'glb', 'gltf', 'bin']);
const MAX_TOTAL = 25 * 1024 * 1024;
const MAX_FICHIER = 8 * 1024 * 1024;
const MAX_FICHIERS = 2000;
const TEXTE = /\.(html?|css|m?js|json|txt|md|csv|svg|webmanifest|map|gltf)$/i;
const ID_OK = /^c-[a-z0-9-]{2,40}$/;
const DEPOT_OK = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.\.?$)[A-Za-z0-9_.-]{1,100}$/;
const REF_OK = /^[0-9a-f]{40}$/;

const echapper = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const probleme = (gravite, titre, detail, correction) => ({ agent: 'douanier', gravite, titre, detail, correction });

/** Fiche d'hébergement valide ? (id c-…, dépôt public « pseudo/depot », commit figé de 40 caractères) */
export function ficheValide(app) {
  const h = app?.heberge;
  return Boolean(h && ID_OK.test(app.id) && DEPOT_OK.test(h.depot ?? '') && REF_OK.test(h.ref ?? '') && !/(^|\/)\.\.?(\/|$)/.test(h.dossier ?? ''));
}

/** Politique de sécurité de l'appli : origine opaque + seuls les domaines déclarés. */
export function politiqueCsp({ origine = ORIGINE_EU, autorises = [] } = {}) {
  const domaines = [...new Set(autorises.map((d) => String(d).trim().toLowerCase()).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)))].map((d) => `https://${d}`);
  const src = [origine, ...domaines].join(' ');
  return [
    'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads',
    "default-src 'none'",
    `script-src ${src} 'unsafe-inline' 'unsafe-eval' blob:`,
    `style-src ${src} 'unsafe-inline'`,
    `img-src ${src} data: blob:`,
    `font-src ${src} data:`,
    `media-src ${src} data: blob:`,
    `connect-src ${src}`,
    `worker-src ${origine} blob:`,
    `frame-src ${domaines.join(' ') || "'none'"}`,
    `form-action ${domaines.join(' ') || "'none'"}`,
    "base-uri 'none'",
    "object-src 'none'",
    `frame-ancestors ${origine}`,
  ].join('; ');
}

/** .htaccess du dossier app/ (sans RewriteEngine : piège OVH). */
export function htaccessApp(csp) {
  return `# Généré par scripts/labo/bac-a-sable.mjs — application d'un créateur, isolée (ne pas modifier à la main).
Options -Indexes -ExecCGI
<FilesMatch "(^\\.|\\.(php[0-9]?|phtml|phar|pht|inc|pl|py|cgi|sh|shtml|asp|aspx|jsp|htaccess|htpasswd|ini)$)">
  Require all denied
</FilesMatch>
<IfModule mod_mime.c>
  RemoveHandler .php .php5 .php7 .php8 .phtml .phar .pl .py .cgi
</IfModule>
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "${csp.replace(/"/g, '\\"')}"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "no-referrer"
  Header always set Access-Control-Allow-Origin "*"
  Header always set Cross-Origin-Resource-Policy "cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
</IfModule>
`;
}

/** Télécharge l'archive d'un commit figé (aucun code exécuté) et renvoie le dossier extrait. */
export async function telecharger(depot, ref, tmp) {
  const r = await fetch(`https://codeload.github.com/${depot}/tar.gz/${ref}`, { redirect: 'follow' });
  if (!r.ok) throw new Error(`archive introuvable (${r.status}) : le dépôt ${depot} doit être public`);
  const octets = Buffer.from(await r.arrayBuffer());
  if (octets.length > 60 * 1024 * 1024) throw new Error('archive de plus de 60 Mo');
  const archive = path.join(tmp, 'source.tar.gz');
  await writeFile(archive, octets);
  const dest = path.join(tmp, 'source');
  await mkdir(dest, { recursive: true });
  // GNU tar : chemins absolus et « .. » refusés par défaut ; propriétaires et droits ignorés.
  execFileSync('tar', ['-xzf', archive, '-C', dest, '--no-same-owner', '--no-same-permissions', '--strip-components=1'], { stdio: 'pipe' });
  return dest;
}

/** Copie les seuls fichiers autorisés de `source` vers `dest`. Ne suit jamais un lien symbolique. */
export async function filtrer(source, dest) {
  const retires = [];
  const gardes = [];
  let total = 0;
  const parcourir = async (rel) => {
    for (const nom of await readdir(path.join(source, rel))) {
      const r = rel ? `${rel}/${nom}` : nom;
      const st = await lstat(path.join(source, r));
      if (st.isSymbolicLink()) { retires.push({ fichier: r, raison: 'lien symbolique' }); continue; }
      if (nom.startsWith('.')) { retires.push({ fichier: r, raison: 'fichier caché' }); continue; }
      if (!/^[A-Za-z0-9 _.@()+,~-]+$/.test(nom)) { retires.push({ fichier: r, raison: 'nom de fichier inhabituel' }); continue; }
      if (st.isDirectory()) { if (nom !== 'node_modules') await parcourir(r); else retires.push({ fichier: r, raison: 'dossier de développement' }); continue; }
      if (!st.isFile()) { retires.push({ fichier: r, raison: 'type de fichier' }); continue; }
      const ext = nom.includes('.') ? nom.split('.').pop().toLowerCase() : '';
      if (!EXTENSIONS.has(ext)) { retires.push({ fichier: r, raison: `extension .${ext || '?'} non autorisée` }); continue; }
      if (st.size > MAX_FICHIER) { retires.push({ fichier: r, raison: 'plus de 8 Mo' }); continue; }
      if (gardes.length >= MAX_FICHIERS || total + st.size > MAX_TOTAL) { retires.push({ fichier: r, raison: 'limite de 25 Mo / 2 000 fichiers atteinte' }); continue; }
      let contenu = await readFile(path.join(source, r));
      if (ext === 'svg' && /<script|\bon[a-z]+\s*=|<foreignObject|javascript:/i.test(contenu.toString('utf8'))) { retires.push({ fichier: r, raison: 'SVG contenant du script' }); continue; }
      await mkdir(path.dirname(path.join(dest, r)), { recursive: true });
      await writeFile(path.join(dest, r), contenu, { mode: 0o644 });
      gardes.push(r);
      total += st.size;
    }
  };
  await parcourir('');
  return { gardes, retires, total };
}

/** Le Douanier, version statique : ce que contient le code avant toute ouverture. */
export async function scanStatique(dossier, { gardes, retires }) {
  const pb = [];
  if (!gardes.some((f) => /^index\.html?$/i.test(f))) pb.push(probleme('bloquant', "Pas de page d'accueil index.html", 'à la racine du dossier publié', 'Publie le dossier construit (par exemple dist/) qui contient index.html.'));
  const dangereux = retires.filter((r) => /php|phtml|phar|cgi|\.pl|\.py|\.sh|\.asp|\.jsp/i.test(r.fichier) || r.raison === 'SVG contenant du script');
  if (dangereux.length) pb.push(probleme('important', 'Fichiers exécutables ou scripts retirés', dangereux.slice(0, 5).map((r) => r.fichier).join(', '), "L'hébergement du collectif est statique : retire ces fichiers (le PHP et les scripts serveur ne sont pas acceptés)."));
  const hotes = new Set();
  const vus = new Set();
  for (const f of gardes.filter((x) => TEXTE.test(x))) {
    const texte = await readFile(path.join(dossier, f), 'utf8').catch(() => '');
    for (const s of SECRETS) {
      for (const x of texte.matchAll(s.re)) {
        if (estExemple(x[0]) || vus.has(x[0])) continue;
        vus.add(x[0]);
        const autour = texte.slice(Math.max(0, x.index - 300), x.index + 300);
        if (s.publique?.test(autour)) pb.push(probleme('conseil', `Clé publique à restreindre (${s.nom})`, f, 'Limite cette clé à ton domaine dans la console du fournisseur.'));
        else pb.push(probleme('bloquant', `Secret visible dans le code publié (${s.nom})`, `${f} : ${x[0].slice(0, 6)}…`, 'Supprime cette clé du code, révoque-la chez le fournisseur et crée-en une nouvelle.'));
      }
    }
    if (MINEURS.test(texte)) pb.push(probleme('bloquant', 'Code de minage de cryptomonnaie', f, 'Retire ce code.'));
    for (const t of TRACEURS) if (texte.includes(t.split('/')[0]) && !vus.has(t)) { vus.add(t); pb.push(probleme('bloquant', 'Traceur publicitaire ou de mesure d\'audience', `${t} (${f})`, `Retire ${t} : le collectif refuse les traceurs.`)); }
    for (const x of texte.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})(?=[/"'`\s)?:])/gi)) hotes.add(x[1].toLowerCase());
  }
  return { problemes: pb, hotes: [...hotes].filter((h) => !/(^|\.)(alphabette\.(fr|eu)|w3\.org|schema\.org|ogp\.me)$/.test(h)).sort() };
}

/** Insère le coffre (stockage isolé + garde-fou) en tête de chaque page HTML de l'appli. */
export async function injecterCoffre(dossier, gardes) {
  const coffre = (await readFile(path.join(RACINE, 'labo', 'createurs', 'coffre.js'), 'utf8')).replace(/<\/script/gi, '<\\/script');
  for (const f of gardes.filter((x) => /\.html?$/i.test(x))) {
    const p = path.join(dossier, f);
    let html = await readFile(p, 'utf8');
    const balise = `<script>${coffre}</script>`;
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${balise}`) : `${balise}\n${html}`;
    await writeFile(p, html);
  }
}

/** Page d'accueil du cadre (barre Alphabette, Signaler, mentions, coffre) à partir de labo/createurs/cadre.html. */
export async function ecrireCadre(dossier, app, origine = ORIGINE_EU) {
  const modele = await readFile(path.join(RACINE, 'labo', 'createurs', 'cadre.html'), 'utf8');
  const donnees = { id: app.id, nom: app.name, createur: app.createur || 'un créateur du collectif', ref: app.heberge.ref.slice(0, 7) };
  const html = modele
    .replaceAll('{{APP_JSON}}', JSON.stringify(donnees).replace(/</g, '\\u003c'))
    .replaceAll('{{ID}}', echapper(app.id))
    .replaceAll('{{ORIGINE}}', echapper(origine))
    .replaceAll('{{NOM}}', echapper(app.name))
    .replaceAll('{{CREATEUR}}', echapper(donnees.createur))
    .replaceAll('{{DESCRIPTION}}', echapper((app.description || `${app.name}, une application du Collectif Alphabette.`).slice(0, 300)));
  await mkdir(dossier, { recursive: true });
  await writeFile(path.join(dossier, 'index.html'), html);
}

/**
 * Prépare une appli hébergée dans `<site>/createurs/<id>/` : téléchargement (ou dossier local pour les tests),
 * filtre, Douanier statique, coffre, .htaccess, cadre. Renvoie { ok, problemes, hotes, gardes, retires }.
 */
export async function preparerApp(app, site, { origine = ORIGINE_EU, local } = {}) {
  if (!ficheValide(app)) return { ok: false, problemes: [probleme('bloquant', "Fiche d'hébergement invalide", app.id, 'Il faut un id « c-… », un dépôt public « pseudo/depot » et un commit figé (40 caractères).')] };
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'bac-'));
  try {
    const racineSource = local ?? await telecharger(app.heberge.depot, app.heberge.ref, tmp);
    const source = app.heberge.dossier ? path.join(racineSource, app.heberge.dossier) : racineSource;
    if (!existsSync(source)) return { ok: false, problemes: [probleme('bloquant', 'Dossier introuvable dans le dépôt', app.heberge.dossier, 'Vérifie le nom du dossier publié (par exemple dist).')] };
    const base = path.join(site, 'createurs', app.id);
    const dossierApp = path.join(base, 'app');
    await rm(base, { recursive: true, force: true });
    const filtre = await filtrer(source, dossierApp);
    const scan = await scanStatique(dossierApp, filtre);
    const ok = !scan.problemes.some((p) => p.gravite === 'bloquant');
    if (!ok) { await rm(base, { recursive: true, force: true }); return { ok, ...scan, ...filtre }; }
    await injecterCoffre(dossierApp, filtre.gardes);
    await writeFile(path.join(dossierApp, '.htaccess'), htaccessApp(politiqueCsp({ origine, autorises: app.reseau_autorise ?? [] })));
    await ecrireCadre(base, app, origine);
    return { ok, ...scan, ...filtre };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/**
 * Publication au build (scripts/build-static.mjs) : pour chaque appli hébergée dont CE commit a été validé
 * (atelier/prepublication/<id>.json), prépare `eu/createurs/<id>/` et renvoie la fiche du Laboratoire
 * (adresse /createurs/<id>/). Les autres sont écartées, avec la raison dans le journal.
 */
export async function publierHebergees(eu, apps, dossierVerdicts) {
  const publiees = [];
  for (let app of apps) {
    const verdict = (() => { try { return JSON.parse(readFileSync(path.join(dossierVerdicts, `${app.id}.json`), 'utf8')); } catch { return null; } })();
    // Le commit demandé s'il est validé ; sinon le dernier commit validé reste en ligne (pas de coupure pour le créateur).
    const ref = verdict?.conforme === true ? verdict.ref : verdict?.dernier_conforme?.ref;
    if (!ref || !REF_OK.test(ref)) {
      console.log(`bac à sable : ${app.id} en attente du Douanier (commit ${String(app.heberge?.ref).slice(0, 7)} pas encore validé)`);
      continue;
    }
    if (ref !== app.heberge.ref) console.log(`bac à sable : ${app.id} garde la version validée ${ref.slice(0, 7)} (${String(app.heberge.ref).slice(0, 7)} pas encore validée)`);
    app = { ...app, heberge: { ...app.heberge, ref } };
    try {
      // BAC_A_SABLE_LOCAL (tests seulement) : dossier contenant <id>/ à la place du téléchargement GitHub.
      const r = await preparerApp(app, eu, { local: process.env.BAC_A_SABLE_LOCAL ? path.join(process.env.BAC_A_SABLE_LOCAL, app.id) : undefined });
      if (!r.ok) { console.log(`bac à sable : ${app.id} écartée — ${r.problemes.filter((p) => p.gravite === 'bloquant').map((p) => p.titre).join(' ; ')}`); continue; }
      publiees.push({ ...app, url: `/createurs/${app.id}/`, url_app: `/createurs/${app.id}/app/index.html`, ref: app.heberge.ref });
      console.log(`bac à sable : ${app.id} publiée (${r.gardes.length} fichiers, ${Math.round(r.total / 1024)} Ko, ${r.retires.length} retirés)`);
    } catch (e) {
      console.log(`bac à sable : ${app.id} écartée — ${e.message}`);
    }
  }
  return publiees;
}

/* ------------------------------- Ligne de commande ------------------------------- */

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
  const [commande, quoi, fichierCibles] = args;
  if (commande === 'preparer' && quoi) {
    const site = opt('site') ?? '/tmp/site';
    const origine = opt('origine') ?? ORIGINE_EU;
    const { apps = [] } = JSON.parse(await readFile(path.join(RACINE, 'data', 'apps-communaute.json'), 'utf8'));
    const ids = quoi === 'toutes' ? apps.filter((a) => a.heberge).map((a) => a.id) : quoi.split(',');
    const cibles = [];
    for (const id of ids) {
      const app = apps.find((a) => a.id === id);
      if (!app) { console.error(`${id} : absente de data/apps-communaute.json`); continue; }
      const r = await preparerApp(app, site, { origine, local: opt('local') }).catch((e) => ({ ok: false, problemes: [probleme('bloquant', 'Téléchargement impossible', e.message, 'Vérifie que le dépôt est public et que le commit existe.')] }));
      console.error(`${r.ok ? '✅' : '⛔'} ${id} : ${r.problemes.length} point(s) au contrôle statique${r.gardes ? `, ${r.gardes.length} fichiers` : ''}`);
      cibles.push({
        id, nom: app.name, url: `${origine}/createurs/${id}/app/index.html`, url_publique: `${origine}/createurs/${id}/`, communaute: true, heberge: true,
        ref: app.heberge?.ref, reseau_autorise: app.reseau_autorise ?? [], statique: r.problemes, hotes_references: r.hotes ?? [], pret: r.ok,
      });
    }
    await mkdir(site, { recursive: true });
    await writeFile(path.join(site, 'cibles.json'), JSON.stringify(cibles, null, 2) + '\n');
  } else if (commande === 'verdicts' && quoi && fichierCibles) {
    const sortie = opt('sortie') ?? 'atelier';
    const cibles = JSON.parse(await readFile(fichierCibles, 'utf8'));
    await mkdir(path.join(sortie, 'prepublication'), { recursive: true });
    for (const c of cibles) {
      const rapport = (() => { try { return JSON.parse(readFileSync(path.join(quoi, 'rapports', `${c.id}.json`), 'utf8')); } catch { return null; } })();
      const bloquants = [...(c.statique ?? []), ...(rapport?.problemes ?? [])].filter((p) => p.gravite === 'bloquant').map((p) => p.titre);
      const fichier = path.join(sortie, 'prepublication', `${c.id}.json`);
      const ancien = (() => { try { return JSON.parse(readFileSync(fichier, 'utf8')); } catch { return null; } })();
      const conforme = Boolean(c.pret && rapport && !bloquants.length);
      const date = new Date().toISOString();
      const verdict = {
        id: c.id, ref: c.ref, date, conforme,
        bloquants: [...new Set(bloquants)], note: rapport?.note ?? null, hotes_references: c.hotes_references ?? [],
        ...(rapport ? {} : { raison: 'contrôle dans le navigateur impossible' }),
        // Dernière version validée : elle reste publiée tant qu'une nouvelle n'est pas validée.
        dernier_conforme: conforme ? { ref: c.ref, date } : ancien?.conforme ? { ref: ancien.ref, date: ancien.date } : ancien?.dernier_conforme ?? null,
      };
      await writeFile(fichier, JSON.stringify(verdict, null, 2) + '\n');
      console.error(`${verdict.conforme ? '✅ conforme' : '⛔ refusée'} ${c.id}${verdict.bloquants.length ? ` : ${verdict.bloquants.join(' ; ')}` : ''}`);
    }
  } else {
    console.error('Usage : bac-a-sable.mjs preparer <id|toutes> --site <dossier> [--origine …] [--local …] | verdicts <dossier-atelier> <cibles.json> --sortie <dossier>');
    process.exit(2);
  }
}
