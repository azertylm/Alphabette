#!/usr/bin/env node
/**
 * scripts/labo/fusion-auto.mjs — une Pull Request peut-elle être fusionnée sans Valentin ?
 * Décision de Valentin (20/11/2026) : tout ce qui ne change qu'alphabette.eu se publie tout seul ; ce qui peut
 * changer alphabette.fr (ou les robots eux-mêmes) attend toujours son « fusionne » ou son clic,
 * Décision de Valentin (26/11/2026) : tout se fusionne tout seul SAUF la liste fermée INTERDITS ci-dessous
 * (l'automatisation elle-même, la vitrine figée, l'argent et les règles de base de données). Le site doit
 * toujours se construire (types + build) avant la fusion.
 *
 *   node scripts/labo/fusion-auto.mjs <fichiers.txt> <dossier-base> <dossier-tete>
 *     fichiers.txt : un chemin modifié par ligne ; dossiers : copies du dépôt avant / après (pour les JSON du registre).
 *   Code 0 = fusion automatique permise ; code 1 = il faut Valentin (raisons affichées).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Chemins qui attendent TOUJOURS Valentin (seule liste fermée) :
 *  - l'automatisation elle-même : une PR ne doit jamais pouvoir assouplir ses propres garde-fous ;
 *  - la vitrine alphabette.fr figée (CLAUDE.md : « ne jamais modifier sans ordre explicite de Valentin ») ;
 *  - l'argent (paiements, virements, facturation, webhooks) et les règles de base de données ;
 *  - les secrets et données privées.
 */
const INTERDITS = [
  /^\.github\//, /^scripts\/labo\/fusion-auto\.mjs$/,
  /^vitrine\//,
  /^serveur\/php\/(billing|paiement|payouts|webhooks|finance-commun|carte|boutique|affiliation)\.php$/,
  /^firebase\//, /(^|\/)firestore\.rules$/, /^data\/private\//, /(^|\/)\.env/,
];
/** Garde-fou de volume : une PR énorme est relue par un humain. */
const MAX_FICHIERS = 80;

/** Registres partagés par les deux sites : permis seulement si aucune fiche « vitrine » ne change. */
const REGISTRES = { 'data/apps-registry.json': (d) => d.apps ?? [], 'data/apps-sources.json': (d) => Object.entries(d.apps ?? {}).map(([cle, s]) => ({ id: cle, ...s })) };

const [liste, base, tete] = process.argv.slice(2);
const fichiers = readFileSync(liste, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const lire = (dossier, f) => { try { return JSON.parse(readFileSync(path.join(dossier, f), 'utf8')); } catch { return {}; } };
const raisons = [];

if (fichiers.length > MAX_FICHIERS) raisons.push(`${fichiers.length} fichiers modifiés (plus de ${MAX_FICHIERS})`);
for (const f of fichiers) {
  if (INTERDITS.some((re) => re.test(f))) { raisons.push(`${f} : réservé à Valentin (automatisation, vitrine figée, argent ou secrets)`); continue; }
  if (REGISTRES[f]) {
    const avant = new Map(REGISTRES[f](lire(base, f)).map((a) => [a.id, JSON.stringify(a)]));
    const apres = new Map(REGISTRES[f](lire(tete, f)).map((a) => [a.id, JSON.stringify(a)]));
    const vitrine = (m, id) => { const a = m.get(id); return a ? Boolean(JSON.parse(a).vitrine) : false; };
    const touchees = [...new Set([...avant.keys(), ...apres.keys()])].filter((id) => avant.get(id) !== apres.get(id) && (vitrine(avant, id) || vitrine(apres, id)));
    if (touchees.length) raisons.push(`${f} : fiche(s) de la vitrine modifiée(s) (${touchees.join(', ')})`);
    continue;
  }
}

if (raisons.length) {
  console.log(`Fusion automatique refusée — il faut l'accord de Valentin :\n- ${raisons.join('\n- ')}`);
  process.exit(1);
}
console.log(`Fusion automatique permise : ${fichiers.length} fichier(s), aucun ne touche la liste réservée.`);
