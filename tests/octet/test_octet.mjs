// Tests d'Octet (messages, composant, aide, intégration Laboratoire). Lancé avec bun (importe du TSX).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OctetMessage } from '../../src/octet/OctetMessage.tsx';
import { OctetHelp } from '../../src/octet/OctetHelp.tsx';
import { MESSAGES, AIDE_LABORATOIRE, LIBELLE_AIDE } from '../../src/octet/messages.ts';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lire = (f) => readFileSync(path.join(racine, f), 'utf8');
let ok = 0;
const test = (nom, fn) => { try { fn(); ok += 1; console.log(`  ✓ ${nom}`); } catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; } };
const h = React.createElement;

test('illustration authentique : poses du dépôt, image fixe, ratio conservé, alt vide (décorative)', () => {
  for (const pose of ['arrosoir', 'loupe', 'sablier', 'fiole', 'cle']) assert.ok(existsSync(path.join(racine, `public/assets/octet/octet-${pose}.webp`)), pose);
  const html = renderToStaticMarkup(h(OctetMessage, { message: MESSAGES.accueil }));
  assert.match(html, /src="\/assets\/octet\/octet-arrosoir\.webp"/);
  assert.match(html, /alt=""/);
  assert.match(html, /width="88" height="88"/);
  const css = lire('src/index.css');
  assert.match(css, /\.octet-msg__img \{[^}]*height: auto/);
  assert.doesNotMatch(css, /\.octet-msg__img \{[^}]*(object-fit: *cover|transform)/);
});

test('toutes les variantes s’affichent, avec ou sans illustration, et le texte reste du vrai texte', () => {
  for (const v of ['welcome', 'tip', 'empty', 'success', 'help']) {
    const avec = renderToStaticMarkup(h(OctetMessage, { variante: v, texte: 'Bonjour', pose: 'loupe' }));
    const sans = renderToStaticMarkup(h(OctetMessage, { variante: v, texte: 'Bonjour', pose: null }));
    assert.match(avec, new RegExp(`octet-msg--${v}`));
    assert.match(avec, /<img/); assert.doesNotMatch(sans, /<img/);
    assert.match(sans, />Bonjour</);
  }
});

test('le contenu est échappé : aucun HTML ni script injecté dans une bulle', () => {
  const html = renderToStaticMarkup(h(OctetMessage, { texte: '<img src=x onerror=alert(1)><script>x</script>', pose: null }));
  assert.doesNotMatch(html, /<script>/); assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});

test('aucun message n’est annoncé ni bloquant par défaut ; fermeture seulement si demandée', () => {
  const h1 = renderToStaticMarkup(h(OctetMessage, { message: MESSAGES.conseilIdee }));
  assert.doesNotMatch(h1, /role="status"|autofocus|aria-live/i);
  assert.doesNotMatch(h1, /Masquer ce message/);
  assert.match(renderToStaticMarkup(h(OctetMessage, { message: MESSAGES.conseilIdee, onFermer: () => {} })), /Masquer ce message/);
  assert.match(renderToStaticMarkup(h(OctetMessage, { message: MESSAGES.succesPublie, live: true })), /role="status"/);
});

test('aide : bouton nommé, fermé au départ, avec les six questions demandées + contact réel', () => {
  const html = renderToStaticMarkup(h(OctetHelp));
  assert.match(html, new RegExp(LIBELLE_AIDE.replace('?', '\\?')));
  assert.match(html, /aria-haspopup="dialog"/); assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /role="dialog"/);
  const q = AIDE_LABORATOIRE.map((e) => e.question).join('|');
  for (const m of ['Comment proposer une idée', 'Comment voter', 'différence entre un vote et une note', 'statut d’un prototype', 'très votée', 'rejoindre alphabette.fr']) assert.match(q, new RegExp(m));
  assert.match(AIDE_LABORATOIRE.at(-1).reponse, /contact@alphabette\.fr/);
  const src = lire('src/octet/OctetHelp.tsx');
  for (const k of ['role="dialog"', 'aria-modal="true"', "'Escape'", 'bouton.current?.focus()', 'aria-labelledby']) assert.ok(src.includes(k), k);
});

test('textes honnêtes : un vote ne garantit rien, publication sur .fr = examen + accord explicite', () => {
  const tout = JSON.stringify([MESSAGES, AIDE_LABORATOIRE]);
  assert.match(AIDE_LABORATOIRE.find((e) => e.cle === 'developpee').reponse, /^Non\./);
  assert.match(AIDE_LABORATOIRE.find((e) => e.cle === 'fr').reponse, /accord explicite/);
  assert.match(MESSAGES.progression.texte, /ne garantissent pas/);
  assert.doesNotMatch(tout, /sera (bientôt )?développée|parfaitement sécuris|vous surveille|se souvient de vous|génie|Bravo/i);
});

test('confirmation seulement si le serveur confirme ; attente de validation formulée explicitement', () => {
  const src = lire('src/labo/BoiteIdees.tsx');
  assert.match(src, /r\.ok && r\.idee \? MESSAGES\.succesPublie\.texte : r\.message/);
  assert.match(MESSAGES.succesEnAttente.texte, /sera visible après la vérification/);
});

test('« À découvrir » : seulement un vrai prototype testable, masquable, sans stockage', () => {
  const src = lire('src/labo/BoiteIdees.tsx');
  assert.match(src, /idees\.find\(\(i\) => i\.prototype\?\.testable\)/);
  assert.match(src, /setDecouverteMasquee\(true\)/);
  assert.doesNotMatch(lire('src/octet/OctetMessage.tsx') + lire('src/octet/OctetHelp.tsx') + lire('src/octet/messages.ts'), /localStorage|sessionStorage|document\.cookie|fetch\(|XMLHttpRequest/);
});

test('aucun appel tiers ni émoji souris pour Octet ; image absente = libellé conservé dans la barre', () => {
  const tout = lire('src/octet/OctetMessage.tsx') + lire('src/octet/OctetHelp.tsx') + lire('src/octet/messages.ts');
  assert.doesNotMatch(tout, /https?:\/\/(?!alphabette)/);
  for (const f of ['public/assets/alphabette-barre.js', 'packages/shell/src/EcosystemBar.tsx', 'src/labo/BoiteIdees.tsx', 'src/octet/messages.ts']) assert.doesNotMatch(lire(f), /🐭|🐁/, f);
  assert.match(lire('public/assets/alphabette-barre.js'), /ab-eco__labo--txt/);
});

test('mode calme, mouvement réduit, BIG (rem, pas de hauteur fixe), thème et clavier', () => {
  const css = lire('src/index.css');
  const bloc = css.slice(css.indexOf('Octet : message contextuel'));
  assert.match(bloc, /animation: none !important; transition: none !important/);
  assert.equal((bloc.replace(/(max|min)-height[^;]*;/g, '').match(/(^|[\s{;])height: *\d+(px|rem)/g) || []).length, 0, 'hauteur fixe');
  assert.match(bloc, /var\(--acc-carte/); assert.match(bloc, /focus-visible/);
  assert.match(bloc, /min-height: 44px/);
});

test('documentation de voix présente et liée au composant', () => {
  const d = lire('docs/octet-voice.md');
  assert.match(d, /OctetMessage/); assert.match(d, /OctetHelp/); assert.match(d, /Aucun stockage/);
});

test('Octet v3 : une balise sur le hub, poses transparentes + manifeste, aucune fausse confirmation, voix unique, Mode Calme', () => {
  assert.match(lire('index.html'), /<script src="\/shared\/octet-widget\.js" data-app="alphabette" data-site="auto" data-assets="\/assets\/octet\/dist" defer><\/script>/);
  const manifeste = JSON.parse(lire('public/assets/octet/dist/manifest.json'));
  for (const m of ['boussole', 'cle', 'fiole', 'carnet', 'sablier', 'loupe', 'arrosoir']) {
    assert.ok(manifeste.poses.includes(`octet-${m}`), m);
    assert.ok(existsSync(path.join(racine, `public/assets/octet/dist/octet-${m}.webp`)), m);
  }
  for (const g of ['course', 'grand-saut', 'escalade', 'chute', 'glissade', 'sieste', 'saut-joie', 'port-engrenage', 'lecture-carte', 'cadenas', 'bouclier', 'dossiers', 'balance']) assert.ok(manifeste.poses.includes(`octet-${g}`), `geste ${g}`);
  for (const g of ['bonjour', 'etourdi', 'surprise', 'pouce', 'parapluie', 'pissenlit', 'meditation', 'cadeau', 'clochette']) assert.ok(manifeste.poses.includes(`octet-${g}`), `réaction ${g}`);
  for (const p of manifeste.poses) assert.ok(existsSync(path.join(racine, `public/assets/octet/dist/${p}.webp`)), `manifeste : ${p}`);
  const js = lire('public/shared/octet-widget.js');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /speechSynthesis/, 'voix unique : alphabetteAudio');
  assert.match(code, /alphabetteAudio/);
  assert.doesNotMatch(js, /Bien noté dans mon carnet|onIdeaSubmit/);
  assert.match(js, /if \(!rep\.ok\) throw/, 'merci affiché seulement si le serveur répond OK');
  assert.match(js, /Rien n'a encore été envoyé/);
  assert.match(js, /dataset\.calme === "oui"/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(js, /sound: false/, 'sons coupés par défaut');
  for (const m of [1, 2, 3]) assert.match(js, new RegExp(`id: "secret-${m}-mois", mois: ${m}`), `combinaison ${m} mois`);
  assert.match(js, /a déjà servi sur cet appareil/, 'une combinaison ne sert qu\'une fois par appareil');
  assert.match(js, /derniereReplique < 20000/, 'une réplique spontanée au plus toutes les 20 s');
  assert.match(js, /_peutReagir\(\) \{[\s\S]{0,200}this\._calme\(\)/, 'aucune réaction en Mode Calme');
  assert.doesNotMatch(code, /navigator\.sendBeacon/);
  // seul cookie autorisé : l'inscription Alphabette (ab_membre), écrite par les combinaisons secrètes ; aucun traceur
  const cookies = code.split('\n').filter((l) => /document\.cookie/.test(l));
  for (const l of cookies) assert.match(l, /ab_membre/, `cookie inattendu : ${l.trim()}`);
  assert.match(lire('src/components/Accueil.tsx'), /data-octet-card=""/);
});

test('pipeline des poses : script Python présent et images sources rangées', () => {
  assert.ok(existsSync(path.join(racine, 'scripts/process_octet_assets.py')));
  assert.ok(existsSync(path.join(racine, 'assets/octet/raw/octet-fiole.png')));
  assert.ok(existsSync(path.join(racine, 'public/shared/octet-demo.html')));
});

console.log(`\n${ok} tests Octet réussis`);
