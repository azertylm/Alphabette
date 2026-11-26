// Tests des couvertures « Codex de Vinci » : nouvelle appli sans image, non-écrasement d'une image perso, idempotence, mode strict.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts');
const racine = mkdtempSync(path.join(tmpdir(), 'ab-covers-'));
mkdirSync(path.join(racine, 'data'), { recursive: true });
mkdirSync(path.join(racine, 'public', 'covers'), { recursive: true });
const env = { ...process.env, ALPHABETTE_ROOT: racine };
const lancer = (script, ...args) => execFileSync('node', [path.join(scripts, script), ...args], { env, encoding: 'utf8' });
const registre = () => JSON.parse(readFileSync(path.join(racine, 'data', 'apps-registry.json'), 'utf8'));

// Image personnelle existante (octets sentinelle) + une appli au nom accentué, une nouvelle sans image.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
writeFileSync(path.join(racine, 'public', 'covers', 'Mon Appli.png'), PNG);
writeFileSync(path.join(racine, 'data', 'apps-registry.json'), JSON.stringify({ version: 1, updatedAt: 'x', apps: [
  { id: 'mon-appli', name: 'MON APPLI', slug: 'mon-appli', status: 'actif', url: 'https://mon-appli.alphabette.fr', subdomain: 'monappli' },
  { id: 'omnistat', name: 'OmniStats', slug: 'omnistat', status: 'actif', url: 'https://omnistat.alphabette.fr', subdomain: 'omnistat' },
] }, null, 2));

// 1. Mode strict : la nouvelle appli n'a pas encore de couverture → échec
let r = spawnSync('node', [path.join(scripts, 'sync-covers.mjs'), '--check', '--strict'], { env, encoding: 'utf8' });
assert.equal(r.status, 1, 'strict doit échouer tant qu\'une appli n\'a pas de couverture');

// 2. Une nouvelle application sans image reçoit un SVG < 6 Ko, hors ligne, référencé dans le registre
lancer('ensure-app-cover.mjs', 'omnistat');
const svgPath = path.join(racine, 'public', 'covers', 'omnistat.svg');
assert.ok(existsSync(svgPath), 'omnistat.svg généré');
assert.ok(statSync(svgPath).size < 6144, 'SVG < 6 Ko');
const svg = readFileSync(svgPath, 'utf8');
assert.match(svg, /viewBox="0 0 1200 630"/);
assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/, 'aucune URL externe');
assert.equal(registre().apps.find((a) => a.slug === 'omnistat').cover, '/covers/omnistat.svg');

// 3. L'image personnelle n'est jamais écrasée (octets identiques) et est associée par correspondance souple
lancer('sync-covers.mjs');
assert.deepEqual(readFileSync(path.join(racine, 'public', 'covers', 'Mon Appli.png')), PNG, 'image perso intacte');
const mon = registre().apps.find((a) => a.slug === 'mon-appli');
assert.equal(mon.coverCustom, true);
assert.equal(mon.cover, '/covers/Mon%20Appli.png');
assert.ok(!existsSync(path.join(racine, 'public', 'covers', 'mon-appli.svg')), 'pas de SVG pour une appli avec image perso');

// 4. Idempotence : un second passage ne change rien
const avant = readFileSync(path.join(racine, 'data', 'apps-registry.json'), 'utf8');
const svgAvant = readFileSync(svgPath, 'utf8');
lancer('sync-covers.mjs');
assert.equal(readFileSync(path.join(racine, 'data', 'apps-registry.json'), 'utf8'), avant, 'registre inchangé');
assert.equal(readFileSync(svgPath, 'utf8'), svgAvant, 'SVG inchangé');

// 5. Strict passe maintenant ; slug inconnu → erreur claire
lancer('sync-covers.mjs', '--strict');
r = spawnSync('node', [path.join(scripts, 'ensure-app-cover.mjs'), 'inconnue'], { env, encoding: 'utf8' });
assert.equal(r.status, 1);
console.log('couvertures : 5 contrôles OK');
