<?php
/**
 * paiement.php — Pass, Pass Découverte, Pass Cadeau, crédits IA Débat et Mécènes du Labo (alphabette.eu).
 * Publié dans eu/api/paiement.php par scripts/build-static.mjs. Paiement par liens Stripe, SANS abonnement :
 * un paiement = un achat, jamais de prélèvement suivant (CGV, article 5).
 *
 *   GET  ?etat                                   → offres ouvertes, prix, Pass Découverte ouvert ou non, gratuit_jusqu_au
 *        Offre de lancement (data/paiements.json « gratuit_jusqu_au ») : jusqu'à cette date incluse, ni Pass ni crédits
 *        ne sont vendus (« commander » refuse) ; le soutien Mécène reste possible.
 *   POST { action:"decouverte" }                 → { jeton, debut, fin }   48 h exactement, sans carte bancaire
 *   POST { action:"commander", produit, pour:"moi"|"cadeau", app?, pseudo?, afficher?, porte_monnaie? }
 *                                                → { lien }   lien Stripe + client_reference_id (la commande attend le paiement)
 *   POST { action:"confirmer", session_id, app? } → ce qui a été acheté (Pass activé, carte cadeau, crédits, merci)
 *   POST { action:"activer", code }              → Pass (code cadeau / code d'activation) ou porte-monnaie (PM-…)
 *   POST { action:"verifier", jeton }            → validité d'un Pass
 *   GET  ?solde      (en-tête X-Alphabette-Credits)  → { solde }
 *   GET  ?honneur                                → { mecenes:[{ pseudo, depuis }] }   (Tableau d'Honneur)
 *   POST ?webhook                                → événements Stripe signés (checkout.session.completed…)
 *   GET/POST ?installer                          → enregistre la clé Stripe et le secret du webhook (lien à jeton secret)
 *   GET/POST ?retirer=<id>&t=<jeton>             → retire un pseudo du Tableau d'Honneur (lien envoyé à Valentin)
 *
 * Aucune clé dans le dépôt : la clé Stripe (restreinte, lecture des sessions Checkout) et le secret du webhook sont
 * rangés HORS du site, dans ~/alphabette-paiements/config.json (ou variables d'environnement STRIPE_CLE /
 * STRIPE_WEBHOOK_SECRET). Les liens de paiement (publics) sont dans data/paiements.json.
 * Vie privée : pas d'adresse IP gardée (empreinte du jour), pas de donnée bancaire, l'e-mail de l'acheteur
 * sert seulement à lui envoyer son code (il n'est pas enregistré ici).
 */
declare(strict_types=1);

const JETON_INSTALLATION_SHA256 = 'e606a9f4b26c66bb02983abe15791b06cc6b1d5efad31ddc5596c92664a03a9b';
const DESTINATAIRE = 'azertylm@gmail.com';
const EXPEDITEUR = 'Alphabette <pass@alphabette.eu>';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford : ni I, ni L, ni O, ni U
define('STRIPE', rtrim(getenv('ALPHABETTE_STRIPE_BASE') ?: 'https://api.stripe.com', '/'));

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
$origine = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if (preg_match('#^https://([a-z0-9-]+\.)?alphabette\.(fr|eu)$#', $origine)) {
    header('Access-Control-Allow-Origin: ' . $origine);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, X-Alphabette-Credits');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}

/* ───────────────────────────── utilitaires ───────────────────────────── */

function repondre(int $code, array $d): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function erreur(int $code, string $m, array $plus = array()): void { repondre($code, array('erreur' => $m) + $plus); }

function dossier(): string {
    $maison = getenv('HOME') ?: dirname((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__));
    $d = rtrim($maison, '/') . '/alphabette-paiements';
    if (!is_dir($d)) @mkdir($d, 0700, true);
    if (!is_dir($d) || !is_writable($d)) erreur(503, 'Le service est indisponible pour le moment.');
    return $d;
}

function lire_json(string $f, array $defaut): array {
    $t = is_file($f) ? @file_get_contents($f) : false;
    $d = $t ? json_decode($t, true) : null;
    return is_array($d) ? $d : $defaut;
}

function ecrire_json(string $f, array $d): void {
    $tmp = $f . '.' . bin2hex(random_bytes(4));
    file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    @chmod($tmp, 0600);
    rename($tmp, $f);
}

/** Lecture + écriture sous verrou exclusif (même convention « .lock » que le relais d'IA Débat). */
function modifier(string $f, callable $fn) {
    $v = fopen($f . '.lock', 'c');
    if (!$v || !flock($v, LOCK_EX)) erreur(503, 'Service occupé, réessayez dans un instant.');
    $d = lire_json($f, array());
    $r = $fn($d);
    ecrire_json($f, $d);
    flock($v, LOCK_UN);
    fclose($v);
    return $r;
}

function b64url(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function deb64url(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/')); }

function secret(): string {
    $f = dossier() . '/secret.json';
    $s = lire_json($f, array())['secret'] ?? '';
    if (!is_string($s) || strlen($s) < 32) {
        $s = bin2hex(random_bytes(32));
        $v = fopen($f . '.lock', 'c');
        flock($v, LOCK_EX);
        $deja = lire_json($f, array())['secret'] ?? '';
        if (is_string($deja) && strlen($deja) >= 32) $s = $deja; else ecrire_json($f, array('secret' => $s));
        flock($v, LOCK_UN);
        fclose($v);
    }
    return $s;
}

function config(): array {
    $c = lire_json(dossier() . '/config.json', array());
    if (empty($c['stripe_cle']) && getenv('STRIPE_CLE')) $c['stripe_cle'] = getenv('STRIPE_CLE');
    if (empty($c['webhook_secret']) && getenv('STRIPE_WEBHOOK_SECRET')) $c['webhook_secret'] = getenv('STRIPE_WEBHOOK_SECRET');
    return $c;
}

function texte(string $t, int $max): string {
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags($t)) ?? '');
    return mb_substr($t, 0, $max, 'UTF-8');
}

/** Empreinte du jour : l'adresse IP n'est jamais écrite. */
function empreinte(): string {
    return substr(hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . gmdate('Ymd'), secret()), 0, 20);
}

/** Compteur par visiteur et par jour (fichiers effacés après 2 jours). */
function limite(string $type, int $max): bool {
    $d = dossier();
    $f = $d . '/limites-' . gmdate('Ymd') . '.json';
    foreach (glob($d . '/limites-*.json') ?: array() as $ancien) {
        if ($ancien !== $f && filemtime($ancien) < time() - 2 * 86400) { @unlink($ancien); @unlink($ancien . '.lock'); }
    }
    $k = $type . ':' . empreinte();
    return modifier($f, function (&$q) use ($k, $max) {
        if (($q[$k] ?? 0) >= $max) return false;
        $q[$k] = ($q[$k] ?? 0) + 1;
        return true;
    });
}

function base32(string $octets, int $n): string {
    $bits = '';
    foreach (str_split($octets) as $o) $bits .= str_pad(decbin(ord($o)), 8, '0', STR_PAD_LEFT);
    $r = '';
    for ($i = 0; $i < $n; $i++) $r .= ALPHABET[bindec(substr($bits, $i * 5, 5))];
    return $r;
}

/** « alpha-7k3m q9td 2hxn » → « 7K3MQ9TD2HXN » (O→0, I/L→1 : les confusions courantes sont corrigées). */
function normaliser_code(string $c): string {
    $c = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $c) ?? '');
    if (strpos($c, 'ALPHA') === 0) $c = substr($c, 5);
    return strtr($c, array('O' => '0', 'I' => '1', 'L' => '1', 'U' => 'V'));
}
function joli_code(string $c): string { return 'ALPHA-' . implode('-', str_split($c, 4)); }

function plus_12_mois(int $t): int { return (int) strtotime('+12 months', $t); }
function date_fr(int $t): string { return gmdate('d/m/Y', $t); }

function envoyer_mail(string $a, string $sujet, string $corps): void {
    if ($a === '' || !filter_var($a, FILTER_VALIDATE_EMAIL)) return;
    $journal = getenv('ALPHABETTE_MAIL_JOURNAL');
    if ($journal) { @file_put_contents($journal, json_encode(array('a' => $a, 'sujet' => $sujet, 'corps' => $corps), JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND); return; }
    if (function_exists('mail')) {
        @mail($a, '=?UTF-8?B?' . base64_encode($sujet) . '?=', $corps, 'From: ' . EXPEDITEUR . "\r\nContent-Type: text/plain; charset=UTF-8");
    }
}

/* ───────────────────────────── offres ───────────────────────────── */

function public_json(string $nom): array { return lire_json(__DIR__ . '/' . $nom, array()); }

/** Les prix des Pass viennent de la configuration du hub (api/config.json), le reste de data/paiements.json. */
function produits(): array {
    $hub = public_json('config.json');
    $p = public_json('paiements.json');
    $l = $p['liens'] ?? array();
    $euros = function ($v, $defaut) { return (int) round((is_numeric($v) ? (float) $v : $defaut) * 100); };
    return array(
        'pass_app'        => array('nom' => 'Pass Application (12 mois)', 'prix' => $euros($hub['pricing']['perApp'] ?? null, 15), 'lien' => (string) ($l['pass_app'] ?? ''), 'type' => 'pass', 'offre' => 'app'),
        'pass_ecosysteme' => array('nom' => 'Pass Écosystème (12 mois)', 'prix' => $euros($hub['pricing']['ecosystem'] ?? null, 40), 'lien' => (string) ($l['pass_ecosysteme'] ?? ''), 'type' => 'pass', 'offre' => 'ecosysteme'),
        'credits_iadebat' => array('nom' => 'Pack de crédits IA Débat', 'prix' => $euros($p['credits']['prix'] ?? null, 5), 'lien' => (string) ($l['credits_iadebat'] ?? ''), 'type' => 'credits'),
        'mecene_5'        => array('nom' => 'Soutien au Laboratoire (5 €)', 'prix' => 500, 'lien' => (string) ($l['mecene_5'] ?? ''), 'type' => 'mecene'),
        'mecene_10'       => array('nom' => 'Soutien au Laboratoire (10 €)', 'prix' => 1000, 'lien' => (string) ($l['mecene_10'] ?? ''), 'type' => 'mecene'),
        'mecene_libre'    => array('nom' => 'Soutien au Laboratoire (montant libre)', 'prix' => 100, 'lien' => (string) ($l['mecene_libre'] ?? ''), 'type' => 'mecene'),
    );
}
/**
 * Offre de lancement : tout est gratuit jusqu'à « gratuit_jusqu_au » inclus (heure de Paris). Retourne la date
 * (AAAA-MM-JJ) tant qu'elle n'est pas passée, sinon null. Pendant ce temps, ni Pass ni crédits ne sont vendus.
 */
function gratuit_jusqu_au(): ?string {
    $d = (string) (public_json('paiements.json')['gratuit_jusqu_au'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) return null;
    $fin = DateTime::createFromFormat('Y-m-d H:i:s', $d . ' 23:59:59', new DateTimeZone('Europe/Paris'));
    return $fin && $fin->getTimestamp() >= time() ? $d : null;
}
function payant(string $produit): bool { return in_array($produit, array('pass_app', 'pass_ecosysteme', 'credits_iadebat'), true); }

function credits_par_pack(): int { return max(1, (int) (public_json('paiements.json')['credits']['debats_par_pack'] ?? 50)); }
function activations_max(): int { return max(1, (int) (public_json('paiements.json')['pass']['appareils'] ?? 3)); }
function heures_decouverte(): int { return max(1, (int) (public_json('paiements.json')['decouverte']['heures'] ?? 48)); }

function lien_valide(string $l): bool { return (bool) preg_match('#^https://buy\.stripe\.com/[A-Za-z0-9_]{6,80}$#', $l); }

/** Applications qu'on peut prendre avec le Pass 15 € : les applis payantes en ligne (pas celles de la communauté). */
function applis_pass(): array {
    $r = array();
    foreach (public_json('apps.json')['apps'] ?? array() as $a) {
        $slug = (string) ($a['slug'] ?? $a['id'] ?? '');
        if ($slug === '' || !empty($a['gratuit']) || !empty($a['communaute']) || ($a['status'] ?? 'actif') !== 'actif') continue;
        $r[$slug] = nom_lisible(trim(preg_replace('/\s+/', ' ', strip_tags((string) ($a['name'] ?? $slug))) ?? $slug));
    }
    return $r;
}

/** « IADÉBAT » → « IA Débat », « L'ŒIL DE L'ATELIER » → « L'Œil de l'Atelier » (même règle que l'accueil du hub). */
function nom_lisible(string $nom): string {
    if ($nom !== mb_strtoupper($nom, 'UTF-8')) return $nom;
    $mots = preg_split("/(\s+|-|'|’)/u", mb_strtolower($nom, 'UTF-8'), -1, PREG_SPLIT_DELIM_CAPTURE) ?: array($nom);
    $petits = array('de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'au', 'aux', 'à', 'l', 'd');
    foreach ($mots as $i => $m) {
        if ($i === 0 && mb_strpos($m, 'ia') === 0 && mb_strlen($m) > 2) { $mots[$i] = 'IA ' . mb_strtoupper(mb_substr($m, 2, 1)) . mb_substr($m, 3); continue; }
        if ($i > 0 && in_array($m, $petits, true)) continue;
        $mots[$i] = mb_strtoupper(mb_substr($m, 0, 1)) . mb_substr($m, 1);
    }
    return implode('', $mots);
}

/** Le Pass Découverte n'est proposé que si les débats Premium d'IA Débat peuvent vraiment tourner. */
function decouverte_ouverte(): bool {
    $p = public_json('paiements.json');
    if (($p['decouverte']['actif'] ?? true) === false) return false;
    $maison = getenv('HOME') ?: dirname((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__));
    $ia = rtrim($maison, '/') . '/alphabette-iadebat';
    if (empty(lire_json($ia . '/config.json', array())['cle'])) return false;
    $c = lire_json($ia . '/sante-credit.json', array());
    if (is_numeric($c['solde'] ?? null) && (float) $c['solde'] <= 0) return false;
    if (is_numeric($c['restant_cle'] ?? null) && (float) $c['restant_cle'] <= 0) return false;
    return true;
}

/* ───────────────────────────── jetons ───────────────────────────── */

/** Jeton de Pass signé (lu aussi par le relais d'IA Débat) : { i: identifiant, o: offre, a: appli, d: début, f: fin }. */
function jeton_pass(string $id, string $offre, ?string $app, int $debut, int $fin): string {
    $donnees = b64url(json_encode(array('v' => 1, 'i' => $id, 'o' => $offre, 'a' => $app, 'd' => $debut, 'f' => $fin)));
    return $donnees . '.' . b64url(hash_hmac('sha256', 'pass.' . $donnees, secret(), true));
}
function lire_pass(string $jeton): ?array {
    $p = explode('.', $jeton);
    if (count($p) !== 2 || strlen($jeton) > 600) return null;
    if (!hash_equals(b64url(hash_hmac('sha256', 'pass.' . $p[0], secret(), true)), $p[1])) return null;
    $d = json_decode(deb64url($p[0]), true);
    return is_array($d) && isset($d['f']) ? $d : null;
}

function porte_valide(string $j): bool { return (bool) preg_match('/^PM-[0-9A-Z]{32}$/', $j); }
function porte_hash(string $j): string { return hash('sha256', $j); }
function solde(string $hash): int { return (int) (lire_json(dossier() . '/porte-monnaie.json', array())[$hash]['solde'] ?? 0); }

/* ───────────────────────────── Stripe ───────────────────────────── */

function http(string $methode, string $url, array $entetes): array {
    $c = curl_init($url);
    $h = array('Accept: application/json');
    foreach ($entetes as $k => $v) $h[] = $k . ': ' . $v;
    curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $methode, CURLOPT_HTTPHEADER => $h,
        CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 8));
    $r = curl_exec($c);
    $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    return array('code' => $code, 'corps' => is_string($r) ? $r : '');
}

function session_stripe(string $id): array {
    $cle = (string) (config()['stripe_cle'] ?? '');
    if ($cle === '') erreur(503, "Le paiement n'est pas encore branché : rien n'a été débité de notre côté. Écrivez à " . DESTINATAIRE . '.');
    $r = http('GET', STRIPE . '/v1/checkout/sessions/' . rawurlencode($id), array('Authorization' => 'Bearer ' . $cle, 'Stripe-Version' => '2024-06-20'));
    if ($r['code'] === 404) erreur(404, 'Paiement introuvable.');
    if ($r['code'] !== 200) erreur(502, 'Vérification du paiement impossible pour le moment. Rechargez la page dans une minute.');
    $s = json_decode($r['corps'], true);
    if (!is_array($s)) erreur(502, 'Réponse de Stripe illisible.');
    return $s;
}

/** Quel produit a été payé ? Commande d'abord, puis l'étiquette « produit » du lien Stripe, puis le montant. */
function produit_de(array $s, ?array $commande): ?string {
    $produits = produits();
    $candidat = $commande['produit'] ?? ($s['metadata']['produit'] ?? null);
    if (is_string($candidat) && isset($produits[$candidat])) return $candidat;
    $montant = (int) ($s['amount_total'] ?? 0);
    if ($montant === $produits['pass_ecosysteme']['prix']) return 'pass_ecosysteme';
    if ($montant === $produits['pass_app']['prix']) return 'pass_app';
    return $montant >= 100 ? 'mecene_libre' : null;
}

/**
 * Traite une session Checkout payée, une seule fois (confirmation par la page « merci » ET webhook : le premier
 * arrivé fait le travail, l'autre relit le résultat). Retourne la vente enregistrée.
 */
function traiter_session(array $s): array {
    $sid = (string) ($s['id'] ?? '');
    if (($s['status'] ?? '') !== 'complete' || ($s['payment_status'] ?? '') !== 'paid') {
        erreur(402, 'Le paiement n\'est pas (encore) confirmé par la banque. Rechargez la page dans quelques minutes.', array('en_attente' => true));
    }
    if (strtolower((string) ($s['currency'] ?? '')) !== 'eur') erreur(400, 'Devise inattendue.');
    $D = dossier();
    $ref = (string) ($s['client_reference_id'] ?? '');
    $commande = $ref !== '' ? (lire_json($D . '/commandes.json', array())[$ref] ?? null) : null;
    $produit = produit_de($s, $commande);
    $produits = produits();
    if ($produit === null) erreur(400, 'Achat non reconnu : écrivez à ' . DESTINATAIRE . ' avec votre reçu Stripe.');
    $montant = (int) ($s['amount_total'] ?? 0);
    if ($montant < $produits[$produit]['prix']) erreur(400, 'Montant inattendu : écrivez à ' . DESTINATAIRE . ' avec votre reçu Stripe.');
    $email = (string) ($s['customer_details']['email'] ?? '');

    $nouvelle = false;
    $vente = modifier($D . '/ventes.json', function (&$v) use ($sid, $produit, $produits, $montant, $commande, &$nouvelle) {
        if (isset($v[$sid])) return $v[$sid];
        $nouvelle = true;
        $type = $produits[$produit]['type'];
        $maintenant = time();
        $r = array('produit' => $produit, 'type' => $type, 'montant' => $montant, 'date' => gmdate('c', $maintenant));
        if ($type === 'pass') {
            $cadeau = ($commande['pour'] ?? 'moi') === 'cadeau';
            $app = $produits[$produit]['offre'] === 'app' ? ($commande['app'] ?? null) : null;
            $r += array('offre' => $produits[$produit]['offre'], 'app' => $app, 'cadeau' => $cadeau, 'message' => (string) ($commande['message'] ?? ''));
            if (!$cadeau) $r += array('pass_id' => 'p_' . substr(hash_hmac('sha256', 'pass|' . $sid, secret()), 0, 16), 'debut' => $maintenant, 'fin' => plus_12_mois($maintenant));
        } elseif ($type === 'credits') {
            $r += array('credits' => credits_par_pack(), 'porte_hash' => $commande['porte_hash'] ?? null);
        } else {
            $r += array('pseudo' => !empty($commande['afficher']) ? (string) ($commande['pseudo'] ?? '') : '');
        }
        $v[$sid] = $r;
        return $r;
    });
    if (!$nouvelle) return array($vente, $sid);

    // Effets de la première confirmation : code, crédits, Tableau d'Honneur, e-mails.
    $type = $vente['type'];
    $code = $type === 'pass' ? code_de($sid) : '';
    if ($type === 'pass') {
        modifier($D . '/codes.json', function (&$c) use ($code, $vente, $sid) {
            $h = hash('sha256', $code);
            if (isset($c[$h])) return;
            $c[$h] = array('session' => $sid, 'offre' => $vente['offre'], 'app' => $vente['app'], 'cadeau' => $vente['cadeau'],
                'pass_id' => $vente['pass_id'] ?? ('c_' . substr($h, 0, 16)), 'debut' => $vente['debut'] ?? null, 'fin' => $vente['fin'] ?? null,
                'achat' => time(), 'limite_activation' => plus_12_mois(time()), 'activations' => 0);
        });
    }
    $porte = '';
    if ($type === 'credits') {
        $hash = $vente['porte_hash'] ?: porte_hash($porte = porte_de($sid));
        modifier($D . '/porte-monnaie.json', function (&$p) use ($hash, $vente, $sid) {
            $p[$hash]['solde'] = (int) ($p[$hash]['solde'] ?? 0) + (int) $vente['credits'];
            $p[$hash]['achats'][] = $sid;
            $p[$hash]['maj'] = gmdate('c');
        });
        modifier($D . '/ventes.json', function (&$v) use ($sid, $hash) { $v[$sid]['porte_hash'] = $hash; });
    }
    $retrait = '';
    if ($type === 'mecene' && pseudo_valide($vente['pseudo'])) {
        $retrait = bin2hex(random_bytes(16));
        $id = 'm_' . substr(hash('sha256', $sid), 0, 12);
        modifier($D . '/honneur.json', function (&$h) use ($id, $vente, $retrait) {
            $h['mecenes'][] = array('id' => $id, 'pseudo' => $vente['pseudo'], 'depuis' => gmdate('Y-m'), 'retrait' => hash('sha256', $retrait));
        });
        $vente['retrait_lien'] = 'https://alphabette.eu/api/paiement.php?retirer=' . $id . '&t=' . $retrait;
    }
    prevenir($vente, $sid, $email, $code, $porte);
    return array(modifier($D . '/ventes.json', function (&$v) use ($sid) { return $v[$sid]; }), $sid);
}

function code_de(string $sid): string { return base32(hash_hmac('sha256', 'code|' . $sid, secret(), true), 12); }
function porte_de(string $sid): string { return 'PM-' . base32(hash_hmac('sha256', 'porte|' . $sid, secret(), true), 32); }

function nom_offre(array $v): string {
    if (($v['offre'] ?? '') === 'ecosysteme') return 'Pass Écosystème — toutes les applications Alphabette';
    $apps = applis_pass();
    return 'Pass Application — ' . ($v['app'] ? ($apps[$v['app']] ?? $v['app']) : "l'application de votre choix");
}

function prevenir(array $v, string $sid, string $email, string $code, string $porte): void {
    $euros = number_format($v['montant'] / 100, 2, ',', ' ') . ' €';
    $merci = 'https://alphabette.eu/merci/?session_id=' . rawurlencode($sid);
    if ($v['type'] === 'pass' && $v['cadeau']) {
        envoyer_mail($email, 'Votre carte cadeau Alphabette', "Bonjour,\n\nMerci pour votre achat ! Voici le code à offrir :\n\n    " . joli_code($code) . "\n\n" . nom_offre($v) . "\nValable 12 mois à partir du jour où il est activé (à activer avant le " . date_fr(plus_12_mois(time())) . ").\nAucun renouvellement automatique.\n\nCarte cadeau à imprimer : $merci\n\nPour l'activer : https://alphabette.eu/pass/ puis « J'ai un code cadeau ».\n\nAlphabette — " . DESTINATAIRE);
    } elseif ($v['type'] === 'pass') {
        envoyer_mail($email, 'Votre Pass Alphabette est actif', "Bonjour,\n\nMerci ! " . nom_offre($v) . " : actif jusqu'au " . date_fr((int) $v['fin']) . ".\nAucun renouvellement automatique : rien ne sera prélevé à la fin.\n\nPour l'utiliser sur un autre appareil (" . activations_max() . " au plus) : https://alphabette.eu/pass/ puis « J'ai un code », et ce code :\n\n    " . joli_code($code) . "\n\nAlphabette — " . DESTINATAIRE);
    } elseif ($v['type'] === 'credits') {
        envoyer_mail($email, 'Vos crédits IA Débat', "Bonjour,\n\nMerci ! " . $v['credits'] . " débats Premium ont été ajoutés à votre porte-monnaie IA Débat. Ils n'expirent pas.\n" . ($porte !== '' ? "\nGardez ce code : il retrouve vos crédits sur un autre appareil (https://alphabette.eu/pass/ puis « J'ai un code ») :\n\n    $porte\n" : '') . "\nAlphabette — " . DESTINATAIRE);
    } else {
        envoyer_mail($email, 'Merci pour votre soutien au Laboratoire Alphabette', "Bonjour,\n\nUn grand merci pour votre soutien de $euros. Il paie l'hébergement OVH et les crédits d'intelligence artificielle du Laboratoire.\nC'est un don : ce n'est pas un abonnement, rien d'autre ne sera prélevé.\n\nAlphabette — " . DESTINATAIRE);
    }
    $quoi = $v['type'] === 'pass' ? nom_offre($v) . ($v['cadeau'] ? ' (CADEAU, code ' . joli_code($code) . ')' : '') : ($v['type'] === 'credits' ? 'Crédits IA Débat (' . $v['credits'] . ')' : 'Mécène du Labo' . ($v['pseudo'] ? ' — pseudo affiché : « ' . $v['pseudo'] . ' »' : ''));
    envoyer_mail(DESTINATAIRE, '[Alphabette] Vente : ' . $quoi . ' — ' . $euros, "Nouvel achat sur alphabette.eu\n\n$quoi\nMontant : $euros\nSession Stripe : $sid\nAcheteur : " . ($email ?: '(e-mail non transmis)') . "\n"
        . (!empty($v['retrait_lien']) ? "\nRetirer ce pseudo du Tableau d'Honneur : " . $v['retrait_lien'] . "\n" : '')
        . "\nRemboursement (14 jours, CGV) : depuis le tableau de bord Stripe.");
}

function pseudo_valide(string $p): bool {
    if (mb_strlen($p) < 2 || mb_strlen($p) > 30) return false;
    if (!preg_match('/^[\p{L}\p{N} ._\'’-]+$/u', $p)) return false;               // lettres, chiffres, espace et . _ ' -
    if (preg_match('/(https?|www|\.(com|fr|eu|net|org|io)\b|\d{6,})/i', $p)) return false; // ni lien ni numéro
    return !preg_match('/\b(con|conne|connard|connasse|salope|pute|encul|nique|merde|batard|bâtard|nazi|hitler|fuck|shit|bitch|porn|sexe|viagra|casino)/iu', $p);
}

/** Pass délivré à ce navigateur pour une vente « pour moi ». */
function pass_de_vente(array $v): array {
    $apps = applis_pass();
    return array('type' => 'pass', 'jeton' => jeton_pass($v['pass_id'], $v['offre'], $v['app'], (int) $v['debut'], (int) $v['fin']),
        'offre' => $v['offre'], 'app' => $v['app'], 'app_nom' => $v['app'] ? ($apps[$v['app']] ?? $v['app']) : null,
        'debut' => (int) $v['debut'] * 1000, 'fin' => (int) $v['fin'] * 1000, 'appareils' => activations_max());
}

/* ───────────────────────────── installation ───────────────────────────── */

if (isset($_GET['installer'])) {
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        $e = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($e) || !hash_equals(JETON_INSTALLATION_SHA256, hash('sha256', (string) ($e['jeton'] ?? '')))) erreur(403, 'Lien d\'installation invalide.');
        $cle = trim((string) ($e['stripe_cle'] ?? ''));
        $wh = trim((string) ($e['webhook_secret'] ?? ''));
        if ($cle !== '' && !preg_match('/^(rk|sk)_(live|test)_[0-9A-Za-z]{20,}$/', $cle)) erreur(400, 'Clé Stripe inattendue (rk_live_… conseillée : clé restreinte, lecture des sessions Checkout).');
        if ($wh !== '' && !preg_match('/^whsec_[0-9A-Za-z]{20,}$/', $wh)) erreur(400, 'Secret de webhook inattendu (whsec_…).');
        if ($cle !== '') {
            $t = http('GET', STRIPE . '/v1/checkout/sessions?limit=1', array('Authorization' => 'Bearer ' . $cle));
            if ($t['code'] !== 200) erreur(400, 'Stripe refuse cette clé (' . $t['code'] . ') : elle doit pouvoir LIRE les sessions Checkout.');
        }
        $c = modifier(dossier() . '/config.json', function (&$c) use ($cle, $wh) {
            if ($cle !== '') $c['stripe_cle'] = $cle;
            if ($wh !== '') $c['webhook_secret'] = $wh;
            $c['installe'] = gmdate('c');
            return $c;
        });
        repondre(200, array('ok' => true, 'cle' => !empty($c['stripe_cle']), 'webhook' => !empty($c['webhook_secret'])));
    }
    header('Content-Type: text/html; charset=utf-8');
    $c = config();
    echo '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
        . '<title>Alphabette — brancher Stripe</title><body style="font:18px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem">'
        . '<h1>Brancher le paiement Stripe</h1><p>Clé : <b>' . (empty($c['stripe_cle']) ? 'absente' : 'enregistrée') . '</b> · Webhook : <b>' . (empty($c['webhook_secret']) ? 'absent' : 'enregistré') . '</b></p>'
        . '<form id="f"><p><label>Clé restreinte Stripe (rk_live_…)<br><input name="stripe_cle" autocomplete="off" style="width:100%;min-height:44px"></label></p>'
        . '<p><label>Secret du webhook (whsec_…)<br><input name="webhook_secret" autocomplete="off" style="width:100%;min-height:44px"></label></p>'
        . '<button style="min-height:48px;padding:0 1.2rem">Enregistrer hors du site</button></form><p id="r" role="status"></p>'
        . '<script>var j=(location.hash.match(/jeton=([^&]+)/)||[])[1]||sessionStorage.getItem("pay_jeton")||"";if(j){sessionStorage.setItem("pay_jeton",j);history.replaceState(null,"",location.pathname+"?installer");}'
        . 'document.getElementById("f").onsubmit=async function(e){e.preventDefault();var d=Object.fromEntries(new FormData(this));d.jeton=j;var r=await fetch("?installer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});var x=await r.json().catch(function(){return{}});document.getElementById("r").textContent=r.ok?"✅ Enregistré (clé : "+(x.cle?"oui":"non")+", webhook : "+(x.webhook?"oui":"non")+").":"⛔ "+(x.erreur||r.status);};</script>';
    exit;
}

/* ───────────────────────────── retrait d'un pseudo ───────────────────────────── */

if (isset($_GET['retirer'])) {
    $id = (string) $_GET['retirer'];
    $t = (string) ($_GET['t'] ?? '');
    $h = lire_json(dossier() . '/honneur.json', array());
    $entree = null;
    foreach ($h['mecenes'] ?? array() as $m) if (($m['id'] ?? '') === $id) $entree = $m;
    header('Content-Type: text/html; charset=utf-8');
    if (!$entree || !hash_equals((string) $entree['retrait'], hash('sha256', $t))) { http_response_code(404); echo 'Lien invalide ou déjà utilisé.'; exit; }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        modifier(dossier() . '/honneur.json', function (&$h) use ($id) { $h['mecenes'] = array_values(array_filter($h['mecenes'] ?? array(), function ($m) use ($id) { return ($m['id'] ?? '') !== $id; })); });
        echo '<!doctype html><meta charset="utf-8"><p style="font:18px system-ui;margin:2rem">✅ Pseudo retiré du Tableau d\'Honneur.</p>';
        exit;
    }
    // Une page de confirmation : un lecteur d'e-mails qui ouvre le lien tout seul ne retire rien.
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><form method="post" style="font:18px system-ui;margin:2rem">'
        . '<p>Retirer « ' . htmlspecialchars((string) $entree['pseudo'], ENT_QUOTES) . ' » du Tableau d\'Honneur ?</p><button style="min-height:48px;padding:0 1.2rem">Oui, retirer</button></form>';
    exit;
}

/* ───────────────────────────── lectures ───────────────────────────── */

$METHODE = $_SERVER['REQUEST_METHOD'] ?? '';
if ($METHODE === 'OPTIONS') repondre(204, array());

if ($METHODE === 'GET' && isset($_GET['etat'])) {
    $cle = !empty(config()['stripe_cle']);
    $ouvert = array();
    $gratuit = gratuit_jusqu_au();
    foreach (produits() as $k => $p) $ouvert[$k] = $cle && lien_valide($p['lien']) && !($gratuit && payant($k));
    $prix = array_map(function ($p) { return $p['prix'] / 100; }, produits());
    repondre(200, array('ouvert' => $ouvert, 'prix' => $prix, 'gratuit_jusqu_au' => $gratuit, 'credits_par_pack' => credits_par_pack(), 'appareils' => activations_max(),
        'decouverte' => array('ouverte' => decouverte_ouverte(), 'heures' => heures_decouverte(), 'premium_par_jour' => (int) (public_json('paiements.json')['decouverte']['premium_par_jour'] ?? 3)), 'applis_pass' => applis_pass()));
}

if ($METHODE === 'GET' && isset($_GET['solde'])) {
    $j = (string) ($_SERVER['HTTP_X_ALPHABETTE_CREDITS'] ?? '');
    if (!porte_valide($j)) erreur(400, 'Porte-monnaie inconnu.');
    repondre(200, array('solde' => solde(porte_hash($j))));
}

if ($METHODE === 'GET' && isset($_GET['honneur'])) {
    header('Cache-Control: public, max-age=300');
    $liste = array_map(function ($m) { return array('pseudo' => $m['pseudo'], 'depuis' => $m['depuis']); }, lire_json(dossier() . '/honneur.json', array())['mecenes'] ?? array());
    repondre(200, array('mecenes' => array_reverse($liste)));
}

/* ───────────────────────────── webhook Stripe ───────────────────────────── */

if ($METHODE === 'POST' && isset($_GET['webhook'])) {
    $corps = (string) file_get_contents('php://input');
    $secret = (string) (config()['webhook_secret'] ?? '');
    if ($secret === '') erreur(503, 'Webhook non configuré.');
    $t = ''; $v1 = array();
    foreach (explode(',', (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '')) as $morceau) {
        $kv = explode('=', trim($morceau), 2);
        if (count($kv) !== 2) continue;
        if ($kv[0] === 't') $t = $kv[1];
        if ($kv[0] === 'v1') $v1[] = $kv[1];
    }
    $attendu = hash_hmac('sha256', $t . '.' . $corps, $secret);
    $ok = false;
    foreach ($v1 as $s) if (hash_equals($attendu, $s)) $ok = true;
    if (!$ok || !ctype_digit($t) || abs(time() - (int) $t) > 300) erreur(400, 'Signature invalide.');
    $ev = json_decode($corps, true);
    $type = (string) ($ev['type'] ?? '');
    $s = $ev['data']['object'] ?? null;
    if (in_array($type, array('checkout.session.completed', 'checkout.session.async_payment_succeeded'), true) && is_array($s) && ($s['payment_status'] ?? '') === 'paid') {
        // On relit la session chez Stripe : l'événement ne sert que de signal.
        traiter_session(session_stripe((string) ($s['id'] ?? '')));
    }
    repondre(200, array('recu' => true));
}

/* ───────────────────────────── actions ───────────────────────────── */

if ($METHODE !== 'POST') repondre(200, array('ok' => true));
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 8192) erreur(413, 'Demande trop longue.');
$e = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($e)) erreur(400, 'Demande illisible.');
$action = (string) ($e['action'] ?? '');

if ($action === 'decouverte') {
    if (!decouverte_ouverte()) erreur(503, 'Le Pass Découverte ouvre très bientôt : les débats Premium ne sont pas encore alimentés.', array('bientot' => true));
    if (!limite('decouverte', 1)) erreur(429, "Un Pass Découverte a déjà été ouvert aujourd'hui depuis cette connexion. Il reste valable 48 h sur l'appareil où il a été ouvert.");
    $debut = time();
    $fin = $debut + heures_decouverte() * 3600;
    $id = 'd_' . bin2hex(random_bytes(8));
    repondre(200, array('jeton' => jeton_pass($id, 'decouverte', null, $debut, $fin), 'debut' => $debut * 1000, 'fin' => $fin * 1000));
}

if ($action === 'verifier') {
    $p = lire_pass((string) ($e['jeton'] ?? ''));
    repondre(200, array('valide' => $p !== null && (int) $p['f'] > time(), 'offre' => $p['o'] ?? null, 'app' => $p['a'] ?? null, 'fin' => $p ? (int) $p['f'] * 1000 : null));
}

if ($action === 'commander') {
    $produits = produits();
    $produit = (string) ($e['produit'] ?? '');
    if (!isset($produits[$produit])) erreur(400, 'Offre inconnue.');
    $gratuit = gratuit_jusqu_au();
    if ($gratuit && payant($produit)) erreur(403, 'Rien à payer : Alphabette est gratuit jusqu\'au ' . date_fr((int) strtotime($gratuit . ' 12:00:00')) . ' inclus.', array('gratuit_jusqu_au' => $gratuit));
    if (empty(config()['stripe_cle']) || !lien_valide($produits[$produit]['lien'])) erreur(503, "Le paiement en ligne n'est pas encore ouvert pour cette offre.", array('ferme' => true));
    if (!limite('commande', 30)) erreur(429, "Beaucoup d'essais aujourd'hui : revenez demain ou écrivez à " . DESTINATAIRE . '.');
    $type = $produits[$produit]['type'];
    $c = array('produit' => $produit, 'cree' => time(), 'pour' => 'moi');
    if ($type === 'pass') {
        $c['pour'] = ($e['pour'] ?? '') === 'cadeau' ? 'cadeau' : 'moi';
        if ($produits[$produit]['offre'] === 'app') {
            $app = (string) ($e['app'] ?? '');
            if (!isset(applis_pass()[$app])) erreur(400, "Choisissez l'application du Pass.");
            $c['app'] = $app;
        }
        if ($c['pour'] === 'cadeau') $c['message'] = texte((string) ($e['message'] ?? ''), 140);
    } elseif ($type === 'credits') {
        $pm = (string) ($e['porte_monnaie'] ?? '');
        if ($pm !== '' && porte_valide($pm)) $c['porte_hash'] = porte_hash($pm);
    } else {
        $pseudo = texte((string) ($e['pseudo'] ?? ''), 30);
        if (!empty($e['afficher'])) {
            if (!pseudo_valide($pseudo)) erreur(400, 'Pseudo à afficher : 2 à 30 lettres ou chiffres, sans lien ni numéro.');
            $c['afficher'] = true;
            $c['pseudo'] = $pseudo;
        }
    }
    $ref = 'cmd_' . bin2hex(random_bytes(12));
    modifier(dossier() . '/commandes.json', function (&$d) use ($ref, $c) {
        foreach ($d as $k => $x) if ((int) ($x['cree'] ?? 0) < time() - 14 * 86400) unset($d[$k]);
        $d[$ref] = $c;
    });
    repondre(200, array('lien' => $produits[$produit]['lien'] . '?client_reference_id=' . $ref));
}

if ($action === 'confirmer') {
    $sid = (string) ($e['session_id'] ?? '');
    if (!preg_match('/^cs_(test|live)_[A-Za-z0-9]{10,200}$/', $sid)) erreur(400, 'Paiement introuvable.');
    if (!limite('confirmation', 60)) erreur(429, 'Trop de vérifications : réessayez dans un moment.');
    list($v, $sid) = traiter_session(session_stripe($sid));
    $apps = applis_pass();
    if ($v['type'] === 'pass' && $v['offre'] === 'app' && !$v['app']) {
        // Pass 15 € payé directement (sans passer par la page des offres) : l'acheteur choisit son application, une fois.
        $app = (string) ($e['app'] ?? '');
        if (!isset($apps[$app])) repondre(200, array('type' => 'choisir_app', 'applis' => $apps, 'cadeau' => $v['cadeau']));
        $v = modifier(dossier() . '/ventes.json', function (&$d) use ($sid, $app) { if (empty($d[$sid]['app'])) $d[$sid]['app'] = $app; return $d[$sid]; });
        modifier(dossier() . '/codes.json', function (&$c) use ($sid, $v) { foreach ($c as $h => $x) if (($x['session'] ?? '') === $sid) $c[$h]['app'] = $v['app']; });
    }
    if ($v['type'] === 'pass' && $v['cadeau']) {
        repondre(200, array('type' => 'cadeau', 'code' => joli_code(code_de($sid)), 'offre' => $v['offre'], 'app' => $v['app'],
            'app_nom' => $v['app'] ? ($apps[$v['app']] ?? $v['app']) : null, 'message' => $v['message'] ?? '',
            'activer_avant' => plus_12_mois(strtotime((string) $v['date'])) * 1000, 'appareils' => activations_max()));
    }
    if ($v['type'] === 'pass') repondre(200, pass_de_vente($v) + array('code' => joli_code(code_de($sid))));
    if ($v['type'] === 'credits') {
        $nouveau = porte_hash(porte_de($sid)) === $v['porte_hash'];
        repondre(200, array('type' => 'credits', 'ajoutes' => (int) $v['credits'], 'solde' => solde((string) $v['porte_hash']), 'porte_monnaie' => $nouveau ? porte_de($sid) : null));
    }
    repondre(200, array('type' => 'mecene', 'montant' => $v['montant'] / 100, 'pseudo' => $v['pseudo'] !== '' && pseudo_valide($v['pseudo']) ? $v['pseudo'] : null));
}

if ($action === 'activer') {
    $brut = trim((string) ($e['code'] ?? ''));
    if (!limite('activation', 10)) erreur(429, "Trop d'essais aujourd'hui depuis cette connexion : réessayez demain.");
    if (preg_match('/^PM-?[0-9A-Za-z]{32}$/i', str_replace(' ', '', $brut))) {
        $pm = 'PM-' . normaliser_code(substr(str_replace(' ', '', $brut), -32));
        $p = lire_json(dossier() . '/porte-monnaie.json', array())[porte_hash($pm)] ?? null;
        if (!$p) erreur(404, 'Ce code de porte-monnaie est inconnu. Vérifiez les lettres et les chiffres.');
        repondre(200, array('type' => 'credits', 'porte_monnaie' => $pm, 'solde' => (int) $p['solde']));
    }
    $code = normaliser_code($brut);
    if (strlen($code) !== 12) erreur(400, 'Un code cadeau a 12 caractères (par exemple ALPHA-7K3M-Q9TD-2HXN).');
    $h = hash('sha256', $code);
    $res = modifier(dossier() . '/codes.json', function (&$c) use ($h) {
        if (!isset($c[$h])) return array('refus' => 'inconnu');
        $x = $c[$h];
        if ((int) $x['activations'] >= activations_max()) return array('refus' => 'utilise');
        if ($x['cadeau'] && $x['debut'] === null) {
            if (time() > (int) $x['limite_activation']) return array('refus' => 'expire');
            $c[$h]['debut'] = time();
            $c[$h]['fin'] = plus_12_mois(time());
        }
        if ((int) $c[$h]['fin'] <= time()) return array('refus' => 'fini');
        $c[$h]['activations'] = (int) $x['activations'] + 1;
        return $c[$h];
    });
    $msg = array('inconnu' => 'Ce code est inconnu. Vérifiez les lettres et les chiffres (un 0 et un O, c\'est pareil).',
        'utilise' => 'Ce code a déjà servi sur ' . activations_max() . ' appareils. Écrivez à ' . DESTINATAIRE . ' si c\'est une erreur.',
        'expire' => 'Ce code cadeau n\'a pas été activé dans les 12 mois suivant l\'achat. Écrivez à ' . DESTINATAIRE . '.',
        'fini' => 'Les 12 mois de ce Pass sont terminés.');
    if (isset($res['refus'])) erreur($res['refus'] === 'inconnu' ? 404 : 410, $msg[$res['refus']]);
    if ($res['offre'] === 'app' && !$res['app']) erreur(409, "Ce Pass attend le choix de son application : ouvrez le lien reçu par e-mail après l'achat.");
    $apps = applis_pass();
    repondre(200, array('type' => 'pass', 'jeton' => jeton_pass((string) $res['pass_id'], (string) $res['offre'], $res['app'], (int) $res['debut'], (int) $res['fin']),
        'offre' => $res['offre'], 'app' => $res['app'], 'app_nom' => $res['app'] ? ($apps[$res['app']] ?? $res['app']) : null,
        'debut' => (int) $res['debut'] * 1000, 'fin' => (int) $res['fin'] * 1000, 'cadeau' => (bool) $res['cadeau']));
}

erreur(400, 'Action inconnue.');
