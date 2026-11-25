<?php
/** Routeur de test (php -S) : reproduit les règles .htaccess d'alphabette.eu (scripts/build-static.mjs) sur dist-static/eu. */
$racine = rtrim((string) getenv('EU_DIR'), '/');
$u = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$mimes = array('html' => 'text/html; charset=utf-8', 'js' => 'text/javascript', 'css' => 'text/css', 'json' => 'application/json', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'ico' => 'image/x-icon', 'txt' => 'text/plain', 'xml' => 'application/xml');
function lancer(string $script, array $get = array(), string $info = ''): bool {
    foreach ($get as $k => $v) $_GET[$k] = $v;
    $_SERVER['PATH_INFO'] = $info; $_SERVER['SCRIPT_NAME'] = '/api/createurs/' . basename($script);
    chdir(dirname($script));
    require $script;
    return true;
}
if (preg_match('#^/createur/([a-z0-9-]{3,30})/?$#', $u, $m)) return lancer("$racine/api/createurs/createur.php", array('handle' => $m[1]));
if (preg_match('#^/c/(c-[a-f0-9]{8})/?$#', $u, $m)) return lancer("$racine/api/createurs/app.php", array('id' => $m[1]));
if (preg_match('#^/creations/valider-transfert/?$#', $u)) return lancer("$racine/api/createurs/transfert.php");
if (preg_match('#^/admin/(validations|avis-suspects)/?$#', $u)) { header('Content-Type: text/html; charset=utf-8'); readfile("$racine/admin-createurs.html"); return true; }
if (preg_match('#^/api/createurs/([a-z_]+\.php)(/.*)?$#', $u, $m)) return lancer("$racine/api/createurs/{$m[1]}", array(), $m[2] ?? '');
$f = $racine . $u;
if (is_dir($f)) $f = rtrim($f, '/') . '/index.html';
if (!is_file($f)) $f = "$racine/index.html";
header('Content-Type: ' . ($mimes[pathinfo($f, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
readfile($f);
return true;
