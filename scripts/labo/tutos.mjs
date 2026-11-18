#!/usr/bin/env node
/**
 * scripts/labo/tutos.mjs — repère les difficultés d'usage récurrentes (« je ne trouve pas… »,
 * « comment on… », « où est… ») qui ne viennent PAS d'un bug de code, pour que l'agent écrive
 * un micro-tuto (<MicroTuto />, data/labo/tutos.json).
 *
 *   node scripts/labo/tutos.mjs frictions /tmp/feedbacks.json [--jours 30] [--min 3]
 *
 * Critères : avis des 30 derniers jours, non rejetés, sans erreur console, qui parlent de trouver
 * ou de comprendre quelque chose ; regroupés par appli et par thème (mots communs) ; un thème est
 * retenu à partir de 3 avis (les +1 comptent). Appli qui a déjà un tuto pour ce thème : ignorée.
 */
import { readFileSync } from 'node:fs';

const FRICTION = /(trouve pas|trouvé|je ne vois pas|on ne voit pas|où (est|sont|se trouve|faut)|ou est|comment (on|faire|je|ça)|pas (clair|compris|intuitif)|compliqu|perdu|cherch|caché|sais pas|savais pas)/i;
const VIDES = new Set('le la les un une des de du et ou a à au aux en je j on il elle ce ça cela pour pas ne est sont que qui dans sur avec mon ma mes faut fait faire comment où ou trouve trouver vois voit est-ce'.split(' '));

const [cmd, fichier, ...reste] = process.argv.slice(2);
const opt = (n, d) => { const i = reste.indexOf(`--${n}`); return i >= 0 ? Number(reste[i + 1]) : d; };
if (cmd !== 'frictions' || !fichier) {
  console.error('Usage : node scripts/labo/tutos.mjs frictions <feedbacks.json> [--jours 30] [--min 3]');
  process.exit(2);
}
const jours = opt('jours', 30), min = opt('min', 3);
const brut = JSON.parse(readFileSync(fichier, 'utf8'));
const avis = brut.feedbacks ?? brut;
let tutos = { apps: {} };
try { tutos = JSON.parse(readFileSync(new URL('../../data/labo/tutos.json', import.meta.url), 'utf8')); } catch { /* aucun */ }

const limite = Date.now() - jours * 86400e3;
const mots = (t) => [...new Set(t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z]{4,}/g) ?? [])].filter((m) => !VIDES.has(m));

const parApp = {};
for (const a of avis) {
  if (a.status === 'rejected' || !a.comment || Date.parse(a.timestamp) < limite) continue;
  if (a.telemetry?.console_errors?.length) continue; // bug de code : autre circuit
  if (!FRICTION.test(a.comment)) continue;
  (parApp[a.app_id] ??= []).push({ id: a.id, texte: a.comment, poids: Math.max(1, a.upvotes ?? 1), mots: mots(a.comment) });
}

const resultat = [];
for (const [app, liste] of Object.entries(parApp)) {
  // Thème = mot le plus partagé entre les avis de l'appli.
  const compte = {};
  for (const a of liste) for (const m of a.mots) compte[m] = (compte[m] ?? 0) + a.poids;
  const themes = Object.entries(compte).filter(([, n]) => n >= min).sort((x, y) => y[1] - x[1]).slice(0, 3);
  for (const [theme, poids] of themes) {
    const deja = tutos.apps?.[app]?.raison?.toLowerCase().includes(theme);
    if (deja) continue;
    const exemples = liste.filter((a) => a.mots.includes(theme));
    resultat.push({ app_id: app, theme, poids, tickets: exemples.map((a) => a.id), exemples: exemples.slice(0, 4).map((a) => a.texte) });
  }
}
resultat.sort((a, b) => b.poids - a.poids);
console.log(JSON.stringify({ genere_le: new Date().toISOString(), frictions: resultat }, null, 2));
