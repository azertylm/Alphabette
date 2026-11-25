<?php
/**
 * fichier.php — sert les fichiers d'une appli de créateur, JAMAIS dans l'origine d'Alphabette :
 *   en-tête « Content-Security-Policy: sandbox … » (origine opaque : ni cookies, ni stockage, ni API d'Alphabette lisibles),
 *   et l'appli est affichée dans une <iframe sandbox> SANS « allow-same-origin ».
 *   /api/createurs/fichier.php/<id>/public/<chemin>           → version communautaire d'une appli publiée
 *   /api/createurs/fichier.php/<id>/<jeton>/<chemin>          → aperçu administrateur (jeton signé d'une heure, sans cookie)
 */
require __DIR__ . '/_lib.php';

$info = (string) ($_SERVER['PATH_INFO'] ?? '');
if ($info === '' && isset($_SERVER['REQUEST_URI'])) {
    $u = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $i = strpos($u, 'fichier.php/');
    if ($i !== false) $info = substr($u, $i + 11);
}
$parts = explode('/', ltrim(rawurldecode($info), '/'), 3);
$id = $parts[0] ?? ''; $acces = $parts[1] ?? ''; $rel = $parts[2] ?? '';
if (!id_app_valide($id) || $acces === '') { http_response_code(404); exit; }
if ($rel === '' ) $rel = 'index.html';
$rel = chemin_sur($rel);
if ($rel === '' || !in_array(extension_de($rel), EXTENSIONS_AUTORISEES, true) || basename($rel)[0] === '.') { http_response_code(404); exit; }

$s = db()->prepare('SELECT status FROM submissions WHERE id = ?');
$s->execute(array($id));
$statut = $s->fetchColumn();
if ($statut === false) { http_response_code(404); exit; }
$racine = dossier_depot($id);
if ($acces === 'public') {
    if (!in_array($statut, STATUTS_PUBLICS, true)) { http_response_code(404); exit; }
    $base = $racine . '/communautaire';
} elseif (jeton_fichier_valide($id, 'apercu', $acces)) {
    $base = is_dir($racine . '/communautaire') && in_array($statut, STATUTS_PUBLICS, true) ? $racine . '/communautaire' : $racine . '/original';
} else { http_response_code(403); exit; }

$chemin = realpath($base . '/' . $rel);
$reel = realpath($base);
if ($chemin === false || $reel === false || strpos($chemin, $reel . DIRECTORY_SEPARATOR) !== 0 || !is_file($chemin)) { http_response_code(404); exit; }

$ancetres = array("'self'", 'https://alphabette.eu', 'https://www.alphabette.eu');
foreach (array_filter(array_map('trim', explode(',', (string) getenv('ALPHABETTE_ORIGINES')))) as $o) $ancetres[] = $o;
header_remove('Cache-Control'); header_remove('X-Robots-Tag');
header('Content-Type: ' . mime_de(extension_de($rel)));
header('Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads; frame-ancestors ' . implode(' ', $ancetres));
header('Access-Control-Allow-Origin: *');          // l'origine opaque de l'appli doit pouvoir charger ses propres modules et polices
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex');
header('Cache-Control: ' . ($acces === 'public' ? 'public, max-age=300' : 'no-store'));
header('Content-Length: ' . filesize($chemin));
readfile($chemin);
