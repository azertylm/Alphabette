#!/usr/bin/env bun
/**
 * scripts/voix/generer-bibliotheque.ts — Bibliothèque de voix Alphabette (gratuite, sans serveur).
 *
 * 1. Ouvre chaque page publiée (hub + applis, version construite dist-static) en largeur téléphone,
 *    et demande à la page elle-même ses textes lisibles (window.alphabetteAudio.textesAPrononcer :
 *    même découpage, mêmes empreintes que dans le navigateur des visiteurs).
 *    Ajoute les fichiers voix-textes.json des applis (liste de textes fixes à enregistrer).
 * 2. Enregistre les textes nouveaux avec la voix Gemini « Kore » (clé GEMINI_API_KEY du dépôt,
 *    quota GRATUIT de Google : on s'arrête poliment au premier « quota atteint », la suite au
 *    prochain passage). MP3 mono 48 kbit/s.
 * 3. Écrit voix/index.json (suivi), voix/index.js (lu par les navigateurs) et voix/.htaccess.
 *
 *   bun scripts/voix/generer-bibliotheque.ts --site dist-static --sortie ../voix-depot [--max 40]
 *
 * Variables : GEMINI_API_KEY (obligatoire pour enregistrer), PLAYWRIGHT_MODULE (chemin du module
 * playwright), VOIX_MAX (nombre maximal d'enregistrements par passage).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planBibliotheque, VERSION_BIBLIOTHEQUE } from '../../packages/shell/src/audio/bibliotheque';
import { corpsRequeteTts, garantirWav, base64VersOctets, MODELE_TTS, MODELES_TTS_SECOURS } from '../../packages/shell/src/audio/voixGemini';

const args = process.argv.slice(2);
const opt = (nom: string, defaut: string) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
};
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = path.resolve(opt('site', 'dist-static'));
const SORTIE = path.resolve(opt('sortie', '../voix-depot'), 'voix');
const MAX = Number(process.env.VOIX_MAX || opt('max', '40'));
const PORT = 4199;
const OUBLI_JOURS = 60;
const aujourdhui = new Date().toISOString().slice(0, 10);

interface Entree { texte: string; duree?: number; vu: string; source: string; essais?: number }
interface Index { v: number; entrees: Record<string, Entree> }

fs.mkdirSync(SORTIE, { recursive: true });
const cheminIndex = path.join(SORTIE, 'index.json');
let index: Index = { v: VERSION_BIBLIOTHEQUE, entrees: {} };
try {
  const lu = JSON.parse(fs.readFileSync(cheminIndex, 'utf8')) as Index;
  if (lu.v === VERSION_BIBLIOTHEQUE) index = lu;
} catch { /* première fois */ }

function noter(empreinte: string, texte: string, source: string) {
  const e = index.entrees[empreinte];
  if (e) e.vu = aujourdhui;
  else index.entrees[empreinte] = { texte, vu: aujourdhui, source };
}

/* ------------------------------------------------------------------ 1. Collecte */
async function collecter() {
  const modulePw = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const { chromium } = await import(modulePw);
  const serveur = spawn('node', [path.join(RACINE, 'scripts/labo/serveur-statique.mjs'), SITE, String(PORT), '--spa'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));

  const pages = ['/'];
  try {
    const sources = JSON.parse(fs.readFileSync(path.join(RACINE, 'data/apps-sources.json'), 'utf8')).apps as Record<string, unknown>;
    for (const cle of Object.keys(sources)) {
      for (const p of [`/apps/${cle}/`, `/eu/apps/${cle}/`]) if (fs.existsSync(path.join(SITE, p, 'index.html'))) pages.push(p);
    }
  } catch { /* registre illisible : hub seul */ }

  const navigateur = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let total = 0;
  for (const p of pages) {
    const page = await navigateur.newPage({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
    try {
      await page.goto(`http://localhost:${PORT}${p}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2000);
      const textes: { texte: string; empreinte: string }[] = await page.evaluate(async () => {
        const w = window as unknown as { alphabetteAudio?: { textesAPrononcer?: () => { texte: string; empreinte: string }[] } };
        for (let i = 0; i < 20 && !w.alphabetteAudio?.textesAPrononcer; i++) await new Promise((r) => setTimeout(r, 250));
        return w.alphabetteAudio?.textesAPrononcer?.() ?? [];
      });
      textes.forEach((t) => noter(t.empreinte, t.texte, p));
      total += textes.length;
      // Textes fixes déclarés par l'appli (fiches, chapitres, questions…).
      const declares: string[] = await page.evaluate(async () => {
        try {
          const r = await fetch('voix-textes.json', { cache: 'no-store' });
          if (!r.ok) return [];
          const j = await r.json();
          return Array.isArray(j) ? j.filter((x) => typeof x === 'string') : Array.isArray(j?.textes) ? j.textes : [];
        } catch { return []; }
      });
      for (const brut of declares) for (const part of planBibliotheque(brut)) noter(part.empreinte, part.texte, `${p}voix-textes.json`);
      console.log(`📄 ${p} : ${textes.length} texte(s) de page, ${declares.length} déclaré(s)`);
    } catch (e) {
      console.log(`⚠️  ${p} : ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }
  await navigateur.close();
  serveur.kill();
  console.log(`Collecte : ${total} texte(s) vus sur ${pages.length} page(s).`);
}

/* -------------------------------------------------------------- 2. Enregistrement */
type Resultat = { wav: Uint8Array } | { quota: true } | { echec: true };

async function enregistrer(texte: string, cle: string): Promise<Resultat> {
  for (const modele of [process.env.ALPHABETTE_TTS_MODEL || MODELE_TTS, ...MODELES_TTS_SECOURS]) {
    for (const avecStyle of [true, false]) {
      const controle = new AbortController();
      const delai = setTimeout(() => controle.abort(), 120000);
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle },
          body: JSON.stringify(corpsRequeteTts(texte, avecStyle)),
          signal: controle.signal,
        });
        if (r.status === 429) return { quota: true };
        if (r.status === 404) break;
        if (!r.ok) {
          console.log(`   ${modele}${avecStyle ? ' (style)' : ''} → ${r.status} ${(await r.text()).slice(0, 160)}`);
          continue;
        }
        const j = await r.json();
        const d = j?.candidates?.[0]?.content?.parts?.find((x: { inlineData?: unknown }) => x.inlineData)?.inlineData;
        if (d?.data) return { wav: garantirWav(base64VersOctets(d.data), d.mimeType) };
      } catch (e) {
        console.log(`   ${modele} → ${(e as Error).message}`);
      } finally {
        clearTimeout(delai);
      }
    }
  }
  return { echec: true };
}

function enMp3(wav: Uint8Array, destination: string): number {
  const tmp = path.join(os.tmpdir(), `ab-voix-${process.pid}.wav`);
  fs.writeFileSync(tmp, wav);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', '24000', '-b:a', '48k', destination]);
  fs.rmSync(tmp, { force: true });
  if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr}`);
  // Durée : données PCM 16 bits (44 octets d'en-tête) / (taux × 2).
  const taux = new DataView(wav.buffer, wav.byteOffset).getUint32(24, true) || 24000;
  return Math.round(((wav.length - 44) / (taux * 2)) * 10) / 10;
}

async function enregistrerLesNouveaux() {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) return console.log('Pas de GEMINI_API_KEY : collecte seulement.');
  const a_faire = Object.entries(index.entrees)
    .filter(([h, e]) => !(e.duree && fs.existsSync(path.join(SORTIE, `${h}.mp3`))) && (e.essais ?? 0) < 5)
    // Les plus courts d'abord : boutons et petites pages sortent vite.
    .sort((a, b) => a[1].texte.length - b[1].texte.length);
  console.log(`À enregistrer : ${a_faire.length} (au plus ${MAX} aujourd'hui).`);
  let faits = 0;
  for (const [h, e] of a_faire.slice(0, MAX)) {
    const r = await enregistrer(e.texte, cle);
    if ('quota' in r) {
      console.log('⏸️  Quota gratuit de Google atteint pour aujourd’hui : la suite au prochain passage.');
      break;
    }
    if ('echec' in r) {
      e.essais = (e.essais ?? 0) + 1;
      continue;
    }
    e.duree = enMp3(r.wav, path.join(SORTIE, `${h}.mp3`));
    delete e.essais;
    faits++;
    console.log(`🎙️  ${h}.mp3 (${e.duree} s) — ${e.texte.slice(0, 60)}…`);
    await new Promise((res) => setTimeout(res, 6500)); // quota gratuit : quelques requêtes par minute
  }
  console.log(`Enregistrés ce passage : ${faits}.`);
}

/* ----------------------------------------------------------------- 3. Publication */
function publier() {
  const limite = new Date(Date.now() - OUBLI_JOURS * 864e5).toISOString().slice(0, 10);
  for (const [h, e] of Object.entries(index.entrees)) {
    if (e.vu < limite) {
      delete index.entrees[h];
      fs.rmSync(path.join(SORTIE, `${h}.mp3`), { force: true });
    }
  }
  fs.writeFileSync(cheminIndex, `${JSON.stringify(index, null, 1)}\n`);
  const prets: Record<string, number> = {};
  for (const [h, e] of Object.entries(index.entrees)) if (e.duree && fs.existsSync(path.join(SORTIE, `${h}.mp3`))) prets[h] = e.duree;
  fs.writeFileSync(path.join(SORTIE, 'index.js'), `window.__abVoix=${JSON.stringify({ v: VERSION_BIBLIOTHEQUE, h: prets })};\n`);
  fs.writeFileSync(
    path.join(SORTIE, '.htaccess'),
    [
      '# Bibliothèque de voix Alphabette : lisible depuis tous les sous-domaines.',
      '<IfModule mod_headers.c>',
      '  Header always set Access-Control-Allow-Origin "*"',
      '  <FilesMatch "\\.mp3$">',
      '    Header set Cache-Control "public, max-age=31536000, immutable"',
      '  </FilesMatch>',
      '  <FilesMatch "^index\\.(js|json)$">',
      '    Header set Cache-Control "public, max-age=600"',
      '  </FilesMatch>',
      '</IfModule>',
      'AddType audio/mpeg .mp3',
      '',
    ].join('\n'),
  );
  console.log(`Bibliothèque : ${Object.keys(prets).length} enregistrement(s) prêt(s), ${Object.keys(index.entrees).length} texte(s) suivis.`);
}

if (!args.includes('--sans-collecte')) await collecter();
await enregistrerLesNouveaux();
publier();
