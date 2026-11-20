#!/usr/bin/env node
/**
 * Parcours ORBIT dans Chrome à 390 px, sur le build statique (.eu), avec le faux Internet de test_orbit.py.
 * Aucune requête ne sort : tout ce qui ne vise pas 127.0.0.1 est bloqué et compté.
 *
 *   bun run build:static
 *   NODE_PATH=/tmp/pw/node_modules CHROME_PATH=/usr/bin/google-chrome node tests/orbit/apercu.mjs [dossier-captures]
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const captures = process.argv[2] || '/tmp/orbit-captures';
mkdirSync(captures, { recursive: true });

let ok = 0; const echecs = [];
const verifier = (c, nom) => { if (c) { ok++; console.log('  ✓', nom); } else { echecs.push(nom); console.log('  ✗', nom); } };

const serveur = spawn('python3', [path.join(racine, 'tests', 'orbit', 'test_orbit.py'), '--apercu'], { env: { ...process.env, ORBIT_PORT: String(20000 + Math.floor(Math.random() * 20000)) } });
const url = await new Promise((ok, ko) => {
  serveur.stdout.on('data', (d) => { const m = String(d).match(/http:\/\/\S+/); if (m) ok(m[0]); });
  serveur.on('exit', () => ko(new Error('serveur arrêté')));
  setTimeout(() => ko(new Error('serveur muet')), 20000);
});

const navigateur = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function page(options = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', ...options });
  const p = await ctx.newPage();
  p.erreurs = []; p.externes = [];
  p.on('pageerror', (e) => p.erreurs.push(String(e)));
  p.on('response', (r) => { if (r.status() >= 400) p.erreurs.push(`${r.status()} ${r.url()}`); });
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED|net::|Failed to load resource/.test(m.text())) p.erreurs.push(m.text()); });
  await p.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith('http://127.0.0.1')) return r.continue(); p.externes.push(u); return r.abort('blockedbyclient'); });
  return p;
}
const attendreCartes = async (p, n = 6) => p.waitForFunction((n) => document.querySelectorAll('.o-carte .o-titre').length >= n, n, { timeout: 30000 });

try {
  console.log('Premier passage');
  const p = await page();
  await p.goto(url);
  await p.waitForSelector('#o-session[open]');
  await p.screenshot({ path: `${captures}/1-session.png` });
  verifier(true, 'choix de la session proposé au démarrage');
  await p.click('#o-themes button:has-text("Tech & IA")');
  await p.click('#o-session button[value="15min"]');
  await attendreCartes(p);
  await p.waitForTimeout(2500);   // analyses IA de la première carte
  await p.screenshot({ path: `${captures}/2-flux.png` });
  verifier(await p.locator('iframe').count() === 0, 'aucun lecteur chargé avant de cliquer');
  verifier(p.externes.length === 0, `aucune requête vers l'extérieur avant lecture (${p.externes.length})`);
  verifier(/⏳ 1[45]:/.test(await p.textContent('#o-minuteur')), 'minuteur 15 min lancé');

  const petits = await p.evaluate(() => [...document.querySelectorAll('button, a, input[type=range]')]
    .filter((e) => !e.closest('#ab-barres') && !e.closest('.ab-modale-fond') && e.offsetParent && !e.classList.contains('o-saut'))
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 20) || e.getAttribute('aria-label'), h: r.height, w: r.width }; })
    .filter((r) => r.h < 44 || r.w < 44));
  verifier(petits.length === 0, `boutons ≥ 44 px ${petits.length ? JSON.stringify(petits.slice(0, 4)) : ''}`);

  console.log('Curseur Bulle / Découverte');
  await p.evaluate(() => { const c = document.querySelector('#o-curseur'); c.value = 0; c.dispatchEvent(new Event('input')); });
  await p.waitForTimeout(500);
  const orbites0 = await p.$$eval('.o-carte', (l) => l.map((c) => c.querySelector('.o-tag')?.textContent || ''));
  verifier(orbites0.length > 0 && orbites0.every((t) => t.includes('Tech & IA')), `0 % : seulement l'orbite choisie (${orbites0.length} cartes)`);
  await p.evaluate(() => { const c = document.querySelector('#o-curseur'); c.value = 100; c.dispatchEvent(new Event('input')); });
  await p.waitForTimeout(500);
  const orbites100 = await p.$$eval('.o-carte', (l) => l.map((c) => c.querySelector('.o-tag')?.textContent || ''));
  verifier(orbites100.length > 0 && orbites100.every((t) => !t.includes('Tech & IA')), '100 % : seulement hors des habitudes');
  await p.evaluate(() => { const c = document.querySelector('#o-curseur'); c.value = 30; c.dispatchEvent(new Event('input')); });
  await p.waitForTimeout(500);

  console.log('Filtre durée réelle');
  await p.click('[data-duree="documentaire"]');
  const durees = await p.$$eval('.o-badge--duree', (l) => l.map((b) => b.textContent));
  const enS = (t) => (t.includes('h') ? 3600 * parseInt(t) + 60 * parseInt(t.split('h')[1]) : t.split(':').reduce((a, b) => a * 60 + Number(b), 0));
  verifier(durees.length > 0 && durees.every((t) => enS(t) > 1200), `Documentaire : uniquement > 20 min (${durees.join(', ')})`);
  await p.click('[data-duree="express"]');
  const express = await p.$$eval('.o-badge--duree', (l) => l.map((b) => b.textContent));
  verifier(express.every((t) => enS(t) < 60), 'Express : uniquement < 1 min');
  await p.click('[data-duree=""]');

  console.log('Lecture paresseuse');
  const premiere = p.locator('.o-carte').first();
  await premiere.locator('.o-ecran__lecture').click();
  const src = await p.locator('iframe').first().getAttribute('src');
  verifier(src.startsWith('https://www.youtube-nocookie.com/embed/'), 'lecteur YouTube sans cookie, chargé au clic');
  verifier(await p.locator('iframe').count() === 1, 'un seul lecteur à la fois');
  await p.mouse.wheel(0, 2500); await p.waitForTimeout(800);
  verifier(await p.locator('iframe').count() === 0, 'lecteur retiré quand la vidéo sort de l\'écran');

  console.log('Plongée');
  await p.evaluate(() => scrollTo(0, 0));
  await p.locator('.o-carte button:has-text("Plongée")').first().click();
  await p.waitForSelector('.o-etape', { timeout: 20000 });
  verifier(await p.locator('.o-etape').count() === 5, '5 étapes de plus en plus pointues');
  await p.screenshot({ path: `${captures}/3-plongee.png` });
  await p.click('#o-panneau-fermer');

  console.log('Import et doublons');
  await p.click('#o-ouvrir-import');
  await p.fill('#o-import-url', 'https://vm.tiktok.com/ZMabc123/');
  await p.click('#o-import-form button[type=submit]');
  await p.waitForFunction(() => /Doublon|En orbite|⚠️/.test(document.querySelector('#o-import-etat').textContent), null, { timeout: 30000 });
  const etat = await p.textContent('#o-import-etat');
  verifier(/Doublon/.test(etat) && /YouTube/.test(etat), `repost TikTok d'une vidéo YouTube détecté (${etat})`);
  await p.fill('#o-import-url', 'https://www.youtube.com/watch?v=abcdefghijk');
  await p.click('#o-import-form button[type=submit]');
  await p.waitForFunction(() => /En orbite|⚠️/.test(document.querySelector('#o-import-etat').textContent), null, { timeout: 30000 });
  const etat2 = await p.textContent('#o-import-etat');
  verifier(/En orbite/.test(etat2) && /Tech & IA/.test(etat2) && /Éducatif/.test(etat2) && /Français/.test(etat2), `nouvelle vidéo : titre, orbite, ton, langue (${etat2})`);
  await p.screenshot({ path: `${captures}/4-import.png` });
  await p.click('#o-import-annuler');
  verifier(await p.locator('.o-carte').first().getAttribute('data-id') === 'yt:abcdefghijk', 'vidéo importée en tête de « Mon flux »');
  verifier(p.erreurs.length === 0, `0 erreur dans la console ${p.erreurs.join(' | ')}`);

  console.log('Minuteur doux et mode nuit');
  const n = await page({ colorScheme: 'dark' });
  await n.clock.install();
  await n.goto(url);
  await n.waitForSelector('#o-session[open]');
  await n.click('#o-session button[value="5min"]');
  await attendreCartes(n, 3);
  await n.screenshot({ path: `${captures}/5-nuit.png` });
  await n.locator('.o-ecran__lecture').first().click();
  await n.clock.runFor(5 * 60 * 1000 + 2000);
  await n.waitForSelector('#o-calme:not([hidden])');
  verifier(await n.locator('iframe').count() === 0, 'fin du quota : lecture arrêtée proprement');
  await n.screenshot({ path: `${captures}/6-ecran-calme.png` });
  await n.locator('.o-carte .o-ecran__lecture').first().click({ force: true }).catch(() => {});
  verifier(await n.locator('iframe').count() === 0, 'aucune vidéo ne se relance après la fin');
  verifier(n.erreurs.length === 0, `0 erreur en mode nuit ${n.erreurs.join(' | ')}`);
} catch (e) {
  echecs.push(String(e)); console.log('  ✗', e);
} finally {
  await navigateur.close();
  serveur.kill();
}
console.log(`\n${ok}/${ok + echecs.length} vérifications réussies — captures : ${captures}`);
process.exit(echecs.length ? 1 : 0);
