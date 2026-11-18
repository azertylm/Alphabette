/**
 * scripts/labo/graduation.mjs — Agent de Graduation : du Laboratoire (alphabette.eu) à la Vitrine (alphabette.fr).
 *
 *   node scripts/labo/graduation.mjs eligibles /tmp/feedbacks.json [/tmp/chaos.json]
 *       → JSON : pour chaque appli du Laboratoire, les 3 conditions et le verdict, + le message pour Valentin.
 *   node scripts/labo/graduation.mjs preparer <app_id> /tmp/feedbacks.json
 *       → prépare le paquet de déploiement (sur la branche courante, jamais sur main) :
 *         registre « vitrine » + « certifie », version figée (vitrine.ref = commit testé sur .eu) ou copie
 *         de la page dans vitrine/, entrée data/labo/graduation.json. La publication sur .fr n'a lieu
 *         qu'après la fusion, sur ordre explicite de Valentin.
 *         Avant tout, l'Agent Gardien (gardien.mjs) audite l'appli : une régression bloque le transfert.
 *
 * Conditions (cahier des charges de Valentin) :
 *   1. note moyenne ≥ 4,5/5 ;
 *   2. au moins 20 avis vérifiés (notes humaines, ni robot, ni rejetées) ;
 *   3. 0 bug critique ouvert, et aucun ouvert ces 7 derniers jours (erreur JavaScript jointe, plus de 5 « +1 »,
 *      ou anomalie critique de l'Agent Chaos de la dernière nuit).
 * Au pré-rendu (scripts/labo/seo.mjs), la note et le nombre d'avis enregistrés ici alimentent le JSON-LD.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const lireJson = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const ecrireJson = (p, d) => writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
const [commande, ...args] = process.argv.slice(2);

const NOTE_MIN = 4.5, AVIS_MIN = 20, JOURS_CALME = 7;
const OUVERTS = ['pending', 'approved_auto', 'needs_human_review'];
const CHAOS_CRITIQUE = ['exception', 'promesse_rejetee', 'ecran_blanc', 'pwa_hors_ligne'];

function bilan(appId, feedbacks, decisions, chaos) {
  const statut = (a) => decisions[a.id]?.status ?? a.status ?? 'pending';
  const humains = feedbacks.filter((a) => a.app_id === appId && a.source !== 'agent_chaos' && statut(a) !== 'rejected');
  const notes = humains.map((a) => a.rating).filter(Number.isInteger);
  const moyenne = notes.length ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 100) / 100 : null;
  const il7j = Date.now() - JOURS_CALME * 86400 * 1000;
  const critique = (a) => a.category === 'Bug' && ((a.telemetry?.console_errors?.length ?? 0) > 0 || a.upvotes > 5 || a.source === 'agent_chaos');
  const bugsOuverts = feedbacks.filter((a) => a.app_id === appId && critique(a) && OUVERTS.includes(statut(a)));
  const bugsRecents = feedbacks.filter((a) => a.app_id === appId && critique(a) && statut(a) !== 'rejected' && Date.parse(a.timestamp) > il7j);
  const chaosCritiques = (chaos.apps ?? []).find((x) => x.app_id === appId)?.anomalies?.filter((a) => CHAOS_CRITIQUE.includes(a.type)) ?? [];
  const conditions = {
    note: { ok: moyenne !== null && moyenne >= NOTE_MIN, valeur: moyenne, seuil: NOTE_MIN },
    avis: { ok: notes.length >= AVIS_MIN, valeur: notes.length, seuil: AVIS_MIN },
    stabilite: { ok: !bugsOuverts.length && !bugsRecents.length && !chaosCritiques.length, bugs_ouverts: bugsOuverts.map((a) => a.id), bugs_7_jours: bugsRecents.map((a) => a.id), chaos: chaosCritiques.map((a) => a.ticket) },
  };
  return { moyenne, avis: notes.length, conditions, eligible: Object.values(conditions).every((c) => c.ok) };
}

if (commande === 'eligibles') {
  const { feedbacks = [] } = lireJson(args[0] ?? '/tmp/feedbacks.json', {});
  const chaos = lireJson(args[1] ?? '/tmp/chaos.json', { apps: [] });
  const { decisions = {} } = lireJson('data/labo/decisions.json', {});
  const { apps = [] } = lireJson('data/apps-registry.json', {});
  const resultats = apps
    .filter((a) => a.status === 'actif' && !a.vitrine)
    .map((a) => ({ app_id: a.id, nom: a.name, ...bilan(a.id, feedbacks, decisions, chaos) }));
  const prets = resultats.filter((r) => r.eligible);
  console.log(JSON.stringify({
    genere_le: new Date().toISOString(),
    criteres: { note_min: NOTE_MIN, avis_min: AVIS_MIN, jours_sans_bug_critique: JOURS_CALME },
    eligibles: prets.map((r) => r.app_id),
    messages: prets.map((r) => `🚀 ${r.nom} a atteint ${String(r.moyenne).replace('.', ',')}/5 sur ${r.avis} avis vérifiés, 0 bug critique depuis ${JOURS_CALME} jours sur alphabette.eu. Elle semble prête pour la production. Veux-tu que je la transfère sur alphabette.fr ?`),
    apps: resultats,
  }, null, 2));
} else if (commande === 'preparer') {
  const [appId, fichier = '/tmp/feedbacks.json'] = args;
  const { feedbacks = [] } = lireJson(fichier, {});
  const { decisions = {} } = lireJson('data/labo/decisions.json', {});
  const chaos = lireJson('/tmp/chaos.json', { apps: [] });
  const registre = lireJson('data/apps-registry.json', { apps: [] });
  const sources = lireJson('data/apps-sources.json', { apps: {} });
  const app = registre.apps.find((a) => a.id === appId);
  if (!app) throw new Error(`Appli inconnue : ${appId}`);
  const b = bilan(appId, feedbacks, decisions, chaos);
  if (!b.eligible && !process.argv.includes('--forcer-sur-ordre-de-valentin')) {
    console.error(`${app.name} ne remplit pas les conditions :`, JSON.stringify(b.conditions));
    process.exit(2);
  }
  // Agent Gardien Ergonomie & Sobriété : passe obligatoire, sans contournement possible.
  // Il compare la version de .eu à la précédente (dernier transfert, sinon la version en ligne sur .fr).
  const gardien = spawnSync(process.execPath, ['scripts/labo/gardien.mjs', 'audit', appId, '--enregistrer', '--sortie', `/tmp/eco-score-${appId}.json`],
    { stdio: ['ignore', 'ignore', 'inherit'], env: { NODE_PATH: '/tmp/pw/node_modules', ...process.env } });
  if (gardien.status !== 0) {
    console.error(gardien.status === 1
      ? `⛔ Transfert de ${app.name} bloqué par l'Agent Gardien (régression d'accessibilité ou de sobriété) : à corriger sur .eu d'abord.`
      : `⛔ L'Agent Gardien n'a pas pu auditer ${app.name} (Playwright installé ? npm i playwright dans /tmp/pw). Transfert bloqué.`);
    process.exit(3);
  }
  const ecos = lireJson('data/labo/eco_scores.json', { apps: {} });
  if (ecos.apps[appId]) { ecos.apps[appId].vitrine = true; ecrireJson('data/labo/eco_scores.json', ecos); }
  const date = new Date().toISOString();
  let hote = '';
  try { hote = new URL(app.url).hostname.replace(/^www\./, ''); } catch {}
  const cle = Object.entries(sources.apps).find(([c, s]) => hote === `${c}.alphabette.fr` || (s.domains ?? []).includes(hote))?.[0];
  let version;
  if (cle) {
    // Le commit testé sur .eu (branche principale) devient la version figée de la vitrine.
    const src = sources.apps[cle];
    version = execFileSync('git', ['ls-remote', `https://github.com/${src.repo}.git`, `refs/heads/${src.branch || 'main'}`], { encoding: 'utf8' }).split('\t')[0];
    src.vitrine = { ref: version, depuis: date.slice(0, 10) };
    ecrireJson('data/apps-sources.json', sources);
  } else {
    // Page du hub : la version du Laboratoire est copiée telle quelle dans vitrine/<page>/.
    const page = new URL(app.url).pathname.replace(/^\/|\/$/g, '').split('/')[0];
    if (!page || !existsSync(`public/${page}`)) throw new Error(`Page du hub introuvable pour ${appId}`);
    cpSync(`public/${page}`, `vitrine/${page}`, { recursive: true });
    version = `vitrine/${page}`;
  }
  app.vitrine = true;
  app.certifie = { date: date.slice(0, 10), moyenne: b.moyenne, avis: b.avis };
  ecrireJson('data/apps-registry.json', registre);
  const grad = lireJson('data/labo/graduation.json', { apps: {} });
  grad.apps[appId] = { date, moyenne: b.moyenne, avis: b.avis, version, conditions: b.conditions };
  ecrireJson('data/labo/graduation.json', grad);
  console.log(JSON.stringify({ app_id: appId, nom: app.name, version, moyenne: b.moyenne, avis: b.avis, prochaine_etape: 'Pull Request du hub « Graduation : <appli> » — fusion seulement sur ordre explicite de Valentin.' }, null, 2));
} else {
  console.error('Usage : eligibles <feedbacks.json> [chaos.json] | preparer <app_id> <feedbacks.json>');
  process.exit(1);
}
