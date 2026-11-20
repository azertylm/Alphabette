#!/usr/bin/env node
/**
 * scripts/labo/serveur-statique.mjs — petit serveur de fichiers pour les tests et le contrôle avant publication
 * des applis hébergées. Il applique les en-têtes « Header always set » et les refus « FilesMatch … Require all
 * denied » des .htaccess rencontrés (comme Apache chez OVH), pour tester le bac à sable dans les mêmes conditions.
 *
 *   node scripts/labo/serveur-statique.mjs <dossier> [port=4173] [--spa]
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
  json: 'application/json', map: 'application/json', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', csv: 'text/csv',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
  svg: 'image/svg+xml', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp3: 'audio/mpeg', ogg: 'audio/ogg',
  wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm', webmanifest: 'application/manifest+json', wasm: 'application/wasm',
};

/** Règles utiles d'un .htaccess : en-têtes et motifs refusés. */
function regles(fichier) {
  const texte = readFileSync(fichier, 'utf8');
  const entetes = [...texte.matchAll(/Header always set ([\w-]+) "((?:[^"\\]|\\.)*)"/g)].map((m) => [m[1], m[2].replace(/\\"/g, '"')]);
  const refus = [...texte.matchAll(/<FilesMatch "([^"]+)">\s*Require all denied\s*<\/FilesMatch>/g)].map((m) => new RegExp(m[1].replace(/\\\\/g, '\\')));
  return { entetes, refus };
}

let SPA = false;

export function demarrer(racine, port = 4173, { spa = false } = {}) {
  SPA = spa;
  const base = path.resolve(racine);
  const serveur = createServer((req, res) => {
    let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let fichier = path.join(base, chemin);
    if (!fichier.startsWith(base)) { res.writeHead(403).end(); return; }
    if (existsSync(fichier) && statSync(fichier).isDirectory()) {
      if (!chemin.endsWith('/')) { res.writeHead(301, { Location: chemin + '/' }).end(); return; }
      fichier = path.join(fichier, 'index.html');
    }
    // Pas de PHP ici : on répond comme un service indisponible (jamais le code source).
    if (/\.php$/i.test(chemin)) { res.writeHead(503, { 'Content-Type': 'application/json' }).end('{"erreur":"service indisponible en aperçu"}'); return; }
    const entetes = {};
    for (let d = path.dirname(fichier); d.startsWith(base); d = path.dirname(d)) {
      const h = path.join(d, '.htaccess');
      if (existsSync(h)) {
        const r = regles(h);
        if (r.refus.some((re) => re.test(path.basename(fichier)))) { res.writeHead(403).end('Interdit'); return; }
        for (const [n, v] of r.entetes) if (!(n in entetes)) entetes[n] = v;
      }
      if (d === base) break;
    }
    // API figée du hub : /api/apps → /api/apps.json (comme le .htaccess).
    if (SPA && !existsSync(fichier) && existsSync(fichier.replace(/\/$/, '') + '.json')) fichier = fichier.replace(/\/$/, '') + '.json';
    // --spa : comme le .htaccess du hub, une adresse sans fichier renvoie index.html (pages légales, etc.).
    if ((!existsSync(fichier) || !statSync(fichier).isFile()) && SPA && !path.extname(chemin)) fichier = path.join(base, 'index.html');
    if (!existsSync(fichier) || !statSync(fichier).isFile()) { res.writeHead(404, entetes).end('Introuvable'); return; }
    const ext = path.extname(fichier).slice(1).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store', ...entetes });
    res.end(req.method === 'HEAD' ? undefined : readFileSync(fichier));
  });
  return new Promise((ok) => serveur.listen(port, '127.0.0.1', () => ok(serveur)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dossier = '.', port = '4173'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  await demarrer(dossier, Number(port), { spa: process.argv.includes('--spa') });
  console.error(`Serveur de test : http://127.0.0.1:${port}/ (${dossier})`);
}
