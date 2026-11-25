<?php
/**
 * lot6-commun.php — petit socle du Lot 6 (relais chiffré, santé). Publié dans eu/api/ par scripts/build-static.mjs.
 * Jamais appelé seul (404). OVH Perso : PHP léger, aucune extension rare ; stockage JSON verrouillé (flock)
 * dans un dossier privé fermé au web (data/private/), jamais d'adresse IP écrite en clair.
 */
declare(strict_types=1);

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) { http_response_code(404); exit; }

function l6_entetes(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    header('Referrer-Policy: no-referrer');
    // Les applications (sous-domaines alphabette.fr / .eu) appellent ce relais : CORS limité à l'écosystème.
    $origine = isset($_SERVER['HTTP_ORIGIN']) ? (string)$_SERVER['HTTP_ORIGIN'] : '';
    if ($origine !== '' && preg_match('#^https://([a-z0-9-]+\.)?alphabette\.(fr|eu)$#', $origine) || preg_match('#^http://(localhost|127\.0\.0\.1)(:\d+)?$#', $origine)) {
        header('Access-Control-Allow-Origin: ' . $origine);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

function l6_repondre(int $code, array $donnees): void {
    http_response_code($code);
    echo json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function l6_erreur(int $code, string $message): void { l6_repondre($code, array('erreur' => $message)); }

/** Dossier privé (ALPHABETTE_PRIVATE_DIR, sinon ~/alphabette-labo-donnees/, sinon data/private/ à côté du site). */
function l6_dossier_prive(bool $creer = true): ?string {
    $candidats = array();
    $env = (string) getenv('ALPHABETTE_PRIVATE_DIR');
    if ($env !== '') $candidats[] = $env;
    if ((string) getenv('HOME') !== '') $candidats[] = rtrim((string) getenv('HOME'), '/') . '/alphabette-labo-donnees/lot6-prive';
    $candidats[] = dirname(__DIR__) . '/data/private';
    $candidats[] = __DIR__ . '/donnees-privees';
    foreach ($candidats as $c) {
        if ($creer && !is_dir($c)) @mkdir($c, 0700, true);
        if (is_dir($c) && is_writable($c)) {
            if ($creer && !is_file($c . '/.htaccess')) @file_put_contents($c . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n");
            return rtrim($c, '/');
        }
    }
    return null;
}

/** Variable d'environnement vue par PHP : getenv(), $_SERVER (SetEnv Apache) ou REDIRECT_<nom>. Valeur trimée, '' si absente. */
function l6_env(string $nom): string {
    foreach (array(getenv($nom), $_SERVER[$nom] ?? null, $_SERVER['REDIRECT_' . $nom] ?? null) as $v) {
        if (is_string($v) && trim($v) !== '') return trim($v);
    }
    return '';
}

function l6_lire_json(string $f, array $defaut = array()): array {
    $d = is_file($f) ? json_decode((string) @file_get_contents($f), true) : null;
    return is_array($d) ? $d : $defaut;
}

/** Lecture + écriture atomique sous verrou exclusif : $fn reçoit le tableau par référence. */
function l6_modifier(string $f, callable $fn) {
    $v = fopen($f . '.lock', 'c');
    if (!$v || !flock($v, LOCK_EX)) l6_erreur(503, 'Service occupé, réessayez dans un instant.');
    $d = l6_lire_json($f);
    $r = $fn($d);
    $tmp = $f . '.' . bin2hex(random_bytes(4));
    file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    @chmod($tmp, 0600);
    rename($tmp, $f);
    flock($v, LOCK_UN);
    fclose($v);
    return $r;
}

/** Empreinte du visiteur (HMAC d'adresse IP + sel secret) : l'adresse n'est jamais écrite. */
function l6_empreinte(string $dossier): string {
    $f = $dossier . '/sel-lot6.txt';
    if (!is_file($f)) @file_put_contents($f, bin2hex(random_bytes(16)));
    return substr(hash_hmac('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''), (string) @file_get_contents($f)), 0, 20);
}

/** Limite glissante : au plus $max événements « $type » par visiteur dans les $fenetre dernières secondes. */
function l6_limite(string $dossier, string $type, int $max, int $fenetre): bool {
    $f = $dossier . '/limites-lot6.json';
    $cle = $type . ':' . l6_empreinte($dossier);
    $maintenant = time();
    return l6_modifier($f, function (&$d) use ($cle, $max, $fenetre, $maintenant) {
        foreach ($d as $k => $liste) { // purge des anciennes entrées
            $d[$k] = array_values(array_filter((array) $liste, function ($t) use ($maintenant) { return $t > $maintenant - 86400; }));
            if (!$d[$k]) unset($d[$k]);
        }
        $recents = array_filter((array) ($d[$cle] ?? array()), function ($t) use ($maintenant, $fenetre) { return $t > $maintenant - $fenetre; });
        if (count($recents) >= $max) return false;
        $d[$cle][] = $maintenant;
        return true;
    });
}

function l6_corps_json(int $max = 65536): array {
    $brut = (string) file_get_contents('php://input', false, null, 0, $max + 1);
    if (strlen($brut) > $max) l6_erreur(413, 'Message trop volumineux.');
    $d = json_decode($brut, true);
    return is_array($d) ? $d : array();
}
