#!/usr/bin/env node
/**
 * scripts/labo/podcast-labo.mjs — « Le Podcast du Labo », un épisode par semaine (3 minutes au plus).
 *
 *   node scripts/labo/podcast-labo.mjs [--episodes podcast/episodes.json] [--date AAAA-MM-JJ]
 *
 * Écrit le script parlé de la semaine (lundi → dimanche, heure de Paris) à partir de VRAIES données :
 *   - data/labo/changelog_summary.json : améliorations publiées sur alphabette.eu (datées) ;
 *   - data/labo/releases.json          : passages sur alphabette.fr (« depuis ») ;
 *   - data/labo/status-labo.json       : dernier passage des agents de 21 h 13, interventions de la Sentinelle ;
 *   - data/apps-registry.json          : noms lisibles des applications.
 * L'épisode est ajouté (ou remplacé, même semaine) dans episodes.json : 12 derniers gardés. Le workflow
 * labo-podcast.yml le range chaque dimanche sur la branche labo-donnees (podcast/) ; la publication le met dans
 * alphabette.eu/api/labo/podcast-labo.json, que la page Podcasts lit et fait lire par la voix de l'appareil.
 * Rien n'est inventé : une semaine calme donne un épisode court qui le dit.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const SORTIE = opt('episodes', 'podcast/episodes.json');
const lire = async (p, d) => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(d)));

/* Semaine de Paris : du lundi 00:00 au dimanche 23:59 qui contient --date (aujourd'hui par défaut). */
const jourParis = (d) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const ref = opt('date') ? new Date(`${opt('date')}T12:00:00Z`) : new Date();
const jour = new Date(`${jourParis(ref)}T12:00:00Z`);
const lundi = new Date(jour); lundi.setUTCDate(jour.getUTCDate() - ((jour.getUTCDay() + 6) % 7));
const dimanche = new Date(lundi); dimanche.setUTCDate(lundi.getUTCDate() + 6);
const debutS = jourParis(lundi), finS = jourParis(dimanche);
const dansSemaine = (iso) => { if (!iso) return false; const j = jourParis(new Date(iso)); return j >= debutS && j <= finS; };
const jeudi = new Date(lundi); jeudi.setUTCDate(lundi.getUTCDate() + 3);
const numSemaine = Math.ceil(((jeudi - Date.UTC(jeudi.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
const idEpisode = `${jeudi.getUTCFullYear()}-S${String(numSemaine).padStart(2, '0')}`;
const dateLongue = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/* Noms lisibles (« IADÉBAT » → « IA Débat ») ; les clés de releases.json (« franceservice ») sont rapprochées des id. */
const PETITS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'à', 'au', 'aux', 'en', 'l', 'd']);
const lisible = (nom) => nom !== nom.toUpperCase() ? nom : nom.toLowerCase().split(/(\s+|-|'|’)/).map((m, i) =>
  i === 0 && m.startsWith('ia') && m.length > 2 ? `IA ${m[2].toUpperCase()}${m.slice(3)}` : i > 0 && PETITS.has(m) ? m : m.charAt(0).toUpperCase() + m.slice(1)).join('');
const { apps: registre = [] } = await lire('data/apps-registry.json', {});
const noms = new Map();
for (const a of registre) { noms.set(a.id, lisible(a.name ?? a.id)); noms.set(String(a.id).replace(/[^a-z0-9]/gi, '').toLowerCase(), lisible(a.name ?? a.id)); }
noms.set('podcasts', 'Podcasts');
const nom = (cle) => noms.get(cle) ?? noms.get(String(cle).replace(/[^a-z0-9]/gi, '').toLowerCase()) ?? cle;

/* Données de la semaine */
const { apps: journal = {} } = await lire('data/labo/changelog_summary.json', {});
const ameliorations = Object.entries(journal).flatMap(([cle, lignes]) => (lignes ?? [])
  .filter((l) => dansSemaine(l.date) && l.message).map((l) => {
    const t = String(l.message).trim().replace(/\.?$/, '.');
    return { app: nom(cle), texte: t.charAt(0).toLowerCase() + t.slice(1), date: l.date };
  }))
  .sort((a, b) => a.date.localeCompare(b.date));
const { apps: versions = {} } = await lire('data/labo/releases.json', {});
const passagesFr = Object.entries(versions).flatMap(([cle, l]) => (l ?? [])
  .filter((v) => ['en_ligne', 'stable'].includes(v.statut) && dansSemaine(`${v.depuis}T12:00:00Z`)).map(() => nom(cle)));
const statut = await lire('data/labo/status-labo.json', {});
const interventions = (statut.sentinelle?.interventions ?? []).filter((i) => dansSemaine(i.date ?? i.le ?? i.quand));
const liste = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}` : l[0] ?? '');

/* Script parlé */
const sections = [];
sections.push({ titre: 'Ouverture', texte: `Bonjour, et bienvenue dans le Podcast du Labo : la semaine du ${dateLongue(debutS)} au ${dateLongue(finS)} sur alphabette.eu, le laboratoire où vos avis font évoluer les applications. En trois minutes au plus, ce qui a vraiment changé.` });
if (ameliorations.length) {
  const montrees = ameliorations.slice(0, 8);
  const parApp = new Map();
  for (const a of montrees) parApp.set(a.app, [...(parApp.get(a.app) ?? []), a.texte]);
  const phrases = [...parApp].map(([app, t]) => `Dans ${app} : ${t.join(' Et aussi : ')}`);
  const reste = ameliorations.length - montrees.length;
  sections.push({ titre: 'Ce qui a été amélioré', texte: `Cette semaine, ${ameliorations.length === 1 ? 'une amélioration a été publiée' : `${ameliorations.length} améliorations ont été publiées`}. ${phrases.join(' ')}${reste > 0 ? ` Et ${reste} autre${reste > 1 ? 's' : ''}, à découvrir sur chaque carte avec le bouton Avant / Après.` : ''}` });
} else {
  sections.push({ titre: 'Ce qui a été amélioré', texte: 'Semaine calme : aucune amélioration publiée cette fois. Les agents sont passés chaque soir, mais rien ne méritait d\'être changé à la hâte. C\'est aussi ça, un laboratoire sérieux.' });
}
sections.push({ titre: 'Sur la vitrine alphabette.fr', texte: passagesFr.length
  ? `Côté vitrine, ${liste([...new Set(passagesFr)])} ${new Set(passagesFr).size > 1 ? 'ont' : 'a'} reçu une nouvelle version validée sur alphabette.fr.`
  : 'Côté vitrine, aucune nouvelle version n\'est passée sur alphabette.fr cette semaine : seules les applications assez mûries y vont.' });
sections.push({ titre: 'La Sentinelle', texte: interventions.length
  ? `La Sentinelle, qui surveille alphabette.fr, est intervenue ${interventions.length} fois pour revenir à une version sûre. Tout est rentré dans l'ordre.`
  : 'La Sentinelle, qui surveille alphabette.fr jour et nuit, n\'a pas eu besoin d\'intervenir.' });
sections.push({ titre: 'À vous', texte: 'La suite dépend de vous : sous chaque application d\'alphabette.eu, le bouton « Donner mon avis ». Chaque soir à 21 h 13, les agents les lisent, et les meilleures idées deviennent des corrections. Merci, et à la semaine prochaine !' });

const texte = sections.map((s) => s.texte).join('\n\n');
const mots = texte.split(/\s+/).filter(Boolean).length;
const episode = {
  id: idEpisode, semaine: { du: debutS, au: finS }, publie_le: new Date().toISOString(),
  titre: `Le Podcast du Labo — semaine du ${dateLongue(debutS)}`,
  duree_estimee_s: Math.round((mots / 150) * 60), mots, sections, texte,
  sources: { ameliorations: ameliorations.length, passages_fr: passagesFr.length, interventions_sentinelle: interventions.length },
};

const d = await lire(SORTIE, { episodes: [] });
const episodes = [episode, ...(d.episodes ?? []).filter((e) => e.id !== episode.id)].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 12);
await mkdir(path.dirname(path.resolve(SORTIE)), { recursive: true });
await writeFile(SORTIE, JSON.stringify({ _aide: 'Le Podcast du Labo (alphabette.eu/podcasts/) : un script parlé par semaine, écrit par scripts/labo/podcast-labo.mjs à partir des vraies données du Laboratoire. 12 derniers épisodes.', episodes }, null, 2) + '\n');
console.log(`Podcast du Labo ${episode.id} : ${mots} mots (~${Math.round(episode.duree_estimee_s / 60 * 10) / 10} min), ${ameliorations.length} amélioration(s), ${passagesFr.length} passage(s) sur .fr.`);
if (episode.duree_estimee_s > 200) { console.error('::warning::épisode de plus de 3 min 20'); }
