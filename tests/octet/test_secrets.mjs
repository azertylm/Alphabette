// Tests des combinaisons secrètes d'Octet : validation serveur (PHP), une fois par appareil, compteur, admin, chasse au trésor.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lire = (f) => readFileSync(path.join(racine, f), 'utf8');
let ok = 0;
const test = async (nom, fn) => { try { await fn(); ok += 1; console.log(`  ✓ ${nom}`); } catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; } };

await test('client : aucune séquence en clair, vérification par le serveur, parapluie hors réseau', () => {
  const js = lire('public/shared/octet-widget.js');
  assert.doesNotMatch(js, /COMBINAISONS|gestes: \[/, 'plus de table de combinaisons dans le navigateur');
  assert.doesNotMatch(js, /URDLURDLO|LLRRUDUDOO|OUUDDLRLROOO/);
  assert.match(js, /action: "essayer"/);
  assert.match(js, /CLE_EN_ATTENTE/);
  assert.match(js, /"umbrella"[^\n]*au sec/);
  assert.match(js, /new Date\(c\.jusquau\)/, 'la date de fin vient du serveur');
});

await test('chasse.json : saison, dates, indices uniques, récompense', () => {
  const c = JSON.parse(lire('public/shared/chasse.json'));
  assert.ok(c.saison && c.debut && c.fin && c.recompense?.texte);
  const ids = c.indices.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const i of c.indices) assert.ok(i.adresse && i.fragment && i.ou, i.id);
  assert.doesNotMatch(lire('public/shared/octet-pont.html'), /document\.cookie/);
  assert.doesNotMatch(lire('public/shared/octet-chasse.js'), /document\.cookie/);
});

const php = spawnSync('php', ['-v']);
if (php.status !== 0) console.log('  (php absent : tests serveur ignorés)');
else {
  const prive = mkdtempSync(path.join(tmpdir(), 'secrets-'));
  const api = mkdtempSync(path.join(tmpdir(), 'secrets-api-'));
  for (const n of ['lot6-commun.php', 'secrets.php']) cpSync(path.join(racine, 'serveur/php', n), path.join(api, n));
  const port = 19300 + Math.floor(Math.random() * 500);
  const mdp = 'valeur-test-mdp-admin-0001';
  const srv = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', api], { env: { ...process.env, ALPHABETTE_PRIVATE_DIR: prive, ADMIN_PASSWORD: mdp }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const url = `http://127.0.0.1:${port}/secrets.php`;
  const post = (corps, ent = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ent }, body: JSON.stringify(corps) });
  const app1 = 'a'.repeat(32), app2 = 'b'.repeat(32);
  try {
    await test('serveur : mauvaise saisie → non, sans rien révéler', async () => {
      const r = await post({ action: 'essayer', appareil: app1, gestes: 'UUUUO' });
      assert.deepEqual(await r.json(), { ok: false });
      assert.equal((await post({ action: 'essayer', appareil: 'pas-un-id', gestes: 'UO' })).status, 400);
    });
    await test('serveur : table de départ (empreintes) reconnue, date de fin renvoyée, une fois par appareil', async () => {
      const r = await (await post({ action: 'essayer', appareil: app1, gestes: 'DD' + 'URDLURDLO' })).json();
      assert.equal(r.ok, true); assert.equal(r.niveau, 1); assert.equal(r.deja, false);
      const fin = Date.parse(r.jusquau);
      assert.ok(fin > Date.now() + 27 * 86400000 && fin < Date.now() + 32 * 86400000);
      const r2 = await (await post({ action: 'essayer', appareil: app1, gestes: 'URDLURDLO' })).json();
      assert.equal(r2.deja, true); assert.equal(r2.jusquau, undefined);
      const r3 = await (await post({ action: 'essayer', appareil: app2, gestes: 'OUUDDLRLROOO' })).json();
      assert.equal(r3.niveau, 3);
    });
    await test('serveur : infos publiques sans aucun geste', async () => {
      const t = await (await fetch(url + '?infos')).text();
      const j = JSON.parse(t);
      assert.equal(j.nombre, 3);
      assert.doesNotMatch(t, /gestes|empreinte|URDL/);
    });
    await test('admin : mot de passe exigé, compteur par mois, rotation de saison', async () => {
      assert.equal((await fetch(url + '?admin')).status, 401);
      assert.equal((await fetch(url + '?admin', { headers: { 'X-Admin-Password': 'mauvais' } })).status, 403);
      const a = await (await fetch(url + '?admin', { headers: { 'X-Admin-Password': mdp } })).json();
      const mois = new Date().toISOString().slice(0, 7);
      assert.equal(a.compteur['automne-2026-1-mois'][mois], 1);
      assert.ok(!JSON.stringify(a).includes('empreinte'));
      // nouvelle saison : l'ancienne est coupée, une nouvelle ajoutée
      const table = a.combinaisons.map((c) => ({ ...c, actif: false }));
      table.push({ nom: 'Le flocon', mois: 2, saison: 'Hiver 2026', gestes: 'UDUDLRO', actif: true });
      const e = await post({ action: 'enregistrer', combinaisons: table }, { 'X-Admin-Password': mdp });
      assert.equal(e.status, 200, await e.clone().text());
      assert.deepEqual(await (await post({ action: 'essayer', appareil: app2, gestes: 'URDLURDLO' })).json(), { ok: false }, 'ancienne coupée');
      const n = await (await post({ action: 'essayer', appareil: app2, gestes: 'UDUDLRO' })).json();
      assert.equal(n.ok, true); assert.equal(n.niveau, 2);
    });
    await test('admin : refuse une combinaison trop facile ou qui en recouvre une autre', async () => {
      const base = [{ nom: 'A', mois: 1, gestes: 'UDUDLRO', actif: true }];
      assert.equal((await post({ action: 'enregistrer', combinaisons: [{ nom: 'X', mois: 1, gestes: 'UUOO', actif: true }] }, { 'X-Admin-Password': mdp })).status, 400);
      assert.equal((await post({ action: 'enregistrer', combinaisons: [...base, { nom: 'B', mois: 2, gestes: 'LLUDUDLRO', actif: true }] }, { 'X-Admin-Password': mdp })).status, 400);
      assert.equal((await post({ action: 'enregistrer', combinaisons: [{ nom: 'C', mois: 1, gestes: 'UDUDLRL', actif: true }] }, { 'X-Admin-Password': mdp })).status, 400, 'doit finir par O');
    });
    await test('stockage : aucune IP ni identifiant d\'appareil en clair', async () => {
      const dossier = path.join(prive, 'secrets');
      for (const f of readdirSync(dossier)) {
        const t = readFileSync(path.join(dossier, f), 'utf8');
        assert.ok(!t.includes('127.0.0.1') && !t.includes(app1) && !t.includes(app2), f);
      }
    });
    await test('serveur : essais en rafale freinés (429)', async () => {
      let dernier = 200;
      for (let i = 0; i < 45 && dernier !== 429; i++) dernier = (await post({ action: 'essayer', appareil: 'c'.repeat(32), gestes: 'LLLLO' })).status;
      assert.equal(dernier, 429);
    });
  } finally { srv.kill(); }
}
console.log(`\n${ok} test(s) secrets réussi(s)`);
