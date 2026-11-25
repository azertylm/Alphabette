#!/usr/bin/env node
/**
 * audit-lot5.mjs — audit statique automatique (Lot 5). Code de sortie 0 = conforme, 1 = anomalie.
 *
 *   node scripts/audit-lot5.mjs            (base de comparaison : origin/main, ou AUDIT_BASE=<commit>)
 *
 * Vérifie :
 *  1. Tarif unique : aucune mention d'un Pass/bouquet à 40 € ni de prorata (sauf phrase qui l'INTERDIT : « zéro », « aucun »…)
 *  2. Applis protégées intactes (Lidarsol, Osolar, ProxiLien, Orbit, Info Perso) et vitrine .fr figée (vitrine/, vitrine.ref)
 *  3. Règles d'argent : commissions prises sur les 500 c. d'Alphabette, créateur ≥ 1000 c. par licence, pas de flottant
 *  4. Sécurité : aucun secret dans le dépôt, dossiers privés fermés, en-têtes/anti-CSRF sur chaque service, pas de cookie
 *     dans le moteur financier, voix unique (pas de speechSynthesis direct dans le code modifié)
 *  5. Replis : liens de paiement vides ou Stripe https, pages du Lot 5 avec la double barre et un message hors connexion
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const anomalies = [];
const ok = [];
const verifier = (nom, cond, detail = '') => (cond ? ok.push(nom) : anomalies.push(`${nom}${detail ? ' — ' + detail : ''}`));
const lire = (f) => readFileSync(path.join(racine, f), 'utf8');

const EXCLUS = /^(node_modules|dist|dist-static|\.git|vitrine|public\/orbit|tests|bun\.lock)(\/|$)/;
function fichiers(dir = '', l = []) {
  for (const n of readdirSync(path.join(racine, dir))) {
    const rel = dir ? `${dir}/${n}` : n;
    if (EXCLUS.test(rel) || rel === 'scripts/audit-lot5.mjs' || n === 'node_modules') continue;
    const st = statSync(path.join(racine, rel));
    if (st.isDirectory()) fichiers(rel, l);
    else if (/\.(php|ts|tsx|js|mjs|html|json|md|css)$/.test(n) && st.size < 3_000_000) l.push(rel);
  }
  return l;
}
const tous = fichiers();

// 1. Tarif unique
const ESP = '(?:[\\s\\u00a0\\u202f]|&nbsp;|&#160;)?';
const INTERDIT = new RegExp(`\\b40${ESP}(?:,00)?${ESP}(?:€|euros?\\b)|pass_ecosysteme|ecosystemPerYear|PRICES\\.ecosystem|pricing\\??\\.ecosystem|\\bprorata\\b|\\b4000\\s*c\\b`, 'i');
const NEGATION = /(z[ée]ro|aucun|aucune|pas de|sans|jamais|interdit|plus de|ni)\b[^.]{0,40}(40|prorata|bouquet|pass)/i;
const mentions = [];
for (const f of tous) {
  if (/\.min\.js$|assets\/(qrcode|alphabette-effets|alphabette-audio|alphabette-votes)\.js$|^public\/apps\//.test(f)) continue;
  lire(f).split('\n').forEach((ligne, i) => { if (INTERDIT.test(ligne) && !NEGATION.test(ligne)) mentions.push(`${f}:${i + 1}`); });
}
verifier('zéro mention de Pass 40 € ou de prorata', mentions.length === 0, mentions.slice(0, 12).join(', '));

// 2. Applis protégées et vitrine figée
const base = process.env.AUDIT_BASE || 'origin/main';
let changes = [];
try { changes = execFileSync('git', ['-C', racine, 'diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean); }
catch { try { changes = execFileSync('git', ['-C', racine, 'diff', '--name-only', base], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { anomalies.push(`base git « ${base} » introuvable : diff impossible`); } }
const PROTEGES = /(^|\/)(lidarsol|osolar|proxilien|orbit|info-?perso|infosperso)([./_-]|$)|^vitrine\//i;
const touches = changes.filter((f) => PROTEGES.test(f));
verifier('aucune modification des applis protégées ni de vitrine/', touches.length === 0, touches.join(', '));
try {
  const avant = JSON.parse(execFileSync('git', ['-C', racine, 'show', `${base}:data/apps-sources.json`], { encoding: 'utf8' }));
  const apres = JSON.parse(lire('data/apps-sources.json'));
  const refs = (s) => JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v?.vitrine ?? null])));
  verifier('vitrine.ref inchangées', refs(avant) === refs(apres));
} catch { verifier('vitrine.ref inchangées', !changes.includes('data/apps-sources.json')); }

// 3. Règles d'argent (lues dans le code, pas recopiées)
const cc = lire('serveur/php/croissance-commun.php');
const fc = lire('serveur/php/finance-commun.php');
const cst = (src, n) => { const m = src.match(new RegExp(`const ${n} = (\\d+)`)); return m ? Number(m[1]) : NaN; };
const prix = cst(fc, 'PRIX_ABONNEMENT_CENTIMES'), partC = cst(fc, 'PART_CREATEUR_CENTIMES'), partA = cst(fc, 'PART_ALPHABETTE_CENTIMES');
verifier('15 € = 1000 créateur + 500 Alphabette', prix === 1500 && partC === 1000 && partA === 500);
verifier('seuil de virement 20 €', cst(fc, 'SEUIL_VIREMENT_CENTIMES') === 2000);
const parrain = cst(cc, 'COMMISSION_PARRAIN_CREATEUR'), app = cst(cc, 'COMMISSION_APPORTEUR'), fav = cst(cc, 'COMMISSION_FAVORIS');
verifier('affiliation 100 / 150 / 100, cumul ≤ 500 (Alphabette garde ≥ 250)', parrain === 100 && app === 150 && fav === 100 && partA - parrain - Math.max(app, fav) === 250);
const packs = Object.fromEntries([...cc.matchAll(/(\d+) => (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]).filter(([n]) => [5, 10, 25].includes(n)));
const pct = cst(cc, 'PART_CREATEUR_PACK_POURCENT');
verifier('packs 6500 / 12000 / 27500 et jamais < 1000 c. par licence au créateur',
  packs[5] === 6500 && packs[10] === 12000 && packs[25] === 27500 && /max\(intdiv\(\$prix \* PART_CREATEUR_PACK_POURCENT, 100\), \$nb \* PART_CREATEUR_CENTIMES\)/.test(cc) && pct === 75);
verifier('café 300 = 200 + 100, bounty 90 %, boost 1000 × 4 places', cst(cc, 'PRIX_POURBOIRE') === 300 && cst(cc, 'PART_CREATEUR_POURBOIRE') === 200 && cst(cc, 'BOUNTY_POURCENT_CONTRIBUTEUR') === 90 && cst(cc, 'PRIX_BOOST') === 1000 && cst(cc, 'BOOST_PLACES') === 4);
const argent = ['serveur/php/croissance-commun.php', 'serveur/php/boutique.php', 'serveur/php/affiliation.php', 'serveur/php/webhooks.php', 'serveur/php/payouts.php'];
const flottants = argent.filter((f) => /\(float\)|floatval|\bround\(|\*\s*0\.\d|\/\s*100\b(?!\))/.test(lire(f)));
verifier('calculs d\'argent sans flottant', flottants.length === 0, flottants.join(', '));

// 4. Sécurité
const SECRETS = /(sk-or-v1-[a-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{10,}|rk_live_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{30,})/;
const fuites = tous.filter((f) => SECRETS.test(lire(f)));
verifier('aucun secret dans le dépôt', fuites.length === 0, fuites.join(', '));
verifier('dossier privé fermé (.htaccess)', existsSync(path.join(racine, 'data/private/.htaccess')) && /Require all denied/.test(lire('data/private/.htaccess')));
verifier('bibliothèques « _*.php » non appelables', /\^_\.\*\\\.php\$[\s\S]*Require all denied/.test(lire('serveur/php/createurs/.htaccess')));
const services = readdirSync(path.join(racine, 'serveur/php')).filter((f) => f.endsWith('.php') && !/commun|^paiement|^iadebat|^orbit|^crash|upload-guard/.test(f));
const sansGarde = services.filter((f) => { const s = lire(`serveur/php/${f}`); return !/f_entetes\(\)|w_signature_valide/.test(s); });
verifier('chaque service financier pose ses en-têtes (CORS fermé, no-store)', sansGarde.length === 0, sansGarde.join(', '));
const cookies = services.filter((f) => /setcookie\s*\(/.test(lire(`serveur/php/${f}`)));
verifier('moteur financier sans cookie', cookies.length === 0, cookies.join(', '));
const nouveauxCreateurs = ['communaute.php', 'recrutement.php'];
verifier('Labo communautaire : POST protégés (anti-CSRF)', nouveauxCreateurs.every((f) => /exiger_post\(\)/.test(lire(`serveur/php/createurs/${f}`))));
const voix = changes.filter((f) => existsSync(path.join(racine, f)) && /\.(ts|tsx|js|html)$/.test(f) && /speechSynthesis/.test(lire(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
verifier('voix unique : pas de speechSynthesis direct dans le code modifié', voix.length === 0, voix.join(', '));
verifier('juge IA : réponse JSON stricte validée', /function juge_valider_json/.test(lire('serveur/php/createurs/communaute.php')) && /array_keys\(\$d\) !== array\('verdict', 'raison'\)/.test(lire('serveur/php/createurs/communaute.php')));
verifier('code jours .fr signé HMAC-SHA256 et à usage unique', /c_code_jours_verifier/.test(cc) && /hash_equals/.test(cc) && /codes_jours_utilises \(code_id TEXT PRIMARY KEY/.test(cc));

// 5. Replis
const liens = JSON.parse(lire('data/boutique.json')).liens;
const mauvais = Object.entries(liens).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : Object.entries(v))).filter(([, v]) => v !== '' && !/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/.test(v));
verifier('liens de paiement : vides ou Stripe https', mauvais.length === 0, mauvais.map(([k]) => k).join(', '));
const pages = ['rejoindre-createurs', 'essai', 'invite', 'studio-partage', 'boutique', 'bounties', 'credits', 'roadmap', 'contribuer', 'admin-newsletter'];
const sansBarre = pages.filter((p) => !/alphabette-barre\.js/.test(lire(`labo/pages/${p}.html`)));
verifier('double barre sur chaque page du Lot 5', sansBarre.length === 0, sansBarre.join(', '));
verifier('message clair hors connexion', /Pas de connexion : réessayez/.test(lire('labo/pages/lot5.js')));
verifier('pages du Lot 5 publiées par le build', pages.every((p) => lire('scripts/build-static.mjs').includes(`'${p}`)));

const total = ok.length + anomalies.length;
console.log(`Audit Lot 5 : ${ok.length}/${total} contrôles conformes`);
for (const a of anomalies) console.log('  ✗ ' + a);
process.exit(anomalies.length ? 1 : 0);
