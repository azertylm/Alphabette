#!/usr/bin/env node
/**
 * scripts/labo/veilleur.mjs — Le Veilleur : toutes les heures, chaque adresse d'Alphabette répond-elle ?
 *
 *   node scripts/labo/veilleur.mjs [--etat veilleur/etat.json] [--sortie veilleur]
 *
 * Vérifie : les deux accueils, le service des avis, chaque application de alphabette.eu et de alphabette.fr
 * (réponse < 400, page HTML non vide), et pour chaque appli hébergée du collectif la présence de l'en-tête
 * d'isolement « Content-Security-Policy: sandbox » (si OVH l'ignorait, le coffre renvoie vers le cadre, mais
 * on veut le savoir tout de suite). Une adresse n'est déclarée en panne qu'après 2 échecs de suite (2 heures),
 * pour ne pas réveiller Valentin pour une seconde de coupure. Aucune dépendance, aucun navigateur.
 *
 * Sorties : <etat> (compteurs d'échecs), <sortie>/evenements.json { pannes, retablies }, <sortie>/rapport.md.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ETAT = opt('etat', 'veilleur/etat.json');
const SORTIE = opt('sortie', 'veilleur');
const SEUIL = 2;
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };

async function obtenir(url, { methode = 'GET', delai = 20000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), delai);
  try {
    const r = await fetch(url, { method: methode, redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Veilleur Alphabette)', 'Cache-Control': 'no-cache' } });
    const corps = methode === 'HEAD' ? '' : await r.text();
    return { statut: r.status, entetes: r.headers, corps };
  } catch (e) {
    return { statut: 0, erreur: e.name === 'AbortError' ? 'pas de réponse en 20 s' : e.message };
  } finally {
    clearTimeout(t);
  }
}

const cibles = [
  { cle: 'accueil-fr', nom: 'Accueil alphabette.fr', url: 'https://alphabette.fr/', type: 'page' },
  { cle: 'accueil-eu', nom: 'Accueil alphabette.eu', url: 'https://alphabette.eu/', type: 'page' },
  { cle: 'avis-eu', nom: 'Service des avis (alphabette.eu)', url: 'https://alphabette.eu/api/feedback.php?etat=1', type: 'json-ok' },
];
for (const [site, base] of [['eu', 'https://alphabette.eu'], ['fr', 'https://alphabette.fr']]) {
  const r = await obtenir(`${base}/api/apps.json?t=${Date.now()}`);
  let apps = [];
  try { apps = JSON.parse(r.corps).apps ?? []; } catch { cibles.push({ cle: `registre-${site}`, nom: `Liste des applis (${base})`, url: `${base}/api/apps.json`, type: 'json' }); }
  for (const a of apps.filter((x) => x.status === 'actif' && x.url && x.url !== '#')) {
    let url;
    try { url = new URL(a.url, base).href; } catch { continue; }
    if (cibles.some((c) => c.url === url)) continue;
    cibles.push({ cle: `${site}:${a.id}`, nom: `${a.name} (${site === 'eu' ? 'Laboratoire' : 'Vitrine'})`, url, type: 'page' });
    if (a.heberge && a.url_app) cibles.push({ cle: `${site}:${a.id}:isolement`, nom: `Isolement de ${a.name}`, url: new URL(a.url_app, base).href, type: 'isolement' });
  }
}

async function controler(c) {
  const r = await obtenir(c.url);
  if (!r.statut) return r.erreur || 'injoignable';
  if (r.statut >= 400) return `réponse HTTP ${r.statut}`;
  if (c.type === 'page' && (!/<html|<!doctype/i.test(r.corps) || r.corps.length < 200)) return 'page vide ou inattendue';
  if (c.type === 'json' || c.type === 'json-ok') {
    let d;
    try { d = JSON.parse(r.corps); } catch { return 'réponse illisible'; }
    if (c.type === 'json-ok' && d.ok !== true) return 'le service répond « pas prêt »';
  }
  if (c.type === 'isolement' && !/sandbox/i.test(r.entetes.get('content-security-policy') ?? '')) return "en-tête d'isolement absent (Content-Security-Policy: sandbox)";
  return null;
}

const etat = lire(ETAT, { echecs: {} });
const pannes = [], retablies = [], lignes = [];
for (let i = 0; i < cibles.length; i += 8) {
  const lot = cibles.slice(i, i + 8);
  const resultats = await Promise.all(lot.map(controler));
  lot.forEach((c, j) => {
    const pb = resultats[j];
    const avant = etat.echecs[c.cle]?.n ?? 0;
    if (pb) {
      etat.echecs[c.cle] = { n: avant + 1, depuis: etat.echecs[c.cle]?.depuis ?? new Date().toISOString(), probleme: pb, nom: c.nom, url: c.url };
      if (avant + 1 === SEUIL) pannes.push({ cle: c.cle, nom: c.nom, url: c.url, probleme: pb, grave: c.type === 'isolement' || c.cle.startsWith('accueil') });
      lignes.push(`- ${avant + 1 >= SEUIL ? '🔴' : '🟠'} ${c.nom} — ${pb} (${c.url})`);
    } else {
      if (avant >= SEUIL) retablies.push({ cle: c.cle, nom: c.nom, url: c.url, depuis: etat.echecs[c.cle].depuis });
      delete etat.echecs[c.cle];
    }
  });
}
etat.date = new Date().toISOString();
etat.controlees = cibles.length;
mkdirSync(path.dirname(ETAT), { recursive: true });
mkdirSync(SORTIE, { recursive: true });
writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n');
writeFileSync(path.join(SORTIE, 'evenements.json'), JSON.stringify({ date: etat.date, pannes, retablies }, null, 2) + '\n');
writeFileSync(path.join(SORTIE, 'rapport.md'), `## Le Veilleur — ${cibles.length} adresses contrôlées\n\n${lignes.length ? lignes.join('\n') : '✅ Tout répond.'}\n${retablies.length ? `\nRétablies : ${retablies.map((r) => r.nom).join(', ')}\n` : ''}`);
console.log(JSON.stringify({ controlees: cibles.length, en_echec: lignes.length, pannes: pannes.length, retablies: retablies.length }));
