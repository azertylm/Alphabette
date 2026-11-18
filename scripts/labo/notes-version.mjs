/**
 * scripts/labo/notes-version.mjs — matière première de l'Agent Rédacteur de notes de version (bilingue).
 *
 *   node scripts/labo/notes-version.mjs <app_id> <ancienne_ref> <nouvelle_ref> [/tmp/feedbacks.json]
 *       → JSON : commits entre les deux versions (dépôt de l'appli) + tickets fermés (implemented) de la période.
 * L'agent `redacteur-notes` en tire deux textes, rangés dans data/labo/notes_version.json :
 *   - « technique » (alphabette.eu) : correctifs, refactorisation, optimisations, avec références ;
 *   - « citoyenne » (alphabette.fr) : français simple, rassurant, sans jargon, pensé pour les seniors.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const lireJson = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const [appId, ancienne, nouvelle, fichier = '/tmp/feedbacks.json'] = process.argv.slice(2);
if (!appId || !ancienne || !nouvelle) {
  console.error('Usage : <app_id> <ancienne_ref> <nouvelle_ref> [feedbacks.json]');
  process.exit(1);
}
const { apps: registre = [] } = lireJson('data/apps-registry.json', {});
const { apps: sources = {} } = lireJson('data/apps-sources.json', {});
const app = registre.find((a) => a.id === appId);
let hote = '';
try { hote = new URL(app.url).hostname.replace(/^www\./, ''); } catch {}
const cle = Object.entries(sources).find(([c, s]) => hote === `${c}.alphabette.fr` || (s.domains ?? []).includes(hote))?.[0];
const depot = cle ? sources[cle].repo : 'azertylm/alphabette';

const comparaison = JSON.parse(execFileSync('gh', ['api', `repos/${depot}/compare/${ancienne}...${nouvelle}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const commits = comparaison.commits.map((c) => ({ sha: c.sha.slice(0, 7), date: c.commit.author.date, message: c.commit.message.split('\n\n')[0], details: c.commit.message.split('\n\n').slice(1).join('\n').replace(/Co-Authored-By:.*|Claude-Session:.*/g, '').trim().slice(0, 800) }));
const fichiers = (comparaison.files ?? []).map((f) => `${f.status} ${f.filename} (+${f.additions} −${f.deletions})`).slice(0, 60);
const debut = commits[0]?.date ?? '1970-01-01';
const { feedbacks = [] } = lireJson(fichier, {});
const { decisions = {} } = lireJson('data/labo/decisions.json', {});
const tickets = feedbacks
  .filter((a) => a.app_id === appId && (decisions[a.id]?.status ?? a.status) === 'implemented' && (decisions[a.id]?.decided_at ?? a.timestamp) >= debut)
  .map((a) => ({ id: a.id, categorie: a.category, demande: a.comment, message_public: decisions[a.id]?.changelog_public_message ?? null, plus1: a.upvotes }));

console.log(JSON.stringify({ app_id: appId, nom: app?.name, depot, de: ancienne, a: nouvelle, commits, fichiers, tickets_fermes: tickets }, null, 2));
