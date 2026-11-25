#!/usr/bin/env node
/**
 * scripts/sync-covers.mjs — couvertures illustrées des applications (idempotent).
 *
 *  1. Range dans public/covers/ les images déposées à la racine de public/ (jamais écrasées ni supprimées).
 *  2. Associe chaque image personnelle à une appli du registre (slug / id / nom, tolérant aux tirets, casse, accents) :
 *     cover = "/covers/<fichier>", coverCustom = true.
 *  3. Pour les applis SANS image personnelle : génère public/covers/<slug>.svg (1200×630, < 6 Ko, style Codex de Vinci).
 *  4. Écrit data/apps-registry.json seulement si quelque chose change.
 * Usage : node scripts/sync-covers.mjs [--check]
 */
import { readFile, writeFile, readdir, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registre = path.join(racine, 'data', 'apps-registry.json');
const dossier = path.join(racine, 'public', 'covers');
const EXT = /\.(png|jpe?g|webp|avif|gif)$/i;
const SANS = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ECHAP = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nomLisible = (n) => (n === n.toUpperCase() ? n.charAt(0) + n.slice(1).toLowerCase() : n);
const verifier = process.argv.includes('--check');

/** Schémas géométriques par grande famille (mots-clés du nom/slug/description). */
const FAMILLES = [
  [/quiz|devine|jeu|petits-jeux|clash|tribunal|memo|matchsoiree|disstrack/i, 'jeux'],
  [/sante|senior|parent|famille|plan|frigo|echo|balade|ou-cest|bailleur|copro|facture|asso/i, 'vie'],
  [/ia|prompt|lecture|magique|radar|info|studio|kurate|podcast|wiki|orbit|une-de|curioz|cyber|negocoach/i, 'savoir'],
  [/solar|eco|agri|lidar|energie|batisol/i, 'terre'],
];
const famille = (a) => { const t = `${a.slug} ${a.name} ${a.groupe ?? ''}`; for (const [re, f] of FAMILLES) if (re.test(t)) return f; return 'savoir'; };

function motif(f) {
  const E = '#4a2e1b', S = '#9e4736', L = '#b08d3c';
  const fin = `fill="none" stroke="${E}" stroke-width="2"`;
  switch (f) {
    case 'jeux': return `<rect x="760" y="150" width="260" height="260" ${fin}/><circle cx="830" cy="220" r="14" fill="${S}"/><circle cx="950" cy="340" r="14" fill="${S}"/><circle cx="890" cy="280" r="14" fill="${S}"/><path d="M760 150 1020 410M1020 150 760 410" stroke="${L}" stroke-width="2"/>`;
    case 'vie': return `<path d="M760 400V270l130-110 130 110v130z" ${fin}/><rect x="855" y="320" width="70" height="80" ${fin}/><circle cx="890" cy="270" r="26" fill="none" stroke="${S}" stroke-width="3"/>`;
    case 'terre': return `<circle cx="890" cy="280" r="70" fill="none" stroke="${S}" stroke-width="3"/><path d="M890 150v60M890 350v60M760 280h60M960 280h60M798 188l42 42M940 330l42 42M982 188l-42 42M840 330l-42 42" stroke="${E}" stroke-width="2"/>`;
    default: return `<path d="M760 400h260M790 400V200M850 400V150M910 400V240M970 400V180" stroke="${E}" stroke-width="2"/><circle cx="890" cy="190" r="34" fill="none" stroke="${S}" stroke-width="3"/><path d="M760 400 1020 150" stroke="${L}" stroke-width="2"/>`;
  }
}

export function svgReplie(app) {
  const nom = ECHAP(nomLisible(app.name)).slice(0, 40);
  const taille = nom.length > 22 ? 56 : 72;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="Illustration de l'application ${nom}">
<rect width="1200" height="630" fill="#f4e8cf"/><rect x="24" y="24" width="1152" height="582" fill="none" stroke="#4a2e1b" stroke-width="2"/><rect x="34" y="34" width="1132" height="562" fill="none" stroke="#9c7b55" stroke-width="1"/>
<g fill="none" stroke="#9e4736" stroke-width="1.5"><circle cx="890" cy="280" r="190"/><circle cx="890" cy="280" r="150" stroke="#b08d3c"/><path d="M700 280h380M890 90v380" stroke="#9c7b55"/></g>
${motif(famille(app))}
<text x="80" y="300" font-family="Georgia,'Times New Roman',serif" font-size="${taille}" font-weight="700" fill="#2c1a0e">${nom}</text>
<path d="M80 330h300" stroke="#9e4736" stroke-width="3"/>
<text x="80" y="390" font-family="Georgia,'Times New Roman',serif" font-size="30" font-style="italic" fill="#4a2e1b">Alphabette — le Laboratoire</text>
</svg>
`;
}

async function main() {
  await mkdir(dossier, { recursive: true });
  // 1. images égarées à la racine de public/ ou du dépôt (dépôts « Add files via upload »)
  let deplacees = 0;
  for (const base of [path.join(racine, 'public'), racine]) {
    for (const f of await readdir(base)) {
      if (!EXT.test(f) || /^(og-image|favicon|icon|apple-touch|logo|pwa-)/i.test(f)) continue;
      const dest = path.join(dossier, f);
      if (await stat(dest).catch(() => null)) continue; // jamais d'écrasement
      if (!verifier) await rename(path.join(base, f), dest);
      deplacees += 1;
    }
  }
  const reg = JSON.parse(await readFile(registre, 'utf8'));
  const fichiers = (await readdir(dossier)).filter((f) => EXT.test(f));
  const index = new Map(); // clé normalisée → fichier
  for (const f of fichiers) index.set(SANS(f.replace(EXT, '')), f);
  let perso = 0, replis = 0, change = false;
  const sansMatch = new Set(fichiers);
  for (const app of reg.apps) {
    const cles = [app.slug, app.id, app.name, app.subdomain, app.slug?.replace(/^infos-/, 'info-')].filter(Boolean).map(SANS);
    let fichier = cles.map((c) => index.get(c)).find(Boolean);
    if (!fichier && app.slug === 'infos-perso') fichier = index.get('infoperso');
    if (fichier) {
      sansMatch.delete(fichier);
      const cover = `/covers/${encodeURIComponent(fichier)}`;
      if (app.cover !== cover || app.coverCustom !== true) { app.cover = cover; app.coverCustom = true; change = true; }
      perso += 1;
      continue;
    }
    if (app.coverCustom === true && app.cover) { perso += 1; continue; } // image personnelle déjà associée : intouchée
    const svg = svgReplie(app);
    const cible = path.join(dossier, `${app.slug}.svg`);
    const ancien = await readFile(cible, 'utf8').catch(() => '');
    if (ancien !== svg && !verifier) await writeFile(cible, svg);
    if (Buffer.byteLength(svg) >= 6144) throw new Error(`SVG de repli trop lourd : ${app.slug}`);
    const cover = `/covers/${app.slug}.svg`;
    if (app.cover !== cover || app.coverCustom) { app.cover = cover; delete app.coverCustom; change = true; }
    replis += 1;
  }
  if (change && !verifier) { reg.updatedAt = new Date().toISOString(); await writeFile(registre, JSON.stringify(reg, null, 2) + '\n'); }
  const orphelines = [...sansMatch].filter((f) => !f.endsWith('.svg'));
  console.log(`couvertures : ${perso} image(s) personnelle(s) associée(s), ${replis} SVG de repli, ${deplacees} déplacée(s) vers public/covers/${orphelines.length ? `, ${orphelines.length} sans appli (${orphelines.join(', ')})` : ''}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
