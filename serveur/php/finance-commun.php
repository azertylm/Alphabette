<?php
/**
 * finance-commun.php — socle partagé par billing.php, webhooks.php, payouts.php, upload-guard.php et gdpr.php.
 * Publié dans eu/api/ par scripts/build-static.mjs. N'est jamais appelé seul (404 si on l'ouvre).
 *
 * RÈGLES MÉTIER (CLAUDE.md) — tout en CENTIMES ENTIERS, jamais de flottant :
 *   abonnement 15,00 €/an = 1500 c. = 1000 c. créateur + 500 c. Alphabette. Pas de Pass 40 €, pas de prorata.
 *   virement créateur : seuil 2000 c. (20,00 €).
 *
 * Données privées HORS du site : ~/alphabette-finance/ (ou variable ALPHABETTE_FINANCE_DIR) → finance.sqlite.
 * Secrets lus dans l'environnement (SetEnv du .htaccess OVH ou variables du serveur), sinon fichiers 0600 du dossier privé :
 *   ALPHABETTE_IBAN_KEY        clé AES-256-GCM des IBAN (64 hex ou base64 de 32 octets)
 *   ALPHABETTE_WEBHOOK_SECRET  secret de signature des webhooks Stripe (whsec_…)
 *   ALPHABETTE_ADMIN_PASSWORD  mot de passe de l'administration (en-tête X-Admin-Password)
 * Webhook et admin peuvent aussi être posés dans ~/alphabette-finance/config.json { webhook_secret, admin_password }.
 * Zéro pistage : aucun cookie, aucune IP enregistrée (empreintes HMAC seulement), aucun service tiers.
 */
declare(strict_types=1);

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) { http_response_code(404); exit; }

const PRIX_ABONNEMENT_CENTIMES = 1500;
const PART_CREATEUR_CENTIMES = 1000;
const PART_ALPHABETTE_CENTIMES = 500;
const SEUIL_VIREMENT_CENTIMES = 2000;
const DUREE_ABONNEMENT_SECONDES = 365 * 86400;
const DELAI_DISPONIBILITE_DEFAUT = 14 * 86400; // droit de rétractation de 14 jours avant que les gains soient virables
const OTP_DUREE_SECONDES = 15 * 60;
const OTP_ESSAIS_MAX = 5;
const SESSION_DUREE_SECONDES = 30 * 86400;
const ADMIN_EMAIL = 'azertylm@gmail.com';
const EXPEDITEUR_FINANCE = 'Alphabette <revenus@alphabette.eu>';

if (PART_CREATEUR_CENTIMES + PART_ALPHABETTE_CENTIMES !== PRIX_ABONNEMENT_CENTIMES) { http_response_code(500); exit; }

function f_entetes(): void {
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    header('Referrer-Policy: no-referrer');
    $o = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if (preg_match('#^https://([a-z0-9-]+\.)?alphabette\.(fr|eu)$#', $o)) {
        header('Access-Control-Allow-Origin: ' . $o);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Password');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}

function f_repondre(int $code, array $d): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function f_erreur(int $code, string $m, array $plus = array()): void { f_repondre($code, array('erreur' => $m) + $plus); }

function f_corps(): array {
    $t = file_get_contents('php://input') ?: '';
    if (strlen($t) > 65536) f_erreur(413, 'Requête trop grosse.');
    $d = json_decode($t, true);
    return is_array($d) ? $d : array();
}

function f_maintenant(): int {
    // Horloge réglable UNIQUEMENT pour les tests automatisés (variable d'environnement du serveur, jamais de la requête).
    $t = getenv('ALPHABETTE_FINANCE_HORLOGE');
    return ($t !== false && ctype_digit($t)) ? (int) $t : time();
}

function f_delai_disponibilite(): int {
    $d = getenv('ALPHABETTE_FINANCE_DELAI');
    return ($d !== false && ctype_digit($d)) ? (int) $d : DELAI_DISPONIBILITE_DEFAUT;
}

function f_dossier(): string {
    $d = getenv('ALPHABETTE_FINANCE_DIR');
    if (!$d) {
        $maison = getenv('HOME') ?: dirname((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__));
        $d = rtrim($maison, '/') . '/alphabette-finance';
    }
    if (!is_dir($d)) @mkdir($d, 0700, true);
    if (!is_dir($d) || !is_writable($d)) f_erreur(503, 'Service indisponible pour le moment.');
    return $d;
}

/** Secret : variable d'environnement, sinon fichier 0600 créé une fois dans le dossier privé. */
function f_secret(string $env, string $fichier, int $octets = 32): string {
    $v = getenv($env);
    if (is_string($v) && $v !== '') return $v;
    $f = f_dossier() . '/' . $fichier;
    if (!is_file($f)) {
        $tmp = $f . '.' . bin2hex(random_bytes(4));
        file_put_contents($tmp, bin2hex(random_bytes($octets)));
        @chmod($tmp, 0600);
        if (!@link($tmp, $f)) { /* un autre processus l'a créé */ }
        @unlink($tmp);
    }
    return trim((string) file_get_contents($f));
}

/** Réglage : variable d'environnement, sinon ~/alphabette-finance/config.json (hors du site, jamais dans le dépôt). */
function f_reglage(string $env, string $cle): string {
    $v = getenv($env);
    if (is_string($v) && $v !== '') return $v;
    $f = f_dossier() . '/config.json';
    $c = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
    return is_array($c) && is_string($c[$cle] ?? null) ? $c[$cle] : '';
}

function f_hmac(string $s): string { return hash_hmac('sha256', $s, f_secret('ALPHABETTE_FINANCE_SECRET', 'secret.key')); }

/* ───────────────────────────── base SQLite ───────────────────────────── */

function f_db(): PDO {
    static $db = null;
    if ($db) return $db;
    $db = new PDO('sqlite:' . f_dossier() . '/finance.sqlite', null, null, array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION));
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec('PRAGMA busy_timeout = 8000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    $db->exec(<<<SQL
CREATE TABLE IF NOT EXISTS comptes (
  id INTEGER PRIMARY KEY, email TEXT, email_hash TEXT UNIQUE, pseudo TEXT,
  iban_chiffre TEXT, iban_fin TEXT, iban_pays TEXT, cree_le INTEGER NOT NULL, supprime_le INTEGER);
CREATE TABLE IF NOT EXISTS sessions (jeton_hash TEXT PRIMARY KEY, compte_id INTEGER NOT NULL, expire INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS otp (
  compte_id INTEGER NOT NULL, but TEXT NOT NULL, code_hash TEXT NOT NULL, expire INTEGER NOT NULL, essais INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (compte_id, but));
CREATE TABLE IF NOT EXISTS limites (cle TEXT PRIMARY KEY, n INTEGER NOT NULL, fin INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS applis (slug TEXT PRIMARY KEY, createur_id INTEGER, statut TEXT NOT NULL DEFAULT 'active', maj INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS webhook_events (
  provider_event_id TEXT PRIMARY KEY, type TEXT NOT NULL, resultat TEXT NOT NULL, recu_le INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS abonnements (
  id INTEGER PRIMARY KEY, app_slug TEXT NOT NULL, abonne_hash TEXT, paiement_ref TEXT UNIQUE,
  montant_centimes INTEGER NOT NULL CHECK (montant_centimes = 1500), debut INTEGER NOT NULL, fin INTEGER NOT NULL,
  statut TEXT NOT NULL DEFAULT 'actif', provider_event_id TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS ecritures (
  id INTEGER PRIMARY KEY, compte_id INTEGER, beneficiaire TEXT NOT NULL CHECK (beneficiaire IN ('createur','alphabette')),
  type TEXT NOT NULL, montant_centimes INTEGER NOT NULL, app_slug TEXT, abonnement_id INTEGER, virement_id INTEGER,
  provider_event_id TEXT, disponible_le INTEGER NOT NULL, cree_le INTEGER NOT NULL, libelle TEXT);
CREATE INDEX IF NOT EXISTS ecritures_compte ON ecritures (compte_id, cree_le);
CREATE TABLE IF NOT EXISTS virements (
  id INTEGER PRIMARY KEY, compte_id INTEGER NOT NULL, montant_centimes INTEGER NOT NULL CHECK (montant_centimes >= 2000),
  iban_fin TEXT, statut TEXT NOT NULL, cree_le INTEGER NOT NULL, traite_le INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS un_virement_en_cours ON virements (compte_id) WHERE statut = 'demande';
CREATE TABLE IF NOT EXISTS signalements (
  app_slug TEXT NOT NULL, rapporteur TEXT NOT NULL, motif TEXT NOT NULL, cree_le INTEGER NOT NULL, PRIMARY KEY (app_slug, rapporteur));
CREATE TABLE IF NOT EXISTS empreintes (
  app_slug TEXT PRIMARY KEY, compte_id INTEGER, sha256 TEXT NOT NULL, structure TEXT NOT NULL, cree_le INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS empreintes_sha ON empreintes (sha256);
CREATE INDEX IF NOT EXISTS empreintes_structure ON empreintes (structure);
CREATE TABLE IF NOT EXISTS visites (app_slug TEXT NOT NULL, jour TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (app_slug, jour));
SQL);
    return $db;
}

/** Transaction à verrou d'écriture immédiat (aucune double écriture possible entre deux requêtes simultanées). */
function f_transaction(callable $fn) {
    $db = f_db();
    $db->exec('BEGIN IMMEDIATE');
    try { $r = $fn($db); $db->exec('COMMIT'); return $r; }
    catch (Throwable $e) { $db->exec('ROLLBACK'); throw $e; }
}

/** Formatage d'affichage uniquement : le calcul reste en entiers. */
function f_euros(int $c): string {
    $signe = $c < 0 ? '-' : '';
    $c = abs($c);
    return $signe . intdiv($c, 100) . ',' . str_pad((string) ($c % 100), 2, '0', STR_PAD_LEFT) . ' €';
}

/* ───────────────────────────── limites, empreintes ───────────────────────────── */

function f_empreinte_ip(): string { return substr(f_hmac('ip|' . ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 32); }

function f_limite(string $cle, int $max, int $fenetre): bool {
    $t = f_maintenant();
    return f_transaction(function (PDO $db) use ($cle, $max, $fenetre, $t) {
        $db->prepare('DELETE FROM limites WHERE fin < ?')->execute(array($t));
        $q = $db->prepare('SELECT n FROM limites WHERE cle = ?'); $q->execute(array($cle));
        $n = $q->fetchColumn();
        if ($n === false) { $db->prepare('INSERT INTO limites (cle, n, fin) VALUES (?, 1, ?)')->execute(array($cle, $t + $fenetre)); return true; }
        if ((int) $n >= $max) return false;
        $db->prepare('UPDATE limites SET n = n + 1 WHERE cle = ?')->execute(array($cle));
        return true;
    });
}

/* ───────────────────────────── e-mails ───────────────────────────── */

function f_mail(string $a, string $sujet, string $corps): bool {
    $test = getenv('ALPHABETTE_FINANCE_MAIL_DIR'); // tests : le message est écrit dans un fichier au lieu d'être envoyé
    if ($test) {
        @file_put_contents(rtrim($test, '/') . '/' . preg_replace('/[^a-z0-9@._-]/i', '_', $a) . '.txt', $sujet . "\n\n" . $corps . "\n---\n", FILE_APPEND);
        return true;
    }
    if (!function_exists('mail')) return false;
    return @mail($a, '=?UTF-8?B?' . base64_encode($sujet) . '?=', $corps, 'From: ' . EXPEDITEUR_FINANCE . "\r\nContent-Type: text/plain; charset=UTF-8");
}

/* ───────────────────────────── comptes & sessions ───────────────────────────── */

function f_email_valide(string $e): bool { return strlen($e) <= 190 && filter_var($e, FILTER_VALIDATE_EMAIL) !== false; }
function f_email_hash(string $e): string { return f_hmac('email|' . mb_strtolower(trim($e), 'UTF-8')); }

function f_compte_par_email(string $email, bool $creer): ?array {
    $h = f_email_hash($email);
    $q = f_db()->prepare('SELECT * FROM comptes WHERE email_hash = ?'); $q->execute(array($h));
    $c = $q->fetch();
    if ($c || !$creer) return $c ?: null;
    f_db()->prepare('INSERT OR IGNORE INTO comptes (email, email_hash, cree_le) VALUES (?, ?, ?)')->execute(array(mb_strtolower(trim($email), 'UTF-8'), $h, f_maintenant()));
    $q->execute(array($h));
    return $q->fetch() ?: null;
}

function f_compte(int $id): ?array {
    $q = f_db()->prepare('SELECT * FROM comptes WHERE id = ? AND supprime_le IS NULL'); $q->execute(array($id));
    return $q->fetch() ?: null;
}

/** Compte connecté (en-tête Authorization: Bearer <jeton>). Pas de cookie. */
function f_compte_connecte(bool $obligatoire = true): ?array {
    $h = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^Bearer\s+([A-Za-z0-9_-]{20,100})$/', $h, $m)) {
        $q = f_db()->prepare('SELECT compte_id FROM sessions WHERE jeton_hash = ? AND expire > ?');
        $q->execute(array(hash('sha256', $m[1]), f_maintenant()));
        $id = $q->fetchColumn();
        if ($id !== false && ($c = f_compte((int) $id))) return $c;
    }
    if ($obligatoire) f_erreur(401, 'Connectez-vous pour continuer.');
    return null;
}

function f_ouvrir_session(int $compte_id): string {
    $jeton = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $db = f_db();
    $db->prepare('DELETE FROM sessions WHERE expire < ?')->execute(array(f_maintenant()));
    $db->prepare('INSERT INTO sessions (jeton_hash, compte_id, expire) VALUES (?, ?, ?)')->execute(array(hash('sha256', $jeton), $compte_id, f_maintenant() + SESSION_DUREE_SECONDES));
    return $jeton;
}

/* ───────────────────────────── codes à usage unique (6 chiffres, 15 min) ───────────────────────────── */

function f_otp_creer(int $compte_id, string $but): string {
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    f_db()->prepare('INSERT OR REPLACE INTO otp (compte_id, but, code_hash, expire, essais) VALUES (?, ?, ?, ?, 0)')
        ->execute(array($compte_id, $but, f_hmac("otp|$compte_id|$but|$code"), f_maintenant() + OTP_DUREE_SECONDES));
    return $code;
}

/** Vérifie ET consomme le code (un seul usage). Renvoie 'ok', 'expire', 'faux' ou 'bloque'. */
function f_otp_verifier(PDO $db, int $compte_id, string $but, string $code): string {
    $q = $db->prepare('SELECT * FROM otp WHERE compte_id = ? AND but = ?'); $q->execute(array($compte_id, $but));
    $o = $q->fetch();
    if (!$o) return 'expire';
    if ((int) $o['expire'] < f_maintenant()) { $db->prepare('DELETE FROM otp WHERE compte_id = ? AND but = ?')->execute(array($compte_id, $but)); return 'expire'; }
    if ((int) $o['essais'] >= OTP_ESSAIS_MAX) return 'bloque';
    if (!preg_match('/^\d{6}$/', $code) || !hash_equals($o['code_hash'], f_hmac("otp|$compte_id|$but|$code"))) {
        $db->prepare('UPDATE otp SET essais = essais + 1 WHERE compte_id = ? AND but = ?')->execute(array($compte_id, $but));
        return 'faux';
    }
    $db->prepare('DELETE FROM otp WHERE compte_id = ? AND but = ?')->execute(array($compte_id, $but));
    return 'ok';
}

/* ───────────────────────────── IBAN : validation + chiffrement AES-256-GCM ───────────────────────────── */

function f_iban_normaliser(string $i): string { return strtoupper(preg_replace('/[\s-]+/', '', $i) ?? ''); }

/** Contrôle ISO 13616 (modulo 97) + longueur du pays pour les pays SEPA courants. */
function f_iban_valide(string $iban): bool {
    $iban = f_iban_normaliser($iban);
    if (!preg_match('/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/', $iban)) return false;
    $longueurs = array('FR' => 27, 'BE' => 16, 'DE' => 22, 'ES' => 24, 'IT' => 27, 'LU' => 20, 'MC' => 27, 'CH' => 21, 'NL' => 18, 'PT' => 25, 'AT' => 20, 'IE' => 22, 'GB' => 22);
    $pays = substr($iban, 0, 2);
    if (isset($longueurs[$pays]) && strlen($iban) !== $longueurs[$pays]) return false;
    $r = substr($iban, 4) . substr($iban, 0, 4);
    $num = '';
    foreach (str_split($r) as $ch) $num .= ctype_alpha($ch) ? (string) (ord($ch) - 55) : $ch;
    $reste = 0;
    foreach (str_split($num, 7) as $morceau) $reste = (int) ((string) $reste . $morceau) % 97;
    return $reste === 1;
}

/** Affichage masqué « FR76 •••• •••• 1234 » (colonne iban_pays = 4 premiers caractères, iban_fin = 4 derniers). */
function f_iban_masque_compte(array $c): string {
    if (empty($c['iban_fin'])) return '';
    return substr((string) $c['iban_pays'], 0, 4) . ' •••• •••• ' . $c['iban_fin'];
}

function f_cle_iban(): string {
    $k = f_secret('ALPHABETTE_IBAN_KEY', 'cle-iban.key');
    if (preg_match('/^[0-9a-f]{64}$/i', $k)) return (string) hex2bin($k);
    $b = base64_decode($k, true);
    if ($b !== false && strlen($b) === 32) return $b;
    f_erreur(503, 'Chiffrement indisponible : clé IBAN mal réglée.');
    return '';
}

function f_chiffrer(string $clair, string $contexte): string {
    $iv = random_bytes(12);
    $tag = '';
    $ct = openssl_encrypt($clair, 'aes-256-gcm', f_cle_iban(), OPENSSL_RAW_DATA, $iv, $tag, $contexte, 16);
    if ($ct === false) f_erreur(503, 'Chiffrement impossible.');
    return 'v1:' . base64_encode($iv . $tag . $ct);
}

function f_dechiffrer(string $paquet, string $contexte): ?string {
    if (strncmp($paquet, 'v1:', 3) !== 0) return null;
    $b = base64_decode(substr($paquet, 3), true);
    if ($b === false || strlen($b) < 29) return null;
    $r = openssl_decrypt(substr($b, 28), 'aes-256-gcm', f_cle_iban(), OPENSSL_RAW_DATA, substr($b, 0, 12), substr($b, 12, 16), $contexte);
    return $r === false ? null : $r;
}

/* ───────────────────────────── soldes (entiers) ───────────────────────────── */

/** Gains en attente (rétractation pas encore écoulée) et solde disponible (virable), en centimes. */
function f_soldes(int $compte_id): array {
    $q = f_db()->prepare("SELECT
        COALESCE(SUM(CASE WHEN disponible_le >  ? THEN montant_centimes ELSE 0 END), 0) AS attente,
        COALESCE(SUM(CASE WHEN disponible_le <= ? THEN montant_centimes ELSE 0 END), 0) AS disponible,
        COALESCE(SUM(CASE WHEN type = 'vente' THEN montant_centimes ELSE 0 END), 0) AS total_gagne
        FROM ecritures WHERE compte_id = ? AND beneficiaire = 'createur'");
    $t = f_maintenant();
    $q->execute(array($t, $t, $compte_id));
    $r = $q->fetch() ?: array();
    return array('pendingCents' => (int) ($r['attente'] ?? 0), 'availableBalanceCents' => (int) ($r['disponible'] ?? 0), 'totalEarnedCents' => (int) ($r['total_gagne'] ?? 0));
}

/* ───────────────────────────── administration ───────────────────────────── */

function f_admin(): void {
    $attendu = f_reglage('ALPHABETTE_ADMIN_PASSWORD', 'admin_password');
    if ( strlen($attendu) < 12) f_erreur(503, 'Administration non configurée.');
    $donne = (string) ($_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '');
    if (!f_limite('admin|' . f_empreinte_ip(), 20, 3600)) f_erreur(429, 'Trop d\'essais.');
    if (!hash_equals($attendu, $donne)) f_erreur(403, 'Mot de passe incorrect.');
}
