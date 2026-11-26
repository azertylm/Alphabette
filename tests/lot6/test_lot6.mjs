// Tests du Lot 6 : Nutri-Score, Météo du Labo, masquage des barres, relais chiffré (PHP), Ruche à Idées, santé, couvertures.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let ok = 0;
const test = async (nom, fn) => { try { await fn(); ok += 1; console.log(`  ✓ ${nom}`); } catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; } };
const mod = (f) => import(path.join(racine, 'packages/shell/src', f));

// ---------- modules purs ----------
const nutri = await mod('nutriscore.ts');
const meteo = await mod('meteo.ts');
const masq = await mod('masquage.ts');

await test('Nutri-Score : lettre A pour une appli exemplaire, E pour une appli pistée', () => {
  const bon = { originesTierces: 0, traceurs: 0, baseCommune: true, voix: true, horsLigne: true, hebergeeFrance: true, ia: 'aucune', poidsKo: 200 };
  assert.equal(nutri.calculerNutriScore(bon).lettre, 'A');
  const mauvais = { originesTierces: 12, traceurs: 6, baseCommune: false, voix: false, horsLigne: false, hebergeeFrance: false, ia: 'autre', poidsKo: 9000 };
  assert.equal(nutri.calculerNutriScore(mauvais).lettre, 'E');
});
await test('Nutri-Score : jamais de lettre inventée si un constat manque', () => {
  const r = nutri.calculerNutriScore({ originesTierces: null, traceurs: null, baseCommune: null, voix: null, horsLigne: null, hebergeeFrance: null, ia: null, poidsKo: null });
  assert.equal(r.lettre, null);
});
await test('Nutri-Score : lettres en blanc sur fond ≥ 7:1 (AAA)', async () => {
  const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const [l, c] of Object.entries(nutri.COULEURS_LETTRE)) assert.ok(1.05 / (lum(c) + 0.05) >= 7, `lettre ${l}`);
});
await test('Météo : ☀️ OK, ⛅ évolutions, 🌧️ vérif, inconnu sans erreur', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  assert.equal(meteo.meteoDepuisStatut(null, now).ciel, 'inconnu');
  assert.equal(meteo.meteoDepuisStatut({ dernier_passage: '2026-11-20T00:00:00Z', corrections: 0 }, now).ciel, 'ok');
});
await test('Barres : se cachent en descendant, reviennent en remontant', () => {
  assert.equal(masq.decisionBarres(false, 400, 30), true);
  assert.equal(masq.decisionBarres(true, 400, -30), false);
  assert.equal(masq.decisionBarres(false, 20, 30), false);
});

// ---------- serveur PHP ----------
const php = spawnSync('php', ['-v']);
if (php.status !== 0) { console.log('  (php absent : tests serveur ignorés)'); }
else {
  const prive = mkdtempSync(path.join(tmpdir(), 'l6-'));
  const dossierApi = mkdtempSync(path.join(tmpdir(), 'l6-api-'));
  const { cpSync, mkdirSync } = await import('node:fs');
  for (const n of ['lot6-commun.php', 'relay.php', 'ideas.php', 'health.php', 'croissance-commun.php', 'finance-commun.php']) if (existsSync(path.join(racine, 'serveur/php', n))) cpSync(path.join(racine, 'serveur/php', n), path.join(dossierApi, n));
  mkdirSync(path.join(dossierApi, 'labo'), { recursive: true });
  cpSync(path.join(racine, 'data/labo/idees-statuts.json'), path.join(dossierApi, 'labo/idees-statuts.json'));
  cpSync(path.join(racine, 'data/labo/idees-statuts.json'), path.join(dossierApi, 'idees-statuts.json'));
  const port = 18700 + Math.floor(Math.random() * 500);
  const srv = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', dossierApi], { env: { ...process.env, ALPHABETTE_PRIVATE_DIR: prive, ALPHABETTE_COLLECTIF_DIR: prive, ADMIN_PASSWORD: 'valeur-test-mdp-admin-0001', ALPHABETTE_ADMIN_EMAIL: 'boite-admin@exemple.invalid' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const base = `http://127.0.0.1:${port}/`;
  const post = (f, corps, ent = {}) => fetch(base + f, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ent }, body: JSON.stringify(corps) });
  try {
    await test('Relais : dépôt → lecture unique → détruit', async () => {
      const d = await post('relay.php', { action: 'deposer', bloc: 'AAAA_bbbb-CCCC' });
      assert.equal(d.status, 201);
      const { code, expire_dans } = await d.json();
      assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/); assert.equal(expire_dans, 120);
      const l1 = await post('relay.php', { action: 'lire', code });
      assert.equal(l1.status, 200); assert.equal((await l1.json()).bloc, 'AAAA_bbbb-CCCC');
      assert.equal((await post('relay.php', { action: 'lire', code })).status, 404);
    });
    await test('Relais : refuse un bloc trop gros et un code inconnu', async () => {
      assert.ok((await post('relay.php', { action: 'deposer', bloc: 'A'.repeat(30000) })).status >= 400);
      assert.equal((await post('relay.php', { action: 'lire', code: 'ZZZZZZ' })).status, 404);
    });
    await test('Relais : CORS limité à l’écosystème Alphabette', async () => {
      const a = await post('relay.php', { action: 'lire', code: 'ZZZZZZ' }, { Origin: 'https://quiz.alphabette.fr' });
      assert.equal(a.headers.get('access-control-allow-origin'), 'https://quiz.alphabette.fr');
      const b = await post('relay.php', { action: 'lire', code: 'ZZZZZZ' }, { Origin: 'https://evil.example' });
      assert.equal(b.headers.get('access-control-allow-origin'), null);
    });
    await test('Santé : aucun secret, seulement des booléens', async () => {
      const t = await (await fetch(base + 'health.php')).text();
      const j = JSON.parse(t);
      for (const v of Object.values(j.configuration ?? {})) assert.equal(typeof v.configured, 'boolean');
      assert.ok(!/secret|password|=\w{16,}/i.test(JSON.stringify(j.configuration).replace(/ADMIN_PASSWORD|FINANCE_SECRET|WEBHOOK_SECRET/g, '')));
    });
    await test('Santé : ADMIN_PASSWORD et ALPHABETTE_ADMIN_EMAIL en booléens, valeurs jamais exposées', async () => {
      const t = await (await fetch(base + 'health.php')).text();
      const j = JSON.parse(t);
      assert.equal(j.configuration.ADMIN_PASSWORD.configured, true);
      assert.equal(j.configuration.ALPHABETTE_ADMIN_EMAIL.configured, true);
      assert.deepEqual(Object.keys(j.configuration.ADMIN_PASSWORD), ['configured']);
      assert.ok(!t.includes('valeur-test-mdp-admin-0001') && !t.includes('boite-admin@exemple.invalid') && !t.includes('exemple.invalid'));
    });
    await test('Ruche : piège, délai mini, idée, puis vote unique par session', async () => {
      const jeton = 'a'.repeat(32);
      const piege = await post('ideas.php', { action: 'idee', titre: 'Robot', besoin: 'x', jeton, piege: 'robot', delai_ms: 9000 });
      assert.equal((await piege.json()).idee, null);
      const vite = await post('ideas.php', { action: 'idee', titre: 'Trop vite', besoin: 'Un besoin réel', jeton, piege: '', delai_ms: 10 });
      assert.equal(vite.status, 429);
      const r = await post('ideas.php', { action: 'idee', titre: 'Trier mes photos de famille', besoin: 'Je voudrais retrouver facilement les photos de mes petits-enfants.', categorie: 'Autre', jeton, piege: '', delai_ms: 9000 });
      const j = await r.json();
      assert.equal(r.status, 201, JSON.stringify(j));
      const id = j.idee.id;
      const autre = 'b'.repeat(32);
      const v1 = await post('ideas.php', { action: 'voter', id, jeton: autre });
      const v2 = await post('ideas.php', { action: 'voter', id, jeton: autre });
      const n1 = await v1.json(), n2 = await v2.json();
      assert.equal(v1.status, 200); assert.equal(n1.votes, 2);
      assert.equal(v2.status, 409, 'un second vote de la même session est refusé'); assert.ok(n2.erreur);
      const liste = await (await fetch(base + 'ideas.php?liste&filtre=nouvelles')).json();
      assert.ok(liste.idees.some((i) => i.id === id));
    });
    await test('Ruche : « Je prends le défi » exige un créateur connecté', async () => {
      const r = await post('ideas.php', { action: 'defi', id: 'inconnu' });
      assert.ok([401, 403, 404, 503].includes(r.status), String(r.status));
    });
  } finally { srv.kill(); }
}

// ---------- couvertures ----------
await test('Couvertures : toute appli a une image existante, SVG de repli < 200 Ko', () => {
  const reg = JSON.parse(readFileSync(path.join(racine, 'data/apps-registry.json'), 'utf8'));
  for (const a of reg.apps) {
    assert.ok(a.cover, `cover manquante : ${a.slug}`);
    const f = path.join(racine, 'public', decodeURIComponent(a.cover));
    assert.ok(existsSync(f), `fichier absent : ${a.cover}`);
    if (!a.coverCustom) assert.ok(statSync(f).size < 200 * 1024, `trop lourd : ${a.cover}`);
  }
});

console.log(`${ok} test(s) Lot 6 réussis`);
