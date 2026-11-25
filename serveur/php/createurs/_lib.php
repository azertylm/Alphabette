<?php
/**
 * _lib.php — socle commun du service « Créateurs » d'alphabette.eu (OVH Perso : PHP + SQLite, pas de Node).
 * Publié dans eu/api/createurs/ par scripts/build-static.mjs. Jamais appelé directement (voir .htaccess).
 *
 * Stockage : SQLite (PDO) dans data/private/ — dossier fermé au web par .htaccess, créé et verrouillé ici.
 * Atomicité : transactions « BEGIN IMMEDIATE » (un seul écrivain à la fois, aucun compteur recalculé à moitié).
 * Vie privée : l'adresse IP n'est jamais écrite en clair, seulement une empreinte HMAC (IP) et une empreinte du
 * sous-réseau (/24 en IPv4, /48 en IPv6), indispensables à l'anti-fraude.
 * Alertes à l'administrateur : adresse lue dans la variable d'environnement ALPHABETTE_ADMIN_EMAIL (jamais dans le code).
 */
declare(strict_types=1);

const SEUIL_AVIS_POSITIFS = 10;
const SEUIL_RATIO = 0.75;           // part d'avis positifs parmi les avis valides
const PIONNIERS_MAX = 50;
const SESSION_MIN_SECONDES = 30;    // usage actif minimum avant de pouvoir voter (contrôlé côté serveur)
const FENETRE_FRAUDE_SECONDES = 600;
const SEUIL_FRAUDE_VOTES = 5;       // « plus de 5 » votes positifs suspects en 10 minutes
const TAILLE_MAX_DEPOT = 15 * 1024 * 1024;
const TAILLE_MAX_DECOMPRESSE = 40 * 1024 * 1024;
const FICHIERS_MAX_ZIP = 400;
const EXTENSIONS_AUTORISEES = array('html', 'htm', 'css', 'js', 'mjs', 'json', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico',
    'txt', 'md', 'woff', 'woff2', 'ttf', 'otf', 'mp3', 'ogg', 'wav', 'mp4', 'webm', 'xml', 'webmanifest', 'map', 'wasm');
const CATEGORIES = array('Quotidien', 'Santé & bien-être', 'Éducation', 'Culture', 'Outils', 'Jeux', 'Citoyen', 'Autre');
const TAGS_AVIS = array('utile', 'clair', 'beau', 'rapide', 'original', 'accessible', 'confus', 'lent', 'bug', 'inutile');
const STATUTS = array('draft', 'pending_admin_review', 'rejected', 'lab_eu', 'eligible_fr', 'published_fr', 'paused_abuse', 'flag_security_review');
const STATUTS_PUBLICS = array('lab_eu', 'eligible_fr', 'published_fr');
const EXPEDITEUR = 'Alphabette <createurs@alphabette.eu>';

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

/* ───────────────────────────── réponses ───────────────────────────── */

function repondre(int $code, array $d): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function erreur(int $code, string $m, array $plus = array()): void { repondre($code, array('erreur' => $m) + $plus); }

function texte(string $t, int $max): string {
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags($t)) ?? '');
    return mb_substr($t, 0, $max, 'UTF-8');
}

/** Contrôle anti-CSRF d'une requête POST : en-tête personnalisé (impossible à envoyer depuis un autre site) + origine. */
function exiger_post(bool $sousDomaines = false): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erreur(405, 'Méthode non autorisée.');
    if (($_SERVER['HTTP_X_ALPHABETTE'] ?? '') !== '1') erreur(403, 'Requête refusée.');
    $origine = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origine !== '') {
        $permises = array_filter(array_map('trim', explode(',', (string) getenv('ALPHABETTE_ORIGINES'))));
        $motif = $sousDomaines ? '#^https://([a-z0-9-]+\.)?alphabette\.(eu|fr)$#' : '#^https://(www\.)?alphabette\.(eu|fr)$#';
        if (!preg_match($motif, $origine) && !in_array($origine, $permises, true)) erreur(403, 'Origine refusée.');
    }
}
function corps_json(): array {
    $t = (string) file_get_contents('php://input');
    if (strlen($t) > 200000) erreur(413, 'Requête trop grosse.');
    $d = json_decode($t, true);
    return is_array($d) ? $d : array();
}

/* ───────────────────────────── stockage ───────────────────────────── */

function dossier_prive(): string {
    static $d = null;
    if ($d !== null) return $d;
    $candidats = array();
    $env = (string) getenv('ALPHABETTE_PRIVATE_DIR');
    if ($env !== '') $candidats[] = $env;
    // 1. Hors du site (comme ~/alphabette-labo-donnees/ des autres services) : survit aux publications qui remplacent eu/.
    // 2. Sinon data/private/ à côté du site, fermé par .htaccess (créé ici, et livré par le build).
    if ((string) getenv('HOME') !== '') $candidats[] = rtrim((string) getenv('HOME'), '/') . '/alphabette-labo-donnees/createurs-prive';
    $candidats[] = dirname(__DIR__, 2) . '/data/private';
    foreach ($candidats as $c) {
        if (!is_dir($c)) @mkdir($c, 0700, true);
        if (is_dir($c) && is_writable($c)) {
            // Même si le dossier est dans le site, rien n'en sort : .htaccess (Apache 2.2 et 2.4) + index muet.
            if (!is_file($c . '/.htaccess')) @file_put_contents($c . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n");
            if (!is_file($c . '/index.html')) @file_put_contents($c . '/index.html', '');
            return $d = rtrim($c, '/');
        }
    }
    erreur(503, "Le service n'est pas disponible pour le moment.");
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $neuve = !is_file(dossier_prive() . '/alphabette.sqlite');
    $pdo = new PDO('sqlite:' . dossier_prive() . '/alphabette.sqlite', null, null, array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC));
    $pdo->exec('PRAGMA busy_timeout = 8000');
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA foreign_keys = ON');
    if ($neuve) @chmod(dossier_prive() . '/alphabette.sqlite', 0600);
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  emailNorm TEXT NOT NULL UNIQUE,
  handle TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',
  creatorCode TEXT,
  hasFreeCreatorAccess INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_tokens (hash TEXT PRIMARY KEY, userId INTEGER NOT NULL, expiresAt INTEGER NOT NULL, usedAt INTEGER);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, userId INTEGER NOT NULL, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Autre',
  sourceType TEXT NOT NULL,                 -- html | zip | github
  sourceRef TEXT NOT NULL DEFAULT '',       -- adresse du dépôt GitHub public, ou nom du fichier déposé
  sourceFetched INTEGER NOT NULL DEFAULT 1, -- 0 = dépôt GitHub pas encore récupéré
  status TEXT NOT NULL,
  statusBeforeFlag TEXT,
  isPioneer INTEGER NOT NULL DEFAULT 0,
  originalHash TEXT NOT NULL DEFAULT '',    -- SHA-256 de la version_originale archivée (jamais modifiée)
  communityHash TEXT NOT NULL DEFAULT '',   -- SHA-256 de la version_communautaire (celle qui évolue)
  rejectionReason TEXT NOT NULL DEFAULT '',
  collabAccepted INTEGER NOT NULL DEFAULT 0,
  creatorIpHash TEXT NOT NULL DEFAULT '',
  positiveCount INTEGER NOT NULL DEFAULT 0,
  negativeCount INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  validatedAt INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions(userId);
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appId TEXT NOT NULL,
  userId INTEGER NOT NULL,
  positive INTEGER NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  valid INTEGER NOT NULL DEFAULT 1,
  invalidReason TEXT NOT NULL DEFAULT '',
  sessionSeconds INTEGER NOT NULL DEFAULT 0,
  ipHash TEXT NOT NULL DEFAULT '',
  subnetHash TEXT NOT NULL DEFAULT '',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  UNIQUE(userId, appId)
);
CREATE INDEX IF NOT EXISTS idx_votes_app ON votes(appId);
CREATE TABLE IF NOT EXISTS flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appId TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',      -- open | dismissed | actioned
  createdAt INTEGER NOT NULL,
  closedAt INTEGER
);
CREATE TABLE IF NOT EXISTS admin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS transfer_tokens (hash TEXT PRIMARY KEY, appId TEXT NOT NULL, userId INTEGER NOT NULL, expiresAt INTEGER NOT NULL, usedAt INTEGER);
CREATE TABLE IF NOT EXISTS transfers (appId TEXT PRIMARY KEY, userId INTEGER NOT NULL, amountCents INTEGER NOT NULL, status TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expiresAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS limites (k TEXT PRIMARY KEY, n INTEGER NOT NULL, debut INTEGER NOT NULL);
INSERT OR IGNORE INTO admin_settings(key, value) VALUES ('requireManualValidation', 'true');
SQL);
    return $pdo;
}

/** Exécute $fn dans une transaction exclusive ; rien n'est écrit si une exception survient. */
function transaction(callable $fn) {
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $r = $fn($pdo);
        $pdo->exec('COMMIT');
        return $r;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->exec('ROLLBACK');
        throw $e;
    }
}

function reglage(string $k, string $defaut = ''): string {
    $s = db()->prepare('SELECT value FROM admin_settings WHERE key = ?');
    $s->execute(array($k));
    $v = $s->fetchColumn();
    return $v === false ? $defaut : (string) $v;
}
function validation_manuelle(): bool { return reglage('requireManualValidation', 'true') !== 'false'; }

/* ───────────────────────────── secrets et empreintes ───────────────────────────── */

function secret(): string {
    static $s = null;
    if ($s !== null) return $s;
    $f = dossier_prive() . '/secret.key';
    if (!is_file($f)) { @file_put_contents($f, bin2hex(random_bytes(32))); @chmod($f, 0600); }
    return $s = trim((string) @file_get_contents($f));
}
function hmac(string $x): string { return hash_hmac('sha256', $x, secret()); }
function sha256_jeton(string $t): string { return hash('sha256', $t); }

function adresse_ip(): string { return (string) ($_SERVER['REMOTE_ADDR'] ?? ''); }
function empreinte_ip(): string { return substr(hmac('ip|' . adresse_ip()), 0, 24); }
function empreinte_sous_reseau(): string {
    $ip = adresse_ip();
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $p = explode('.', $ip);
        return substr(hmac('net4|' . $p[0] . '.' . $p[1] . '.' . $p[2]), 0, 24);
    }
    $b = @inet_pton($ip);
    return substr(hmac('net6|' . ($b !== false ? bin2hex(substr($b, 0, 6)) : $ip)), 0, 24);
}

/** « Jean.Dupont+promo@Gmail.com » → « jeandupont@gmail.com » : un même courrier ne compte qu'une fois. */
function email_normalise(string $e): string {
    $e = mb_strtolower(trim($e), 'UTF-8');
    if (!preg_match('/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/', $e, $m)) return '';
    $local = $m[1]; $dom = $m[2];
    if ($dom === 'googlemail.com') $dom = 'gmail.com';
    $local = preg_replace('/\+.*$/', '', $local) ?? $local;
    if ($dom === 'gmail.com') $local = str_replace('.', '', $local);
    return $local . '@' . $dom;
}

/** Limite par clé sur une fenêtre simple (tout est dans SQLite). Retourne true si l'action est autorisée. */
function limite(string $cle, int $max, int $fenetre): bool {
    return transaction(function (PDO $p) use ($cle, $max, $fenetre) {
        $s = $p->prepare('SELECT n, debut FROM limites WHERE k = ?');
        $s->execute(array($cle));
        $l = $s->fetch();
        $now = time();
        if (!$l || $now - (int) $l['debut'] >= $fenetre) {
            $p->prepare('INSERT OR REPLACE INTO limites(k, n, debut) VALUES (?, 1, ?)')->execute(array($cle, $now));
            return true;
        }
        if ((int) $l['n'] >= $max) return false;
        $p->prepare('UPDATE limites SET n = n + 1 WHERE k = ?')->execute(array($cle));
        return true;
    });
}

/* ───────────────────────────── courrier ───────────────────────────── */

function destinataire_admin(): string { return trim((string) getenv('ALPHABETTE_ADMIN_EMAIL')); }

function envoyer_mail(string $a, string $sujet, string $corps): void {
    if ($a === '') return;
    $dir = (string) getenv('ALPHABETTE_MAIL_DIR');       // essais : le courrier est écrit dans un fichier
    if ($dir !== '') {
        @mkdir($dir, 0700, true);
        @file_put_contents($dir . '/' . date('YmdHis') . '-' . bin2hex(random_bytes(3)) . '.txt', "À: $a\nSujet: $sujet\n\n$corps\n");
        return;
    }
    if (function_exists('mail')) {
        @mail($a, '=?UTF-8?B?' . base64_encode($sujet) . '?=', $corps, 'From: ' . EXPEDITEUR . "\r\nContent-Type: text/plain; charset=UTF-8");
    }
}
function origine_publique(): string { return rtrim((string) (getenv('ALPHABETTE_ORIGINE') ?: 'https://alphabette.eu'), '/'); }

/* ───────────────────────────── comptes et sessions ───────────────────────────── */

function cookie_pose(string $nom, string $valeur, int $duree): void {
    $https = (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    setcookie($nom, $valeur, array('expires' => $duree > 0 ? time() + $duree : time() - 3600, 'path' => '/', 'secure' => $https,
        'httponly' => true, 'samesite' => 'Lax'));
}

function creer_session(int $userId): void {
    $jeton = bin2hex(random_bytes(32));
    db()->prepare('INSERT INTO sessions(hash, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)')
        ->execute(array(sha256_jeton($jeton), $userId, time(), time() + 30 * 86400));
    cookie_pose('ab_session', $jeton, 30 * 86400);
}

function utilisateur_courant(): ?array {
    $j = (string) ($_COOKIE['ab_session'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $j)) return null;
    $s = db()->prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.userId WHERE s.hash = ? AND s.expiresAt > ?');
    $s->execute(array(sha256_jeton($j), time()));
    $u = $s->fetch();
    return $u ?: null;
}
function exiger_utilisateur(bool $verifie = true): array {
    $u = utilisateur_courant();
    if (!$u) erreur(401, 'Connectez-vous pour continuer.');
    if ($verifie && (int) $u['emailVerified'] !== 1) erreur(403, "Confirmez d'abord votre adresse e-mail.");
    return $u;
}

function identifiant_public(array $u): array {
    return array('id' => (int) $u['id'], 'handle' => $u['handle'], 'emailVerified' => (int) $u['emailVerified'] === 1,
        'role' => $u['role'], 'creatorCode' => $u['creatorCode'], 'hasFreeCreatorAccess' => (int) $u['hasFreeCreatorAccess'] === 1);
}

function nouvel_identifiant_app(): string {
    do { $id = 'c-' . bin2hex(random_bytes(4)); $s = db()->prepare('SELECT 1 FROM submissions WHERE id = ?'); $s->execute(array($id)); }
    while ($s->fetchColumn());
    return $id;
}
function id_app_valide(string $id): bool { return (bool) preg_match('/^c-[a-f0-9]{8}$/', $id); }

/* ───────────────────────────── avis : éligibilité, anti-fraude ───────────────────────────── */

/** Recalcule atomiquement les compteurs d'une appli et applique les passages d'état (appelé DANS une transaction). */
function recalculer(PDO $p, string $appId): array {
    $s = $p->prepare('SELECT COALESCE(SUM(positive = 1), 0) AS pos, COALESCE(SUM(positive = 0), 0) AS neg FROM votes WHERE appId = ? AND valid = 1');
    $s->execute(array($appId));
    $c = $s->fetch();
    $pos = (int) $c['pos']; $neg = (int) $c['neg'];
    $p->prepare('UPDATE submissions SET positiveCount = ?, negativeCount = ?, updatedAt = ? WHERE id = ?')->execute(array($pos, $neg, time(), $appId));
    $s = $p->prepare('SELECT * FROM submissions WHERE id = ?');
    $s->execute(array($appId));
    $app = $s->fetch();
    if (!$app) return array('positifs' => $pos, 'negatifs' => $neg, 'ratio' => 0.0, 'statut' => '');
    $total = $pos + $neg;
    $ratio = $total > 0 ? $pos / $total : 0.0;
    $remplit = $pos >= SEUIL_AVIS_POSITIFS && $ratio >= SEUIL_RATIO;
    if ($app['status'] === 'lab_eu' && $remplit) {
        $p->prepare("UPDATE submissions SET status = 'eligible_fr', updatedAt = ? WHERE id = ?")->execute(array(time(), $appId));
        $app['status'] = 'eligible_fr';
        $jeton = bin2hex(random_bytes(32));
        $p->prepare('INSERT INTO transfer_tokens(hash, appId, userId, expiresAt) VALUES (?, ?, ?, ?)')
            ->execute(array(sha256_jeton($jeton), $appId, (int) $app['userId'], time() + 90 * 86400));
        $u = $p->prepare('SELECT email FROM users WHERE id = ?');
        $u->execute(array((int) $app['userId']));
        $email = (string) $u->fetchColumn();
        if ($email !== '') {
            envoyer_mail($email, 'Votre appli est éligible à alphabette.fr', "Bonjour,\n\nBonne nouvelle : « " . $app['name'] . " » a reçu $pos avis positifs (" . round($ratio * 100) . " %). Elle peut passer sur alphabette.fr.\n\n"
                . "Lancer le transfert (abonnement de 15 € par an, à votre rythme) :\n" . origine_publique() . "/creations/valider-transfert?token=$jeton\n\nCe lien est personnel et valable 90 jours. Le transfert est sans risque : le refaire ne change rien.\n\nAlphabette");
        }
    } elseif ($app['status'] === 'eligible_fr' && !$remplit) {
        $p->prepare("UPDATE submissions SET status = 'lab_eu', updatedAt = ? WHERE id = ?")->execute(array(time(), $appId));
        $p->prepare('DELETE FROM transfer_tokens WHERE appId = ? AND usedAt IS NULL')->execute(array($appId));
        $app['status'] = 'lab_eu';
    }
    return array('positifs' => $pos, 'negatifs' => $neg, 'ratio' => round($ratio, 4), 'statut' => $app['status']);
}

/** Ouvre une alerte si plus de 5 avis positifs en 10 min viennent de comptes < 24 h ou d'un même sous-réseau. DANS une transaction. */
function surveiller_fraude(PDO $p, string $appId): ?int {
    $depuis = time() - FENETRE_FRAUDE_SECONDES;
    $s = $p->prepare('SELECT v.id, v.subnetHash, v.createdAt AS vote_le, u.createdAt AS compte_le
        FROM votes v JOIN users u ON u.id = v.userId
        WHERE v.appId = ? AND v.valid = 1 AND v.positive = 1 AND v.createdAt >= ?');
    $s->execute(array($appId, $depuis));
    $jeunes = 0; $reseaux = array();
    foreach ($s->fetchAll() as $v) {
        if ((int) $v['vote_le'] - (int) $v['compte_le'] < 86400) $jeunes++;
        $reseaux[$v['subnetHash']] = ($reseaux[$v['subnetHash']] ?? 0) + 1;
    }
    $reseauMax = $reseaux ? max($reseaux) : 0;
    if ($jeunes <= SEUIL_FRAUDE_VOTES && $reseauMax <= SEUIL_FRAUDE_VOTES) return null;
    $deja = $p->prepare("SELECT id FROM flags WHERE appId = ? AND status = 'open'");
    $deja->execute(array($appId));
    if ($deja->fetchColumn()) return null;
    $motif = $jeunes > SEUIL_FRAUDE_VOTES ? "$jeunes avis positifs en moins de 10 min depuis des comptes de moins de 24 h" : "$reseauMax avis positifs en moins de 10 min depuis un même sous-réseau";
    $p->prepare('INSERT INTO flags(appId, reason, details, createdAt) VALUES (?, ?, ?, ?)')->execute(array($appId, 'flag_security_review', $motif, time()));
    $id = (int) $p->lastInsertId();
    $p->prepare("UPDATE submissions SET statusBeforeFlag = status, status = 'flag_security_review', updatedAt = ? WHERE id = ? AND status IN ('lab_eu','eligible_fr')")
        ->execute(array(time(), $appId));
    $p->prepare('DELETE FROM transfer_tokens WHERE appId = ? AND usedAt IS NULL')->execute(array($appId));
    envoyer_mail(destinataire_admin(), '[Alphabette] Avis suspects : ' . $appId, "Alerte de sécurité sur $appId : $motif.\nÀ examiner : " . origine_publique() . "/admin/avis-suspects\n");
    return $id;
}

/* ───────────────────────────── dépôts : fichiers et archives ───────────────────────────── */

function dossier_depot(string $id): string {
    $d = dossier_prive() . '/depots/' . $id;
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return $d;
}

function extension_de(string $nom): string { return strtolower(pathinfo($nom, PATHINFO_EXTENSION)); }

/** Chemin relatif sûr (pas de « .. », pas de chemin absolu, pas de caractère de contrôle) ou chaîne vide. */
function chemin_sur(string $c): string {
    $c = str_replace('\\', '/', $c);
    if ($c === '' || $c[0] === '/' || preg_match('/[\x00-\x1f]/', $c)) return '';
    foreach (explode('/', $c) as $morceau) if ($morceau === '..' || $morceau === '.' || $morceau === '') return '';
    return $c;
}

/**
 * Décompresse une archive ZIP dans $cible après contrôles : nombre et taille limités, extensions autorisées
 * (jamais de .php ni .htaccess), pas de chemin échappant au dossier. Retire un éventuel dossier racine unique (zip GitHub).
 * Retourne array('ok'=>bool, 'erreur'=>?string, 'fichiers'=>int).
 */
function extraire_zip(string $zip, string $cible): array {
    if (!class_exists('ZipArchive')) return array('ok' => false, 'erreur' => "Archives ZIP indisponibles sur ce serveur : déposez un fichier .html.");
    $z = new ZipArchive();
    if ($z->open($zip) !== true) return array('ok' => false, 'erreur' => "Archive illisible.");
    if ($z->numFiles < 1 || $z->numFiles > FICHIERS_MAX_ZIP) { $z->close(); return array('ok' => false, 'erreur' => "L'archive doit contenir entre 1 et " . FICHIERS_MAX_ZIP . ' fichiers.'); }
    $entrees = array(); $total = 0; $racines = array();
    for ($i = 0; $i < $z->numFiles; $i++) {
        $st = $z->statIndex($i);
        $nom = str_replace('\\', '/', (string) $st['name']);
        if ($nom === '' || substr($nom, -1) === '/' || strpos($nom, '__MACOSX/') === 0) continue;
        if (chemin_sur($nom) === '') { $z->close(); return array('ok' => false, 'erreur' => "Chemin refusé dans l'archive : $nom"); }
        $nomBase = basename($nom);
        if ($nomBase[0] === '.') continue;                                               // fichiers cachés : ignorés
        $ext = extension_de($nom);
        if (!in_array($ext, EXTENSIONS_AUTORISEES, true)) { $z->close(); return array('ok' => false, 'erreur' => "Type de fichier refusé : $nomBase (seuls les fichiers de site statique sont acceptés)."); }
        $total += (int) $st['size'];
        if ($total > TAILLE_MAX_DECOMPRESSE) { $z->close(); return array('ok' => false, 'erreur' => "Archive trop lourde une fois décompressée."); }
        $entrees[] = array('i' => $i, 'nom' => $nom);
        $racines[explode('/', $nom)[0]] = strpos($nom, '/') !== false;
    }
    if (!$entrees) { $z->close(); return array('ok' => false, 'erreur' => "L'archive est vide."); }
    // Dossier racine unique (zip GitHub : « depot-main/ ») : on le retire.
    $prefixe = '';
    if (count($racines) === 1 && reset($racines) === true) $prefixe = array_key_first($racines) . '/';
    $a_index = false;
    foreach ($entrees as $e) if (substr($e['nom'], strlen($prefixe)) === 'index.html') $a_index = true;
    if (!$a_index) { $z->close(); return array('ok' => false, 'erreur' => "Il manque un fichier index.html à la racine de l'archive."); }
    if (!is_dir($cible)) @mkdir($cible, 0700, true);
    foreach ($entrees as $e) {
        $rel = substr($e['nom'], strlen($prefixe));
        if (chemin_sur($rel) === '') continue;
        $dest = $cible . '/' . $rel;
        if (!is_dir(dirname($dest))) @mkdir(dirname($dest), 0700, true);
        $flux = $z->getStream($z->getNameIndex($e['i']));
        if (!$flux) continue;
        $sortie = fopen($dest, 'wb');
        $ecrit = 0;
        while (!feof($flux)) { $b = fread($flux, 65536); if ($b === false) break; $ecrit += strlen($b); if ($ecrit > TAILLE_MAX_DECOMPRESSE) break; fwrite($sortie, $b); }
        fclose($sortie); fclose($flux);
        @chmod($dest, 0600);
    }
    $z->close();
    return array('ok' => true, 'erreur' => null, 'fichiers' => count($entrees));
}

/** Empreinte SHA-256 d'un dossier : chemins triés + contenus. Sert de « version_communautaire ». */
function hash_dossier(string $d): string {
    $liste = array();
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($d, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) if ($f->isFile()) $liste[] = substr($f->getPathname(), strlen($d) + 1);
    sort($liste);
    $h = hash_init('sha256');
    foreach ($liste as $r) { hash_update($h, $r . "\0"); hash_update_file($h, $d . '/' . $r); hash_update($h, "\0"); }
    return hash_final($h);
}

function copier_dossier(string $src, string $dst): void {
    if (!is_dir($dst)) @mkdir($dst, 0700, true);
    foreach (scandir($src) ?: array() as $n) {
        if ($n === '.' || $n === '..') continue;
        if (is_dir("$src/$n")) copier_dossier("$src/$n", "$dst/$n");
        else { copy("$src/$n", "$dst/$n"); @chmod("$dst/$n", 0600); }
    }
}
function supprimer_dossier(string $d): void {
    if (!is_dir($d)) return;
    foreach (scandir($d) ?: array() as $n) {
        if ($n === '.' || $n === '..') continue;
        is_dir("$d/$n") ? supprimer_dossier("$d/$n") : @unlink("$d/$n");
    }
    @rmdir($d);
}

/** Titre, description et README d'un dossier déjà extrait (analyse automatique). */
function analyser_dossier(string $d): array {
    $titre = ''; $desc = ''; $readme = '';
    $idx = $d . '/index.html';
    if (is_file($idx)) {
        $h = (string) @file_get_contents($idx, false, null, 0, 200000);
        if (preg_match('#<title[^>]*>(.*?)</title>#is', $h, $m)) $titre = texte(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'), 80);
        if (preg_match('#<meta[^>]+name=["\']description["\'][^>]*content=["\']([^"\']*)#i', $h, $m)) $desc = texte(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'), 300);
    }
    foreach (array('README.md', 'readme.md', 'Readme.md') as $r) {
        if (is_file("$d/$r")) { $readme = (string) @file_get_contents("$d/$r", false, null, 0, 20000); break; }
    }
    if ($readme !== '') {
        if ($titre === '' && preg_match('/^\s*#\s+(.+)$/m', $readme, $m)) $titre = texte($m[1], 80);
        if ($desc === '') {
            foreach (preg_split('/\R{2,}/', $readme) ?: array() as $par) {
                $par = trim($par);
                if ($par !== '' && $par[0] !== '#' && $par[0] !== '!' && $par[0] !== '[' && $par[0] !== '<') { $desc = texte(preg_replace('/[*_`>\[\]()]/', '', $par) ?? $par, 300); break; }
            }
        }
    }
    return array('nom' => $titre, 'description' => $desc);
}

function url_github_valide(string $u): ?array {
    if (!preg_match('#^https://github\.com/([A-Za-z0-9._-]{1,39})/([A-Za-z0-9._-]{1,100}?)(?:\.git)?/?$#', trim($u), $m)) return null;
    return array('owner' => $m[1], 'repo' => $m[2]);
}

/** Récupère l'archive d'un dépôt GitHub public (cURL, 12 s, 15 Mo). Retourne le chemin du zip ou null (GitHub indisponible). */
function telecharger_github(string $owner, string $repo): ?string {
    if (!function_exists('curl_init')) return null;
    $base = rtrim((string) (getenv('ALPHABETTE_GITHUB_CODELOAD') ?: 'https://codeload.github.com'), '/');
    $tmp = tempnam(sys_get_temp_dir(), 'abgh');
    $f = fopen($tmp, 'wb');
    $ch = curl_init("$base/$owner/$repo/zip/HEAD");
    curl_setopt_array($ch, array(CURLOPT_FILE => $f, CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3, CURLOPT_USERAGENT => 'alphabette-createurs', CURLOPT_NOPROGRESS => false,
        CURLOPT_PROGRESSFUNCTION => function ($c, $dt, $d) { return $d > TAILLE_MAX_DEPOT ? 1 : 0; }));
    $ok = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    fclose($f);
    if (!$ok || $code !== 200 || filesize($tmp) < 100) { @unlink($tmp); return null; }
    return $tmp;
}

/** Marque une soumission validée : version communautaire = copie de l'originale, pionnier, accès créateur. DANS une transaction. */
function valider_soumission(PDO $p, array $app): array {
    $id = $app['id'];
    $racine = dossier_depot($id);
    $orig = $racine . '/original';
    $comm = $racine . '/communautaire';
    if (!is_dir($orig) || !is_file($orig . '/index.html')) throw new RuntimeException('Fichiers de la soumission introuvables.');
    supprimer_dossier($comm);
    copier_dossier($orig, $comm);
    $hash = hash_dossier($comm);
    $n = (int) $p->query("SELECT COUNT(*) FROM submissions WHERE isPioneer = 1")->fetchColumn();
    $pionnier = $n < PIONNIERS_MAX ? 1 : 0;
    $p->prepare("UPDATE submissions SET status = 'lab_eu', isPioneer = ?, communityHash = ?, rejectionReason = '', validatedAt = ?, updatedAt = ? WHERE id = ?")
        ->execute(array($pionnier, $hash, time(), time(), $id));
    $u = $p->prepare('SELECT * FROM users WHERE id = ?');
    $u->execute(array((int) $app['userId']));
    $user = $u->fetch();
    if ($user && !$user['creatorCode']) {
        $code = 'CRE-' . strtoupper(bin2hex(random_bytes(4)));
        $p->prepare('UPDATE users SET creatorCode = ?, hasFreeCreatorAccess = 1 WHERE id = ?')->execute(array($code, (int) $app['userId']));
    } elseif ($user) {
        $p->prepare('UPDATE users SET hasFreeCreatorAccess = 1 WHERE id = ?')->execute(array((int) $app['userId']));
    }
    if ($user) envoyer_mail($user['email'], 'Votre appli est en ligne sur alphabette.eu', "Bonjour,\n\n« " . $app['name'] . " » est validée et visible dans le Laboratoire : " . origine_publique() . "/createur/" . $user['handle'] . "\n"
        . ($pionnier ? "Vous faites partie des 50 premiers : badge « Pionnier ».\n" : '') . "Votre accès créateur est gratuit.\n\nAlphabette");
    return array('pionnier' => (bool) $pionnier, 'hash' => $hash);
}

/* ───────────────────────────── jetons d'aperçu (sans cookie) ───────────────────────────── */

/** Jeton signé de courte durée : permet à une iframe isolée (origine opaque, sans cookie) de charger les fichiers d'une appli. */
function jeton_fichier(string $id, string $mode, int $duree = 3600): string {
    $exp = time() + $duree;
    return $exp . '.' . substr(hmac("fichier|$id|$mode|$exp"), 0, 32);
}
function jeton_fichier_valide(string $id, string $mode, string $jeton): bool {
    if (!preg_match('/^(\d{9,11})\.([a-f0-9]{32})$/', $jeton, $m)) return false;
    return (int) $m[1] >= time() && hash_equals(substr(hmac("fichier|$id|$mode|" . $m[1]), 0, 32), $m[2]);
}

function mime_de(string $ext): string {
    static $t = array('html' => 'text/html; charset=utf-8', 'htm' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8', 'mjs' => 'text/javascript; charset=utf-8', 'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp',
        'avif' => 'image/avif', 'ico' => 'image/x-icon', 'txt' => 'text/plain; charset=utf-8', 'md' => 'text/plain; charset=utf-8',
        'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf', 'otf' => 'font/otf', 'mp3' => 'audio/mpeg', 'ogg' => 'audio/ogg',
        'wav' => 'audio/wav', 'mp4' => 'video/mp4', 'webm' => 'video/webm', 'xml' => 'application/xml', 'webmanifest' => 'application/manifest+json',
        'map' => 'application/json', 'wasm' => 'application/wasm');
    return $t[$ext] ?? 'application/octet-stream';
}
