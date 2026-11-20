/**
 * scripts/labo/atelier/listes.mjs — listes partagées de l'Atelier qualité (Douanier, Parapluie, bac à sable).
 * Aucune dépendance. Tenir ces listes courtes et sûres : un faux positif coûte du temps à un créateur.
 */

/** Traceurs publicitaires et de mesure d'audience (domaine ou suffixe). */
export const TRACEURS = [
  'google-analytics.com', 'googletagmanager.com', 'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'connect.facebook.net', 'facebook.com/tr', 'analytics.tiktok.com', 'ads.tiktok.com',
  'hotjar.com', 'hotjar.io', 'clarity.ms', 'mouseflow.com', 'fullstory.com', 'smartlook.com', 'luckyorange.com',
  'segment.io', 'segment.com', 'mixpanel.com', 'amplitude.com', 'heap.io', 'heapanalytics.com',
  'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com', 'adnxs.com', 'rubiconproject.com', 'pubmatic.com',
  'scorecardresearch.com', 'quantserve.com', 'bat.bing.com', 'snap.licdn.com', 'px.ads.linkedin.com',
  'sc-static.net', 'tr.snapchat.com', 'mc.yandex.ru', 'yandex.ru/metrika', 'top-fwz1.mail.ru', 'static.ads-twitter.com',
  'analytics.twitter.com', 'pinimg.com/ct', 'ct.pinterest.com', 'cdn.mxpnl.com', 'stats.wp.com', 'widget.intercom.io',
];

/** Mineurs de cryptomonnaie dans le navigateur (domaines et marqueurs de code). */
export const MINEURS = /coinhive|coin-hive|cryptonight|cryptoloot|webminepool|deepminer|minero\.cc|coinimp|jsecoin|monerominer|webmine\.pro/i;

/** Fournisseurs d'IA du routeur BYOK : la clé du visiteur n'y va que s'il l'a saisie. */
export const FOURNISSEURS_IA = [
  'generativelanguage.googleapis.com', 'api.mistral.ai', 'api.anthropic.com', 'api.openai.com', 'api.deepseek.com',
  'api.x.ai', 'openrouter.ai', 'api.groq.com', 'api.together.xyz', 'api.cohere.ai', 'api-inference.huggingface.co',
];

/** Polices et bibliothèques chargées depuis un tiers (transmettent l'adresse IP du visiteur). */
export const POLICES_EXTERNES = ['fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net', 'fonts.bunny.net', 'use.fontawesome.com'];

/**
 * Secrets reconnaissables dans le code publié. `publique` : clé faite pour être visible (à restreindre),
 * jamais bloquante.
 */
export const SECRETS = [
  // Les plus précis d'abord : une clé Anthropic ou OpenRouter garde son vrai nom (chaque valeur n'est comptée qu'une fois).
  { nom: 'clé Anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/g },
  { nom: 'clé OpenRouter', re: /\bsk-or-v1-[a-f0-9]{48,}\b/g },
  { nom: 'clé OpenAI', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g },
  { nom: 'jeton GitHub', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g },
  { nom: 'clé AWS', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { nom: 'clé secrète Stripe', re: /\b(?:sk|rk)_live_[0-9A-Za-z]{24,}\b/g },
  { nom: 'jeton Slack', re: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g },
  { nom: 'clé privée', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { nom: 'clé Google', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, publique: /firebase|authDomain|projectId|maps\.googleapis/i },
];

/** Une valeur trouvée est-elle un exemple (sk-xxxx…, « your-key ») plutôt qu'une vraie clé ? */
export function estExemple(valeur) {
  const v = valeur.replace(/^(sk-(?:proj-|ant-|or-v1-)?|AIza|AKIA|gh[pousr]_|github_pat_|xox[baprs]-|(?:sk|rk)_live_)/, '');
  if (/x{6,}|0{8,}|1234567|your|votre|exemple|example|dummy|test|chaos|canari|placeholder/i.test(valeur)) return true;
  const differents = new Set(v).size;
  return v.length >= 16 && differents < 8;
}

/** Domaine d'une adresse (sans www.). */
export const hoteDe = (url) => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

/** `hote` appartient-il à l'un des domaines de la liste (égalité ou sous-domaine) ? */
export const dansListe = (hote, liste) => liste.some((d) => {
  const dom = d.split('/')[0];
  return hote === dom || hote.endsWith('.' + dom);
});

/** Traceur reconnu pour cette adresse (gère « facebook.com/tr »). */
export function traceurDe(url) {
  const hote = hoteDe(url);
  let chemin = '';
  try { chemin = new URL(url).pathname; } catch { /* rien */ }
  return TRACEURS.find((t) => {
    const [dom, ...reste] = t.split('/');
    const ok = hote === dom || hote.endsWith('.' + dom);
    return ok && (!reste.length || chemin.startsWith('/' + reste.join('/')));
  }) ?? null;
}

/** Sites d'Alphabette : jamais « tiers ». */
export const estAlphabette = (hote) => /(^|\.)alphabette\.(fr|eu)$/i.test(hote);
