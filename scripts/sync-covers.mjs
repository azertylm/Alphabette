#!/usr/bin/env node
/**
 * scripts/sync-covers.mjs — couvertures illustrées des applications (idempotent).
 *
 *  1. Range dans public/covers/ les images déposées à la racine de public/ (jamais écrasées ni supprimées).
 *  2. Associe chaque image personnelle à une appli du registre (slug / id / nom, tolérant aux tirets, casse, accents) :
 *     cover = "/covers/<fichier>", coverCustom = true.
 *  3. Pour les applis SANS image personnelle : génère public/covers/<slug>.svg (1200×630, < 6 Ko, style Codex de Vinci).
 *  4. Écrit data/apps-registry.json seulement si quelque chose change.
 * Usage : node scripts/sync-covers.mjs [--check] [--strict]
 *   --check  : n'écrit rien, signale seulement ce qui changerait
 *   --strict : échoue (code 1) si une appli du registre n'a pas de couverture référencée ET présente dans public/covers/
 * Une seule appli : node scripts/ensure-app-cover.mjs <slug> (appelle syncCovers({ slug })).
 */
import { readFile, writeFile, readdir, mkdir, rename, stat } from 'node:fs/promises';
import { svgCodex } from './covers/codex.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = process.env.ALPHABETTE_ROOT
  ? path.resolve(process.env.ALPHABETTE_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registre = path.join(racine, 'data', 'apps-registry.json');
const dossier = path.join(racine, 'public', 'covers');
const EXT = /\.(png|jpe?g|webp|avif|gif)$/i;
const SANS = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ECHAP = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nomLisible = (n) => (n === n.toUpperCase() ? n.charAt(0) + n.slice(1).toLowerCase() : n);

/** Schémas géométriques par grande famille (mots-clés du nom/slug/description). Les plus spécifiques d'abord. */
const FAMILLES = [
  [/stat|sport|omni|score|classement|foot|match|f1|nba|nhl/i, 'stats'],
  [/voix|voice|audio|podcast|ecout|radio|chant/i, 'voix'],
  [/balade|carte|ou-cest|itineraire|voyage|radar|trajet/i, 'carte'],
  [/atelier|oeil|creat|studio|dessin|photo|video|graph/i, 'atelier'],
  [/quiz|devine|jeu|petits-jeux|clash|tribunal|memo|disstrack|debat/i, 'jeux'],
  [/sante|senior|parent|famille|plan|frigo|echo|bailleur|copro|facture|asso/i, 'vie'],
  [/solar|eco|agri|lidar|energie|batisol/i, 'terre'],
  [/ia|prompt|lecture|magique|info|kurate|wiki|orbit|une-de|curioz|cyber|negocoach|livre/i, 'savoir'],
];
const famille = (a) => { const t = `${a.slug} ${a.name} ${a.groupe ?? ''}`; for (const [re, f] of FAMILLES) if (re.test(t)) return f; return 'outil'; };

const E = '#4a2e1b', S = '#9e4736', L = '#b08d3c';
const fin = `fill="none" stroke="${E}" stroke-width="2"`;
const fa = (w) => `fill="none" stroke="${E}" stroke-width="${w}"`;
const r1 = (n) => Math.round(n * 10) / 10;
/** Engrenage à n dents (chemin fermé) + moyeu. */
function engrenage(cx, cy, r, n = 10, teinte = E) {
  const pts = [];
  for (let i = 0; i < n * 4; i += 1) {
    const a = (Math.PI * 2 * i) / (n * 4) - Math.PI / 2;
    const rr = [0, 1].includes(i % 4) ? r : r * 0.8;
    pts.push(`${r1(cx + rr * Math.cos(a))} ${r1(cy + rr * Math.sin(a))}`);
  }
  return `<path d="M${pts.join('L')}z" fill="#efe0c2" stroke="${teinte}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r1(r * 0.28)}" ${fin}/>`;
}
/** Poulie : roue, corde et contrepoids. */
const poulie = (cx, cy, r, chute) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#efe0c2" stroke="${E}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="4" fill="${E}"/><path d="M${cx - r} ${cy}v${chute}M${cx + r} ${cy}v${chute - 40}" stroke="${E}" stroke-width="1.5"/><rect x="${cx - r - 12}" y="${cy + chute}" width="24" height="32" ${fin}/>`;
const pointilles = (d) => `<path d="${d}" fill="none" stroke="${S}" stroke-width="2" stroke-dasharray="7 7"/>`;
const etoile = (x, y) => `<path d="M${x} ${y - 16}l4.7 10.5 11.3 1.2-8.5 7.6 2.5 11.2-10-5.8-10 5.8 2.5-11.2-8.5-7.6 11.3-1.2z" fill="${L}" stroke="${E}" stroke-width="1"/>`;

function motif(f) {
  switch (f) {
    case 'stats': // podium mécanique : barres + engrenage + étoile
      return `<path d="M740 430h340" stroke="${E}" stroke-width="2"/><rect x="770" y="330" width="70" height="100" ${fin}/><rect x="860" y="250" width="70" height="180" fill="#efe0c2" stroke="${S}" stroke-width="3"/><rect x="950" y="370" width="70" height="60" ${fin}/>${engrenage(895, 190, 42, 10, S)}${etoile(895, 120)}${pointilles('M760 300Q830 190 850 230M940 230Q990 250 985 340')}`;
    case 'voix': // pavillon + ondes concentriques
      return `<path d="M760 250l110-50v160l-110-50z" fill="#efe0c2" stroke="${E}" stroke-width="2"/><path d="M900 230q40 50 0 100M935 205q70 75 0 150M970 180q100 100 0 200" fill="none" stroke="${S}" stroke-width="3"/>${engrenage(830, 420, 34, 8)}${pointilles('M790 420Q700 360 760 300')}`;
    case 'carte': // rose des vents + chemin pointillé
      return `<circle cx="890" cy="280" r="110" ${fin}/><path d="M890 170l22 110-22 110-22-110z" fill="#efe0c2" stroke="${S}" stroke-width="2"/><path d="M780 280l110-22 110 22-110 22z" ${fin}/>${pointilles('M770 420Q850 360 900 400T1040 330')}<circle cx="1040" cy="330" r="9" fill="${S}"/>`;
    case 'atelier': // chevalet + compas
      return `<path d="M830 420 890 170 950 420M860 330h60" ${fin}/><rect x="850" y="210" width="80" height="90" fill="#efe0c2" stroke="${S}" stroke-width="3"/><path d="M1000 160 970 300M1000 160 1040 300M985 230h38" stroke="${E}" stroke-width="3"/><circle cx="1000" cy="160" r="9" fill="${L}"/>${pointilles('M970 300Q1005 345 1040 300')}`;
    case 'jeux': // dés + trajectoires + engrenage
      return `<rect x="770" y="190" width="120" height="120" ${fin}/><circle cx="800" cy="220" r="9" fill="${S}"/><circle cx="860" cy="280" r="9" fill="${S}"/><circle cx="830" cy="250" r="9" fill="${S}"/>${engrenage(985, 340, 52, 10)}${pointilles('M890 190Q960 120 1020 180M900 310Q940 380 940 340')}${etoile(1030, 190)}`;
    case 'vie':
      return `<path d="M760 400V270l130-110 130 110v130z" ${fin}/><rect x="855" y="320" width="70" height="80" ${fin}/><circle cx="890" cy="270" r="26" fill="none" stroke="${S}" stroke-width="3"/>${poulie(1040, 200, 24, 90)}`;
    case 'terre':
      return `<circle cx="890" cy="280" r="70" fill="none" stroke="${S}" stroke-width="3"/><path d="M890 150v60M890 350v60M760 280h60M960 280h60M798 188l42 42M940 330l42 42M982 188l-42 42M840 330l-42 42" stroke="${E}" stroke-width="2"/>${engrenage(1030, 400, 30, 8)}`;
    case 'savoir': // livre ailé
      return `<path d="M890 330 770 300V190l120 30 120-30v110z" fill="#efe0c2" stroke="${E}" stroke-width="2"/><path d="M890 220v110" stroke="${E}" stroke-width="2"/><path d="M770 200Q720 150 700 110Q760 130 790 175M1010 200Q1060 150 1080 110Q1020 130 990 175" fill="none" stroke="${S}" stroke-width="3"/>${engrenage(1000, 420, 36, 9)}${pointilles('M770 420Q760 350 700 330')}`;
    default: // outil : train d'engrenages + levier
      return `${engrenage(840, 260, 70, 12)}${engrenage(960, 360, 46, 9, S)}${engrenage(1030, 220, 34, 8)}<path d="M740 430h300" stroke="${E}" stroke-width="2"/>${poulie(780, 130, 22, 100)}${pointilles('M880 170Q930 110 1000 150')}`;
  }
}

/** Engrenage réutilisable (<symbol> id="g", rayon 50) : dessiné une fois, placé par <use>. */
const SYMBOLE_ENGRENAGE = (() => {
  const pts = [];
  for (let i = 0; i < 32; i += 1) {
    const a = (Math.PI * 2 * i) / 32;
    const rr = [0, 1].includes(i % 4) ? 50 : 40;
    pts.push(`${r1(rr * Math.cos(a))} ${r1(rr * Math.sin(a))}`);
  }
  return `<g id="g"><path d="M${pts.join('L')}z"/><circle r="14" fill="none"/><path d="M0-40V-14M0 40V14M-40 0H-14M40 0H14" fill="none"/></g>`;
})();
const gr = (x, y, k, f = 'url(#w)') => `<use href="#g" transform="translate(${x} ${y}) scale(${k})" fill="${f}"/>`;

/** Scène centrale « machine à classer » d'OmniStats / sport : podium, balance, poulies, engrenages, trophée. */
function sceneStats() {
  const hach = 'fill="url(#h)" stroke="none"';
  return `<path d="M310 505V150M870 505V150M310 150H870M310 180 360 150M870 180 820 150" ${fa(3)}/><path d="M310 150V505H330V150z" ${hach}/>
<path d="M600 150v18" ${fin}/><circle cx="600" cy="150" r="22" fill="url(#w)" stroke="${E}" stroke-width="2.5"/><circle cx="600" cy="150" r="5" fill="${E}"/>
<path d="M578 150Q400 150 400 250M622 150Q800 150 800 290" fill="none" stroke="${E}" stroke-width="1.5"/><path d="M400 250 375 285H425zM800 290 775 325H825z" ${fa(1.2)}/>
<ellipse cx="400" cy="290" rx="38" ry="9" fill="url(#w)" stroke="${E}" stroke-width="2"/><ellipse cx="800" cy="330" rx="38" ry="9" fill="url(#w)" stroke="${E}" stroke-width="2"/>
<circle cx="400" cy="264" r="22" fill="#f4e8cf" stroke="${E}" stroke-width="2"/><path d="M400 252l11 8-4 13h-14l-4-13zM400 242v10M411 260l11-4M407 273l7 10M393 273l-7 10M389 260l-11-4" ${fa(1.3)}/>
<circle cx="800" cy="304" r="22" fill="url(#s)" stroke="${E}" stroke-width="2"/><path d="M778 304h44M800 282v44M783 288Q800 304 783 320M817 288Q800 304 817 320" ${fa(1.3)}/>
<path d="M350 150v150M840 150v150" ${fa(1.5)}/><path d="M336 300h28v34h-28z" fill="url(#h)" stroke="${E}" stroke-width="2"/>
<path d="M440 505V400h110V505zM550 505V345h110V505zM660 505V430h110V505z" fill="#efe0c2" stroke="${E}" stroke-width="2.5"/><path d="M550 345h110v160H550z" fill="url(#h)" opacity=".7"/>
<text font-family="Georgia,serif" font-style="italic" fill="${S}" text-anchor="middle" font-size="42"><tspan x="495" y="470">2</tspan><tspan x="605" y="452">1</tspan><tspan x="715" y="486">3</tspan></text>
<circle cx="605" cy="285" r="58" fill="url(#l)"/><circle cx="605" cy="285" r="52" fill="none" stroke="${S}" stroke-width="1.5" stroke-dasharray="5 6"/>
<path d="M578 280c0 40 12 52 27 52s27-12 27-52zM632 290q22-4 18 18-4 14-20 14M578 290q-22-4-18 18 4 14 20 14M605 332v14M586 346h38v-0" fill="url(#w)" stroke="${E}" stroke-width="2.5"/><path d="M580 300h50" ${fa(1.3)}/>
<path d="M330 505v-0" ${fin}/>${gr(240, 450, 1.1)}${gr(960, 440, 1.25)}
<path d="M960 440 900 360 775 410" ${fa(5)}/><circle cx="900" cy="360" r="9" fill="url(#w)" stroke="${E}" stroke-width="2"/><circle cx="775" cy="410" r="7" fill="${E}"/>
<ellipse cx="180" cy="140" rx="26" ry="9" fill="url(#h)" stroke="${E}" stroke-width="2"/><path d="M154 140v10a26 9 0 0 0 52 0v-10" ${fin}/>
<path d="M205 165Q320 330 395 238" fill="none" stroke="${S}" stroke-width="2" stroke-dasharray="7 7" marker-end="url(#a)"/><path d="M880 330Q1000 380 1040 300" fill="none" stroke="${S}" stroke-width="2" stroke-dasharray="7 7" marker-end="url(#a)"/>
<path d="M1010 120 1000 255M1010 120 1075 250M1002 205h58" fill="none" stroke="${E}" stroke-width="3"/><circle cx="1010" cy="118" r="10" fill="url(#w)" stroke="${E}" stroke-width="2"/>
${etoile(1090, 330)}`;
}

/** Fond de parchemin commun : texture, vieillissement, géométrie de construction (déco partagée par toutes les couvertures). */
const DEFS = `<defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6ebd3"/><stop offset="1" stop-color="#ecdcba"/></linearGradient><radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#8a5a2b" stop-opacity="0"/><stop offset="1" stop-color="#6b4220" stop-opacity=".38"/></radialGradient><radialGradient id="l" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f2a35c" stop-opacity=".85"/><stop offset="1" stop-color="#f2a35c" stop-opacity="0"/></radialGradient><linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3c27e"/><stop offset="1" stop-color="#b08d3c"/></linearGradient><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d98a72"/><stop offset="1" stop-color="#9e4736"/></linearGradient><pattern id="h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0v7" stroke="#4a2e1b" stroke-width="1.1" opacity=".55"/></pattern><marker id="a" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M1 1 8 5 1 9" fill="none" stroke="#9e4736" stroke-width="1.6"/></marker><filter id="r" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence baseFrequency=".03" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .35 0 0 0 0 .22 0 0 0 0 .1 0 0 0 .35 0"/></filter><filter id="b"><feGaussianBlur stdDeviation="14"/></filter>${SYMBOLE_ENGRENAGE}</defs>`;
const DECOR = `<g fill="none" stroke="#9c7b55" stroke-width="1.2"><circle cx="600" cy="300" r="270"/><path d="M600 40v560" stroke-dasharray="3 5"/></g><g fill="#7a4a1d" opacity=".25" filter="url(#b)"><circle cx="90" cy="90" r="34"/><circle cx="1110" cy="560" r="40"/></g>`;

export function svgReplie(app) {
  return svgCodex({ nom: ECHAP(nomLisible(app.name)).slice(0, 40), famille: famille(app), seed: app.slug ?? app.id ?? app.name });
}

export async function syncCovers({ slug = null, verifier = false, strict = false } = {}) {
  await mkdir(dossier, { recursive: true });
  // 1. images égarées à la racine de public/ ou du dépôt (dépôts « Add files via upload »)
  let deplacees = 0;
  for (const base of slug ? [] : [path.join(racine, 'public'), racine]) {
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
  const cibles = slug ? reg.apps.filter((a) => a.slug === slug || a.id === slug) : reg.apps;
  if (slug && cibles.length === 0) throw new Error(`Application introuvable dans le registre : ${slug}`);
  for (const app of cibles) {
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
    if (Buffer.byteLength(svg) >= 200 * 1024) throw new Error(`SVG de repli trop lourd : ${app.slug}`);
    const cover = `/covers/${app.slug}.svg`;
    if (app.cover !== cover || app.coverCustom) { app.cover = cover; delete app.coverCustom; change = true; }
    replis += 1;
  }
  if (change && !verifier) { reg.updatedAt = new Date().toISOString(); await writeFile(registre, JSON.stringify(reg, null, 2) + '\n'); }
  const manquantes = [];
  if (strict) {
    for (const app of reg.apps) {
      const f = app.cover ? decodeURIComponent(app.cover.replace(/^\/covers\//, '')) : '';
      if (!f || !(await stat(path.join(dossier, f)).catch(() => null))) manquantes.push(app.slug ?? app.id);
    }
  }
  const orphelines = slug ? [] : [...sansMatch].filter((f) => !f.endsWith('.svg'));
  console.log(`couvertures : ${perso} image(s) personnelle(s) associée(s), ${replis} SVG de repli, ${deplacees} déplacée(s) vers public/covers/${orphelines.length ? `, ${orphelines.length} sans appli (${orphelines.join(', ')})` : ''}`);
  if (manquantes.length) throw new Error(`Application(s) sans couverture : ${manquantes.join(', ')}`);
  return { perso, replis, deplacees };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await syncCovers({ verifier: process.argv.includes('--check'), strict: process.argv.includes('--strict') }); }
  catch (err) { console.error(`couvertures : ${err.message}`); process.exit(1); }
}
