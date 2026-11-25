#!/usr/bin/env node
/**
 * scripts/check-a11y.mjs — contrôles d'accessibilité statiques (sans navigateur), branchés dans la CI.
 *  - pages labo/pages/*.html : lang, viewport, <title>, une seule <h1>, alt des images, étiquettes des champs ;
 *  - jamais de speechSynthesis direct (voix unique alphabetteAudio) dans src/ et packages/shell/src (hors audio/) ;
 *  - contrastes WCAG AAA (≥ 7:1) des palettes Codex et des lettres Nutri-Score.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const erreurs = [];
const ko = (m) => erreurs.push(m);

function lum(h) { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function contraste(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }

// 1. Pages
const dirPages = path.join(racine, 'labo', 'pages');
// Pages du Lot 6 (les pages plus anciennes ont leurs propres contrôles).
const PAGES = new Set(['aidant.html', 'idees.html', 'kits.html', 'presse.html', 'transfert.html']);
for (const f of (await readdir(dirPages)).filter((n) => PAGES.has(n))) {
  const h = await readFile(path.join(dirPages, f), 'utf8');
  if (!/<html[^>]+lang="fr"/i.test(h)) ko(`${f} : <html lang="fr"> manquant`);
  if (!/name="viewport"/i.test(h)) ko(`${f} : meta viewport manquante`);
  if (!/<title>[^<]+<\/title>/i.test(h)) ko(`${f} : <title> manquant`);
  if ((h.match(/<h1[\s>]/gi) ?? []).length > 1) ko(`${f} : plusieurs <h1>`);
  for (const m of h.matchAll(/<img\b[^>]*>/gi)) if (!/\balt=/i.test(m[0])) ko(`${f} : image sans alt (${m[0].slice(0, 60)})`);
  for (const m of h.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const a = m[2];
    if (/type="(hidden|submit|button|checkbox|radio)"/i.test(a) && /type="hidden"/i.test(a)) continue;
    const id = /\bid="([^"]+)"/i.exec(a)?.[1];
    const avant = h.slice(0, m.index);
    const dansLabel = avant.lastIndexOf('<label') > avant.lastIndexOf('</label>');
    const piege = /tabindex="-1"/i.test(a) && /aria-hidden/i.test(h.slice(Math.max(0, m.index - 200), m.index + 200));
    const ok = /aria-label(ledby)?=/i.test(a) || /type="hidden"/i.test(a) || piege || dansLabel || (id && new RegExp(`for="${id}"`).test(h));
    if (!ok) ko(`${f} : champ sans étiquette (${m[0].slice(0, 60)})`);
  }
}

// 2. Voix unique
async function* fichiers(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|dist|audio/.test(e.name)) yield* fichiers(p); } else if (/\.(tsx?|jsx?)$/.test(e.name)) yield p; } }
for (const base of ['src', path.join('packages', 'shell', 'src')]) {
  for await (const p of fichiers(path.join(racine, base))) {
    const t = await readFile(p, 'utf8');
    if (/(?<!\/\/.*)\bspeechSynthesis\b/.test(t.replace(/\/\*[\s\S]*?\*\//g, '')) && !/alphabetteAudio|audio\//.test(p)) ko(`${path.relative(racine, p)} : speechSynthesis direct interdit (utiliser alphabetteAudio)`);
  }
}

// 3. Contrastes AAA
const paires = [
  ['Codex jour : encre/parchemin', '#2c1a0e', '#f4e8cf'], ['Codex jour : sépia/parchemin', '#4a2e1b', '#f4e8cf'], ['Codex jour : sanguine/parchemin', '#7a2e22', '#f4e8cf'],
  ['Codex jour : sanguine/carte', '#7a2e22', '#efe0c2'], ['Codex jour : sépia/carte', '#4a2e1b', '#efe0c2'], ['Codex jour : bouton', '#fff8ea', '#7a2e22'],
  ['Codex encre : texte', '#f4e8cf', '#20140b'], ['Codex encre : doux', '#e6d3ae', '#2c1d11'], ['Codex encre : sanguine claire', '#f0b8a8', '#2c1d11'], ['Codex encre : bouton', '#20140b', '#e8b27a'],
  ...Object.entries({ A: '#14532d', B: '#365314', C: '#713f12', D: '#7c2d12', E: '#7f1d1d' }).map(([l, c]) => [`Nutri-Score ${l}`, '#ffffff', c]),
];
for (const [nom, a, b] of paires) { const c = contraste(a, b); if (c < 7) ko(`contraste AAA insuffisant — ${nom} : ${c.toFixed(2)}:1`); }

if (erreurs.length) { console.error(`✗ accessibilité : ${erreurs.length} problème(s)\n- ${erreurs.join('\n- ')}`); process.exit(1); }
console.log(`✓ accessibilité : pages, voix unique et ${paires.length} contrastes AAA vérifiés`);
