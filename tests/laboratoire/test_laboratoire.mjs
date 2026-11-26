// Tests du Laboratoire d'Octet (backend labo/serveur/collectif.php) : idées, votes, discussion, notes, modération, garde-fous .fr.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let ok = 0;
const test = async (nom, fn) => { try { await fn(); ok += 1; console.log(`  ✓ ${nom}`); } catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; } };

const lire = (f) => readFileSync(path.join(racine, f), 'utf8');

// ---------- statique : barre commune, textes, ancre ----------
await test('barre commune : le lien du Laboratoire mène à alphabette.eu depuis .fr et reste local sur .eu', () => {
  const src = lire('public/assets/alphabette-barre.js');
  const m = src.match(/function lienLabo\(\) \{([^]*?)\}\s*\n/);
  assert.ok(m, 'fonction lienLabo absente');
  const evalPour = (hostname) => new Function('location', 'local', `return (function () {${m[1]}})()`)({ hostname }, false);
  assert.equal(evalPour('alphabette.fr'), 'https://alphabette.eu/#idees');
  assert.equal(evalPour('www.alphabette.fr'), 'https://alphabette.eu/#idees');
  assert.equal(evalPour('iadebat.alphabette.fr'), 'https://alphabette.eu/#idees');
  assert.equal(evalPour('alphabette.eu'), '/#idees');
  assert.match(src, /ab-eco__labo/); // lien visible aussi sur petit écran (icône), libellé complet ≥ 760 px
  assert.match(src, /aria-label|tip\(el\('a', \{ class: 'ab-eco__icone ab-eco__labo'/);
});
await test('barre React (@alphabette/shell) : même lien, mêmes domaines', () => {
  const src = lire('packages/shell/src/EcosystemBar.tsx');
  assert.match(src, /https:\/\/alphabette\.eu\/#idees/);
  assert.match(src, /ab-eco__labo/);
});
await test('Octet (icône) présent dans la barre HTML, la barre React et le cadre des applis de la communauté', () => {
  assert.match(lire('public/assets/alphabette-barre.js'), /octet\/octet-icone\.webp/);
  assert.match(lire('packages/shell/src/EcosystemBar.tsx'), /octet-icone\.webp/);
  assert.match(lire('labo/createurs/cadre.html'), /octet-icone\.webp/);
  assert.ok(readFileSync(path.join(racine, 'public/assets/octet/octet-icone.webp')).length > 500);
});
await test('la section d\'idées garde son ancre #idees et son service', () => {
  const src = lire('src/labo/BoiteIdees.tsx');
  assert.match(src, /id="idees"/);
  assert.match(lire('src/labo/collectif.ts'), /\/api\/collectif\.php/);
});
await test('les textes n\'affirment plus que tout transfert vers .fr est impossible, sans promettre une publication automatique', () => {
  for (const f of ['labo/pages/embarquement.html', 'src/legal/contenu.tsx', 'labo/serveur/collectif.php']) {
    const t = lire(f);
    assert.doesNotMatch(t, /jamais<\/strong> transférée sur alphabette\.fr|Elles ne sont jamais transférées sur alphabette\.fr|jamais alphabette\.fr —/, f);
  }
  assert.match(lire('labo/pages/embarquement.html'), /accord explicite/);
  assert.match(lire('src/labo/BoiteIdees.tsx'), /Ce n'est jamais automatique/);
});
await test('l\'état par défaut des conditions de location est « non validées »', () => {
  assert.equal(JSON.parse(lire('data/labo/conditions-location.json')).validees, false);
});
await test('l\'interface rend les contenus en texte (aucun HTML injecté)', () => {
  for (const f of ['src/labo/BoiteIdees.tsx']) assert.doesNotMatch(lire(f), /dangerouslySetInnerHTML|innerHTML/, f);
  assert.doesNotMatch(lire('labo/pages/admin-idees.html'), /\.innerHTML\s*=\s*[^'"\s]/);
});

if (spawnSync('php', ['-v']).status !== 0) { console.log('  (php absent : tests serveur ignorés)'); process.exit(process.exitCode ?? 0); }

const tmp = mkdtempSync(path.join(tmpdir(), 'labo-octet-'));
const api = path.join(tmp, 'a', 'b', 'api');
mkdirSync(path.join(api, 'labo'), { recursive: true });
cpSync(path.join(racine, 'labo/serveur/collectif.php'), path.join(api, 'collectif.php'));
writeFileSync(path.join(api, 'apps.json'), JSON.stringify({ apps: [{ id: 'quiz-musique' }] }));
writeFileSync(path.join(api, 'labo/idees-statuts.json'), JSON.stringify({ statuts: {} }));
const JETON_ADMIN = 'jeton-admin-de-test-0123456789abcd';
const port = 18700 + Math.floor(Math.random() * 500);
const srv = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', api], { env: { ...process.env, ALPHABETTE_LABO_ADMIN_TOKEN: JETON_ADMIN }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const base = `http://127.0.0.1:${port}/collectif.php`;
const post = async (corps, en = {}) => { const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', ...en }, body: JSON.stringify(corps) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const get = async (q) => { const r = await fetch(`${base}?${q}`); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const admin = (corps) => post(corps, { 'X-Labo-Admin': JETON_ADMIN });
const donnees = path.join(tmp, 'alphabette-labo-donnees', 'collectif');
const razLimites = () => { try { for (const f of readdirSync(donnees)) if (f.startsWith('limites-')) rmSync(path.join(donnees, f)); } catch { /* rien à effacer */ } };
const jeton = (n) => String(n).padStart(32, 'a');
const idee = (titre, plus = {}) => ({ action: 'idee', titre, probleme: 'Je perds du temps chaque semaine.', phrase: 'Une appli simple qui me rappelle quoi faire.', categorie: 'Quotidien', jeton: jeton(1), ...plus });

try {
  let id;
  await test('idée valide publiée tout de suite, sans compte, avec pseudonyme facultatif', async () => {
    const r = await post(idee('Rappel des poubelles', { pseudo: 'Camille' }));
    assert.equal(r.status, 201); id = r.idee.id;
    assert.equal(r.idee.etape, 'nouvelle'); assert.equal(r.idee.pseudo, 'Camille'); assert.equal(r.idee.votes, 1);
  });
  await test('la validation serveur rejette vide, trop long, lien, e-mail, téléphone, catégorie inconnue', async () => {
    assert.equal((await post(idee('Ab'))).status, 400);
    assert.equal((await post(idee('x'.repeat(81)))).status, 400);
    assert.equal((await post(idee('Idée avec lien', { phrase: 'Voir https://exemple.com pour le détail' }))).status, 400);
    assert.equal((await post(idee('Idée avec mail', { probleme: 'Écrivez à moi@exemple.fr pour discuter' }))).status, 400);
    assert.equal((await post(idee('Idée avec tel', { phrase: 'Appelez le 06 12 34 56 78 maintenant' }))).status, 400);
    assert.equal((await post(idee('Catégorie bizarre', { categorie: 'Zzz' }))).status, 400);
    assert.equal((await post(idee('Pseudo avec lien', { pseudo: 'www.spam.com' }))).status, 400);
  });
  await test('le piège à robots est ignoré sans publier', async () => {
    const r = await post({ ...idee('Idée de robot'), site_web: 'x' });
    assert.equal(r.id, 'ignore');
    assert.ok(!(await get('idees=1')).idees.some((i) => i.titre === 'Idée de robot'));
  });
  await test('ancien format (titre + phrase) toujours accepté', async () => {
    const r = await post({ action: 'idee', titre: 'Ancienne idée', phrase: 'Une phrase de dix caractères au moins.' });
    assert.equal(r.status, 201);
  });
  await test('contenus affichés tels quels (aucun HTML interprété par le serveur)', async () => {
    const r = await post(idee('Idée <b>grasse</b>', { phrase: 'Texte avec <script>alert(1)</script> dedans ok' }));
    assert.equal(r.status, 201);
    assert.ok(!r.idee.titre.includes('<') && !r.idee.phrase.includes('<'));
  });
  await test('l\'auteur ne peut pas soutenir sa propre idée une seconde fois (même appareil)', async () => {
    assert.equal((await post({ action: 'voter_idee', id, jeton: jeton(1) })).status, 409);
  });
  await test('un soutien compté une seule fois par appareil, retrait possible, total cohérent', async () => {
    const a = await post({ action: 'voter_idee', id, jeton: jeton(2) });
    assert.equal(a.status, 200); assert.equal(a.votes, 2);
    const b = await post({ action: 'voter_idee', id, jeton: jeton(2) });
    assert.equal(b.status, 409);
    assert.equal((await get('idees=1')).idees.find((i) => i.id === id).votes, 2);
    const c = await post({ action: 'retirer_vote_idee', id, jeton: jeton(2) });
    assert.equal(c.votes, 1);
    assert.equal((await post({ action: 'retirer_vote_idee', id, jeton: jeton(2) })).status, 404);
  });
  await test('le client ne peut changer ni statut, ni compteur, ni décision par une requête publique', async () => {
    assert.equal((await post({ action: 'admin_statut', id, etape: 'disponible_fr' })).status, 403);
    assert.equal((await post({ action: 'admin_statut', id, etape: 'disponible_fr' }, { 'X-Labo-Admin': 'faux' })).status, 403);
    assert.equal((await post({ action: 'idee', ...idee('Pirate'), votes: 999, etape: 'disponible_fr' })).idee?.votes ?? 1, 1);
  });
  await test('commentaire en texte brut, réponse sur un seul niveau, validations', async () => {
    const c1 = await post({ action: 'commenter', id, texte: 'Très utile pour ma famille', pseudo: 'Paul' });
    assert.equal(c1.status, 201);
    const c2 = await post({ action: 'commenter', id, texte: 'Je suis d\'accord', parent: c1.commentaire.id });
    assert.equal(c2.commentaire.parent, c1.commentaire.id);
    const c3 = await post({ action: 'commenter', id, texte: 'Réponse à la réponse', parent: c2.commentaire.id });
    assert.equal(c3.commentaire.parent, c1.commentaire.id);
    assert.equal((await post({ action: 'commenter', id, texte: 'ab' })).status, 400);
    assert.equal((await post({ action: 'commenter', id, texte: 'Voir www.spam.com maintenant' })).status, 400);
    assert.equal((await post({ action: 'commenter', id, texte: 'mot '.repeat(150) })).status, 201); // tronqué à 500
    const d = await get(`idee=${id}`);
    assert.ok(d.commentaires.length >= 3 && d.commentaires.every((c) => c.texte.length <= 500));
    assert.ok(d.idee.nb_commentaires >= 3);
  });
  await test('signalement d\'une idée et d\'un commentaire', async () => {
    assert.equal((await post({ action: 'signaler_contenu', type: 'idee', id, motif: 'spam' })).status, 200);
    assert.equal((await post({ action: 'signaler_contenu', type: 'idee', id, motif: 'inconnu' })).status, 400);
    const l = await admin({ action: 'admin_liste' });
    assert.ok(l.signalements.some((s) => s.cible === id));
  });
  await test('une idée sans prototype ne reçoit pas de note étoilée ; « 0/5 » jamais affiché', async () => {
    const r = await post({ action: 'noter_prototype', id, note: 5, essai: true, jeton: jeton(3) });
    assert.equal(r.status, 403);
    assert.equal((await get('idees=1')).idees.find((i) => i.id === id).prototype, null);
  });
  await test('prototype : association limitée au registre, note après essai réel, un avis par appareil', async () => {
    assert.equal((await admin({ action: 'admin_prototype', id, app_id: 'inconnue', testable: true })).status, 400);
    assert.equal((await admin({ action: 'admin_prototype', id, app_id: 'quiz-musique', testable: true })).status, 200);
    let p = (await get('idees=1')).idees.find((i) => i.id === id).prototype;
    assert.equal(p.nb_avis, 0); assert.equal(p.moyenne, null);
    assert.equal((await post({ action: 'noter_prototype', id, note: 4, jeton: jeton(3) })).status, 400); // sans « j'ai essayé »
    assert.equal((await post({ action: 'noter_prototype', id, note: 6, essai: true, jeton: jeton(3) })).status, 400);
    assert.equal((await post({ action: 'noter_prototype', id, note: 4, essai: true, jeton: jeton(3), commentaire: 'Simple à prendre en main' })).status, 201);
    assert.equal((await post({ action: 'noter_prototype', id, note: 5, essai: true, jeton: jeton(3) })).status, 200); // mise à jour, pas de doublon
    assert.equal((await post({ action: 'noter_prototype', id, note: 3, essai: true, jeton: jeton(4) })).status, 201);
    p = (await get('idees=1')).idees.find((i) => i.id === id).prototype;
    assert.equal(p.nb_avis, 2); assert.equal(p.moyenne, 4);
  });
  await test('un vote populaire ne publie rien : disponible_fr bloqué sans accord, revue et conditions', async () => {
    for (let k = 10; k < 30; k += 1) await post({ action: 'voter_idee', id, jeton: jeton(k) });
    const r = await admin({ action: 'admin_statut', id, etape: 'disponible_fr' });
    assert.equal(r.status, 409);
    assert.match(r.erreur, /accord explicite du créateur/); assert.match(r.erreur, /revue/); assert.match(r.erreur, /conditions de location/);
    assert.notEqual((await get('idees=1')).idees.find((i) => i.id === id).etape, 'disponible_fr');
  });
  await test('anti-spam : au plus 3 idées par jour et par visiteur', async () => {
    razLimites();
    for (let k = 0; k < 3; k += 1) assert.equal((await post(idee(`Idée de limite numéro ${k}`, { jeton: jeton(70 + k) }))).status, 201);
    assert.equal((await post(idee('Idée de limite numéro quatre', { jeton: jeton(79) }))).status, 429);
    razLimites();
  });
  await test('candidate_fr exige un prototype ; avec accord + revue mais conditions non validées, .fr reste bloqué', async () => {
    const autre = (await post(idee('Autre idée sans prototype', { jeton: jeton(50) }))).idee.id;
    assert.equal((await admin({ action: 'admin_statut', id: autre, etape: 'candidate_fr' })).status, 409);
    assert.equal((await admin({ action: 'admin_statut', id, etape: 'candidate_fr', note: 'Revue en cours' })).status, 200);
    await admin({ action: 'admin_accord', id, valeur: true }); await admin({ action: 'admin_revue', id, valeur: true });
    const r = await admin({ action: 'admin_statut', id, etape: 'disponible_fr' });
    assert.equal(r.status, 409); assert.match(r.erreur, /conditions de location/); assert.doesNotMatch(r.erreur, /accord explicite/);
  });
  await test('avec les conditions validées par l\'équipe, la publication devient possible (action éditoriale explicite)', async () => {
    writeFileSync(path.join(api, 'labo/conditions-location.json'), JSON.stringify({ validees: true }));
    const r = await admin({ action: 'admin_statut', id, etape: 'disponible_fr', note: 'Accord signé et revue terminée' });
    assert.equal(r.status, 200);
    const d = await get(`idee=${id}`);
    assert.equal(d.idee.etape, 'disponible_fr');
    assert.ok(d.historique.some((h) => h.vers === 'candidate_fr') && d.historique.some((h) => h.vers === 'disponible_fr'));
    writeFileSync(path.join(api, 'labo/conditions-location.json'), JSON.stringify({ validees: false }));
  });
  await test('modération : masquer, fermer la discussion, fusionner un doublon sans perdre soutiens ni commentaires', async () => {
    const dup = (await post(idee('Rappel poubelles (doublon)', { jeton: jeton(60) }))).idee.id;
    await post({ action: 'commenter', id: dup, texte: 'Commentaire du doublon' });
    const avant = (await get('idees=1')).idees.find((i) => i.id === id).votes;
    const f = await admin({ action: 'admin_fusionner', id: dup, vers: id });
    assert.equal(f.status, 200);
    const apres = (await get('idees=1')).idees;
    assert.equal(apres.find((i) => i.id === id).votes, avant + 1);
    assert.ok(!apres.some((i) => i.id === dup));
    assert.equal((await get(`idee=${dup}`)).fusion_vers, id);
    assert.ok((await get(`idee=${id}`)).commentaires.some((c) => c.texte === 'Commentaire du doublon'));
    assert.equal((await admin({ action: 'admin_fermer', id, ferme: true })).status, 200);
    assert.equal((await post({ action: 'commenter', id, texte: 'Encore un commentaire' })).status, 403);
    await admin({ action: 'admin_fermer', id, ferme: false });
    assert.equal((await admin({ action: 'admin_masquer', type: 'idee', id, masque: true })).status, 200);
    assert.ok(!(await get('idees=1')).idees.some((i) => i.id === id));
    assert.equal((await get(`idee=${id}`)).status, 404);
    await admin({ action: 'admin_masquer', type: 'idee', id, masque: false });
  });
  await test('administration : refusée sans jeton ou avec un mauvais jeton, jamais ouverte par défaut', async () => {
    const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'admin_liste' }) });
    assert.equal(r.status, 403);
    assert.equal((await post({ action: 'admin_liste', jeton_admin: 'x'.repeat(30) })).status, 403);
  });
  await test('origine étrangère refusée en écriture', async () => {
    assert.equal((await post(idee('Idée depuis un autre site'), { Origin: 'https://evil.example' })).status, 403);
  });
} finally { srv.kill(); }
console.log(`\n${ok} tests passés${process.exitCode ? ' — ÉCHECS ci-dessus' : ''}`);
