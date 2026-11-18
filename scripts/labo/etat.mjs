/**
 * scripts/labo/etat.mjs — tableau de bord des avis pour les agents du Laboratoire.
 *
 * Usage (depuis la racine du hub) :
 *   git fetch -q --depth=1 origin labo-donnees && git show FETCH_HEAD:feedbacks.json > /tmp/feedbacks.json
 *   node scripts/labo/etat.mjs /tmp/feedbacks.json            → résumé lisible
 *   node scripts/labo/etat.mjs /tmp/feedbacks.json --json     → avis à trier, en JSON (pour Triage_Analyst)
 *
 * Fusionne les avis bruts (export de alphabette.eu) avec data/labo/decisions.json et
 * data/labo/autorisations.json. Les plus soutenus (+1) d'abord. Au-delà de 5 soutiens,
 * une demande est marquée PRIORITÉ HAUTE.
 */
import { readFile } from 'node:fs/promises';

const [fichier = '/tmp/feedbacks.json', option] = process.argv.slice(2);
const lire = async (p, defaut) => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(defaut)));

const brut = await lire(fichier, { feedbacks: [] });
const { decisions = {} } = await lire('data/labo/decisions.json', {});
const { autorisations = {} } = await lire('data/labo/autorisations.json', {});
const { apps: registre = [] } = await lire('data/apps-registry.json', {});
const noms = Object.fromEntries(registre.map((a) => [a.id, a.name]));

const avis = (brut.feedbacks ?? []).map((a) => {
  const d = decisions[a.id] ?? {};
  return {
    ...a,
    status: d.status ?? a.status ?? 'pending',
    ai_analysis: d.ai_analysis ?? a.ai_analysis,
    autorisation: autorisations[a.id] ?? null,
  };
});

const aTrier = avis
  .filter((a) => a.status === 'pending' || (a.status === 'needs_human_review' && a.autorisation))
  .sort((x, y) => y.upvotes - x.upvotes || x.timestamp.localeCompare(y.timestamp))
  .map((a) => ({ ...a, priorite_haute: a.upvotes > 5 }));

if (option === '--json') {
  console.log(JSON.stringify(aTrier, null, 2));
  process.exit(0);
}

const parStatut = avis.reduce((m, a) => ((m[a.status] = (m[a.status] ?? 0) + 1), m), {});
console.log(`Avis reçus : ${avis.length} — ${Object.entries(parStatut).map(([s, n]) => `${s} ${n}`).join(', ') || 'aucun'}`);
console.log(`Export du : ${brut.genere_le ?? 'inconnu'}\n`);
if (!aTrier.length) console.log('Rien à trier.');
for (const a of aTrier) {
  const note = a.rating ? `${a.rating}★ ` : '';
  const prio = a.priorite_haute ? ' ⚠ PRIORITÉ HAUTE' : '';
  const auto = a.autorisation ? ` [Valentin : ${a.autorisation.decision}]` : '';
  console.log(`${a.id}  ${noms[a.app_id] ?? a.app_id}  ${a.category}  +${a.upvotes}${prio}${auto}`);
  console.log(`   ${note}${a.comment || '(note seule)'}`);
  if (a.telemetry?.console_errors?.length) console.log(`   erreurs : ${a.telemetry.console_errors.join(' | ')}`);
  console.log(`   ${a.telemetry?.platform ?? ''} ${a.telemetry?.viewport ?? ''} · version ${a.version_tested}`);
}

// Tableau de bord d'administration : dernières décisions du Conseil des Agents et incidents de production.
if (option !== '--json') {
  const conseil = await lire('data/labo/conseil.json', { apps: {} });
  const incidents = await lire('data/labo/incidents.json', { incidents: [] });
  const decisionsConseil = Object.entries(conseil.apps ?? {});
  if (decisionsConseil.length) {
    console.log('\n=== Conseil des Agents ===');
    for (const [id, d] of decisionsConseil) console.log(`\n${noms[id] ?? id} — ${d.evalue_le.slice(0, 10)}\n  ${d.synthese_executive.join('\n  ')}`);
  }
  if ((incidents.incidents ?? []).length) {
    console.log('\n=== Incidents en production (Sentinelle) ===');
    for (const i of incidents.incidents.slice(-5)) console.log(`- ${i.date.slice(0, 16)} ${i.app_id} : ${i.raisons.join(' ; ')} → ${i.retour_a ? 'retour à ' + i.retour_a.slice(0, 7) : 'pas de N-1'}`);
  }
}
