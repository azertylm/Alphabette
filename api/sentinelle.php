<?php
/**
 * sentinelle.php — compte des 100 premières sessions de chaque nouvelle version d'une appli de alphabette.fr.
 * Publié dans dist-static/api/sentinelle.php (scripts/build-static.mjs).
 *
 *   POST {app, version, fatale:0|1, rendu_ms, erreur}  (sonde labo/serveur/sentinelle.js)
 *   GET  ?etat=1  → agrégats publics par appli : version, sessions, sessions avec erreur fatale, rendu médian,
 *                   rendu médian de la version précédente, 10 dernières erreurs distinctes (nettoyées).
 *
 * Lu par .github/workflows/sentinelle.yml (scripts/labo/sentinelle.mjs) qui décide du retour arrière.
 * Vie privée : aucune adresse IP ni identifiant conservés ; une empreinte salée du jour limite les abus.
 * Données rangées hors du dossier publié (comme les avis du Laboratoire). Compatible PHP 7.0+.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
// Applis servies sur <clé>.alphabette.fr : envoi en text/plain (pas de pré-vérification), réponse lisible par elles.
$o = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (preg_match('#^https://([a-z0-9-]+\.)?alphabette\.fr$#', $o)) header('Access-Control-Allow-Origin: ' . $o);

const FENETRE = 100;

function repondre($code, $d) { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function dossier() {
    $maison = getenv('HOME') ?: dirname($_SERVER['DOCUMENT_ROOT']);
    foreach (array($maison . '/alphabette-labo-donnees', sys_get_temp_dir() . '/alphabette-labo-donnees') as $d) {
        if (is_dir($d) || @mkdir($d, 0700, true)) { if (is_writable($d)) return $d; }
    }
    repondre(503, array('erreur' => 'stockage indisponible'));
}
$DOSSIER = dossier();
$FICHIER = $DOSSIER . '/sentinelle.json';

function lire($f) { $t = @file_get_contents($f); $d = $t ? json_decode($t, true) : null; return is_array($d) ? $d : array('apps' => array()); }

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $d = lire($FICHIER);
    $sortie = array();
    foreach ($d['apps'] as $app => $a) {
        $med = function ($l) { if (!$l) return null; sort($l); return $l[(int) floor(count($l) / 2)]; };
        $sortie[$app] = array(
            'version' => $a['version'], 'depuis' => $a['depuis'], 'sessions' => $a['sessions'], 'fatales' => $a['fatales'],
            'rendu_median_ms' => $med($a['rendus']), 'rendus_mesures' => count($a['rendus']),
            'precedente' => isset($a['precedente']) ? $a['precedente'] : null,
            'erreurs' => $a['erreurs'],
        );
    }
    repondre(200, array('maj' => gmdate('c'), 'fenetre' => FENETRE, 'apps' => (object) $sortie));
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') repondre(405, array('erreur' => 'méthode'));

$e = json_decode((string) file_get_contents('php://input', false, null, 0, 4000), true);
if (!is_array($e)) repondre(400, array('erreur' => 'illisible'));
$app = isset($e['app']) ? (string) $e['app'] : '';
$version = isset($e['version']) ? (string) $e['version'] : '';
if (!preg_match('/^[a-z0-9-]{1,40}$/', $app) || !preg_match('/^[a-f0-9]{7,40}$/', $version)) repondre(400, array('erreur' => 'appli ou version'));
// Seules les applis réellement publiées sur .fr sont comptées.
$connues = @json_decode((string) @file_get_contents(__DIR__ . '/sentinelle-versions.json'), true);
if (!is_array($connues) || !isset($connues[$app]) || strpos($connues[$app], $version) !== 0) repondre(200, array('ok' => true, 'assez' => true));

// Limite d'abus : 3 envois par jour et par empreinte (IP salée, jamais gardée en clair).
$sel = $DOSSIER . '/sentinelle-sel';
if (!file_exists($sel)) @file_put_contents($sel, bin2hex(random_bytes(16)));
$empreinte = hash('sha256', gmdate('Y-m-d') . (string) @file_get_contents($sel) . (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '') . $app);
$limites = $DOSSIER . '/sentinelle-limites-' . gmdate('Y-m-d') . '.json';

$f = fopen($FICHIER, 'c+');
if (!$f || !flock($f, LOCK_EX)) repondre(503, array('erreur' => 'occupé'));
$brut = stream_get_contents($f);
$d = $brut ? json_decode($brut, true) : null;
if (!is_array($d)) $d = array('apps' => array());
$l = json_decode((string) @file_get_contents($limites), true) ?: array();
if (isset($l[$empreinte]) && $l[$empreinte] >= 3) { flock($f, LOCK_UN); repondre(429, array('assez' => false)); }
$l[$empreinte] = (isset($l[$empreinte]) ? $l[$empreinte] : 0) + 1;
@file_put_contents($limites, json_encode($l));
foreach (glob($DOSSIER . '/sentinelle-limites-*.json') as $vieux) if ($vieux !== $limites) @unlink($vieux);

$a = isset($d['apps'][$app]) ? $d['apps'][$app] : null;
if (!$a || $a['version'] !== $version) {
    // Nouvelle version : l'ancienne devient la référence (rendu médian), une nouvelle fenêtre commence.
    $prec = null;
    if ($a && count($a['rendus'])) { $r = $a['rendus']; sort($r); $prec = array('version' => $a['version'], 'sessions' => $a['sessions'], 'fatales' => $a['fatales'], 'rendu_median_ms' => $r[(int) floor(count($r) / 2)]); }
    elseif ($a && isset($a['precedente'])) $prec = $a['precedente'];
    $a = array('version' => $version, 'depuis' => gmdate('c'), 'sessions' => 0, 'fatales' => 0, 'rendus' => array(), 'erreurs' => array(), 'precedente' => $prec);
}
if ($a['sessions'] < FENETRE) {
    $a['sessions']++;
    // « ResizeObserver loop… » : avertissement du navigateur, l'appli ne plante pas (anciennes sondes en cache).
    $benin = isset($e['erreur']) && preg_match('/ResizeObserver loop/i', (string) $e['erreur']);
    if (!empty($e['fatale']) && !$benin) {
        $a['fatales']++;
        $m = isset($e['erreur']) ? mb_substr(preg_replace('/[^\P{C}\n]/u', '', (string) $e['erreur']), 0, 160) : '';
        if ($m !== '' && !in_array($m, $a['erreurs'], true)) $a['erreurs'] = array_slice(array_merge($a['erreurs'], array($m)), -10);
    }
    if (isset($e['rendu_ms']) && is_numeric($e['rendu_ms']) && $e['rendu_ms'] > 0 && $e['rendu_ms'] < 120000) $a['rendus'][] = (int) $e['rendu_ms'];
}
$d['apps'][$app] = $a;
ftruncate($f, 0); rewind($f); fwrite($f, json_encode($d)); fflush($f); flock($f, LOCK_UN); fclose($f);
repondre(200, array('ok' => true, 'assez' => $a['sessions'] >= FENETRE));
