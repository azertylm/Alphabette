/**
 * scripts/labo/seo.mjs — pré-rendu statique (SSG léger) des applications « certifiées » sur alphabette.fr.
 *
 * Les applis sont des SPA React/Vite (<div id="root"></div>) : un moteur de recherche ou un aperçu de partage
 * n'y voit rien. À la publication de la vitrine, on écrit dans leur index.html :
 *  - <title>, description, URL canonique, balises Open Graph et Twitter complètes ;
 *  - un bloc JSON-LD Schema.org `SoftwareApplication` avec `aggregateRating` = la VRAIE note acquise sur
 *    alphabette.eu (data/labo/graduation.json, jamais inventée) ;
 *  - dans #root, un contenu lisible (nom, description, note, badge « Certifié par la communauté ») que React
 *    remplace dès le démarrage : la page est utile même avant le JavaScript.
 */

const echapper = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nomLisible = (n) => (n === n.toUpperCase() ? n.charAt(0) + n.slice(1).toLowerCase() : n);

/**
 * @param {string} html            index.html de l'appli (version vitrine)
 * @param {{ name: string, description?: string, url: string, gratuit?: boolean, category?: string, icon?: string }} app
 * @param {{ date: string, moyenne: number, avis: number } | undefined} certification
 */
export function preRendre(html, app, certification) {
  const nom = nomLisible(app.name);
  const description = (app.description || `${nom}, une application Alphabette.`).slice(0, 300);
  const url = app.url.endsWith('/') ? app.url : `${app.url}/`;
  const image = app.cover ? `https://alphabette.fr${app.cover}` : 'https://alphabette.fr/og-image.png';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: nom,
    description,
    url,
    applicationCategory: app.category || 'UtilitiesApplication',
    operatingSystem: 'Web, Android, iOS (navigateur)',
    inLanguage: 'fr',
    isAccessibleForFree: Boolean(app.gratuit),
    publisher: { '@type': 'Organization', name: 'Alphabette', url: 'https://alphabette.fr' },
    offers: app.gratuit
      ? { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      : { '@type': 'Offer', price: '15', priceCurrency: 'EUR', description: '15 € par an, 7 jours d’essai offerts' },
    ...(certification
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: certification.moyenne, ratingCount: certification.avis, bestRating: 5, worstRating: 1 } }
      : {}),
  };
  const meta = [
    `<title>${echapper(nom)} — ${echapper(description.length > 60 ? description.slice(0, 60).replace(/\s+\S*$/, '') + '…' : description)} | Alphabette</title>`,
    `<meta name="description" content="${echapper(description)}">`,
    `<link rel="canonical" href="${echapper(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="fr_FR">`,
    `<meta property="og:site_name" content="Alphabette">`,
    `<meta property="og:title" content="${echapper(nom)}${certification ? ' — Certifié par la communauté' : ''}">`,
    `<meta property="og:description" content="${echapper(description)}">`,
    `<meta property="og:url" content="${echapper(url)}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${echapper(nom)}">`,
    `<meta name="twitter:description" content="${echapper(description)}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
  const note = certification
    ? `<p style="font-size:1.1rem">★ ${String(certification.moyenne).replace('.', ',')}/5 · ${certification.avis} avis sur le Laboratoire Alphabette</p>
      <p style="display:inline-block;padding:.3rem .8rem;border-radius:999px;background:#0f766e;color:#fff;font-weight:800">✓ Certifié par la communauté</p>`
    : '';
  const contenu = `<main style="font:18px/1.5 system-ui,sans-serif;max-width:36rem;margin:12vh auto;padding:0 1.25rem">
      <h1 style="font-size:2rem;margin:0 0 .5rem">${echapper(nom)}</h1>
      <p>${echapper(description)}</p>
      ${note}
      <p style="opacity:.7">Chargement de l'application…</p>
    </main>`;

  let sortie = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+(?:name="(?:description|twitter:[^"]+)"|property="og:[^"]+")[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '');
  sortie = /<\/head>/i.test(sortie) ? sortie.replace(/<\/head>/i, `    ${meta}\n  </head>`) : `${meta}\n${sortie}`;
  // Contenu pré-rendu dans la racine React, si elle est vide (React le remplace au démarrage).
  sortie = sortie.replace(/<div id="root">\s*<\/div>/i, `<div id="root">${contenu}</div>`);
  return sortie;
}
