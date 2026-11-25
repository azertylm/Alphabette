<?php
/** Routeur de test (php -S) : reproduit les règles .htaccess d'alphabette.eu utiles au Lot 5 sur un dossier WEB_DIR
 *  (WEB_DIR = eu/api du build : moteur financier à la racine, service Créateurs dans createurs/). */
$racine = rtrim((string) getenv('WEB_DIR'), '/');
$u = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
function lancer(string $script, array $get = array(), string $info = ''): bool {
    foreach ($get as $k => $v) $_GET[$k] = $v;
    $_SERVER['PATH_INFO'] = $info; $_SERVER['SCRIPT_FILENAME'] = $script; $_SERVER['SCRIPT_NAME'] = '/' . basename($script);
    chdir(dirname($script));
    require $script;
    return true;
}
if (preg_match('#^/go/([a-z0-9][a-z0-9-]{0,62})/?$#', $u, $m)) return lancer("$racine/affiliation.php", array('go' => $m[1]));
if ($u === '/api/badge.php') return lancer("$racine/createurs/badge.php");
if (preg_match('#^/api/createurs/([a-z_]+\.php)(/.*)?$#', $u, $m) && is_file("$racine/createurs/{$m[1]}")) return lancer("$racine/createurs/{$m[1]}", array(), $m[2] ?? '');
if (preg_match('#^/api/([a-z-]+\.php)$#', $u, $m) && is_file("$racine/{$m[1]}") && $m[1][0] !== '_') return lancer("$racine/{$m[1]}");
// Aperçu des pages (STATIC_DIR = dist-static/eu) : fichiers statiques + réécritures des pages du Lot 5.
$st = rtrim((string) getenv('STATIC_DIR'), '/');
if ($st !== '') {
    if (preg_match('#^/essai/[a-z0-9-]+/?$#', $u)) $u = '/essai/';
    if (preg_match('#^/invite/r[a-z0-9]{10}/?$#', $u)) $u = '/invite/';
    if ($u === '/admin/newsletter' || $u === '/admin/newsletter/') $u = '/admin-newsletter.html';
    $f = $st . $u;
    if (is_dir($f)) $f = rtrim($f, '/') . '/index.html';
    if (is_file($f) && strpos(realpath($f), realpath($st)) === 0) {
        $types = array('html' => 'text/html; charset=utf-8', 'js' => 'text/javascript', 'css' => 'text/css', 'svg' => 'image/svg+xml', 'json' => 'application/json', 'png' => 'image/png');
        header('Content-Type: ' . ($types[pathinfo($f, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
        readfile($f); return true;
    }
}
http_response_code(404); echo '{"erreur":"introuvable"}'; return true;
