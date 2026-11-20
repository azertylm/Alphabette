/**
 * scripts/labo/tableau-honneur.mjs — remplit data/labo/tableau-honneur.json (Tableau d'Honneur d'alphabette.eu).
 *
 * Usage (racine du hub, après maturity-curator) : node scripts/labo/tableau-honneur.mjs /tmp/feedbacks.json
 *
 * Une ligne par avis qui :
 *   - porte un pseudo (champ facultatif du formulaire d'avis, validé par api/feedback.php) ;
 *   - est « implemented » dans data/labo/decisions.json (amélioration réellement en ligne).
 * Jamais de ligne inventée ni de pseudo ajouté à la main. Les lignes de plus de 2 mois sont supprimées
 * (le site n'affiche que le mois en cours). Un pseudo listé dans « retraits » n'est plus jamais ajouté.
 */
import { readFile, writeFile } from 'node:fs/promises';

const [fichier = '/tmp/feedbacks.json'] = process.argv.slice(2);
const lire = async (p, defaut) => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(defaut)));

const { feedbacks = [] } = await lire(fichier, {});
const { decisions = {} } = await lire('data/labo/decisions.json', {});
const sortie = 'data/labo/tableau-honneur.json';
const tableau = await lire(sortie, { contributions: [] });
const contributions = Array.isArray(tableau.contributions) ? tableau.contributions : [];
const retraits = new Set((tableau.retraits ?? []).map((p) => String(p).toLowerCase()));
const dejaLa = new Set(contributions.map((c) => c.avis_id));

const PSEUDO = /^[\p{L}\p{N} ._'’-]{2,24}$/u;
let ajouts = 0;
for (const a of feedbacks) {
  const d = decisions[a.id];
  const statut = d?.status ?? a.status;
  const pseudo = typeof a.pseudo === 'string' ? a.pseudo.trim() : '';
  if (statut !== 'implemented' || !pseudo || !PSEUDO.test(pseudo) || /@|\d{5,}/.test(pseudo)) continue;
  if (dejaLa.has(a.id) || retraits.has(pseudo.toLowerCase())) continue;
  const date = [d?.date, d?.implemented_le, d?.mis_en_ligne_le].find((x) => x && !Number.isNaN(Date.parse(x))) ?? new Date().toISOString();
  contributions.push({ pseudo, app_id: a.app_id, avis_id: a.id, date });
  dejaLa.add(a.id);
  ajouts++;
}

// Minimisation : on ne garde que le mois en cours et le précédent.
const limite = new Date();
limite.setUTCDate(1);
limite.setUTCMonth(limite.getUTCMonth() - 1);
limite.setUTCHours(0, 0, 0, 0);
limite.setTime(limite.getTime() - 2 * 3600e3); // marge fuseau de Paris
const gardees = contributions.filter((c) => Date.parse(c.date) >= limite.getTime());

tableau.contributions = gardees.sort((x, y) => Date.parse(x.date) - Date.parse(y.date));
await writeFile(sortie, JSON.stringify(tableau, null, 2) + '\n');
console.log(`Tableau d'Honneur : ${ajouts} retour(s) ajouté(s), ${gardees.length} ligne(s) gardée(s).`);
