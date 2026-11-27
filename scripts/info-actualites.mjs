/**
 * info-actualites.mjs — vraies actualités pour ALPHABETTE INFO (alphabette.eu/info.html).
 *
 * Même mécanisme qu'Info Perso (« flux d'actualités figé à la publication ») :
 *  - à chaque publication du hub (push sur main et toutes les 3 h, deploy-ovh.yml), ce script lit
 *    côté serveur (GitHub Actions) les flux RSS publics de grands médias français ;
 *  - il nettoie, retire les doublons (même titre, ou même sujet couvert par plusieurs médias),
 *    varie les sources en tête de liste, et écrit eu/api/info/actualites.json ;
 *  - la page lit ce fichier sur le même site : le navigateur du visiteur n'appelle aucun site tiers.
 * On ne garde que le titre, le court résumé publié par le média dans son flux et le lien vers
 * l'article d'origine (aucune image, aucun texte complet).
 *
 * Si aucun flux ne répond (coupure réseau), on garde la dernière version publiée plutôt qu'une page vide.
 *
 * Usage : import { publierActualites } from './info-actualites.mjs' (appelé par build-static.mjs),
 *         ou `node scripts/info-actualites.mjs <fichier.json>` pour essayer à la main.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Flux lus à chaque publication : grands médias français, flux publics, sans abonnement. */
export const FLUX = [
  { source: 'franceinfo', categorie: 'Actualité', url: 'https://www.francetvinfo.fr/titres.rss' },
  { source: 'Le Monde', categorie: 'Actualité', url: 'https://www.lemonde.fr/rss/une.xml' },
  { source: 'Le Figaro', categorie: 'Actualité', url: 'https://www.lefigaro.fr/rss/figaro_flash-actu.xml' },
  { source: 'Le Parisien', categorie: 'Actualité', url: 'https://feeds.leparisien.fr/leparisien/rss' },
  { source: 'BFM TV', categorie: 'Actualité', url: 'https://www.bfmtv.com/rss/news-24-7/' },
  { source: 'France 24', categorie: 'International', url: 'https://www.france24.com/fr/rss' },
  { source: 'Le Monde', categorie: 'International', url: 'https://www.lemonde.fr/international/rss_full.xml' },
  { source: 'Les Échos', categorie: 'Économie', url: 'https://services.lesechos.fr/rss/les-echos-economie.xml' },
  { source: 'franceinfo', categorie: 'Économie', url: 'https://www.francetvinfo.fr/economie.rss' },
  { source: 'Futura', categorie: 'Science', url: 'https://www.futura-sciences.com/rss/actualites.xml' },
  { source: 'Le Monde', categorie: 'Science', url: 'https://www.lemonde.fr/sciences/rss_full.xml' },
  { source: 'Le Monde', categorie: 'Technologie', url: 'https://www.lemonde.fr/pixels/rss_full.xml' },
  { source: 'Numerama', categorie: 'Technologie', url: 'https://www.numerama.com/feed/' },
  { source: 'franceinfo', categorie: 'Culture', url: 'https://www.francetvinfo.fr/culture.rss' },
  { source: 'Le Monde', categorie: 'Culture', url: 'https://www.lemonde.fr/culture/rss_full.xml' },
  { source: 'franceinfo', categorie: 'Sport', url: 'https://www.francetvinfo.fr/sports.rss' },
];

const PAR_FLUX = 15; // articles gardés au plus par flux
const MAX_ARTICLES = 120;
const AGE_MAX = 3 * 24 * 3600 * 1000; // plus vieux que 3 jours : ce n'est plus de l'actualité
const RESUME_MAX = 320;
const PUBLIEE = 'https://alphabette.eu/api/info/actualites.json';

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', ecirc: 'ê',
  agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï', euml: 'ë',
  Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç', oelig: 'œ', OElig: 'Œ', euro: '€', deg: '°' };

// Un code de caractère impossible (&#99999999;) est laissé tel quel au lieu de faire perdre tout le flux.
const caractere = (code, brut) => (Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : brut);

export function decoder(texte = '') {
  return texte
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => caractere(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d) => caractere(parseInt(d, 10), m))
    .replace(/&([a-z]+);/gi, (m, nom) => ENTITES[nom] ?? m);
}

/** Texte brut : entités décodées (deux fois : certains flux encodent le HTML), balises retirées. */
export function texteBrut(brut = '') {
  return decoder(decoder(brut)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function balise(bloc, noms) {
  for (const nom of noms) {
    const m = bloc.match(new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${nom}>`, 'i'));
    if (m && m[1].trim()) return m[1];
  }
  return '';
}

function lienDe(bloc) {
  const rss = balise(bloc, ['link']);
  if (rss && !/^\s*$/.test(rss)) return texteBrut(rss);
  const atom = bloc.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || bloc.match(/<link[^>]*href=["']([^"']+)["']/i);
  return atom ? decoder(atom[1]).trim() : '';
}

function couper(texte, max) {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  return coupe.slice(0, Math.max(coupe.lastIndexOf(' '), max - 40)).replace(/[\s,;:.–-]+$/, '') + '…';
}

/** Identifiant stable (le même article garde le même id d'une publication à l'autre : favoris). */
export function identifiant(texte) {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return 'une_' + (h >>> 0).toString(36);
}

/** Lit un flux RSS 2.0 ou Atom (sans dépendance). */
export function lireFlux(xml, flux, maintenant = Date.now()) {
  const blocs = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi), ...xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
  const articles = [];
  for (const bloc of blocs) {
    if (articles.length >= PAR_FLUX) break;
    const titre = texteBrut(balise(bloc, ['title']));
    const lien = lienDe(bloc);
    if (titre.length < 6 || !/^https:\/\//i.test(lien)) continue;
    const resume = couper(texteBrut(balise(bloc, ['description', 'summary', 'content:encoded', 'content'])), RESUME_MAX);
    const brute = texteBrut(balise(bloc, ['pubDate', 'published', 'updated', 'dc:date']));
    let t = brute ? new Date(brute).getTime() : NaN;
    if (!Number.isFinite(t)) continue; // sans date fiable, on ne fait pas passer un article pour récent
    if (t > maintenant + 5 * 60000) t = maintenant;
    if (maintenant - t > AGE_MAX) continue;
    articles.push({
      id: identifiant(lien),
      titre,
      resume: resume && resume.toLowerCase() !== titre.toLowerCase() ? resume : '',
      source: flux.source,
      categorie: flux.categorie,
      date: new Date(t).toISOString(),
      lien,
    });
  }
  return articles;
}

const MOTS_VIDES = new Set(['dans', 'avec', 'pour', 'cette', 'apres', 'avoir', 'faire', 'plus', 'sont', 'leur', 'leurs',
  'nous', 'vous', 'tout', 'tous', 'toute', 'toutes', 'bien', 'aussi', 'entre', 'sans', 'comme', 'mais', 'vers', 'chez',
  'sous', 'france', 'paris', 'selon', 'fait', 'deux', 'trois', 'quatre', 'direct', 'video', 'quoi', 'faut', 'savoir']);

const motsForts = (simple) => new Set(simple.split(' ').filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)));

/**
 * Retire les doublons : même lien, même début de titre, ou même sujet déjà couvert par un autre média
 * (au moins 3 mots forts en commun, et au moins 60 % des mots forts du titre le plus court). On garde le plus récent.
 */
export function dedoublonner(articles) {
  const liens = new Set();
  const titres = new Set();
  const sujets = [];
  const garde = [];
  for (const a of [...articles].sort((x, y) => y.date.localeCompare(x.date))) {
    const simple = a.titre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    if (liens.has(a.lien) || titres.has(simple.slice(0, 45))) continue;
    const mots = motsForts(simple);
    const memeSujet = mots.size >= 3 && sujets.some((autres) => {
      let communs = 0;
      for (const m of mots) if (autres.has(m)) communs += 1;
      return communs >= 3 && communs >= 0.6 * Math.min(mots.size, autres.size);
    });
    if (memeSujet) continue;
    liens.add(a.lien);
    titres.add(simple.slice(0, 45));
    sujets.push(mots);
    garde.push(a);
  }
  return garde;
}

/**
 * Ordre « À la une » : le plus récent d'abord, en variant les médias : à chaque place, l'article le plus récent
 * d'un média qui n'a pas encore 2 articles dans les 10 premiers (3 dans les 20) ; sinon le plus récent tout court.
 */
export function classer(articles) {
  const reste = [...articles];
  const ordre = [];
  const parSource = new Map();
  while (reste.length && ordre.length < MAX_ARTICLES) {
    const plafond = ordre.length < 10 ? 2 : ordre.length < 20 ? 3 : Infinity;
    let i = reste.findIndex((a) => (parSource.get(a.source) || 0) < plafond);
    if (i === -1) i = 0;
    const [a] = reste.splice(i, 1);
    ordre.push(a);
    parSource.set(a.source, (parSource.get(a.source) || 0) + 1);
  }
  return ordre;
}

async function telecharger(url, delai = 10000) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlphabetteInfo/1.0; +https://alphabette.eu/info.html)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(delai),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/** Lit tous les flux et renvoie le contenu du fichier publié. */
export async function construireActualites({ flux = FLUX, lire = telecharger, maintenant = Date.now() } = {}) {
  const resultats = await Promise.all(flux.map(async (f) => {
    try { const a = lireFlux(await lire(f.url), f, maintenant); return { f, a, ok: a.length > 0 }; }
    catch (e) { return { f, a: [], ok: false, erreur: String(e.message || e).slice(0, 80) }; }
  }));
  const articles = classer(dedoublonner(resultats.flatMap((r) => r.a)));
  return {
    genere_le: new Date(maintenant).toISOString(),
    sources: resultats.map((r) => ({ nom: r.f.source, categorie: r.f.categorie, articles: r.a.length, ok: r.ok, ...(r.erreur ? { erreur: r.erreur } : {}) })),
    articles,
  };
}

/** Écrit <dossier>/api/info/actualites.json (dossier = eu/ du site statique). */
export async function publierActualites(dossier, options = {}) {
  let donnees = await construireActualites(options);
  if (!donnees.articles.length) {
    // Aucun flux lisible (coupure passagère) : on republie la dernière version plutôt qu'une page vide.
    try {
      const ancienne = JSON.parse(await telecharger(PUBLIEE));
      if (Array.isArray(ancienne.articles) && ancienne.articles.length) donnees = { ...ancienne, reprise: true };
    } catch { /* rien de publié encore */ }
  }
  const cible = path.join(dossier, 'api', 'info', 'actualites.json');
  await mkdir(path.dirname(cible), { recursive: true });
  await writeFile(cible, JSON.stringify(donnees) + '\n');
  const lus = donnees.sources.filter((s) => s.ok).length;
  console.log(`ALPHABETTE INFO : ${donnees.articles.length} actualités, ${lus}/${donnees.sources.length} flux lus${donnees.reprise ? ' (aucun flux lisible : version précédente reprise)' : ''}`);
  for (const s of donnees.sources.filter((x) => !x.ok)) console.log(`  ! flux illisible : ${s.nom} (${s.categorie})${s.erreur ? ' — ' + s.erreur : ''}`);
  return donnees;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sortie = process.argv[2] || 'actualites.json';
  const donnees = await construireActualites();
  await writeFile(sortie, JSON.stringify(donnees, null, 2) + '\n');
  console.log(`${donnees.articles.length} actualités → ${sortie}`);
  for (const s of donnees.sources) console.log(`  ${s.ok ? '✓' : '!'} ${s.nom} (${s.categorie}) : ${s.articles}${s.erreur ? ' — ' + s.erreur : ''}`);
}
