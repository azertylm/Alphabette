/**
 * tests/labo/test_meteo_horloge.ts — compte à rebours de la Météo du Labo (21 h 13, heure de Paris, été / hiver)
 * et titres du Tableau d'Honneur. Usage (racine du hub) : bun tests/labo/test_meteo_horloge.ts
 */
import { moisParis, partiesParis, prochainPassage, titreHonneur } from '../../src/labo/labo';
import { etatSentinelle } from '../../scripts/labo/meteo.mjs';

let ko = 0;
const verifier = (nom: string, cond: boolean, info = '') => { if (!cond) { ko++; console.log('ÉCHEC', nom, info); } };
const cas: [string, string][] = [
  ['2026-11-20T09:53:00Z', '2026-11-20T20:13:00.000Z'], // hiver, avant le passage
  ['2026-11-20T20:13:01Z', '2026-11-21T20:13:00.000Z'], // juste après → lendemain
  ['2026-07-01T19:00:00Z', '2026-07-01T19:13:00.000Z'], // été (UTC+2)
  ['2026-03-29T00:30:00Z', '2026-03-29T19:13:00.000Z'], // jour du passage à l'heure d'été
  ['2026-10-25T00:30:00Z', '2026-10-25T20:13:00.000Z'], // jour du retour à l'heure d'hiver
  ['2026-12-31T22:30:00Z', '2027-01-01T20:13:00.000Z'], // changement d'année
];
for (const [maintenant, attendu] of cas) {
  const r = prochainPassage(new Date(maintenant)).toISOString();
  verifier(`prochain passage depuis ${maintenant}`, r === attendu, r);
  const p = partiesParis(new Date(r));
  verifier(`21 h 13 à Paris (${r})`, p.hour === 21 && p.minute === 13);
}
verifier('titre 1', titreHonneur(1).titre === 'Œil de lynx');
verifier('titre 2', titreHonneur(2).titre === 'Œil de lynx');
verifier('titre 3', titreHonneur(3).titre === 'Voix du labo');
verifier('titre 5', titreHonneur(5).titre === 'Dompteur de bugs');
verifier('titre 9', titreHonneur(9).titre === 'Dompteur de bugs');
verifier('mois de Paris', moisParis(new Date('2026-11-30T23:30:00Z')) === '2026-12');
const s = etatSentinelle([{ date: '2026-11-18T10:00:00Z', app_id: 'iadebat', retour_a: 'abc' }, { date: '2026-11-19T10:00:00Z', app_id: 'orbit', retour_a: null }]);
verifier('sentinelle total', s.retours_arriere_total === 1, JSON.stringify(s));
verifier('sentinelle ordre', s.interventions[0].app_id === 'orbit' && s.interventions[0].retour_arriere === false, JSON.stringify(s));
verifier('sentinelle vide', etatSentinelle([]).interventions.length === 0);
console.log(ko ? `${ko} échec(s)` : 'Tout est bon.');
process.exit(ko ? 1 : 0);
