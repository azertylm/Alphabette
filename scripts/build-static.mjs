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
 * Deux sites dans le même dossier OVH (aiguillés par nom d'hôte dans le .htaccess) :
 *  - racine  → alphabette.fr : la vitrine, uniquement les applications « vitrine » du registre ;
 *  - eu/     → alphabette.eu : le Laboratoire, toutes les applications + avis des visiteurs
 *              (eu/api/feedback.php, voir labo/ et docs/LABO-EU.md).
 * Sur alphabette.fr, les applications du laboratoire redirigent (302) vers alphabette.eu.
 *
 * Usage : bun run build && node scripts/build-static.mjs
 */
import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

/**
 * Domaines propres des applications (data/apps-sources.json → "domains") :
 * rattachés chez OVH au MÊME dossier que alphabette.fr (aucune place de
 * multisite consommée), puis aiguillés ici vers apps/<clé>/ selon le nom d'hôte.
 */
const { apps: sources = {} } = JSON.parse(await readFile(path.join(racine, 'data', 'apps-sources.json'), 'utf8'));
const echapper = (d) => d.replace(/[.]/g, '\\.');
const REGLES_DOMAINES = Object.entries(sources)
  .filter(([, s]) => Array.isArray(s.domains) && s.domains.length)
  .map(([cle, s]) => `  # ${cle} : ${s.domains.join(', ')}
  RewriteCond %{HTTP_HOST} ^(www\\.)?(${s.domains.map(echapper).join('|')})$ [NC]
  RewriteCond %{REQUEST_URI} !^/apps/${cle}/
  RewriteRule ^(.*)$ apps/${cle}/$1 [L]`)
  .join('\n\n');

/**
 * Domaines en simple redirection (data/apps-sources.json → "redirects") :
 * proxilien.eu → https://proxilien.fr. Tant que le domaine est encore rattaché à
 * l'hébergement, la redirection se fait ici ; une fois la redirection posée chez
 * OVH (zone du domaine), il peut être détaché de l'hébergement.
 */
const REGLES_REDIRECTIONS = Object.entries(sources)
  .filter(([, s]) => Array.isArray(s.redirects) && s.redirects.length && Array.isArray(s.domains) && s.domains.length)
  .map(([cle, s]) => `  # ${cle} : ${s.redirects.join(', ')} → ${s.domains[0]}
  RewriteCond %{HTTP_HOST} ^(www\\.)?(${s.redirects.map(echapper).join('|')})$ [NC]
  RewriteRule ^(.*)$ https://${s.domains[0]}/$1 [R=301,L]`)
  .join('\n\n');

const HTACCESS = (labo) => `# Généré par scripts/build-static.mjs — ne pas modifier à la main.
Options -Indexes -MultiViews
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

  # Laboratoire : alphabette.eu est servi depuis le dossier eu/.
  # Chez OVH, une réécriture vers eu/ ne repasse pas par eu/.htaccess quand la cible n'existe pas :
  # les adresses de l'API figée pointent donc directement sur leur fichier.
  RewriteCond %{HTTP_HOST} ^(www\\.)?alphabette\\.eu$ [NC]
  RewriteRule ^api/apps/?$ eu/api/apps.json [L]
  RewriteCond %{HTTP_HOST} ^(www\\.)?alphabette\\.eu$ [NC]
  RewriteRule ^api/ai/config/?$ eu/api/ai/config.json [L]
  RewriteCond %{HTTP_HOST} ^(www\\.)?alphabette\\.eu$ [NC]
  RewriteRule ^api/health/?$ eu/api/health.json [L]
  RewriteCond %{HTTP_HOST} ^(www\\.)?alphabette\\.eu$ [NC]
  RewriteRule ^api/admin/session/?$ eu/api/admin-session.json [L]
  RewriteCond %{HTTP_HOST} ^(www\\.)?alphabette\\.eu$ [NC]
  RewriteRule ^api/donnees-privees - [F,L]
  RewriteCond %{HTTP_HOST} ^(www\\.)?alphabette\\.eu$ [NC]
  RewriteCond %{REQUEST_URI} !^/eu/
  RewriteRule ^(.*)$ eu/$1 [L]

  # Applications en test : leur adresse en .fr renvoie vers le Laboratoire (302 : provisoire)
${labo || '  # (aucune)'}

  # Domaines en redirection vers le domaine principal de leur application
${REGLES_REDIRECTIONS || '  # (aucun)'}

  # Domaines propres des applications (aiguillage par nom d'hôte)
${REGLES_DOMAINES || '  # (aucun)'}

  # Continuité des anciennes adresses
  RewriteRule ^goat(/.*)?$ https://alphabette.eu/apps/goatchevretheking$1 [R=302,L]

  # API publique figée au build
  RewriteRule ^api/apps/?$ api/apps.json [L]
  RewriteRule ^api/ai/config/?$ api/ai/config.json [L]
  RewriteRule ^api/health/?$ api/health.json [L]
  RewriteRule ^api/admin/session/?$ api/admin-session.json [L]

  # Le reste de l'API (écriture, IA, admin) n'existe pas en statique
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule ^api/ - [R=404,L]

  # Applications publiées dans apps/<clé>/ : servies telles quelles
  RewriteRule ^apps/ - [L]

  # Application monopage : toute autre adresse renvoie index.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>
`;

/** .htaccess du Laboratoire (dossier eu/, servi pour alphabette.eu). */
const HTACCESS_EU = `# Généré par scripts/build-static.mjs — ne pas modifier à la main.
Options -Indexes -MultiViews
DirectoryIndex index.html

<IfModule mod_headers.c>
  <FilesMatch "\\.(json|php)$">
    Header set Cache-Control "no-store"
  </FilesMatch>
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /eu/

  # Le dossier eu/ n'est servi que sous le nom alphabette.eu
  RewriteCond %{HTTP_HOST} !^(www\\.)?alphabette\\.eu$ [NC]
  RewriteRule ^(.*)$ https://alphabette.eu/$1 [R=302,L]

  # Données privées éventuelles du service des avis : jamais servies
  RewriteRule ^api/donnees-privees - [F,L]

  # API publique figée au build + service des avis
  RewriteRule ^api/apps/?$ api/apps.json [L]
  RewriteRule ^api/ai/config/?$ api/ai/config.json [L]
  RewriteRule ^api/health/?$ api/health.json [L]
  RewriteRule ^api/admin/session/?$ api/admin-session.json [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule ^api/ - [R=404,L]

  # Applications et fichiers du laboratoire : servis tels quels
  RewriteRule ^(apps|labo)/ - [L]

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
const labo = await preparerLaboratoire();
await writeFile(path.join(sortie, '.htaccess'), HTACCESS(labo));
// Empreinte de la version publiée : la publication vérifie qu'OVH l'a bien mise en ligne.
await writeFile(
  path.join(sortie, 'version.json'),
  JSON.stringify({ sha: process.env.GITHUB_SHA || 'local' }) + '\n',
);
console.log(`\nSite statique prêt : ${path.relative(racine, sortie)}/ (alphabette.fr) et ${path.relative(racine, sortie)}/eu/ (alphabette.eu)`);

/* ============================ Laboratoire .eu ============================ */

/** Clé de publication (apps/<clé>/) d'une application du registre, d'après son adresse. */
function cleDepuisUrl(app) {
  let u;
  try { u = new URL(app.url); } catch { return null; }
  const hote = u.hostname.replace(/^www\./, '');
  if (hote === 'alphabette.fr') return null; // page du hub
  for (const [cle, s] of Object.entries(sources)) {
    if (hote === `${cle}.alphabette.fr` || (s.domains ?? []).includes(hote)) return cle;
  }
  if (app.subdomain && sources[app.subdomain]) return app.subdomain;
  return null;
}

/** Adresse de l'application sur alphabette.eu (relative : le même site). */
function cheminEu(app) {
  const cle = cleDepuisUrl(app);
  if (cle) return `/apps/${cle}/`;
  try {
    const u = new URL(app.url);
    if (u.hostname.replace(/^www\./, '') === 'alphabette.fr') return u.pathname + u.search;
  } catch {}
  return app.url;
}

/** Ajoute le capteur d'erreurs du laboratoire en tête d'une page HTML. */
async function injecterCapteur(fichier) {
  let html;
  try { html = await readFile(fichier, 'utf8'); } catch { return; }
  if (html.includes('/labo/capteur.js')) return;
  const balise = '<script src="/labo/capteur.js"></script>';
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n    ${balise}`) : balise + html;
  await writeFile(fichier, html);
}

async function preparerLaboratoire() {
  const eu = path.join(sortie, 'eu');
  const appsJson = path.join(sortie, 'api', 'apps.json');
  const { apps: actives = [] } = JSON.parse(await readFile(appsJson, 'utf8'));

  // 1. Copie intégrale du hub dans eu/ (avant de réduire la vitrine).
  await rm(eu, { recursive: true, force: true });
  await mkdir(eu, { recursive: true });
  for (const nom of await readdir(sortie)) {
    if (nom === 'eu' || nom === '.htaccess' || nom === 'version.json') continue;
    await cp(path.join(sortie, nom), path.join(eu, nom), { recursive: true });
  }

  // 2. Registre du laboratoire : toutes les applications actives, adresses en .eu.
  const appsEu = actives.map((app) => {
    const cle = cleDepuisUrl(app);
    return { ...app, url: cheminEu(app), ...(cle ? { cle } : {}) };
  });
  await writeFile(path.join(eu, 'api', 'apps.json'), JSON.stringify({ apps: appsEu, labo: true }, null, 2) + '\n');

  // 3. Vitrine .fr : seulement les applications « vitrine ».
  const vitrine = actives.filter((app) => app.vitrine === true);
  await writeFile(appsJson, JSON.stringify({ apps: vitrine }, null, 2) + '\n');
  console.log(`vitrine .fr : ${vitrine.map((a) => a.name).join(', ')}`);
  console.log(`laboratoire .eu : ${appsEu.length} applications`);

  // 4. Pages du hub figées pour la vitrine (vitrine/<page>/ remplace la copie de .fr).
  const dossierVitrine = path.join(racine, 'vitrine');
  try {
    for (const nom of await readdir(dossierVitrine)) {
      await rm(path.join(sortie, nom), { recursive: true, force: true });
      await cp(path.join(dossierVitrine, nom), path.join(sortie, nom), { recursive: true });
      console.log(`vitrine figée : ${nom}/`);
    }
  } catch {}

  // 5. Service des avis, capteur d'erreurs et fichiers des agents.
  await cp(path.join(racine, 'labo', 'serveur', 'feedback.php'), path.join(eu, 'api', 'feedback.php'));
  await mkdir(path.join(eu, 'labo'), { recursive: true });
  await cp(path.join(racine, 'labo', 'serveur', 'capteur.js'), path.join(eu, 'labo', 'capteur.js'));
  await mkdir(path.join(eu, 'api', 'labo'), { recursive: true });
  for (const nom of ['decisions', 'changelog_summary', 'maturity_index', 'beta']) {
    const src = path.join(racine, 'data', 'labo', `${nom}.json`);
    const contenu = await readFile(src, 'utf8').catch(() => '{"apps":{}}\n');
    await writeFile(path.join(eu, 'api', 'labo', `${nom}.json`), contenu);
  }
  await writeFile(path.join(eu, '.htaccess'), HTACCESS_EU);

  // 6. Capteur dans les pages du hub servies sur .eu (wikicom, quiz…), pas dans l'accueil.
  for (const nom of await readdir(eu)) {
    const p = path.join(eu, nom);
    const st = await stat(p);
    if (st.isFile() && nom.endsWith('.html') && nom !== 'index.html') await injecterCapteur(p);
    if (st.isDirectory() && !['api', 'assets', 'apps', 'labo'].includes(nom)) await injecterCapteur(path.join(p, 'index.html'));
  }

  // 7. Règles .htaccess de la vitrine : adresses .fr des applications du laboratoire → .eu.
  const pagesHub = actives
    .filter((app) => !app.vitrine && !cleDepuisUrl(app))
    .map((app) => { try { return new URL(app.url); } catch { return null; } })
    .filter((u) => u && u.hostname.replace(/^www\./, '') === 'alphabette.fr')
    .map((u) => u.pathname.replace(/^\/|\/$/g, '').split('/')[0])
    .filter(Boolean);
  const clesLabo = Object.entries(sources).filter(([, s]) => !s.vitrine).map(([cle]) => cle);
  const domainesLabo = Object.entries(sources)
    .filter(([, s]) => !s.vitrine)
    .flatMap(([cle, s]) => (s.domains ?? []).filter((d) => d.endsWith('.alphabette.fr')).map((d) => [cle, d]));
  const regles = [];
  if (pagesHub.length) {
    regles.push(`  RewriteCond %{HTTP_HOST} ^(www\\.)?alphabette\\.fr$ [NC]
  RewriteRule ^(${[...new Set(pagesHub)].map(echapper).join('|')})(/.*)?$ https://alphabette.eu/$1$2 [R=302,L]`);
  }
  if (clesLabo.length) {
    regles.push(`  RewriteCond %{HTTP_HOST} ^(www\\.)?alphabette\\.fr$ [NC]
  RewriteRule ^apps/(${clesLabo.map(echapper).join('|')})(/.*)?$ https://alphabette.eu/apps/$1$2 [R=302,L]`);
  }
  for (const [cle, d] of domainesLabo) {
    regles.push(`  RewriteCond %{HTTP_HOST} ^(www\\.)?${echapper(d)}$ [NC]
  RewriteRule ^(.*)$ https://alphabette.eu/apps/${cle}/$1 [R=302,L]`);
  }
  return regles.join('\n\n');
}
