#!/usr/bin/env node
/**
 * tests/atelier/test_atelier.mjs — vérifie l'Atelier qualité et le bac à sable sur des pages locales.
 *
 *   NODE_PATH=/tmp/pw/node_modules [CHROME_PATH=/usr/bin/google-chrome] node tests/atelier/test_atelier.mjs
 *
 * 1. Bac à sable : filtre (PHP, .htaccess, SVG piégé, lien symbolique, node_modules retirés), coffre, cadre.
 * 2. Isolement réel dans Chrome : origine opaque, cookies et stockage du site illisibles, coffre persistant,
 *    garde-fou si l'en-tête de sécurité manque.
 * 3. Atelier : la bonne appli passe, la mauvaise est arrêtée (traceur, secret, débordement, zoom, contraste…).
 * 4. Jury : badge seulement après 3 jours de contrôle réussi sur 7.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { preparerApp, publierHebergees } from '../../scripts/labo/bac-a-sable.mjs';
import { demarrer } from '../../scripts/labo/serveur-statique.mjs';
import { jury } from '../../scripts/labo/atelier/analyse.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FIX = path.join(RACINE, 'tests', 'atelier', 'fixtures');
const PORT = 4179;
const ORIGINE = `http://127.0.0.1:${PORT}`;
let echecs = 0, total = 0;
const verifier = (ok, message) => { total++; if (ok) console.log(`  ✓ ${message}`); else { echecs++; console.log(`  ✗ ${message}`); } };

const site = mkdtempSync(path.join(os.tmpdir(), 'site-atelier-'));
const source = mkdtempSync(path.join(os.tmpdir(), 'source-'));
try {
  /* ---------- 1. Bac à sable ---------- */
  console.log('1. Bac à sable (filtre et préparation)');
  cpSync(path.join(FIX, 'hebergee'), source, { recursive: true });
  writeFileSync(path.join(source, 'pirate.php'), '<?php echo "pirate"; ?>');
  writeFileSync(path.join(source, '.htaccess'), 'Options +ExecCGI');
  writeFileSync(path.join(source, 'piege.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  mkdirSync(path.join(source, 'node_modules', 'x'), { recursive: true });
  writeFileSync(path.join(source, 'node_modules', 'x', 'a.js'), 'x');
  symlinkSync('/etc/passwd', path.join(source, 'lien'));
  const app = { id: 'c-compteur', name: 'Compteur', createur: 'Testeuse', description: 'Un compteur de test.', heberge: { depot: 'exemple/compteur', ref: 'a'.repeat(40) } };
  const r = await preparerApp(app, site, { origine: ORIGINE, local: source });
  const dossierApp = path.join(site, 'createurs', 'c-compteur', 'app');
  verifier(r.ok, 'appli acceptée par le contrôle statique');
  for (const f of ['pirate.php', '.htaccess-source', 'piege.svg', 'lien', 'node_modules']) {
    if (f === '.htaccess-source') continue;
    verifier(!existsSync(path.join(dossierApp, f)), `${f} retiré`);
  }
  verifier(r.retires.some((x) => x.fichier === '.htaccess' && x.raison === 'fichier caché'), '.htaccess du créateur retiré (remplacé par celui du bac à sable)');
  const htaccess = readFileSync(path.join(dossierApp, '.htaccess'), 'utf8');
  verifier(/Content-Security-Policy "sandbox allow-scripts/.test(htaccess) && !/RewriteEngine/.test(htaccess), '.htaccess du bac à sable : en-tête sandbox, sans RewriteEngine');
  verifier(readFileSync(path.join(dossierApp, 'index.html'), 'utf8').includes('__ab_coffre__'), 'coffre inséré dans index.html');
  verifier(existsSync(path.join(site, 'createurs', 'c-compteur', 'index.html')), 'cadre créé');
  const mauvais = await preparerApp({ ...app, id: 'c-mauvais', heberge: { depot: 'x/y', ref: 'b'.repeat(40) } }, site, { origine: ORIGINE, local: path.join(FIX, 'mauvaise') });
  verifier(!mauvais.ok && mauvais.problemes.some((p) => /Secret visible/.test(p.titre)) && mauvais.problemes.some((p) => /Traceur/.test(p.titre)), 'appli avec secret et traceur refusée avant publication');
  const invalide = await preparerApp({ ...app, heberge: { depot: 'x/y', ref: 'main' } }, site, { origine: ORIGINE, local: source });
  verifier(!invalide.ok, 'commit non figé refusé');

  // Pages « du hub » sur la même origine que le bac à sable, pour vérifier l'isolement.
  writeFileSync(path.join(site, 'hub.html'), '<!doctype html><title>Hub</title><script>localStorage.setItem("secret-du-hub","CLE-IA-DU-VISITEUR");document.cookie="session=SECRET; path=/";</script>');
  // Copie sans en-têtes de sécurité : simule un hébergeur qui ignorerait le .htaccess.
  cpSync(path.join(site, 'createurs', 'c-compteur'), path.join(site, 'createurs', 'c-sans-entetes'), { recursive: true });
  rmSync(path.join(site, 'createurs', 'c-sans-entetes', 'app', '.htaccess'));
  for (const n of ['bonne', 'mauvaise', 'blanche']) cpSync(path.join(FIX, n), path.join(site, 'apps', n), { recursive: true });

  const serveur = await demarrer(site, PORT);
  const navigateur = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    /* ---------- 2. Isolement réel ---------- */
    console.log('2. Isolement dans le navigateur');
    const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`${ORIGINE}/hub.html`);
    await page.goto(`${ORIGINE}/createurs/c-compteur/`);
    const cadre = await (await page.waitForSelector('iframe')).contentFrame();
    await cadre.waitForSelector('#espion:not(:empty)', { timeout: 10000 });
    const vu = await cadre.textContent('#espion');
    verifier(await cadre.evaluate(() => self.origin) === 'null', 'origine opaque dans le cadre');
    verifier(vu.includes('cookie=') && !vu.includes('SECRET'), `cookies du site invisibles (${vu.split(' | ')[0]})`);
    verifier(vu.includes('parent:refusé'), 'page parente inaccessible');
    verifier(vu.includes('secret=null'), 'stockage du site illisible (clé IA du visiteur protégée)');
    verifier(vu.includes('donnees=true'), "l'appli lit ses propres fichiers (fetch)");
    await cadre.click('#plus');
    await cadre.click('#plus');
    await page.waitForTimeout(200);
    await page.reload();
    const cadre2 = await (await page.waitForSelector('iframe')).contentFrame();
    await cadre2.waitForSelector('#espion:not(:empty)');
    verifier((await cadre2.textContent('#valeur')) === '2', 'coffre : la valeur est gardée après rechargement');
    verifier(await page.evaluate(() => localStorage.getItem('secret-du-hub')) === 'CLE-IA-DU-VISITEUR', 'le coffre ne touche pas au stockage du site');
    const direct = await ctx.newPage();
    await direct.goto(`${ORIGINE}/createurs/c-compteur/app/index.html`);
    await direct.waitForTimeout(500);
    verifier(await direct.evaluate(() => self.origin) === 'null', 'ouverture directe : toujours isolée (en-tête sandbox)');
    const sansEntetes = await ctx.newPage();
    await sansEntetes.goto(`${ORIGINE}/createurs/c-sans-entetes/app/index.html`);
    await sansEntetes.waitForURL(/\/createurs\/c-sans-entetes\/$/, { timeout: 5000 }).catch(() => {});
    verifier(/\/createurs\/c-sans-entetes\/$/.test(sansEntetes.url()), 'sans en-tête de sécurité : la page renvoie vers le cadre isolé');
    const interdit = await ctx.request.get(`${ORIGINE}/createurs/c-compteur/app/.htaccess`);
    verifier(interdit.status() === 403, 'fichiers cachés refusés (403)');
    await ctx.close();
  } finally {
    await navigateur.close();
  }

  /* ---------- 3. Atelier ---------- */
  console.log('3. Atelier qualité');
  const cibles = [
    { id: 'bonne', nom: 'Bonne appli', url: `${ORIGINE}/apps/bonne/`, communaute: true },
    { id: 'mauvaise', nom: 'Mauvaise appli', url: `${ORIGINE}/apps/mauvaise/`, communaute: true },
    { id: 'c-compteur', nom: 'Compteur', url: `${ORIGINE}/createurs/c-compteur/app/index.html`, communaute: true, heberge: true },
    { id: 'blanche', nom: 'Blanche', url: `${ORIGINE}/apps/blanche/` },
    { id: 'absente', nom: 'Absente', url: `${ORIGINE}/apps/absente/` },
  ];
  const sortie = path.join(site, 'atelier');
  writeFileSync(path.join(site, 'cibles.json'), JSON.stringify(cibles));
  // Processus séparé, sans bloquer ce processus : le serveur de test doit continuer à répondre.
  await new Promise((ok, ko) => {
    const p = spawn(process.execPath, [path.join(RACINE, 'scripts', 'labo', 'atelier.mjs'), 'controler', '--cibles', path.join(site, 'cibles.json'), '--sortie', sortie], { stdio: ['ignore', 'ignore', 'inherit'], env: process.env });
    const t = setTimeout(() => { p.kill(); ko(new Error('atelier trop long')); }, 300000);
    p.on('exit', (code) => { clearTimeout(t); code === 0 ? ok() : ko(new Error(`atelier : code ${code}`)); });
  });
  const lire = (id) => JSON.parse(readFileSync(path.join(sortie, 'rapports', `${id}.json`), 'utf8'));
  const bonne = lire('bonne'), mauvaise = lire('mauvaise'), compteur = lire('c-compteur');
  const titres = (x) => x.problemes.map((p) => `${p.agent}:${p.titre}`).join('\n');
  verifier(bonne.compte.bloquant === 0 && bonne.compte.important === 0, `bonne appli : aucun point bloquant ni important (note ${bonne.note})`);
  verifier(bonne.controle_technique >= 85, `bonne appli : contrôle technique ${bonne.controle_technique}/100`);
  verifier(bonne.apte === true, 'bonne appli : apte au badge');
  const attendus = [/douanier:Traceur/, /douanier:Secret visible/, /pouce:La page dépasse/, /pouce:Le zoom est bloqué/, /opticien:Textes peu contrastés/,
    /opticien:.*bouton.*sans nom/, /opticien:.*sans étiquette/, /phare:Pas de description/, /parapluie:Pas d'avertissement sur les réponses de l'IA/,
    /parapluie:Aucun lien vers les mentions/, /poids_plume:Polices chargées/, /temoin:.*erreur.*JavaScript/, /opticien:On ne voit pas où l'on est au clavier/];
  for (const re of attendus) verifier(re.test(titres(mauvaise)), `mauvaise appli : ${re.source.replace(/\\/g, '')}`);
  verifier(mauvaise.apte === false && mauvaise.compte.bloquant >= 2, `mauvaise appli : pas de badge (${mauvaise.compte.bloquant} bloquants)`);
  verifier(mauvaise.problemes.every((p) => p.prompt && p.correction), 'chaque problème a une correction et un prompt');
  verifier(compteur.compte.bloquant === 0, `appli hébergée contrôlée dans son bac à sable (note ${compteur.note})`);
  verifier(/temoin:Page blanche/.test(titres(lire('blanche'))), 'Témoin : page blanche repérée');
  verifier(/temoin:L'application ne s'ouvre pas/.test(titres(lire('absente'))), 'Témoin : adresse en erreur repérée');
  verifier(!/Page blanche/.test(titres(mauvaise)), 'Témoin : une page claire et peu remplie n\'est pas prise pour une page blanche');
  verifier(existsSync(path.join(sortie, 'captures', 'bonne.jpg')), 'Témoin : capture 390 px enregistrée');
  verifier(existsSync(path.join(sortie, 'index.json')) && existsSync(path.join(sortie, 'alertes.json')), 'index et alertes écrits');
  if (echecs) console.log(`\n--- problèmes de la mauvaise appli ---\n${titres(mauvaise)}\n--- bonne ---\n${titres(bonne)}`);

  /* ---------- 4. Jury ---------- */
  console.log('4. Jury');
  const jourJ = Date.parse('2026-11-20T12:00:00Z');
  const jour = (j, apte) => ({ apps: { x: { id: 'x', date: new Date(jourJ - j * 86400000).toISOString(), apte, controle_technique: 90, note: 90 } } });
  verifier(jury([jour(2, true), jour(1, true), jour(0, true)], jourJ).x.teste_au_labo === true, '3 jours réussis : badge');
  verifier(jury([jour(1, true), jour(0, true)], jourJ).x.teste_au_labo === false, '2 jours seulement : pas encore');
  verifier(jury([jour(3, true), jour(2, true), jour(1, true), jour(0, false)], jourJ).x.teste_au_labo === false, 'dernier contrôle raté : badge retiré');
  verifier(jury([jour(9, true), jour(8, true), jour(1, true), jour(0, true)], jourJ).x.teste_au_labo === false, 'contrôles de plus de 7 jours ignorés');
  /* ---------- 5. Versions validées (publication au build) ---------- */
  console.log('5. Versions validées');
  const A = 'a'.repeat(40), Bref = 'b'.repeat(40);
  const verdicts = path.join(site, 'verdicts');
  const locaux = path.join(site, 'locaux');
  mkdirSync(verdicts, { recursive: true });
  cpSync(path.join(FIX, 'hebergee'), path.join(locaux, 'c-compteur'), { recursive: true });
  process.env.BAC_A_SABLE_LOCAL = locaux;
  const fiche = { ...app, heberge: { depot: 'exemple/compteur', ref: Bref } };
  const pub = (v) => { writeFileSync(path.join(verdicts, 'c-compteur.json'), JSON.stringify(v)); return publierHebergees(path.join(site, 'eu'), [fiche], verdicts); };
  verifier((await pub({ ref: Bref, conforme: true })).at(0)?.ref === Bref, 'commit validé : publié');
  verifier((await pub({ ref: Bref, conforme: false, dernier_conforme: { ref: A } })).at(0)?.ref === A, 'nouveau commit refusé : la dernière version validée reste en ligne');
  verifier((await pub({ ref: Bref, conforme: false, dernier_conforme: null })).length === 0, 'jamais validée : pas publiée');
  verifier((await pub({ ref: A, conforme: true })).at(0)?.ref === A, 'nouveau commit pas encore contrôlé : la version validée reste');
  delete process.env.BAC_A_SABLE_LOCAL;
  serveur.close();
} finally {
  rmSync(site, { recursive: true, force: true });
  rmSync(source, { recursive: true, force: true });
}
console.log(`\n${total - echecs}/${total} vérifications réussies`);
process.exit(echecs ? 1 : 0);
