/**
 * build-static.mjs — fabrique la version statique du hub (dossier dist-static/)
 * pour un hébergement sans Node (OVH Perso : Apache + PHP).
 *
 * Principe : on démarre le vrai serveur (dist/server.cjs) le temps du build,
 * on fige ses réponses publiques (/api/apps, /api/config.json, …) en fichiers
 * JSON, puis un .htaccess les sert aux mêmes adresses. Aucune logique dupliquée.
 * La console /admin (écriture) n'existe pas en statique : le registre se modifie
 * dans data/apps-registry.json, et chaque push republie le site.
 *
 * Usage : bun run build && node scripts/build-static.mjs
 */
import { spawn } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const racine = process.cwd();
const dist = path.join(racine, 'dist');
const sortie = path.join(racine, 'dist-static');
const PORT = 3999;
const base = `http://127.0.0.1:${PORT}`;

/** Réponses publiques à figer : route du serveur → fichier servi par Apache. */
const ROUTES = [
  ['/api/apps', 'api/apps.json'],
  ['/api/config.json', 'api/config.json'],
  ['/api/ai/config', 'api/ai/config.json'],
  ['/api/health', 'api/health.json'],
];

const HTACCESS = `# Généré par scripts/build-static.mjs — ne pas modifier à la main.
Options -Indexes
DirectoryIndex index.html

<IfModule mod_headers.c>
  <FilesMatch "\\.json$">
    Header set Access-Control-Allow-Origin "*"
    Header set Cache-Control "public, max-age=60"
  </FilesMatch>
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On

  # HTTPS partout
  RewriteCond %{HTTPS} !=on
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]

  # Continuité des anciennes adresses
  RewriteRule ^goat(/.*)?$ https://goatchevretheking.alphabette.fr$1 [R=301,L]

  # API publique figée au build
  RewriteRule ^api/apps/?$ api/apps.json [L]
  RewriteRule ^api/ai/config/?$ api/ai/config.json [L]
  RewriteRule ^api/health/?$ api/health.json [L]
  RewriteRule ^api/admin/session/?$ api/admin-session.json [L]

  # Le reste de l'API (écriture, IA, admin) n'existe pas en statique
  RewriteRule ^api/ - [R=404,L]

  # Application monopage : toute autre adresse renvoie index.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>
`;

async function attendreServeur() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Le serveur du hub ne répond pas (dist/server.cjs).');
}

await rm(sortie, { recursive: true, force: true });
await cp(dist, sortie, {
  recursive: true,
  filter: (src) => !path.basename(src).startsWith('server.cjs'),
});

const serveur = spawn(process.execPath, [path.join(dist, 'server.cjs')], {
  cwd: racine,
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
  stdio: 'ignore',
});

try {
  await attendreServeur();
  for (const [route, fichier] of ROUTES) {
    const r = await fetch(base + route);
    if (!r.ok) throw new Error(`${route} → HTTP ${r.status}`);
    const cible = path.join(sortie, fichier);
    await mkdir(path.dirname(cible), { recursive: true });
    await writeFile(cible, JSON.stringify(await r.json(), null, 2) + '\n');
    console.log(`figé  ${route} → ${fichier}`);
  }
} finally {
  serveur.kill();
}

await writeFile(
  path.join(sortie, 'api', 'admin-session.json'),
  JSON.stringify({ authenticated: false, configured: false }) + '\n',
);
await writeFile(path.join(sortie, '.htaccess'), HTACCESS);
console.log(`\nSite statique prêt : ${path.relative(racine, sortie)}/`);
