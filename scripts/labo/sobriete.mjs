/**
 * scripts/labo/sobriete.mjs — outils de sobriété numérique partagés par l'Agent Gardien,
 * le plugin Vite et la collecte des applis :
 *   - ecoIndex(dom, requetes, tailleKo) : méthode EcoIndex (GreenIT.fr / ecoindex.fr), note A à G ;
 *   - noteSobriete(score) : A à E pour la fiche (F et G de l'EcoIndex comptent comme E) ;
 *   - compresserSvg(texte) : allègement SANS perte (commentaires, métadonnées d'éditeur, espaces) ;
 *   - compresserSvgDossier(dossier) : applique la compression à tous les .svg d'un build.
 * Aucune dépendance.
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Quantiles officiels de l'EcoIndex (référentiel HTTP Archive), repris de cnumr/ecoindex_python.
const Q_DOM = [0, 47, 75, 159, 233, 298, 358, 417, 476, 537, 603, 674, 753, 843, 949, 1076, 1237, 1459, 1801, 2479, 594601];
const Q_REQ = [0, 2, 15, 25, 34, 42, 49, 56, 63, 70, 78, 86, 95, 105, 117, 130, 147, 170, 205, 281, 3920];
const Q_KO = [0, 1.37, 144.7, 319.53, 479.46, 631.97, 783.38, 937.91, 1098.62, 1265.47, 1448.32, 1648.27, 1876.08, 2142.06, 2465.37, 2866.31, 3401.59, 4155.73, 5400.08, 8037.54, 223212.26];

function quantile(q, v) {
  for (let i = 1; i < q.length; i++) if (v < q[i]) return i - 1 + (v - q[i - 1]) / (q[i] - q[i - 1]);
  return q.length - 1;
}

export function ecoIndex(dom, requetes, tailleKo) {
  const score = Math.max(0, Math.min(100, 100 - (5 * (3 * quantile(Q_DOM, dom) + 2 * quantile(Q_REQ, requetes) + quantile(Q_KO, tailleKo))) / 6));
  const note = score > 80 ? 'A' : score > 70 ? 'B' : score > 55 ? 'C' : score > 40 ? 'D' : score > 25 ? 'E' : score > 10 ? 'F' : 'G';
  return {
    score: Math.round(score * 10) / 10,
    note,
    // Estimations EcoIndex par page vue.
    ges_g_co2e: Math.round((2 + (2 * (50 - score)) / 100) * 100) / 100,
    eau_cl: Math.round((3 + (3 * (50 - score)) / 100) * 100) / 100,
  };
}

/** Note de sobriété A–E affichée sur alphabette.fr (F et G regroupées en E). */
export const noteSobriete = (scoreEco) => (scoreEco > 80 ? 'A' : scoreEco > 70 ? 'B' : scoreEco > 55 ? 'C' : scoreEco > 40 ? 'D' : 'E');
export const ORDRE_NOTES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Allègement sans perte d'un SVG : rien de ce qui est dessiné n'est modifié. */
export function compresserSvg(svg) {
  return svg
    .replace(/<\?xml[^>]*\?>\s*/g, '')
    .replace(/<!DOCTYPE[^>]*>\s*/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/<(sodipodi|inkscape):[^>]*?\/>/gi, '')
    .replace(/<(sodipodi|inkscape):([a-z-]+)[\s\S]*?<\/\1:\2>/gi, '')
    .replace(/\s(?:sodipodi|inkscape):[a-z-]+="[^"]*"/gi, '')
    .replace(/\sxmlns:(?:sodipodi|inkscape|dc|cc|rdf)="[^"]*"/gi, '')
    .replace(/>\s+</g, '><')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function fichiers(dossier) {
  const sortie = [];
  for (const nom of await readdir(dossier).catch(() => [])) {
    const p = path.join(dossier, nom);
    const s = await stat(p);
    if (s.isDirectory()) sortie.push(...(await fichiers(p)));
    else sortie.push({ p, taille: s.size });
  }
  return sortie;
}

export async function compresserSvgDossier(dossier) {
  let avant = 0, apres = 0, n = 0;
  for (const f of await fichiers(dossier)) {
    if (!f.p.endsWith('.svg')) continue;
    const t = await readFile(f.p, 'utf8');
    const c = compresserSvg(t);
    avant += Buffer.byteLength(t); apres += Buffer.byteLength(c); n++;
    if (c.length < t.length) await writeFile(f.p, c);
  }
  return { fichiers: n, avant_o: avant, apres_o: apres, gain_o: avant - apres };
}

/** Poids d'un build par famille de fichiers (Ko). */
export async function poidsBuild(dossier) {
  const fam = { js: 0, css: 0, images: 0, polices: 0, html: 0, autres: 0 };
  for (const f of await fichiers(dossier)) {
    const e = path.extname(f.p).toLowerCase();
    const k = /\.(m?js)$/.test(e) ? 'js' : e === '.css' ? 'css' : /\.(png|jpe?g|gif|webp|avif|svg|ico)$/.test(e) ? 'images'
      : /\.(woff2?|ttf|otf|eot)$/.test(e) ? 'polices' : e === '.html' ? 'html' : 'autres';
    fam[k] += f.taille;
  }
  const ko = (o) => Math.round(o / 102.4) / 10;
  return Object.fromEntries([...Object.entries(fam).map(([k, v]) => [k, ko(v)]), ['total', ko(Object.values(fam).reduce((s, v) => s + v, 0))]]);
}
