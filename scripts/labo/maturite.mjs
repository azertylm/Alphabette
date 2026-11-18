/**
 * scripts/labo/maturite.mjs — calcule data/labo/maturity_index.json (score sur 100).
 *
 * Usage (racine du hub) : node scripts/labo/maturite.mjs /tmp/feedbacks.json
 *
 *  - Satisfaction (40 pts)  : note moyenne / 5 × 40 — au moins 3 notes, sinon pas de score ;
 *  - Stabilité    (30 pts)  : 30 − 10 par bug encore ouvert signalé sur 7 jours
 *                             − 5 par avis des 7 jours portant des erreurs JavaScript (minimum 0) ;
 *  - Audit qualité IA (30)  : data/labo/audits.json (QA_Verifier) — sans audit, pas de score.
 * Pas assez de données → score null : la carte n'affiche rien (aucun chiffre inventé).
 * Affiche « TRANSFERT POSSIBLE » pour chaque application à 85 ou plus.
 */
import { readFile, writeFile } from 'node:fs/promises';

const [fichier = '/tmp/feedbacks.json'] = process.argv.slice(2);
const lire = async (p, defaut) => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(defaut)));

const { feedbacks = [] } = await lire(fichier, {});
const { decisions = {} } = await lire('data/labo/decisions.json', {});
const { apps: audits = {} } = await lire('data/labo/audits.json', {});
const { apps: registre = [] } = await lire('data/apps-registry.json', {});
const sortie = await lire('data/labo/maturity_index.json', {});

const il7j = Date.now() - 7 * 86400 * 1000;
const statut = (a) => decisions[a.id]?.status ?? a.status ?? 'pending';
const resultat = {};
const alertes = [];

for (const app of registre.filter((a) => a.status === 'actif')) {
  const avis = feedbacks.filter((a) => a.app_id === app.id && statut(a) !== 'rejected');
  const notes = avis.map((a) => a.rating).filter((n) => Number.isInteger(n));
  const recents = avis.filter((a) => Date.parse(a.timestamp) > il7j);
  const bugsOuverts = recents.filter((a) => a.category === 'Bug' && statut(a) !== 'implemented').length;
  const avecErreurs = recents.filter((a) => a.telemetry?.console_errors?.length).length;

  const satisfaction = notes.length >= 3 ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length / 5) * 40) : null;
  const stabilite = Math.max(0, 30 - 10 * bugsOuverts - 5 * avecErreurs);
  const audit = typeof audits[app.id]?.score === 'number' ? Math.max(0, Math.min(30, audits[app.id].score)) : null;
  const score = satisfaction === null || audit === null ? null : satisfaction + stabilite + audit;

  resultat[app.id] = {
    score,
    satisfaction,
    stabilite,
    audit,
    nb_notes: notes.length,
    manque: score === null ? [satisfaction === null && 'au moins 3 notes', audit === null && 'audit QA'].filter(Boolean) : [],
  };
  if (score !== null && score >= 85 && !app.vitrine) alertes.push(`${app.name} : ${score}/100`);
}

sortie.apps = resultat;
sortie.calcule_le = new Date().toISOString();
await writeFile('data/labo/maturity_index.json', JSON.stringify(sortie, null, 2) + '\n');

const avecScore = Object.entries(resultat).filter(([, r]) => r.score !== null);
console.log(`Scores calculés : ${avecScore.length} / ${Object.keys(resultat).length}`);
for (const [id, r] of avecScore) console.log(`  ${id} : ${r.score}/100 (satisfaction ${r.satisfaction}, stabilité ${r.stabilite}, audit ${r.audit})`);
for (const a of alertes) console.log(`TRANSFERT POSSIBLE vers alphabette.fr — ${a}`);
