/**
 * scripts/labo/atelier/mesures.mjs — mesures prises DANS la page (fonctions envoyées à page.evaluate).
 * Chaque fonction est autonome (aucune variable extérieure) : Playwright la sérialise.
 */

/** Pouce, Opticien, Phare, Parapluie et Plume : tout ce qui se lit dans la page rendue. */
export function mesurerPage() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const style = (e) => getComputedStyle(e);
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = style(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const court = (t, n = 60) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const decrire = (e) => {
    const nom = court(e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || e.getAttribute('placeholder') || '', 40);
    return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList?.[0] ? '.' + e.classList[0] : ''}${nom ? ` « ${nom} »` : ''}`;
  };

  /* ---------------- Pouce : une main, petit écran ---------------- */
  const coupe = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (style(a).overflowX !== 'visible') return true; return false; };
  const deborde = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && style(e).position !== 'fixed' && !coupe(e); };
  const tous = [...document.querySelectorAll('body *')];
  const fautifs = tous.filter(deborde).filter((e) => ![...e.children].some(deborde)).slice(0, 4)
    .map((e) => `${decrire(e)} (${Math.round(e.getBoundingClientRect().right)} px)`);
  const debordement = { exces: Math.max(0, document.documentElement.scrollWidth - vw), fautifs };

  const SELECTEUR = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=checkbox], [role=switch], [role=menuitem]';
  const interactifs = [...document.querySelectorAll(SELECTEUR)].filter(visible);
  const dansPhrase = (e) => {
    if (e.tagName !== 'A' || !e.parentElement) return false;
    const texteParent = court(e.parentElement.textContent, 2000);
    return texteParent.length > court(e.textContent, 2000).length + 15 && /^(P|LI|SPAN|TD|DD|LABEL|SMALL|EM|STRONG)$/.test(e.parentElement.tagName);
  };
  const zone = (e) => {
    let r = e.getBoundingClientRect();
    const lab = e.closest('label') || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`));
    if (lab && visible(lab)) { const l = lab.getBoundingClientRect(); if (l.width * l.height > r.width * r.height) r = l; }
    return r;
  };
  const cibles = interactifs.filter((e) => !dansPhrase(e));
  const petits = cibles.filter((e) => { const r = zone(e); return r.width < 44 || r.height < 44; });
  const rects = cibles.slice(0, 150).map((e) => ({ e, r: zone(e) }));
  let serres = 0;
  const exemplesSerres = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const gx = Math.max(0, Math.max(a.r.left, b.r.left) - Math.min(a.r.right, b.r.right));
      const gy = Math.max(0, Math.max(a.r.top, b.r.top) - Math.min(a.r.bottom, b.r.bottom));
      const voisins = (gx === 0 && gy < 8) || (gy === 0 && gx < 8);
      const chevauche = gx === 0 && gy === 0;
      if (voisins && !chevauche && (Math.min(a.r.width, a.r.height) < 44 || Math.min(b.r.width, b.r.height) < 44)) {
        serres++;
        if (exemplesSerres.length < 3) exemplesSerres.push(`${decrire(a.e)} ↔ ${decrire(b.e)}`);
      }
    }
  }
  const metaVp = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
  const maxEchelle = /maximum-scale\s*=\s*([\d.]+)/i.exec(metaVp);
  const zoomBloque = /user-scalable\s*=\s*(no|0)/i.test(metaVp) || (maxEchelle && Number(maxEchelle[1]) < 2);
  let surfaceFixe = 0;
  for (const e of tous) {
    const p = style(e).position;
    if ((p === 'fixed' || p === 'sticky') && visible(e)) {
      const r = e.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (w * h > vw * vh * 0.9) continue; // fond plein écran (calque d'application), pas un bandeau
      surfaceFixe += w * h;
    }
  }
  // Zone du pouce : l'action principale (premier bouton plein) est-elle dans les 2/3 bas de l'écran ou atteignable ?
  const pouce = {
    debordement, nbInteractifs: cibles.length, nbPetits: petits.length, petits: petits.slice(0, 6).map((e) => {
      const r = zone(e); return `${decrire(e)} (${Math.round(r.width)}×${Math.round(r.height)} px)`;
    }),
    serres, exemplesSerres, viewport: metaVp, zoomBloque: Boolean(zoomBloque), partFixe: Math.round((surfaceFixe / (vw * vh)) * 100),
  };

  /* ---------------- Opticien : lisibilité et accessibilité ---------------- */
  const rgba = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fond = (e) => {
    const couches = [];
    for (let a = e; a; a = a.parentElement) {
      const s = style(a);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null; // image ou dégradé : mesure impossible
      const c = rgba(s.backgroundColor);
      if (c && c[3] > 0) { couches.push(c); if (c[3] >= 1) break; }
    }
    let res = [255, 255, 255];
    for (const c of couches.reverse()) res = res.map((v, i) => v * (1 - c[3]) + c[i] * c[3]);
    return res;
  };
  const avecTexte = tous.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length >= 2) && visible(e)).slice(0, 400);
  let cMesures = 0, cOk = 0; const faibles = []; let petitesPolices = 0; const exemplesPolices = [];
  for (const e of avecTexte) {
    const s = style(e);
    const taille = parseFloat(s.fontSize);
    if (taille < 12) { petitesPolices++; if (exemplesPolices.length < 3) exemplesPolices.push(`${decrire(e)} (${taille} px)`); }
    const c = rgba(s.color); const f = fond(e);
    // Texte en dégradé (background-clip: text) ou transparent : couleur réelle non mesurable.
    if (!c || !f || c[3] < 0.1 || /text/.test(s.backgroundClip || s.webkitBackgroundClip || '')) continue;
    const coul = c.slice(0, 3).map((v, i) => v * c[3] + f[i] * (1 - c[3]));
    const l1 = lum(coul), l2 = lum(f);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const grand = taille >= 24 || (taille >= 18.66 && Number(s.fontWeight) >= 700);
    cMesures++;
    if (ratio >= (grand ? 3 : 4.5)) cOk++;
    else if (faibles.length < 5) faibles.push(`${decrire(e)} (${ratio.toFixed(1)}:1)`);
  }
  const imagesSansAlt = [...document.images].filter((i) => visible(i) && !i.hasAttribute('alt')).map((i) => court(i.getAttribute('src'), 80));
  const nomAccessible = (e) => court(e.textContent) || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title')
    || [...e.querySelectorAll('img[alt]')].some((i) => i.alt.trim()) || [...e.querySelectorAll('svg title')].some((t) => t.textContent.trim())
    || (e.tagName === 'INPUT' && (e.value || e.getAttribute('aria-label')));
  const sansNom = interactifs.filter((e) => /^(BUTTON|A)$/.test(e.tagName) || e.getAttribute('role') === 'button').filter((e) => !nomAccessible(e));
  const champs = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]):not([type=reset]), select, textarea')].filter(visible);
  const sansEtiquette = champs.filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.getAttribute('title'));
  const interrupteurTheme = interactifs.some((e) => /(nuit|sombre|jour|clair|thème|theme|dark|light|☀|🌙|☾)/i.test(`${e.textContent} ${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''}`));
  const opticien = {
    cMesures, cOk, faibles, petitesPolices, exemplesPolices,
    imagesSansAlt: imagesSansAlt.slice(0, 5), nbImagesSansAlt: imagesSansAlt.length,
    sansNom: sansNom.slice(0, 5).map(decrire), nbSansNom: sansNom.length,
    sansEtiquette: sansEtiquette.slice(0, 5).map(decrire), nbSansEtiquette: sansEtiquette.length,
    lang: document.documentElement.getAttribute('lang') || '', interrupteurTheme,
    fondBody: style(document.body).backgroundColor,
  };

  /* ---------------- Phare : référencement et partage ---------------- */
  const meta = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() ?? '';
  const liens = [];
  const vus = new Set();
  for (const a of document.querySelectorAll('a[href]')) {
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = '';
    if (vus.has(u.href)) continue;
    vus.add(u.href);
    liens.push({ url: u.href, interne: u.host === location.host, texte: court(a.textContent, 40) });
    if (liens.length >= 60) break;
  }
  const h1 = [...document.querySelectorAll('h1')].filter(visible);
  const phare = {
    titre: document.title.trim(), description: meta('meta[name="description"]'),
    ogTitre: meta('meta[property="og:title"]'), ogDescription: meta('meta[property="og:description"]'), ogImage: meta('meta[property="og:image"]'),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
    robots: meta('meta[name="robots"]'), nbH1: h1.length, h1: court(h1[0]?.textContent, 80), liens,
  };

  /* ---------------- Parapluie : cadre légal et éthique ---------------- */
  const texte = (document.body?.innerText ?? '').slice(0, 20000);
  const liensLegaux = [...document.querySelectorAll('a[href]')]
    .filter((a) => /(mentions|légal|legal|confidentialit|privacy|cgu|conditions|cookies|rgpd|données personnelles|imprint|impressum)/i.test(`${a.textContent} ${a.getAttribute('href')}`))
    .map((a) => court(a.textContent || a.getAttribute('href'), 40)).slice(0, 6);
  const SENSIBLE = /(s[ée]curit[ée] sociale|n° ?ss\b|nir\b|iban|bic\b|carte bancaire|num[ée]ro de carte|cvv|cryptogramme|date de naissance|passeport|carte d'identit[ée]|mot de passe|password)/i;
  const champsSensibles = champs.filter((e) => SENSIBLE.test(`${e.name} ${e.id} ${e.getAttribute('placeholder') ?? ''} ${e.getAttribute('autocomplete') ?? ''} ${e.labels?.[0]?.textContent ?? ''} ${e.getAttribute('aria-label') ?? ''}`)).map(decrire).slice(0, 4);
  const parapluie = {
    liensLegaux,
    mentionIA: /\b(IA|I\.A\.|intelligence artificielle|ChatGPT|GPT-?\d|Mistral|Gemini|Claude|Llama|DeepSeek|OpenRouter)\b/.test(texte),
    avertissementIA: /(peu(t|vent) (se tromper|faire des erreurs|commettre des erreurs|être inexact)|v[ée]rifie[rz]? (les|toujours|chaque|par vous)|à v[ée]rifier|ne remplace pas|n'est pas un (avis|conseil)|réponses? (générée|produite)s? par (une )?(ia|intelligence))/i.test(texte),
    champsSensibles,
  };

  /* ---------------- Plume : les textes du premier écran ---------------- */
  const boutons = [...new Set(interactifs.filter((e) => /^(BUTTON|A)$/.test(e.tagName) || e.getAttribute('role') === 'button').map((e) => court(e.textContent || e.getAttribute('aria-label'), 50)).filter(Boolean))].slice(0, 20);
  const plume = {
    titre: document.title.trim(), h1: court(h1[0]?.textContent, 120),
    h2: [...document.querySelectorAll('h2')].filter(visible).slice(0, 5).map((e) => court(e.textContent, 100)),
    boutons, debut: court(texte, 700),
  };

  return {
    largeur: vw, hauteur: vh, dom: document.getElementsByTagName('*').length, longueurTexte: texte.trim().length,
    pouce, opticien, phare, parapluie, plume,
  };
}

/** Couleur de fond principale (pour comparer clair / sombre). */
export function fondPrincipal() {
  const cible = document.querySelector('#root > *, #app > *, main, body') || document.body;
  for (let e = cible; e; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
  }
  return 'rgb(255, 255, 255)';
}

/** Élément actif : son indicateur de focus est-il visible ? (appelé après chaque Tab) */
export function focusVisible() {
  const e = document.activeElement;
  if (!e || e === document.body || e === document.documentElement) return null;
  const s = getComputedStyle(e);
  const contour = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
  const ombre = s.boxShadow && s.boxShadow !== 'none';
  const r = e.getBoundingClientRect();
  return { visible: Boolean(contour || ombre), dansEcran: r.bottom > 0 && r.top < window.innerHeight, nom: `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}` };
}
