#!/usr/bin/env node
/**
 * scripts/labo/sentinelle.mjs — Sentinelle post-transfert & retour arrière automatique (alphabette.fr).
 *
 *   node scripts/labo/sentinelle.mjs verifier [--etat <fichier.json>] [--feedbacks /tmp/feedbacks.json] [--appliquer]
 *
 * Lit les agrégats anonymes de la sonde (https://alphabette.fr/api/sentinelle.php?etat=1) pour la version
 * actuellement publiée de chaque appli (vitrine.ref) et déclenche le retour arrière si, sur ses 100 premières
 * sessions :
 *   - plus de 2 % de sessions ont une erreur fatale (window.onerror / promesse rejetée de l'appli) —
 *     décidé dès la 3e session fautive, puisque 3 sur 100 dépassent déjà 2 % quoi qu'il arrive ;
 *   - ou le temps de premier rendu médian (≥ 20 mesures) a au moins doublé par rapport à la version précédente.
 *
 * Avec --appliquer :
 *   1. data/apps-sources.json : vitrine.ref ← release stable N-1 (data/labo/releases.json), la version fautive
 *      est marquée « retiree » (la graduation ne pourra pas la reproposer telle quelle) ;
 *   2. data/labo/incidents.json : trace (sessions, taux, rendus, erreurs nettoyées) ;
 *   3. data/labo/decisions.json : les tickets livrés avec la version fautive repassent « pending » (rouverts
 *      sur alphabette.eu) avec la trace de l'incident ;
 *   4. écrit /tmp/sentinelle-rapport.md (corps du ticket GitHub ouvert par le workflow).
 * Le commit, la publication et le ticket sont faits par .github/workflows/sentinelle.yml.
 * Sans version N-1 connue : pas de retour arrière possible, alerte seule.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const lire = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const ecrire = (p, d) => writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
if (args[0] !== 'verifier') { console.error('Usage : sentinelle.mjs verifier [--etat f] [--feedbacks f] [--appliquer]'); process.exit(2); }

const SEUIL_TAUX = 0.02, FENETRE = 100, MIN_FATALES = Math.floor(FENETRE * SEUIL_TAUX) + 1, MIN_RENDUS = 20, FACTEUR_RENDU = 2;

const etat = opt('etat') ? lire(opt('etat'), null)
  : await fetch(`https://alphabette.fr/api/sentinelle.php?etat=1&t=${Date.now()}`).then((r) => r.json()).catch(() => null);
if (!etat?.apps) { console.error('Sentinelle : état illisible.'); process.exit(2); }

const sources = lire('data/apps-sources.json', { apps: {} });
const releases = lire('data/labo/releases.json', { apps: {} });
const registre = lire('data/apps-registry.json', { apps: [] });
const idRegistre = (cle) => {
  const s = sources.apps[cle] ?? {};
  const hote = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  return registre.apps.find((a) => hote(a.url) === `${cle}.alphabette.fr` || (s.domains ?? []).includes(hote(a.url)))?.id ?? cle;
};

// Avertissements du navigateur qui ne font pas planter l'appli : jamais une « erreur fatale ».
const BENIN = /ResizeObserver loop/i;

const verdicts = [];
for (let [cle, a] of Object.entries(etat.apps)) {
  const ref = sources.apps[cle]?.vitrine?.ref;
  if (!ref || !ref.startsWith(a.version)) continue; // mesure d'une version qui n'est plus (ou pas) en ligne
  const raisons = [];
  // Si toutes les erreurs relevées sont des avertissements bénins, les sessions « fatales » n'en sont pas.
  const erreursReelles = (a.erreurs ?? []).filter((e) => !BENIN.test(e));
  if (a.fatales > 0 && (a.erreurs ?? []).length > 0 && erreursReelles.length === 0) a = { ...a, fatales: 0 };
  if (a.fatales >= MIN_FATALES || (a.sessions >= FENETRE && a.fatales / a.sessions > SEUIL_TAUX)) {
    raisons.push(`${a.fatales} session(s) sur ${a.sessions} avec une erreur fatale (seuil : plus de 2 % des ${FENETRE} premières)`);
  }
  const p = a.precedente?.rendu_median_ms;
  if (a.rendus_mesures >= MIN_RENDUS && p && a.rendu_median_ms >= FACTEUR_RENDU * p) {
    raisons.push(`premier rendu médian ${a.rendu_median_ms} ms contre ${p} ms pour la version précédente (×${(a.rendu_median_ms / p).toFixed(1)})`);
  }
  const histo = releases.apps[cle] ?? [];
  const precedente = [...histo].reverse().find((r) => r.ref !== ref && r.statut !== "retiree");
  verdicts.push({ cle, app_id: idRegistre(cle), version: ref, sessions: a.sessions, fatales: a.fatales, rendu_median_ms: a.rendu_median_ms,
    rendu_precedent_ms: p ?? null, retour_arriere: raisons.length > 0, raisons, cible: raisons.length ? precedente?.ref ?? null : null, erreurs: a.erreurs ?? [] });
}

// Sans version N-1, une version déjà marquée « retiree » a déjà donné son alerte : pas de nouvel incident,
// ni commit, ni publication, ni ticket à chaque passage (toutes les 20 minutes).
const dejaSignale = (v) => !v.cible && (releases.apps[v.cle] ?? []).some((r) => r.ref === v.version && r.statut === 'retiree');
const fautifs = verdicts.filter((v) => v.retour_arriere && !dejaSignale(v));
if (args.includes('--appliquer') && fautifs.length) {
  const incidents = lire('data/labo/incidents.json', { incidents: [] });
  const decisions = lire('data/labo/decisions.json', { decisions: {} });
  const fb = lire(opt('feedbacks') ?? '/tmp/feedbacks.json', { feedbacks: [] }).feedbacks ?? [];
  const date = new Date().toISOString();
  let rapport = `# ⛔ Sentinelle : incident en production sur alphabette.fr\n\n`;
  for (const v of fautifs) {
    const histo = (releases.apps[v.cle] ??= []);
    const courante = histo.find((r) => r.ref === v.version);
    if (courante) Object.assign(courante, { statut: 'retiree', retiree_le: date, raison: v.raisons.join(' ; ') });
    else histo.push({ ref: v.version, depuis: sources.apps[v.cle].vitrine.depuis, statut: 'retiree', retiree_le: date, raison: v.raisons.join(' ; ') });
    if (v.cible) {
      sources.apps[v.cle].vitrine = { ref: v.cible, depuis: date.slice(0, 10), retour_arriere_de: v.version };
      const cible = histo.find((r) => r.ref === v.cible);
      if (cible) cible.statut = 'en_ligne';
    }
    // Tickets livrés depuis la mise en ligne de la version fautive : rouverts sur .eu avec la trace.
    const depuis = Date.parse(courante?.depuis ?? sources.apps[v.cle]?.vitrine?.depuis ?? 0) || 0;
    const rouverts = [];
    for (const a of fb.filter((x) => x.app_id === v.app_id)) {
      const d = decisions.decisions[a.id];
      const statut = d?.status ?? a.status;
      if (statut !== 'implemented') continue;
      if (d?.date && Date.parse(d.date) < depuis - 30 * 86400e3) continue;
      decisions.decisions[a.id] = { ...(d ?? {}), status: 'pending', reouvert: { date, par: 'sentinelle', version: v.version, raisons: v.raisons, erreurs: v.erreurs } };
      rouverts.push(a.id);
    }
    incidents.incidents.push({ date, app: v.cle, app_id: v.app_id, version: v.version, retour_a: v.cible, raisons: v.raisons, sessions: v.sessions, fatales: v.fatales,
      rendu_median_ms: v.rendu_median_ms, rendu_precedent_ms: v.rendu_precedent_ms, erreurs: v.erreurs, tickets_rouverts: rouverts });
    rapport += `## ${v.app_id} (${v.cle}) — version ${v.version.slice(0, 7)}\n\n` +
      `- **Constat** : ${v.raisons.join(' ; ')}\n` +
      `- **Action** : ${v.cible ? `retour automatique à la version stable ${v.cible.slice(0, 7)} sur alphabette.fr` : 'aucune version précédente connue : pas de retour arrière possible, intervention nécessaire'}\n` +
      `- **Tickets rouverts sur alphabette.eu** : ${rouverts.length ? rouverts.join(', ') : 'aucun identifié'}\n` +
      (v.erreurs.length ? `- **Trace** (erreurs nettoyées, anonymes) :\n${v.erreurs.map((e) => `  - \`${e.replace(/`/g, "'")}\``).join('\n')}\n` : '') + '\n';
  }
  rapport += `La version retirée ne peut plus être reproposée telle quelle : corriger sur alphabette.eu, puis nouvelle graduation (Agent Gardien et Conseil des Agents).\n`;
  ecrire('data/apps-sources.json', sources);
  ecrire('data/labo/releases.json', releases);
  ecrire('data/labo/incidents.json', incidents);
  ecrire('data/labo/decisions.json', decisions);
  writeFileSync('/tmp/sentinelle-rapport.md', rapport);
}
console.log(JSON.stringify({ verifie_le: new Date().toISOString(), apps: verdicts, retours_arriere: fautifs.map((v) => v.cle), deja_signales: verdicts.filter((v) => v.retour_arriere && dejaSignale(v)).map((v) => v.cle) }, null, 2));
