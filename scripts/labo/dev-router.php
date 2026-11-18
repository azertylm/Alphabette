<?php
// Essai local du Laboratoire (imite le .htaccess de eu/) :
//   php -S 127.0.0.1:8090 -t dist-static/eu scripts/labo/dev-router.php   puis http://127.0.0.1:8090/?labo
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$racine = $_SERVER['DOCUMENT_ROOT'];
if (preg_match('#^/api/apps/?$#', $uri)) { header('Content-Type: application/json'); readfile("$racine/api/apps.json"); return true; }
if (preg_match('#^/api/(config|health)(\.json)?/?$#', $uri, $m)) { header('Content-Type: application/json'); readfile("$racine/api/{$m[1]}.json"); return true; }
if (preg_match('#\.php$#', $uri) && is_file($racine . $uri)) { chdir(dirname($racine . $uri)); require $racine . $uri; return true; }
if (is_file($racine . $uri)) return false;
if (is_dir($racine . $uri) && is_file(rtrim($racine . $uri, '/') . '/index.html')) return false;
readfile("$racine/index.html");
return true;
