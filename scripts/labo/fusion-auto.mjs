#!/usr/bin/env node
/**
 * scripts/labo/fusion-auto.mjs — une Pull Request peut-elle être fusionnée sans Valentin ?
 * Décision de Valentin (20/11/2026) : tout ce qui ne change qu'alphabette.eu se publie tout seul ; ce qui peut
 * changer alphabette.fr (ou les robots eux-mêmes) attend toujours son « fusionne » ou son clic.
 *
 *   node scripts/labo/fusion-auto.mjs <fichiers.txt> <dossier-base> <dossier-tete>
 *     fichiers.txt : un chemin modifié par ligne ; dossiers : copies du dépôt avant / après (pour les JSON du registre).
 *   Code 0 = fusion automatique permise ; code 1 = il faut Valentin (raisons affichées).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Chemins qui ne servent qu'au Laboratoire, aux agents ou à la documentation. */
// data/labo/ sauf ce qu'alphabette.fr lit aussi : notes de version citoyennes, tutos et éco-scores « vitrine »,
// versions N-1 de la Sentinelle (retour arrière de .fr), autorisations de Valentin.
const PERMIS = [
  /^data\/labo\/(?!(notes_version|releases|tutos|eco_scores|autorisations)\.json$)/, /^data\/apps-communaute\.json$/, /^docs\//, /^RULES_AND_MEMORY\.md$/, /^\.claude\/(agents|commands)\//,
  /^tests\//, /^labo\/(collectif|crash-testeur|createurs)\//, /^labo\/serveur\/(feedback|collectif|capteur)\.(php|js)$/,
];
/** Registres partagés par les deux sites : permis seulement si aucune fiche « vitrine » ne change. */
const REGISTRES = { 'data/apps-registry.json': (d) => d.apps ?? [], 'data/apps-sources.json': (d) => Object.entries(d.apps ?? {}).map(([cle, s]) => ({ id: cle, ...s })) };

const [liste, base, tete] = process.argv.slice(2);
const fichiers = readFileSync(liste, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const lire = (dossier, f) => { try { return JSON.parse(readFileSync(path.join(dossier, f), 'utf8')); } catch { return {}; } };
const raisons = [];

for (const f of fichiers) {
  if (PERMIS.some((re) => re.test(f))) continue;
  if (REGISTRES[f]) {
    const avant = new Map(REGISTRES[f](lire(base, f)).map((a) => [a.id, JSON.stringify(a)]));
    const apres = new Map(REGISTRES[f](lire(tete, f)).map((a) => [a.id, JSON.stringify(a)]));
    const vitrine = (m, id) => { const a = m.get(id); return a ? Boolean(JSON.parse(a).vitrine) : false; };
    const touchees = [...new Set([...avant.keys(), ...apres.keys()])].filter((id) => avant.get(id) !== apres.get(id) && (vitrine(avant, id) || vitrine(apres, id)));
    if (touchees.length) raisons.push(`${f} : fiche(s) de la vitrine modifiée(s) (${touchees.join(', ')})`);
    continue;
  }
  raisons.push(`${f} : peut changer alphabette.fr ou les robots`);
}

if (raisons.length) {
  console.log(`Fusion automatique refusée — il faut l'accord de Valentin :\n- ${raisons.join('\n- ')}`);
  process.exit(1);
}
console.log(`Fusion automatique permise : ${fichiers.length} fichier(s), tous propres à alphabette.eu.`);
