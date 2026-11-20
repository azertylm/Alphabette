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
import { existsSync } from 'node:fs';
import { preRendre } from './labo/seo.mjs';
import { ficheValide, publierHebergees } from './labo/bac-a-sable.mjs';
import { publierAtelier } from './labo/parrain.mjs';
import { avecSentinelle } from './labo/meteo.mjs';

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

  # Une seule adresse pour le Laboratoire (référencement) : www.alphabette.eu → alphabette.eu
  RewriteCond %{HTTP_HOST} ^www\\.alphabette\\.eu$ [NC]
  RewriteRule ^(.*)$ https://alphabette.eu/$1 [R=301,L]

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

/** Pages propres à la vitrine alphabette.fr (dossier pages-fr/) : jamais publiées sur .eu. */
const PAGES_FR = ['kit-seniors', 'site-vitrine', 'manifeste'];

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

  # Pages de la vitrine : elles n'existent que sur alphabette.fr
  RewriteRule ^(${PAGES_FR.join('|')})(/.*)?$ https://alphabette.fr/$1/ [R=301,L]

  # Applications, fichiers du laboratoire, applis hébergées des créateurs (bac à sable) et rapports de l'atelier : servis tels quels
  RewriteRule ^(apps|labo|createurs|atelier)/ - [L]

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

function echapperHtml(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Référencement d'alphabette.eu : page d'accueil distincte de .fr, robots.txt et sitemap.xml. */
async function referencerLaboratoire(eu, appsEu) {
  const ORIGINE_EU = 'https://alphabette.eu';
  const TITRE_EU = 'Le Laboratoire Alphabette — applications gratuites à tester et à noter';
  const DESCRIPTION_EU =
    "Testez en avant-première les applications d'Alphabette (IA Débat, Info Perso, France Service, jeux et outils du quotidien), " +
    'donnez votre avis en un clic et aidez à les améliorer. Gratuit, sans inscription.';
  const index = path.join(eu, 'index.html');
  let html = await readFile(index, 'utf8');
  const meta = (attr, nom, contenu) => {
    const re = new RegExp(`<meta\\s+${attr}="${nom}"[^>]*>`, 'i');
    const balise = `<meta ${attr}="${nom}" content="${echapperHtml(contenu)}" />`;
    html = re.test(html) ? html.replace(re, balise) : html.replace(/<\/head>/i, `  ${balise}\n  </head>`);
  };
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${echapperHtml(TITRE_EU)}</title>`);
  meta('name', 'description', DESCRIPTION_EU);
  meta('property', 'og:title', TITRE_EU);
  meta('property', 'og:description', DESCRIPTION_EU);
  meta('property', 'og:url', `${ORIGINE_EU}/`);
  meta('property', 'og:site_name', 'Alphabette');
  html = html.replace(/<link\s+rel="canonical"[^>]*>\s*/i, '');
  html = html.replace(/<\/head>/i, `  <link rel="canonical" href="${ORIGINE_EU}/" />\n  </head>`);

  // Applis du Laboratoire (adresses relatives au site) : texte lisible sans JavaScript + sitemap.
  const vus = new Set();
  const liens = appsEu
    .filter((a) => typeof a.url === 'string' && a.url.startsWith('/') && a.name)
    .map((a) => ({ nom: a.name, desc: a.description || '', chemin: a.url.split('?')[0].split('#')[0] }))
    .filter((l) => (vus.has(l.chemin) ? false : vus.add(l.chemin)));
  const noscript = `<noscript>
      <h1>Le Laboratoire Alphabette</h1>
      <p>${echapperHtml(DESCRIPTION_EU)}</p>
      <ul>
${liens.map((l) => `        <li><a href="${echapperHtml(l.chemin)}">${echapperHtml(l.nom)}</a>${l.desc ? ` — ${echapperHtml(l.desc)}` : ''}</li>`).join('\n')}
      </ul>
      <p>Les versions validées sont sur <a href="https://alphabette.fr/">alphabette.fr</a>.</p>
    </noscript>`;
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>\s*/i, '');
  html = html.replace(/<div id="root"><\/div>/i, (m) => `${m}\n    ${noscript}`);
  await writeFile(index, html);

  await writeFile(path.join(eu, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /merci/\nDisallow: /kit-terrain/\nDisallow: /en-direct/\n\nSitemap: ${ORIGINE_EU}/sitemap.xml\n`);
  const jour = new Date().toISOString().slice(0, 10);
  const urls = ['/', ...liens.map((l) => l.chemin), '/embarquement/', '/badge/', '/pass/'];
  await writeFile(
    path.join(eu, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${echapperHtml(ORIGINE_EU + u)}</loc><lastmod>${jour}</lastmod></url>`).join('\n') +
      `\n</urlset>\n`
  );
  console.log(`référencement .eu : titre propre, canonical, robots.txt, sitemap (${urls.length} adresses)`);
}

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
  // Outils du hub propres au Laboratoire (.eu seulement) : ils apparaissent dans la galerie du collectif.
  appsEu.push({
    id: 'crash-testeur', name: 'Le Crash-Testeur', slug: 'crash-testeur', icon: 'Zap', status: 'actif', badge: 'Nouveau',
    url: '/crash-testeur/', gratuit: true, createdAt: '2026-11-19T00:00:00.000Z', updatedAt: '2026-11-20T00:00:00.000Z',
    description: "N'importe quel site testé en 30 secondes : note sur 100 (téléphone, vitesse, accessibilité, sécurité) et les 3 points à corriger en premier.",
  });
  // 2 bis. Collectif : applications de créateurs indépendants validées (data/apps-communaute.json), .eu seulement.
  // Deux cas : l'appli a sa propre adresse https (lien externe), ou elle est hébergée et isolée par Alphabette
  // (« heberge » : dépôt public + commit figé, publiée dans eu/createurs/<id>/ seulement si le Douanier a validé
  // CE commit — atelier/prepublication/<id>.json, branche labo-donnees ; voir docs/labo/ATELIER-QUALITE.md).
  let communaute = [];
  try {
    const { apps = [] } = JSON.parse(await readFile(path.join(racine, 'data', 'apps-communaute.json'), 'utf8'));
    const valides = apps.filter((a) => a && /^c-[a-z0-9-]+$/.test(a.id) && a.name && (a.heberge ? ficheValide(a) : /^https:\/\//.test(a.url ?? '')));
    const hebergees = await publierHebergees(eu, valides.filter((a) => a.heberge), path.join(racine, 'atelier', 'prepublication'));
    communaute = [...valides.filter((a) => !a.heberge), ...hebergees]
      .map((a) => ({
        id: a.id, name: a.name, slug: a.id, icon: 'Sparkles', status: 'actif', badge: a.badge ?? null,
        url: a.url, description: a.description ?? '', createdAt: a.createdAt ?? new Date().toISOString(),
        updatedAt: a.updatedAt ?? a.createdAt ?? new Date().toISOString(), communaute: true,
        createur: a.createur ?? '', categorie: a.categorie ?? '', reseau_autorise: a.reseau_autorise ?? [],
        ...(a.heberge ? { heberge: true, url_app: a.url_app, ref: a.ref } : {}),
      }));
  } catch (err) { console.log(`collectif : ${err.code === 'ENOENT' ? 'aucune appli de la communauté' : err.message}`); }
  await writeFile(path.join(eu, 'api', 'apps.json'), JSON.stringify({ apps: [...appsEu, ...communaute], labo: true }, null, 2) + '\n');
  console.log(`collectif : ${communaute.length} application(s) de la communauté`);

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
      const fiche = vitrine.find((app) => { try { return new URL(app.url).pathname.replace(/^\/|\/$/g, '') === nom; } catch { return false; } });
      const index = path.join(sortie, nom, 'index.html');
      if (fiche?.certifie && (await stat(index).catch(() => null))) {
        await writeFile(index, preRendre(await readFile(index, 'utf8'), fiche, fiche.certifie));
        console.log(`  ✓ pré-rendu SEO de ${nom}/`);
      }
    }
  } catch {}

  // 5. Service des avis, capteur d'erreurs et fichiers des agents.
  await cp(path.join(racine, 'labo', 'serveur', 'feedback.php'), path.join(eu, 'api', 'feedback.php'));
  // Collectif : soutiens et propositions (collectif.php), badge d'entraide et ses deux pages (.eu seulement).
  await cp(path.join(racine, 'labo', 'serveur', 'collectif.php'), path.join(eu, 'api', 'collectif.php'));
  await cp(path.join(racine, 'labo', 'collectif', 'badge.js'), path.join(eu, 'badge.js'));
  for (const [source, dossier] of [['au-hasard.html', 'au-hasard'], ['rejoindre.html', 'rejoindre']]) {
    await mkdir(path.join(eu, dossier), { recursive: true });
    await cp(path.join(racine, 'labo', 'collectif', source), path.join(eu, dossier, 'index.html'));
  }
  // Salle d'embarquement, badge « Passé au Crash-Test », Pass (Découverte 48 h, cadeau, crédits IA Débat) et page « merci »
  // après Stripe (.eu seulement) + leur service api/paiement.php (clé Stripe rangée hors du site). Les Mécènes s'affichent
  // dans le Tableau d'Honneur de l'accueil (.eu).
  await mkdir(path.join(eu, 'labo'), { recursive: true });
  for (const nom of ['pages.css', 'pass.js']) await cp(path.join(racine, 'labo', 'pages', nom), path.join(eu, 'labo', nom));
  // + kit terrain (cartes et flyers à QR codes, interne, noindex) et vue verticale « 21 h 13 en direct ».
  for (const page of ['embarquement', 'badge', 'pass', 'merci', 'kit-terrain', 'en-direct']) {
    await mkdir(path.join(eu, page), { recursive: true });
    await cp(path.join(racine, 'labo', 'pages', `${page}.html`), path.join(eu, page, 'index.html'));
  }
  await cp(path.join(racine, 'labo', 'pages', 'badge'), path.join(eu, 'badge'), { recursive: true });
  await cp(path.join(racine, 'serveur', 'php', 'paiement.php'), path.join(eu, 'api', 'paiement.php'));
  // Le Crash-Testeur (.eu seulement) : la page et son service (clé OpenRouter du relais IA Débat, rien n'est stocké).
  await cp(path.join(racine, 'serveur', 'php', 'crash-test.php'), path.join(eu, 'api', 'crash-test.php'));
  // Audit express (sans IA) : n'importe quel site, note sur 100 ; bulletins publics gardés 90 jours hors du site.
  await cp(path.join(racine, 'serveur', 'php', 'crash-audit.php'), path.join(eu, 'api', 'crash-audit.php'));
  await mkdir(path.join(eu, 'crash-testeur'), { recursive: true });
  await cp(path.join(racine, 'labo', 'crash-testeur', 'index.html'), path.join(eu, 'crash-testeur', 'index.html'));
  await mkdir(path.join(eu, 'labo'), { recursive: true });
  await cp(path.join(racine, 'labo', 'serveur', 'capteur.js'), path.join(eu, 'labo', 'capteur.js'));
  await mkdir(path.join(eu, 'api', 'labo'), { recursive: true });
  for (const nom of ['decisions', 'changelog_summary', 'maturity_index', 'beta', 'notes_version', 'tutos', 'eco_scores',
    // Météo du Labo (bouton Avant / Après, Tableau d'Honneur, modération de la boîte à idées) : docs/labo/METEO-HONNEUR-IDEES.md
    'changelog-labo', 'tableau-honneur', 'idees-statuts']) {
    const src = path.join(racine, 'data', 'labo', `${nom}.json`);
    const contenu = await readFile(src, 'utf8').catch(() => '{"apps":{}}\n');
    await writeFile(path.join(eu, 'api', 'labo', `${nom}.json`), contenu);
  }
  // Météo du Labo : le bloc « sentinelle » est recalculé à chaque publication depuis les vrais retours arrière.
  {
    const lireLabo = async (nom, defaut) => JSON.parse(await readFile(path.join(racine, 'data', 'labo', `${nom}.json`), 'utf8').catch(() => JSON.stringify(defaut)));
    const statut = avecSentinelle(await lireLabo('status-labo', {}), (await lireLabo('incidents', { incidents: [] })).incidents);
    await writeFile(path.join(eu, 'api', 'labo', 'status-labo.json'), JSON.stringify(statut, null, 2) + '\n');
  }
  await writeFile(path.join(eu, '.htaccess'), HTACCESS_EU);
  // Notes de version « citoyennes » : aussi pour la vitrine .fr.
  await mkdir(path.join(sortie, 'api', 'labo'), { recursive: true });
  await writeFile(path.join(sortie, 'api', 'labo', 'notes_version.json'), await readFile(path.join(racine, 'data', 'labo', 'notes_version.json'), 'utf8').catch(() => '{"apps":{}}\n'));
  // Sentinelle post-transfert (.fr) : sonde, service, et liste des versions surveillées.
  await mkdir(path.join(sortie, 'labo'), { recursive: true });
  await cp(path.join(racine, 'labo', 'serveur', 'sentinelle.js'), path.join(sortie, 'labo', 'sentinelle.js'));
  await cp(path.join(racine, 'labo', 'serveur', 'sentinelle.php'), path.join(sortie, 'api', 'sentinelle.php'));
  // IA Débat — Mode Découverte : relais OpenRouter avec la clé d'Alphabette rangée hors du site (.fr et .eu).
  for (const cible of [path.join(sortie, 'api'), path.join(eu, 'api')]) {
    await cp(path.join(racine, 'serveur', 'php', 'iadebat-proxy.php'), path.join(cible, 'iadebat-proxy.php'));
    // Réglages publics des Pass et crédits (aucune clé) : lus par le relais et par paiement.php.
    await cp(path.join(racine, 'data', 'paiements.json'), path.join(cible, 'paiements.json'));
  }
  {
    const sources = JSON.parse(await readFile(path.join(racine, 'data', 'apps-sources.json'), 'utf8'));
    const versions = Object.fromEntries(Object.entries(sources.apps ?? {}).filter(([, s]) => s.vitrine?.ref).map(([c, s]) => [c, s.vitrine.ref]));
    await writeFile(path.join(sortie, 'api', 'sentinelle-versions.json'), JSON.stringify(versions, null, 2) + '\n');
  }
  // Certificats d'Audit Réseau signés (workflow audit-reseau.yml, branche labo-donnees) : sur .fr et .eu.
  const certs = path.join(racine, 'certificats');
  if (existsSync(certs)) {
    for (const cible of [path.join(sortie, 'certificats'), path.join(eu, 'certificats')]) await cp(certs, cible, { recursive: true });
  }
  // Micro-tutos et éco-scores sur .fr : seulement ceux validés pour la vitrine (ordre de Valentin).
  for (const nom of ['tutos', 'eco_scores']) {
    const d = JSON.parse(await readFile(path.join(racine, 'data', 'labo', `${nom}.json`), 'utf8').catch(() => '{"apps":{}}'));
    const apps = Object.fromEntries(Object.entries(d.apps ?? {}).filter(([, v]) => v && v.vitrine === true));
    await writeFile(path.join(sortie, 'api', 'labo', `${nom}.json`), JSON.stringify({ apps }, null, 2) + '\n');
  }

  // 6. Capteur dans les pages du hub servies sur .eu (wikicom, quiz…), pas dans l'accueil.
  for (const nom of await readdir(eu)) {
    const p = path.join(eu, nom);
    const st = await stat(p);
    if (st.isFile() && nom.endsWith('.html') && nom !== 'index.html') await injecterCapteur(p);
    if (st.isDirectory() && !['api', 'assets', 'apps', 'labo', 'createurs', 'atelier', 'merci'].includes(nom)) await injecterCapteur(path.join(p, 'index.html'));
  }

  // 6 bis. Référencement du Laboratoire : titre et description propres (sinon Google le prend pour
  // une copie d'alphabette.fr), adresse canonique, contenu lisible sans JavaScript, robots.txt, sitemap.
  // Les applis du collectif hébergées par Alphabette (/createurs/<id>/) y figurent aussi.
  await referencerLaboratoire(eu, [...appsEu, ...communaute.filter((a) => a.heberge)]);

  // 6 ter bis. Podcast du Labo : épisodes de la semaine (branche labo-donnees, podcast/episodes.json) → api/labo/podcast-labo.json.
  // Sans épisode encore, le fichier n'existe pas et la page Podcasts n'affiche rien de plus.
  try {
    const episodes = JSON.parse(await readFile(path.join(racine, 'podcast', 'episodes.json'), 'utf8'));
    if (Array.isArray(episodes.episodes) && episodes.episodes.length) {
      await mkdir(path.join(eu, 'api', 'labo'), { recursive: true });
      await writeFile(path.join(eu, 'api', 'labo', 'podcast-labo.json'), JSON.stringify({ episodes: episodes.episodes }) + '\n');
    }
  } catch { /* pas encore d'épisode */ }

  // 6 ter. Atelier qualité : rapports du Parrain (/atelier/), notes et badges « Testé au Labo » (api/labo/atelier.json).
  await publierAtelier(eu, path.join(racine, 'atelier'));

  // 6 quater. Pages de la vitrine (alphabette.fr SEULEMENT, jamais copiées dans eu/) : Kit Mairie & Résidence Senior,
  // offre Site vitrine 390 €, manifeste. Sur .eu, ces adresses renvoient vers .fr (.htaccess du laboratoire).
  // Feuille de style commune et générateur de QR codes local (public/assets/qrcode.js, licence MIT).
  await cp(path.join(racine, 'labo', 'pages', 'pages.css'), path.join(sortie, 'assets', 'pages.css'));
  for (const page of PAGES_FR) {
    await mkdir(path.join(sortie, page), { recursive: true });
    await cp(path.join(racine, 'pages-fr', `${page}.html`), path.join(sortie, page, 'index.html'));
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
