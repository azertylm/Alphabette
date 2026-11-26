/**
 * scripts/labo/referencement-fr.mjs — référencement de la vitrine alphabette.fr (accueil du hub).
 *
 * alphabette.eu a déjà son robots.txt, son sitemap et son contenu lisible sans JavaScript
 * (referencerLaboratoire dans build-static.mjs). Cette fonction fait la même chose pour alphabette.fr :
 *  - robots.txt + sitemap.xml (adresses de alphabette.fr uniquement : un sitemap ne peut pas lister d'autres hôtes) ;
 *  - llms.txt (résumé du site pour les assistants IA, format llmstxt.org) ;
 *  - dans l'accueil : données structurées Schema.org (Organization, WebSite, liste d'applications),
 *    image de partage si elle existe, et un contenu lisible sans JavaScript (<noscript>).
 *
 * Ne touche ni à vitrine/, ni aux applications figées (vitrine.ref), ni au titre / à la description de l'accueil.
 * Appelée après la copie de eu/ : l'accueil du Laboratoire n'est donc pas modifié.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ORIGINE = 'https://alphabette.fr';
const echapper = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nomLisible = (n) => (n === n.toUpperCase() ? n.charAt(0) + n.slice(1).toLowerCase() : n);

/** Adresse d'une application : chemin si elle est sur alphabette.fr, sinon null (autre sous-domaine). */
function cheminSurFr(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') === 'alphabette.fr' ? u.pathname.replace(/\/?$/, '/') : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ sortie: string, vitrine: Array<{name: string, description?: string, url: string}>, pagesFr: string[], jour?: string }} p
 */
export async function referencerVitrine({ sortie, vitrine, pagesFr, jour = new Date().toISOString().slice(0, 10) }) {
  // 1. robots.txt + sitemap.xml
  await writeFile(
    path.join(sortie, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /merci/\n\nSitemap: ${ORIGINE}/sitemap.xml\n`
  );
  const chemins = new Set(['/', ...pagesFr.map((p) => `/${p}/`)]);
  for (const app of vitrine) {
    const c = cheminSurFr(app.url);
    if (c) chemins.add(c);
  }
  const urls = [...chemins];
  await writeFile(
    path.join(sortie, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${echapper(ORIGINE + u)}</loc><lastmod>${jour}</lastmod></url>`).join('\n') +
      `\n</urlset>\n`
  );

  // 1 bis. llms.txt : le même résumé, en Markdown, pour les assistants IA qui lisent le web.
  const listeApps = vitrine.filter((a) => a.name && a.url);
  const pagesTexte = [
    ['manifeste', 'Le manifeste : zéro pub, zéro compte'],
    ['kit-seniors', 'Kit Mairie & Résidence Senior'],
    ['site-vitrine', 'Site vitrine clé en main'],
  ].filter(([p]) => pagesFr.includes(p));
  await writeFile(
    path.join(sortie, 'llms.txt'),
    `# Alphabette\n\n> Alphabette réunit des applications utiles en français : pas de publicité, pas de revente de données, pas de compte quand on peut s'en passer. Éditeur indépendant basé à La Grande-Motte (Hérault). Les nouveautés sont testées en public sur alphabette.eu avant d'arriver sur alphabette.fr.\n\n## Applications\n\n` +
      listeApps.map((a) => `- [${nomLisible(a.name)}](${a.url})${a.description ? `: ${a.description}` : ''}`).join('\n') +
      `\n\n## Pages\n\n` +
      pagesTexte.map(([p, t]) => `- [${t}](${ORIGINE}/${p}/)`).join('\n') +
      `\n\n## Laboratoire\n\n- [alphabette.eu](https://alphabette.eu/): applications à tester en avant-première et à noter.\n`
  );

  // 2. Accueil : données structurées + contenu lisible sans JavaScript
  const index = path.join(sortie, 'index.html');
  let html = await readFile(index, 'utf8');
  const apps = vitrine.filter((a) => a.name && a.url).map((a) => ({ nom: nomLisible(a.name), desc: a.description || '', url: a.url }));

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Alphabette',
      url: `${ORIGINE}/`,
      logo: `${ORIGINE}/presse/alphabette-logo.svg`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Alphabette',
      url: `${ORIGINE}/`,
      inLanguage: 'fr',
      publisher: { '@type': 'Organization', name: 'Alphabette', url: `${ORIGINE}/` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Applications Alphabette',
      itemListElement: apps.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'SoftwareApplication',
          name: a.nom,
          url: a.url,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web, Android, iOS (navigateur)',
          inLanguage: 'fr',
          ...(a.desc ? { description: a.desc.slice(0, 300) } : {}),
        },
      })),
    },
  ];
  const balises = [`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`];
  if (existsSync(path.join(sortie, 'og-image.png'))) {
    if (!/property="og:image"/i.test(html)) balises.push(`<meta property="og:image" content="${ORIGINE}/og-image.png" />`);
    if (!/name="twitter:image"/i.test(html)) balises.push(`<meta name="twitter:image" content="${ORIGINE}/og-image.png" />`);
  }
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '');
  html = html.replace(/<\/head>/i, `  ${balises.join('\n    ')}\n  </head>`);

  const liensPages = [
    ['manifeste', 'Le manifeste : zéro pub, zéro compte'],
    ['kit-seniors', 'Kit Mairie & Résidence Senior'],
    ['site-vitrine', 'Site vitrine clé en main'],
  ].filter(([p]) => pagesFr.includes(p));
  const noscript = `<noscript>
      <h1>Alphabette — applications utiles, sans publicité</h1>
      <p>Alphabette réunit des applications du quotidien en français : débat entre intelligences artificielles, démarches administratives, actualités, annuaire d'outils du web. Pas de publicité, pas de revente de données.</p>
      <ul>
${apps.map((a) => `        <li><a href="${echapper(a.url)}">${echapper(a.nom)}</a>${a.desc ? ` — ${echapper(a.desc)}` : ''}</li>`).join('\n')}
${liensPages.map(([p, t]) => `        <li><a href="/${p}/">${echapper(t)}</a></li>`).join('\n')}
      </ul>
      <p>Les nouveautés à tester en avant-première sont sur <a href="https://alphabette.eu/">alphabette.eu</a>.</p>
    </noscript>`;
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>\s*/gi, '');
  html = html.replace(/<div id="root"><\/div>/i, (m) => `${m}\n    ${noscript}`);
  await writeFile(index, html);
  console.log(`référencement .fr : robots.txt, sitemap (${urls.length} adresses), llms.txt, données structurées, contenu sans JavaScript (${apps.length} applis)`);
}
