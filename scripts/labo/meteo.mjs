/**
 * scripts/labo/meteo.mjs — tient data/labo/status-labo.json (bandeau « Météo du Labo » d'alphabette.eu).
 *
 * Usage (racine du hub) :
 *   node scripts/labo/meteo.mjs passage [--avis-lus N] [--corrections N] [--rejets N]
 *        → fin du passage des agents de 21 h 13 : date du passage + chiffres RÉELS du passage (absents = null)
 *   node scripts/labo/meteo.mjs sentinelle
 *        → recalcule seulement le bloc « sentinelle » depuis data/labo/incidents.json
 *
 * Le bloc « sentinelle » ne s'écrit jamais à la main : il vient des retours arrière réellement faits par
 * la Sentinelle (scripts/labo/sentinelle.mjs → incidents.json). scripts/build-static.mjs le recalcule
 * aussi à chaque publication, pour que le bandeau ne soit jamais en retard sur la Sentinelle.
 * Le nombre d'avis en file d'attente n'est pas ici : le navigateur le lit en direct (api/feedback.php).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const VIDE = {
  passage_quotidien: { heure: '21:13', fuseau: 'Europe/Paris' },
  dernier_passage: null,
  sentinelle: { retours_arriere_total: 0, interventions: [] },
};

/** Bloc « sentinelle » d'après la liste des incidents (10 dernières interventions, plus récente d'abord). */
export function etatSentinelle(incidents = []) {
  const liste = (Array.isArray(incidents) ? incidents : [])
    .filter((i) => i && i.date && !Number.isNaN(Date.parse(i.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return {
    retours_arriere_total: liste.filter((i) => i.retour_a).length,
    interventions: liste.slice(0, 10).map((i) => ({
      date: i.date,
      app_id: i.app_id ?? i.app ?? null,
      // retour_a null = la Sentinelle a alerté sans pouvoir revenir en arrière (pas de version précédente).
      retour_arriere: Boolean(i.retour_a),
    })),
  };
}

/** Fichier status-labo.json complet, avec le bloc sentinelle recalculé. */
export function avecSentinelle(statut, incidents) {
  return { _aide: statut?._aide, ...VIDE, ...(statut ?? {}), sentinelle: etatSentinelle(incidents) };
}

const lire = async (p, defaut) => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(defaut)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [commande, ...args] = process.argv.slice(2);
  if (!['passage', 'sentinelle'].includes(commande)) {
    console.error('Usage : node scripts/labo/meteo.mjs passage [--avis-lus N] [--corrections N] [--rejets N] | sentinelle');
    process.exit(1);
  }
  const nombre = (nom) => {
    const i = args.indexOf(`--${nom}`);
    if (i < 0) return null;
    const n = Number(args[i + 1]);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  const fichier = 'data/labo/status-labo.json';
  const statut = await lire(fichier, VIDE);
  const { incidents = [] } = await lire('data/labo/incidents.json', {});
  const sortie = avecSentinelle(statut, incidents);
  if (commande === 'passage') {
    sortie.dernier_passage = {
      date: new Date().toISOString(),
      avis_lus: nombre('avis-lus'),
      corrections: nombre('corrections'),
      rejets: nombre('rejets'),
    };
  }
  await writeFile(fichier, JSON.stringify(sortie, null, 2) + '\n');
  console.log(`status-labo.json à jour : ${sortie.sentinelle.retours_arriere_total} retour(s) arrière au total` +
    (commande === 'passage' ? `, passage du ${sortie.dernier_passage.date}` : ''));
}
