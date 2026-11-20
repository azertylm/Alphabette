#!/usr/bin/env node
/**
 * scripts/labo/concierge.mjs — Le Concierge et L'Économe : ce qui peut tout arrêter sans prévenir.
 *
 *   node scripts/labo/concierge.mjs [--sortie concierge]
 *
 * Le Concierge :
 *   - certificats HTTPS de chaque domaine et sous-domaine (alerte à 21 jours ; Let's Encrypt renouvelle à 30) ;
 *   - date d'expiration de chaque nom de domaine (RDAP officiel, alerte à 45 jours) ;
 *   - redirection http → https des deux sites ;
 *   - service des avis en marche, et sauvegarde des avis (branche labo-donnees) de moins de 12 h.
 * L'Économe (IA Débat et Crash-Testeur partagent la clé OpenRouter d'Alphabette) :
 *   - état du crédit (épuisé, bas, plafond de la clé, clé refusée) via api/iadebat-proxy.php?sante ;
 *   - compte sans crédit acheté : modèles gratuits limités à 50 requêtes par jour pour tout le site ;
 *   - plafond des débats Premium offerts atteint ; historique d'usage sur 30 jours.
 * Sortie : <sortie>/dernier.json (points, domaines, économe), <sortie>/econome.json (30 jours), <sortie>/resume.md,
 * <sortie>/alertes.json (points nouveaux depuis la veille). Aucune dépendance.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const SORTIE = opt('sortie', 'concierge');
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const jours = (date) => Math.floor((Date.parse(date) - Date.now()) / 86400000);
const points = [];
const point = (agent, gravite, titre, detail, correction) => points.push({ agent, gravite, titre, detail, correction });

async function obtenir(url, options = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try { return await fetch(url, { ...options, signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Concierge Alphabette)', ...(options.headers ?? {}) } }); }
  catch { return null; }
  finally { clearTimeout(t); }
}

/* ---------------------------- domaines ---------------------------- */
const { apps: sources = {} } = lire(path.join(RACINE, 'data', 'apps-sources.json'), {});
const hotes = new Set(['alphabette.fr', 'alphabette.eu']);
for (const s of Object.values(sources)) for (const d of [...(s.domains ?? []), ...(s.redirects ?? [])]) hotes.add(d.replace(/^www\./, '').toLowerCase());
const enregistrables = [...new Set([...hotes].map((h) => h.split('.').slice(-2).join('.')))];

function certificat(hote) {
  return new Promise((ok) => {
    const s = tls.connect({ host: hote, port: 443, servername: hote, timeout: 15000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      ok({ fin: c?.valid_to ? new Date(c.valid_to).toISOString() : null, emetteur: c?.issuer?.O ?? c?.issuer?.CN ?? '', valide: s.authorized, erreur: s.authorizationError ? String(s.authorizationError) : null });
    });
    s.on('error', (e) => ok({ fin: null, erreur: e.code || e.message }));
    s.on('timeout', () => { s.destroy(); ok({ fin: null, erreur: 'pas de réponse' }); });
  });
}

const amorce = await obtenir('https://data.iana.org/rdap/dns.json').then((r) => r?.json()).catch(() => null);
async function expiration(domaine) {
  const tld = domaine.split('.').pop();
  const service = amorce?.services?.find(([tlds]) => tlds.includes(tld));
  const base = service?.[1]?.[0];
  if (!base) return { fin: null, erreur: 'registre RDAP inconnu' };
  const r = await obtenir(`${base.replace(/\/$/, '')}/domain/${domaine}`, { headers: { Accept: 'application/rdap+json' } });
  if (!r?.ok) return { fin: null, erreur: `RDAP ${r?.status ?? 'injoignable'}` };
  const d = await r.json().catch(() => null);
  const ev = d?.events?.find((e) => e.eventAction === 'expiration');
  return { fin: ev?.eventDate ?? null, erreur: ev ? null : "date d'expiration non publiée par le registre" };
}

const domaines = [];
for (const h of [...hotes].sort()) {
  const c = await certificat(h);
  const reste = c.fin ? jours(c.fin) : null;
  domaines.push({ hote: h, certificat_fin: c.fin, certificat_jours: reste, emetteur: c.emetteur, erreur: c.erreur });
  if (c.erreur && !c.fin) point('concierge', 'important', `Certificat HTTPS illisible : ${h}`, c.erreur, "Vérifier dans l'espace OVH (Hébergement → Multisite) que le domaine est rattaché avec le SSL activé.");
  else if (!c.valide && c.erreur) point('concierge', 'bloquant', `Certificat HTTPS invalide : ${h}`, c.erreur, "Espace OVH → Hébergement → Multisite : régénérer le certificat SSL du domaine.");
  else if (reste !== null && reste < 7) point('concierge', 'bloquant', `Certificat HTTPS de ${h} expire dans ${reste} jour(s)`, c.fin, 'Espace OVH → Hébergement → Certificat SSL → Régénérer.');
  else if (reste !== null && reste < 21) point('concierge', 'important', `Certificat HTTPS de ${h} expire dans ${reste} jours`, c.fin, "Le renouvellement automatique de Let's Encrypt aurait dû passer : vérifier le multisite OVH.");
}
for (const d of enregistrables.sort()) {
  const e = await expiration(d);
  const reste = e.fin ? jours(e.fin) : null;
  const ligne = domaines.find((x) => x.hote === d) ?? (() => { const x = { hote: d }; domaines.push(x); return x; })();
  Object.assign(ligne, { domaine_fin: e.fin, domaine_jours: reste, ...(e.erreur ? { domaine_info: e.erreur } : {}) });
  if (reste !== null && reste < 15) point('concierge', 'bloquant', `Le nom de domaine ${d} expire dans ${reste} jour(s)`, e.fin, 'Espace OVH → Noms de domaine → renouveler (activer le renouvellement automatique).');
  else if (reste !== null && reste < 45) point('concierge', 'important', `Le nom de domaine ${d} expire dans ${reste} jours`, e.fin, 'Espace OVH → Noms de domaine → vérifier le renouvellement automatique et le moyen de paiement.');
}
for (const site of ['alphabette.fr', 'alphabette.eu']) {
  const r = await obtenir(`http://${site}/`, { redirect: 'manual' });
  const vers = r?.headers.get('location') ?? '';
  if (r && !(r.status >= 300 && r.status < 400 && vers.startsWith('https://'))) point('concierge', 'important', `http://${site} ne renvoie pas vers https://`, `réponse ${r.status}`, 'Le .htaccess généré force le HTTPS : vérifier que la dernière publication est bien en ligne.');
}

/* ---------------------------- avis et sauvegarde ---------------------------- */
const avis = await obtenir('https://alphabette.eu/api/feedback.php?etat=1').then((r) => r?.json()).catch(() => null);
if (avis?.ok !== true) point('concierge', 'important', 'Le service des avis ne répond pas', 'https://alphabette.eu/api/feedback.php?etat=1', "Vérifier la dernière publication (journal du workflow « Publier alphabette.fr »).");
const depot = process.env.GITHUB_REPOSITORY || 'azertylm/Alphabette';
const gh = await obtenir(`https://api.github.com/repos/${depot}/commits?sha=labo-donnees&path=feedbacks.json&per_page=1`, { headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } })
  .then((r) => r?.json()).catch(() => null);
const derniere = Array.isArray(gh) ? gh[0]?.commit?.committer?.date : null;
const sauvegarde = { derniere, heures: derniere ? Math.round((Date.now() - Date.parse(derniere)) / 3600000) : null };
if (sauvegarde.heures !== null && sauvegarde.heures > 12) point('concierge', 'important', `Sauvegarde des avis arrêtée depuis ${sauvegarde.heures} h`, `dernier export : ${derniere}`, 'Relancer le workflow « labo-avis » et vérifier que feedback.php répond.');

/* ---------------------------- L'Économe ---------------------------- */
const sante = await obtenir('https://alphabette.eu/api/iadebat-proxy.php?sante').then((r) => (r?.ok ? r.json() : null)).catch(() => null);
const econome = { date: new Date().toISOString(), sante };
if (!sante) {
  point('econome', 'conseil', "Santé du relais IA indisponible", 'api/iadebat-proxy.php?sante', 'Normal tant que cette version du relais n\'est pas en ligne ; sinon vérifier la publication.');
} else if (sante.actif === false) {
  point('econome', 'conseil', 'Relais IA Débat sans clé OpenRouter', '', "Le Mode Gratuit sans clé n'est pas ouvert : installer la clé d'Alphabette (lien d'installation).");
} else {
  const etat = sante.credit?.etat;
  if (etat === 'cle_refusee') point('econome', 'bloquant', 'OpenRouter refuse la clé du site', '', 'Créer une nouvelle clé et la réinstaller (les débats sans clé et le Crash-Testeur sont arrêtés).');
  if (etat === 'epuise') point('econome', 'important', 'Crédit OpenRouter épuisé', 'débats Premium offerts et Crash-Testeur Premium arrêtés ; le Mode Gratuit continue', 'Ajouter du crédit sur https://openrouter.ai/settings/credits (10 $ suffisent pour lever la limite des modèles gratuits).');
  if (etat === 'bas') point('econome', 'conseil', 'Crédit OpenRouter presque épuisé (moins de 1 $)', '', 'Prévoir un rechargement sur https://openrouter.ai/settings/credits.');
  if (etat === 'plafond_cle') point('econome', 'important', 'Plafond mensuel de la clé atteint', '', "Le plafond de la clé « IA Débat » est atteint : l'augmenter sur https://openrouter.ai/settings/keys ou attendre le mois prochain.");
  if (sante.credit?.compte_gratuit === true) point('econome', 'conseil', 'Compte OpenRouter sans crédit acheté : 50 requêtes gratuites par jour pour tout le site', `${sante.debats_gratuits} débat(s) gratuit(s) aujourd'hui (chaque débat = plusieurs requêtes)`, 'Un premier achat de 10 $ fait passer la limite à 1 000 requêtes par jour.');
  if (sante.premium_total >= sante.plafond_premium) point('econome', 'conseil', `Plafond des débats Premium offerts atteint (${sante.plafond_premium} aujourd'hui)`, '', 'Rien à faire : il se remet à zéro demain. À relever seulement si le budget le permet.');
}
const historiqueF = path.join(SORTIE, 'econome.json');
const historique = lire(historiqueF, { jours: [] });
if (sante?.actif) {
  historique.jours = [...historique.jours.filter((j) => j.jour !== sante.jour), { jour: sante.jour, visiteurs: sante.visiteurs, debats_gratuits: sante.debats_gratuits, debats_premium: sante.debats_premium, credit: sante.credit?.etat }].slice(-30);
}

/* ---------------------------- sorties ---------------------------- */
const precedent = lire(path.join(SORTIE, 'dernier.json'), { points: [] });
const avant = new Set((precedent.points ?? []).map((p) => p.titre.replace(/\d+/g, '#')));
const alertes = points.filter((p) => p.gravite !== 'conseil' && !avant.has(p.titre.replace(/\d+/g, '#')));
mkdirSync(SORTIE, { recursive: true });
const sortie = { date: new Date().toISOString(), points, domaines, sauvegarde, econome };
writeFileSync(path.join(SORTIE, 'dernier.json'), JSON.stringify(sortie, null, 2) + '\n');
writeFileSync(historiqueF, JSON.stringify(historique, null, 2) + '\n');
writeFileSync(path.join(SORTIE, 'alertes.json'), JSON.stringify({ date: sortie.date, alertes }, null, 2) + '\n');
const icone = { bloquant: '⛔', important: '⚠️', conseil: '💡' };
writeFileSync(path.join(SORTIE, 'resume.md'), [
  '## Le Concierge et L\'Économe', '',
  points.length ? points.map((p) => `- ${icone[p.gravite]} **${p.titre}**${p.detail ? ` — ${p.detail}` : ''}\n  ${p.correction}`).join('\n') : '✅ Domaines, certificats, sauvegarde et crédit IA : tout va bien.',
  '', '| Domaine | Certificat (jours) | Nom de domaine (jours) |', '|---|---|---|',
  ...domaines.map((d) => `| ${d.hote} | ${d.certificat_jours ?? '—'} | ${d.domaine_jours ?? (d.domaine_info ? `— (${d.domaine_info})` : '—')} |`),
  '', sante?.actif ? `IA : ${sante.debats_gratuits} débat(s) gratuit(s), ${sante.debats_premium} Premium, ${sante.visiteurs} visiteur(s) aujourd'hui ; crédit : ${sante.credit?.etat}.` : '',
].join('\n') + '\n');
console.log(JSON.stringify({ points: points.length, alertes: alertes.length, domaines: domaines.length }));
