// Tests d'ALPHABETTE INFO : lecture des flux RSS / Atom, doublons, ordre « À la une », reprise en cas de panne.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lireFlux, dedoublonner, classer, construireActualites, publierActualites, texteBrut } from '../../scripts/info-actualites.mjs';

let ok = 0;
const test = async (nom, fn) => { try { await fn(); ok += 1; console.log(`  ✓ ${nom}`); } catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; } };

const MAINTENANT = Date.parse('2026-11-27T10:00:00Z');
const il = (h) => new Date(MAINTENANT - h * 3600000).toUTCString();
const item = (titre, lien, h, desc = 'Résumé de l&#039;article &amp; contexte.') =>
  `<item><title><![CDATA[${titre}]]></title><link>${lien}</link><description>${desc}</description><pubDate>${il(h)}</pubDate></item>`;
const rss = (...items) => `<?xml version="1.0"?><rss><channel><title>Flux</title>${items.join('')}</channel></rss>`;

await test('RSS : titre, résumé nettoyé, date ISO, lien https, rubrique et média du flux', () => {
  const [a] = lireFlux(rss(item('Le Parlement adopte le budget', 'https://exemple.fr/budget', 2, '&lt;p&gt;Le texte &lt;b&gt;final&lt;/b&gt; est voté.&lt;/p&gt;')), { source: 'franceinfo', categorie: 'Actualité' }, MAINTENANT);
  assert.equal(a.titre, 'Le Parlement adopte le budget');
  assert.equal(a.resume, 'Le texte final est voté.');
  assert.equal(a.date, new Date(MAINTENANT - 2 * 3600000).toISOString());
  assert.equal(a.lien, 'https://exemple.fr/budget');
  assert.equal(a.source, 'franceinfo');
  assert.equal(a.categorie, 'Actualité');
  assert.match(a.id, /^une_[0-9a-z]+$/);
});

await test('Atom : lien en attribut href, résumé « summary »', () => {
  const atom = `<feed><entry><title>Une découverte en astronomie</title><link rel="alternate" href="https://exemple.fr/astro"/><summary>Des chercheurs observent…</summary><updated>${new Date(MAINTENANT - 3600000).toISOString()}</updated></entry></feed>`;
  const [a] = lireFlux(atom, { source: 'Futura', categorie: 'Science' }, MAINTENANT);
  assert.equal(a.lien, 'https://exemple.fr/astro');
  assert.equal(a.resume, 'Des chercheurs observent…');
});

await test('on écarte : sans date, trop ancien (> 3 jours), lien non https, titre vide ; date future ramenée à maintenant', () => {
  const sansDate = '<item><title>Article sans date fiable</title><link>https://exemple.fr/x</link></item>';
  const liste = lireFlux(rss(sansDate, item('Vieille nouvelle de la semaine', 'https://exemple.fr/v', 80), item('Lien non sécurisé ici', 'http://exemple.fr/h', 1), item('', 'https://exemple.fr/vide', 1), item('Annonce datée du futur', 'https://exemple.fr/f', -5)), { source: 'S', categorie: 'Actualité' }, MAINTENANT);
  assert.deepEqual(liste.map((a) => a.titre), ['Annonce datée du futur']);
  assert.equal(liste[0].date, new Date(MAINTENANT).toISOString());
});

await test('entités et balises : texte lisible, résumé identique au titre retiré, résumé long coupé', () => {
  assert.equal(texteBrut('L&rsquo;&eacute;t&eacute; &laquo; chaud &raquo; &#8211; <i>bilan</i>'), 'L’été « chaud » – bilan');
  assert.equal(texteBrut('Code impossible &#99999999; &#x110000; gardé'), 'Code impossible &#99999999; &#x110000; gardé');
  const [a] = lireFlux(rss(item('Titre identique au résumé', 'https://exemple.fr/i', 1, 'Titre identique au résumé')), { source: 'S', categorie: 'Actualité' }, MAINTENANT);
  assert.equal(a.resume, '');
  const [b] = lireFlux(rss(item('Résumé très long à couper proprement', 'https://exemple.fr/l', 1, 'mot '.repeat(200))), { source: 'S', categorie: 'Actualité' }, MAINTENANT);
  assert.ok(b.resume.length <= 321 && b.resume.endsWith('…'));
});

await test('doublons : même lien, même titre, même sujet chez un autre média → un seul article (le plus récent)', () => {
  const f = (source) => ({ source, categorie: 'Actualité' });
  const liste = [
    ...lireFlux(rss(item('Tempête Ciaran : vigilance orange dans le Finistère', 'https://a.fr/1', 3)), f('Le Monde'), MAINTENANT),
    ...lireFlux(rss(item('Vigilance orange : la tempête Ciaran frappe le Finistère', 'https://b.fr/2', 1)), f('franceinfo'), MAINTENANT),
    ...lireFlux(rss(item('Tempête Ciaran : vigilance orange dans le Finistère', 'https://c.fr/3', 2)), f('Le Figaro'), MAINTENANT),
    ...lireFlux(rss(item('La Bourse de Paris termine en hausse', 'https://a.fr/1', 1)), f('Les Échos'), MAINTENANT),
    ...lireFlux(rss(item('Ligue des champions : victoire du PSG', 'https://d.fr/4', 4)), f('franceinfo'), MAINTENANT),
  ];
  const garde = dedoublonner(liste);
  assert.deepEqual(garde.map((a) => a.lien), ['https://b.fr/2', 'https://a.fr/1', 'https://d.fr/4']);
});

await test('ordre « À la une » : au plus 2 articles d\'un même média dans les 10 premiers', () => {
  const articles = [];
  for (let i = 0; i < 12; i++) articles.push({ titre: `A${i}`, source: 'Le Monde', date: new Date(MAINTENANT - i * 60000).toISOString(), lien: `https://m.fr/${i}` });
  const autres = ['franceinfo', 'Le Figaro', 'France 24', 'Les Échos', 'Futura'];
  for (let i = 0; i < 15; i++) articles.push({ titre: `B${i}`, source: autres[i % 5], date: new Date(MAINTENANT - (100 + i) * 60000).toISOString(), lien: `https://f.fr/${i}` });
  const ordre = classer(articles);
  const tete = ordre.slice(0, 10);
  const compte = (s) => tete.filter((a) => a.source === s).length;
  assert.equal(compte('Le Monde'), 2, `Le Monde : ${compte('Le Monde')}`);
  assert.equal(ordre[0].titre, 'A0'); // le plus récent reste en tête
  assert.equal(ordre.length, 27);
  assert.equal(new Set(ordre.map((a) => a.lien)).size, 27); // aucun article perdu ni répété
});

await test('construction : un flux en panne n\'empêche pas les autres, et il est signalé', async () => {
  const flux = [{ source: 'A', categorie: 'Actualité', url: 'https://a/rss' }, { source: 'B', categorie: 'Science', url: 'https://b/rss' }];
  const d = await construireActualites({ flux, maintenant: MAINTENANT, lire: async (url) => { if (url.includes('b')) throw new Error('HTTP 503'); return rss(item('Une vraie nouvelle du matin', 'https://a.fr/n', 1)); } });
  assert.equal(d.articles.length, 1);
  assert.deepEqual(d.sources.map((s) => [s.nom, s.ok]), [['A', true], ['B', false]]);
  assert.equal(d.genere_le, new Date(MAINTENANT).toISOString());
});

await test('publication : écrit api/info/actualites.json dans le dossier du Laboratoire', async () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'info-'));
  const flux = [{ source: 'A', categorie: 'Culture', url: 'https://a/rss' }];
  await publierActualites(dossier, { flux, maintenant: MAINTENANT, lire: async () => rss(item('Un festival de cinéma ouvre ses portes', 'https://a.fr/c', 2)) });
  const ecrit = JSON.parse(readFileSync(path.join(dossier, 'api', 'info', 'actualites.json'), 'utf8'));
  assert.equal(ecrit.articles[0].categorie, 'Culture');
  assert.equal(ecrit.articles[0].titre, 'Un festival de cinéma ouvre ses portes');
});

await test('page : plus aucun article inventé, lecture du fichier des actualités du jour', () => {
  const page = readFileSync(new URL('../../public/info.html', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /exemples inventés|Exemple inventé|const ARTICLES/);
  assert.match(page, /api\/info\/actualites\.json/);
  assert.doesNotMatch(page, /allorigins[^\n]*loadLive|loadLive[^\n]*allorigins/); // les actualités du jour ne passent par aucun service tiers
});

console.log(`\n${ok} tests ALPHABETTE INFO réussis`);
