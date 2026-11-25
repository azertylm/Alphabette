<?php
/**
 * agent.php — QR code personnel d'un « agent » (une personne = un code) qui fait la promotion d'Alphabette sur Internet.
 *   GET ?a=CODE            → compte le passage (sans IP ni traceur : un compteur + un compteur de visiteurs distincts par jour), puis redirige vers alphabette.fr
 *   GET ?admin (X-Admin-Password) → passages par agent
 * Valable jusqu'au 7 mai 2027 inclus ; ensuite : page « QR code expiré ».
 */
declare(strict_types=1);
require __DIR__ . '/finance-commun.php';

const A_FIN = 1809727200; // 2027-05-08 00:00 Europe/Paris
const A_SITE = 'https://alphabette.fr';

function a_db(): PDO {
    static $pret = false;
    $db = f_db();
    if ($pret) return $db;
    $db->exec('CREATE TABLE IF NOT EXISTS agents_qr (code TEXT PRIMARY KEY, numero INTEGER NOT NULL, passages INTEGER NOT NULL DEFAULT 0, uniques INTEGER NOT NULL DEFAULT 0, dernier INTEGER);
               CREATE TABLE IF NOT EXISTS agents_vus (code TEXT NOT NULL, jour TEXT NOT NULL, empreinte TEXT NOT NULL, PRIMARY KEY (code, jour, empreinte))');
    $fichier = __DIR__ . '/../data/private/agents-codes.txt';
    if (is_file($fichier) && (int) $db->query('SELECT COUNT(*) FROM agents_qr')->fetchColumn() === 0) {
        $db->beginTransaction();
        $q = $db->prepare('INSERT OR IGNORE INTO agents_qr (code, numero) VALUES (?, ?)');
        foreach (file($fichier, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: array() as $l) {
            $p = explode(';', trim($l));
            if (count($p) === 2 && preg_match('/^[A-Z0-9]{8}$/', $p[0])) $q->execute(array($p[0], (int) $p[1]));
        }
        $db->commit();
    }
    $pret = true;
    return $db;
}

if (isset($_GET['admin'])) {
    header('Cache-Control: no-store');
    f_admin();
    $l = a_db()->query('SELECT numero, passages, uniques, dernier FROM agents_qr ORDER BY passages DESC, numero')->fetchAll();
    f_repondre(200, array('agents' => count($l), 'passages' => array_sum(array_column($l, 'passages')), 'liste' => $l));
}

$code = strtoupper(preg_replace('/[^A-Z0-9]/i', '', (string) ($_GET['a'] ?? '')) ?? '');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
if (f_maintenant() >= A_FIN) {
    http_response_code(410);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QR code expiré</title></head><body style="font:18px/1.6 system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 16px;text-align:center"><h1>QR code expiré</h1><p>Ce QR code était valable jusqu\'au 7 mai 2027.</p><p><a href="' . A_SITE . '">Découvrir Alphabette</a></p></body></html>';
    exit;
}
if (strlen($code) === 8 && f_limite('agent|' . f_empreinte_ip(), 120, 3600)) {
    $db = a_db();
    $q = $db->prepare('SELECT 1 FROM agents_qr WHERE code = ?'); $q->execute(array($code));
    if ($q->fetchColumn()) {
        $t = f_maintenant(); $jour = gmdate('Y-m-d', $t);
        $nouveau = $db->prepare('INSERT OR IGNORE INTO agents_vus (code, jour, empreinte) VALUES (?, ?, ?)');
        $nouveau->execute(array($code, $jour, f_empreinte_ip()));
        $db->prepare('UPDATE agents_qr SET passages = passages + 1, uniques = uniques + ?, dernier = ? WHERE code = ?')->execute(array($nouveau->rowCount(), $t, $code));
    }
}
header('Location: ' . A_SITE, true, 302);
exit;
