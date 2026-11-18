/**
 * scripts/labo/cycle.mjs — prépare un cycle du Laboratoire alphabette.eu (bun run labo:cycle).
 *
 * 1. récupère les avis (branche labo-donnees → /tmp/feedbacks.json) ;
 * 2. affiche le tableau de bord (scripts/labo/etat.mjs) ;
 * 3. recalcule le score de maturité (scripts/labo/maturite.mjs).
 * Ensuite, les 5 agents travaillent en relais strict : commande /cycle-labo (.claude/commands/cycle-labo.md),
 * lancée à la main ou par la tâche planifiée quotidienne (docs/LABO-EU.md). Ce script ne modifie aucun code.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const lire = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const FICHIER = '/tmp/feedbacks.json';

try {
  lire('git', ['fetch', '-q', '--depth=1', 'origin', 'labo-donnees']);
  writeFileSync(FICHIER, lire('git', ['show', 'FETCH_HEAD:feedbacks.json']));
  console.log(`Avis récupérés → ${FICHIER}\n`);
} catch {
  writeFileSync(FICHIER, JSON.stringify({ feedbacks: [] }));
  console.log("Pas encore de branche labo-donnees (aucun avis exporté) : rien à trier.\n");
}
run('node', ['scripts/labo/etat.mjs', FICHIER]);
console.log('');
run('node', ['scripts/labo/maturite.mjs', FICHIER]);
const cand = JSON.parse(lire('node', ['scripts/labo/correcteur.mjs', 'candidats', FICHIER]));
console.log(`Agent Correcteur : ${cand.bugs.length} bug(s) à corriger, ${cand.prompts.length} prompt(s) à ajuster.`);
const aTrier = JSON.parse(lire('node', ['scripts/labo/etat.mjs', FICHIER, '--json']));
console.log(`\n${aTrier.length} avis à trier${aTrier.some((a) => a.priorite_haute) ? ' (dont PRIORITÉ HAUTE)' : ''}. Suite : /cycle-labo.`);
