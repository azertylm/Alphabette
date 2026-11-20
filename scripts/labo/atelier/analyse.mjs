/**
 * scripts/labo/atelier/analyse.mjs — notes sur 100 et problèmes (en français simple) de l'Atelier qualité.
 * Fonctions pures : elles ne lisent que les mesures (testables sans navigateur).
 *
 * Gravités : « bloquant » (empêche la publication ou le badge), « important » (à corriger vite),
 * « conseil » (amélioration). Chaque problème porte une correction et un prompt prêt à coller
 * dans l'IA du créateur (le rapport du Parrain les affiche).
 */
import { ecoIndex } from '../sobriete.mjs';
import { FOURNISSEURS_IA, POLICES_EXTERNES, dansListe, estAlphabette } from './listes.mjs';

export const AGENTS = {
  douanier: { nom: 'Le Douanier', role: 'sécurité : traceurs, secrets, appels non déclarés' },
  pouce: { nom: 'Le Pouce', role: 'téléphone tenu à une main' },
  opticien: { nom: "L'Opticien", role: 'lisibilité et accessibilité' },
  poids_plume: { nom: 'Le Poids Plume', role: 'vitesse et poids' },
  phare: { nom: 'Le Phare', role: 'référencement et partage' },
  parapluie: { nom: 'Le Parapluie', role: 'cadre légal et éthique' },
  temoin: { nom: 'Le Témoin', role: 'écran, stabilité, changements visuels' },
};

/** Page blanche : écran uni (≥ 99,5 % d'une couleur), ou presque uni sans texte, ou DOM vide. */
export function estBlanche(m) {
  const d = m.temoin?.dominante ?? 0;
  const texte = m.page?.longueurTexte ?? 0;
  return d >= 0.995 || (d >= 0.97 && texte < 40) || (m.page ? texte < 3 && m.page.dom < 15 : false);
}

const borne = (n) => Math.max(0, Math.min(100, Math.round(n)));
const ko = (o) => Math.round((o ?? 0) / 1024);

/** Score d'un agent « à verdict » : on part de 100 et chaque problème retire des points. */
const parGravite = (liste) => borne(100 - 50 * liste.filter((p) => p.gravite === 'bloquant').length
  - 15 * liste.filter((p) => p.gravite === 'important').length - 4 * liste.filter((p) => p.gravite === 'conseil').length);

export function analyser(m) {
  const { cible } = m;
  const nom = cible.nom || cible.id;
  const problemes = [];
  const ajouter = (agent, gravite, titre, detail, correction) => {
    problemes.push({
      agent, gravite, titre, detail: detail || '', correction,
      prompt: `Mon application web « ${nom} » a ce problème, relevé par un contrôle automatique : ${titre}${detail ? ` (${detail})` : ''}. ${correction} Fais le plus petit changement possible et ne modifie rien d'autre.`,
    });
  };
  const p = m.page;
  const reseau = m.reseau ?? { requetes: [] };
  const hoteApp = (() => { try { return new URL(cible.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const autorises = [...FOURNISSEURS_IA, ...(cible.reseau_autorise ?? [])];
  const tiers = [...new Set(reseau.requetes.map((r) => r.hote).filter((h) => h && h !== hoteApp && !estAlphabette(h) && h !== 'localhost' && h !== '127.0.0.1'))];
  const nonDeclares = tiers.filter((h) => !dansListe(h, autorises) && !dansListe(h, POLICES_EXTERNES) && !(m.traceurs ?? []).some((t) => t.hote === h));
  const polices = tiers.filter((h) => dansListe(h, POLICES_EXTERNES));
  const utiliseIA = tiers.some((h) => dansListe(h, FOURNISSEURS_IA)) || reseau.requetes.some((r) => /iadebat-proxy|crash-test\.php/.test(r.url));

  /* ---------------- Le Témoin : l'application s'ouvre-t-elle ? ---------------- */
  if (!m.chargement?.ok) {
    ajouter('temoin', 'bloquant', "L'application ne s'ouvre pas", m.chargement?.erreur || `réponse HTTP ${m.chargement?.statut ?? '?'}`,
      "Vérifie que l'adresse publiée répond bien (code 200) et que la page d'accueil s'affiche sans connexion préalable.");
  } else if (estBlanche(m)) {
    ajouter('temoin', 'bloquant', 'Page blanche au démarrage', "l'écran reste vide après le chargement",
      "Trouve l'erreur qui empêche l'affichage (console du navigateur) et corrige-la ; affiche au moins un message si une donnée manque.");
  }
  const erreurs = m.erreurs ?? [];
  if (erreurs.length) {
    ajouter('temoin', 'important', `${erreurs.length} erreur${erreurs.length > 1 ? 's' : ''} JavaScript au chargement`, erreurs.slice(0, 2).join(' · '),
      'Corrige ces erreurs (elles apparaissent dans la console du navigateur) pour que rien ne casse chez les visiteurs.');
  }
  if (typeof m.temoin?.changement === 'number' && m.temoin.changement > 60 && !estBlanche(m)) {
    ajouter('temoin', 'conseil', "L'écran d'accueil a beaucoup changé depuis le dernier contrôle", `${m.temoin.changement} % de l'image différente`,
      "Si ce changement n'est pas voulu, reviens à la version précédente de la page d'accueil.");
  }

  /* ---------------- Le Douanier : sécurité et réputation ---------------- */
  for (const t of m.traceurs ?? []) {
    ajouter('douanier', 'bloquant', 'Traceur publicitaire ou de mesure d\'audience', t.hote,
      `Retire le script de ${t.hote} : le collectif refuse les traceurs (charte, point 3). Si tu as besoin de statistiques, utilise une mesure sans cookie hébergée chez toi.`);
  }
  for (const s of m.mineurs ?? []) {
    ajouter('douanier', 'bloquant', 'Code de minage de cryptomonnaie', s, 'Retire ce code : il utilise le processeur des visiteurs à leur insu.');
  }
  for (const s of (m.secrets ?? []).filter((x) => !x.publique)) {
    ajouter('douanier', 'bloquant', `Secret visible dans le code publié (${s.nom})`, `${s.fichier} : ${s.extrait}`,
      "Supprime cette clé du code, révoque-la tout de suite chez le fournisseur et crée-en une nouvelle ; une clé ne doit jamais être dans le code envoyé au navigateur (demande-la au visiteur ou passe par un serveur).");
  }
  for (const s of (m.secrets ?? []).filter((x) => x.publique)) {
    ajouter('douanier', 'conseil', `Clé publique à restreindre (${s.nom})`, s.fichier,
      'Cette clé est faite pour être visible, mais limite-la à ton nom de domaine dans la console du fournisseur (restrictions HTTP referrer).');
  }
  if (nonDeclares.length) {
    ajouter('douanier', cible.communaute ? 'important' : 'conseil', `Appels vers ${nonDeclares.length} service${nonDeclares.length > 1 ? 's' : ''} tiers non déclaré${nonDeclares.length > 1 ? 's' : ''}`,
      nonDeclares.slice(0, 6).join(', '),
      "Déclare ces services (à quoi ils servent) ou retire-les : un visiteur doit savoir à qui son navigateur parle.");
  }
  const http = reseau.requetes.filter((r) => /^http:\/\//.test(r.url) && !/^http:\/\/(127\.0\.0\.1|localhost)/.test(r.url));
  if (http.length) {
    ajouter('douanier', 'important', 'Ressources chargées sans chiffrement (http://)', http.slice(0, 3).map((r) => r.url).join(', '),
      'Remplace « http:// » par « https:// » pour chaque ressource.');
  }
  for (const s of m.statique ?? []) ajouter(s.agent ?? 'douanier', s.gravite, s.titre, s.detail, s.correction);

  /* ---------------- Le Pouce : téléphone, une main ---------------- */
  if (p) {
    const po = p.pouce;
    if (po.debordement.exces > 1) {
      ajouter('pouce', 'important', `La page dépasse de l'écran sur téléphone (${po.debordement.exces} px de trop)`, po.debordement.fautifs.join(' ; '),
        "Empêche ces éléments de dépasser : max-width: 100 %, images en width: 100 %, grilles en minmax(0, 1fr), et retours à la ligne pour les textes longs (overflow-wrap: anywhere).");
    }
    if (po.nbPetits) {
      ajouter('pouce', po.nbPetits >= 3 ? 'important' : 'conseil', `${po.nbPetits} zone${po.nbPetits > 1 ? 's' : ''} à toucher trop petite${po.nbPetits > 1 ? 's' : ''} (moins de 44 px)`, po.petits.join(' ; '),
        'Agrandis ces boutons et liens à au moins 44 × 44 px (min-height et min-width: 44px, ou plus de marge intérieure).');
    }
    if (po.serres >= 2) {
      ajouter('pouce', 'conseil', `${po.serres} boutons trop serrés (moins de 8 px d'écart)`, po.exemplesSerres.join(' ; '),
        "Ajoute au moins 8 px d'espace entre ces boutons pour éviter de toucher le mauvais.");
    }
    if (po.zoomBloque) {
      ajouter('pouce', 'important', 'Le zoom est bloqué', po.viewport,
        'Dans la balise <meta name="viewport">, retire « user-scalable=no » et « maximum-scale » : les personnes qui voient mal doivent pouvoir zoomer.');
    }
    if (!/width\s*=\s*device-width/i.test(po.viewport)) {
      ajouter('pouce', 'important', 'Page non adaptée au téléphone (balise viewport absente)', '',
        'Ajoute dans <head> : <meta name="viewport" content="width=device-width, initial-scale=1">.');
    }
    if (po.partFixe > 35) {
      ajouter('pouce', 'conseil', `Les bandeaux fixes cachent ${po.partFixe} % de l'écran`, '',
        "Réduis les barres fixes ou masque-les quand on fait défiler la page, pour laisser la place au contenu.");
    }
  }

  /* ---------------- L'Opticien : lisibilité ---------------- */
  let pContraste = 1;
  if (p) {
    const o = p.opticien;
    pContraste = o.cMesures ? o.cOk / o.cMesures : 1;
    if (pContraste < 0.9) {
      ajouter('opticien', pContraste < 0.75 ? 'important' : 'conseil', `Textes peu contrastés (${Math.round((1 - pContraste) * 100)} % des textes)`, o.faibles.join(' ; '),
        'Fonce le texte ou éclaircis le fond : au moins 4,5:1 pour le texte courant et 3:1 pour les grands titres (règle WCAG AA).');
    }
    if (o.petitesPolices) {
      ajouter('opticien', o.petitesPolices >= 5 ? 'important' : 'conseil', `${o.petitesPolices} texte${o.petitesPolices > 1 ? 's' : ''} plus petit${o.petitesPolices > 1 ? 's' : ''} que 12 px`, o.exemplesPolices.join(' ; '),
        'Passe ces textes à 14 px au moins (16 px pour le texte courant).');
    }
    if (o.nbImagesSansAlt) {
      ajouter('opticien', 'conseil', `${o.nbImagesSansAlt} image${o.nbImagesSansAlt > 1 ? 's' : ''} sans texte de remplacement`, o.imagesSansAlt.join(', '),
        'Ajoute un attribut alt qui décrit chaque image (alt="" si elle est seulement décorative).');
    }
    if (o.nbSansNom) {
      ajouter('opticien', 'important', `${o.nbSansNom} bouton${o.nbSansNom > 1 ? 's' : ''} sans nom lisible`, o.sansNom.join(' ; '),
        'Donne un nom à chaque bouton-icône (aria-label="…") : un lecteur d\'écran doit pouvoir l\'annoncer.');
    }
    if (o.nbSansEtiquette) {
      ajouter('opticien', o.nbSansEtiquette >= 3 ? 'important' : 'conseil', `${o.nbSansEtiquette} champ${o.nbSansEtiquette > 1 ? 's' : ''} de saisie sans étiquette`, o.sansEtiquette.join(' ; '),
        'Ajoute une étiquette <label> (ou aria-label) à chaque champ ; un texte gris dans le champ ne suffit pas.');
    }
    if (!o.lang) ajouter('opticien', 'conseil', 'Langue de la page non indiquée', '', 'Ajoute lang="fr" sur la balise <html>.');
    if (m.focus?.atteints >= 3 && m.focus.visibles / m.focus.atteints < 0.5) {
      ajouter('opticien', 'important', 'On ne voit pas où l\'on est au clavier', `${m.focus.visibles}/${m.focus.atteints} éléments montrent un contour`,
        'Ne retire pas le contour de focus (outline: none) ; ajoute par exemple :focus-visible { outline: 3px solid currentColor; outline-offset: 2px }.');
    }
    if (m.sombre && !m.sombre.change && !o.interrupteurTheme) {
      ajouter('opticien', 'conseil', 'Pas de mode sombre', '', 'Propose un thème sombre (prefers-color-scheme: dark ou un bouton Jour / Nuit) : il repose les yeux le soir.');
    }
  }
  const ratioFocus = m.focus?.atteints >= 3 ? m.focus.visibles / m.focus.atteints : 1;

  /* ---------------- Le Poids Plume : vitesse ---------------- */
  const totalKo = ko(reseau.requetes.reduce((s, r) => s + (r.taille || 0), 0));
  const jsKo = ko(reseau.requetes.filter((r) => r.type === 'script').reduce((s, r) => s + (r.taille || 0), 0));
  const lourdes = reseau.requetes.filter((r) => r.type === 'image' && r.taille > 300 * 1024);
  const nonCompresses = reseau.requetes.filter((r) => ['script', 'stylesheet', 'document', 'fetch', 'xhr'].includes(r.type) && r.taille > 50 * 1024 && !r.encodage && !/^(application\/(octet-stream|wasm)|image|font)/.test(r.mime || ''));
  const eco = ecoIndex(p?.dom ?? 0, reseau.requetes.length, totalKo);
  const duree = m.chargement?.duree ?? null;
  if (m.chargement?.ok) {
    if (totalKo > 2048) ajouter('poids_plume', 'important', `Page très lourde (${(totalKo / 1024).toFixed(1)} Mo au chargement)`, '', "Allège la page d'accueil : images compressées (WebP, 1 200 px de large au plus), bibliothèques inutiles retirées, chargement différé du reste.");
    else if (totalKo > 1024) ajouter('poids_plume', 'conseil', `Page lourde (${(totalKo / 1024).toFixed(1)} Mo au chargement)`, '', "Vise moins de 1 Mo pour l'écran d'accueil : compresse les images et charge le reste plus tard.");
    if (lourdes.length) ajouter('poids_plume', lourdes.some((r) => r.taille > 1024 * 1024) ? 'important' : 'conseil', `${lourdes.length} image${lourdes.length > 1 ? 's' : ''} de plus de 300 Ko`, lourdes.slice(0, 3).map((r) => `${r.url.split('/').pop().split('?')[0]} (${ko(r.taille)} Ko)`).join(', '), 'Recompresse ces images (WebP ou AVIF, largeur adaptée à l\'écran).');
    if (jsKo > 1024) ajouter('poids_plume', 'conseil', `Beaucoup de JavaScript (${jsKo} Ko)`, '', 'Retire les bibliothèques inutilisées et découpe le code (chargement à la demande).');
    if (polices.length) ajouter('poids_plume', 'conseil', 'Polices chargées depuis un service externe', polices.join(', '), 'Héberge les polices avec l\'application (fichiers .woff2) : plus rapide, et aucune adresse IP envoyée à un tiers.');
    if (duree !== null && duree > 6000) ajouter('poids_plume', 'important', `Chargement lent (${(duree / 1000).toFixed(1)} s)`, '', "Affiche l'essentiel tout de suite : moins de scripts au démarrage, images différées (loading=\"lazy\").");
    if (nonCompresses.length) ajouter('poids_plume', 'conseil', 'Fichiers texte envoyés sans compression', nonCompresses.slice(0, 3).map((r) => r.url.split('/').pop().split('?')[0]).join(', '), "Active la compression gzip ou brotli chez l'hébergeur.");
  }

  /* ---------------- Le Phare : référencement ---------------- */
  const morts = m.liensMorts ?? [];
  const phare = !p ? null : cible.heberge ? { ...p.phare, titre: p.phare.titre || nom, description: 'fournie par le cadre du Collectif Alphabette (description de la fiche)', ogTitre: 'cadre', ogDescription: 'cadre', ogImage: 'cadre', canonical: 'cadre' } : p.phare;
  if (p) {
    const ph = phare;
    if (!ph.titre) ajouter('phare', 'important', 'Pas de titre de page', '', 'Ajoute une balise <title> de 10 à 65 caractères qui dit ce que fait l\'application.');
    else if (ph.titre.length < 10 || ph.titre.length > 65) ajouter('phare', 'conseil', `Titre de page ${ph.titre.length < 10 ? 'trop court' : 'trop long'} (${ph.titre.length} caractères)`, ph.titre, 'Vise un titre de 10 à 65 caractères.');
    if (!ph.description) ajouter('phare', 'important', 'Pas de description pour Google', '', 'Ajoute <meta name="description" content="…"> : une phrase de 50 à 160 caractères.');
    else if (ph.description.length < 50 || ph.description.length > 160) ajouter('phare', 'conseil', `Description ${ph.description.length < 50 ? 'trop courte' : 'trop longue'} (${ph.description.length} caractères)`, '', 'Vise 50 à 160 caractères.');
    const og = [!ph.ogTitre && 'og:title', !ph.ogDescription && 'og:description', !ph.ogImage && 'og:image'].filter(Boolean);
    if (og.length) ajouter('phare', 'conseil', 'Aperçu de partage incomplet', `manque ${og.join(', ')}`, 'Ajoute les balises Open Graph (og:title, og:description, og:image de 1200×630) pour un bel aperçu sur les réseaux et messageries.');
    if (!ph.nbH1) ajouter('phare', 'conseil', 'Pas de grand titre (h1) visible', '', "Mets le nom ou l'action principale dans une balise <h1>.");
    if (/noindex/i.test(ph.robots)) ajouter('phare', 'important', 'Page cachée aux moteurs de recherche (noindex)', ph.robots, 'Retire « noindex » de la balise meta robots si tu veux être trouvé.');
    if (morts.length) ajouter('phare', morts.length >= 3 ? 'important' : 'conseil', `${morts.length} lien${morts.length > 1 ? 's' : ''} mort${morts.length > 1 ? 's' : ''}`, morts.slice(0, 4).map((l) => `${l.url} (${l.statut})`).join(', '), 'Corrige ou retire ces liens.');
  }

  /* ---------------- Le Parapluie : cadre légal ---------------- */
  if (p) {
    const pa = p.parapluie;
    if ((m.cookiesTiers ?? []).length) {
      ajouter('parapluie', 'important', 'Cookies de tiers déposés dès l\'ouverture', m.cookiesTiers.join(', '),
        "Ne dépose aucun cookie tiers sans l'accord du visiteur (RGPD) : retire le service ou ajoute un vrai choix « Accepter / Refuser » avant tout dépôt.");
    }
    if (polices.some((h) => /google/.test(h))) {
      ajouter('parapluie', 'conseil', "Google Fonts reçoit l'adresse IP des visiteurs", '', 'Héberge la police avec ton application : les autorités européennes considèrent ce transfert comme une donnée personnelle.');
    }
    if (!cible.heberge && !pa.liensLegaux.length) {
      ajouter('parapluie', cible.communaute ? 'important' : 'conseil', 'Aucun lien vers les mentions légales ni la confidentialité', '',
        "Ajoute en bas de page un lien « Mentions légales » (qui édite l'application, comment te contacter) et « Confidentialité » (quelles données, où elles vont).");
    }
    if ((utiliseIA || pa.mentionIA) && !pa.avertissementIA) {
      ajouter('parapluie', utiliseIA ? 'important' : 'conseil', "Pas d'avertissement sur les réponses de l'IA", '',
        "Ajoute près des réponses : « Réponses générées par une IA : elles peuvent contenir des erreurs, vérifiez les informations importantes. »");
    }
    if (pa.champsSensibles.length) {
      ajouter('parapluie', 'conseil', 'Données sensibles demandées', pa.champsSensibles.join(' ; '),
        "Ne demande ces informations que si elles sont indispensables, explique pourquoi et où elles vont, et ne les garde pas plus que nécessaire.");
    }
  }

  /* ---------------- Notes ---------------- */
  const de = (agent) => problemes.filter((x) => x.agent === agent);
  const po = p?.pouce;
  const o = p?.opticien;
  const scores = {
    douanier: parGravite(de('douanier')),
    pouce: p ? borne(100 - (po.debordement.exces > 1 ? 40 : 0) - Math.min(30, 3 * po.nbPetits) - Math.min(10, 2 * po.serres)
      - (po.zoomBloque ? 15 : 0) - (/width\s*=\s*device-width/i.test(po.viewport) ? 0 : 15) - (po.partFixe > 35 ? 10 : 0)) : 0,
    opticien: p ? borne(40 * pContraste + 60 - Math.min(10, o.petitesPolices) - Math.min(10, 2 * o.nbImagesSansAlt) - Math.min(15, 3 * o.nbSansNom)
      - Math.min(10, 3 * o.nbSansEtiquette) - (o.lang ? 0 : 5) - Math.round((1 - ratioFocus) * 10)
      - (m.sombre && !m.sombre.change && !o.interrupteurTheme ? 5 : 0)) : 0,
    poids_plume: m.chargement?.ok ? borne(0.4 * eco.score + (totalKo <= 1024 ? 20 : totalKo <= 2048 ? 10 : 0) + (jsKo <= 500 ? 10 : jsKo <= 1024 ? 5 : 0)
      + (duree === null || duree <= 3000 ? 15 : duree <= 6000 ? 7 : 0) + (polices.length ? 0 : 5) + (lourdes.length ? 0 : 5) + (nonCompresses.length ? 0 : 5)) : 0,
    phare: p ? borne(15 + (phare.titre ? (cible.heberge || (phare.titre.length >= 10 && phare.titre.length <= 65) ? 15 : 8) : 0)
      + (phare.description ? (cible.heberge || (phare.description.length >= 50 && phare.description.length <= 160) ? 15 : 8) : 0)
      + (phare.ogTitre ? 5 : 0) + (phare.ogDescription ? 5 : 0) + (phare.ogImage ? 5 : 0) + (phare.nbH1 ? 10 : 0)
      + (p.opticien.lang ? 5 : 0) + (phare.canonical ? 5 : 0) + Math.max(0, 20 - 5 * morts.length) - (/noindex/i.test(phare.robots) ? 20 : 0)) : 0,
    parapluie: parGravite(de('parapluie')),
  };
  // Une appli qui ne s'ouvre pas ou reste blanche n'a rien à noter côté écran.
  if (!m.chargement?.ok || estBlanche(m)) for (const k of ['pouce', 'opticien', 'poids_plume', 'phare']) scores[k] = 0;
  const controle = borne((scores.pouce + scores.opticien + scores.poids_plume) / 3);
  const note = borne(Object.values(scores).reduce((s, v) => s + v, 0) / Object.keys(scores).length);
  const bloquants = problemes.filter((x) => x.gravite === 'bloquant');
  const apte = m.chargement?.ok === true && !bloquants.length && !erreurs.length
    && !problemes.some((x) => ['douanier', 'parapluie'].includes(x.agent) && x.gravite === 'important')
    && controle >= 85 && Math.min(scores.pouce, scores.opticien, scores.poids_plume) >= 75;

  const ordre = { bloquant: 0, important: 1, conseil: 2 };
  problemes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
  return {
    id: cible.id, nom, url: cible.url, ...(cible.url_app ? { url_app: cible.url_app } : {}),
    communaute: Boolean(cible.communaute), heberge: Boolean(cible.heberge), ...(cible.ref ? { ref: cible.ref } : {}),
    date: m.date ?? new Date().toISOString(),
    scores, controle_technique: controle, note, apte,
    compte: { bloquant: bloquants.length, important: problemes.filter((x) => x.gravite === 'important').length, conseil: problemes.filter((x) => x.gravite === 'conseil').length },
    problemes,
    mesures: {
      poids_ko: totalKo, js_ko: jsKo, requetes: reseau.requetes.length, dom: p?.dom ?? null, ecoindex: eco.score, chargement_ms: duree,
      tiers, traceurs: (m.traceurs ?? []).map((t) => t.hote), contraste_ok_pct: Math.round(pContraste * 100),
    },
    plume: p?.plume ?? null,
    temoin: m.temoin ? { capture: m.temoin.capture ?? null, changement: m.temoin.changement ?? null, blanc: estBlanche(m) } : null,
  };
}

/**
 * Badge « Testé au Labo » (Le Jury) : le dernier contrôle est apte ET au moins 3 contrôles aptes
 * sur les 7 derniers jours (stabilité). `historique` : rapports d'index par jour, du plus ancien au plus récent.
 */
export function jury(historique, maintenant = Date.now()) {
  const depuis = maintenant - 7 * 86400000;
  const parApp = {};
  for (const jour of historique) {
    for (const [id, r] of Object.entries(jour.apps ?? {})) {
      if (Date.parse(r.date) < depuis) continue;
      (parApp[id] ??= []).push(r);
    }
  }
  const resultat = {};
  for (const [id, liste] of Object.entries(parApp)) {
    liste.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const dernier = liste.at(-1);
    const jours = new Set(liste.filter((r) => r.apte).map((r) => r.date.slice(0, 10)));
    const ok = Boolean(dernier.apte) && jours.size >= 3;
    resultat[id] = {
      teste_au_labo: ok, date: ok ? dernier.date.slice(0, 10) : null, controles_7j: liste.length, aptes_7j: jours.size,
      controle_technique: dernier.controle_technique, note: dernier.note,
      raison: ok ? 'Contrôles réussis au moins 3 jours sur les 7 derniers' : !dernier.apte ? 'Le dernier contrôle a relevé des points à corriger' : `Encore ${3 - jours.size} jour(s) de contrôle réussi`,
    };
  }
  return resultat;
}

/** Alertes nouvelles : bloquants absents du contrôle précédent. */
export function nouvellesAlertes(precedent, actuel) {
  const cles = (index) => new Set(Object.values(index?.apps ?? {}).flatMap((r) => (r.bloquants ?? []).map((t) => `${r.id}|${t}`)));
  const avant = cles(precedent);
  return Object.values(actuel.apps ?? {}).flatMap((r) => (r.bloquants ?? []).filter((t) => !avant.has(`${r.id}|${t}`)).map((t) => ({ id: r.id, nom: r.nom, titre: t, communaute: r.communaute })));
}
