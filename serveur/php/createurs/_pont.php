<?php
/**
 * _pont.php — Lot 5 : passerelle entre le service Créateurs (alphabette.sqlite, comptes par lien magique) et le moteur
 * financier (finance.sqlite, Lot 3). Publiés côte à côte : eu/api/createurs/ et eu/api/. Si le moteur financier est absent
 * (tests isolés), toutes les fonctions répondent « rien fait » sans jamais bloquer le service Créateurs.
 * Jamais appelé seul (fichier « _ » refusé par .htaccess).
 */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) { http_response_code(404); exit; }

function pont_actif(): bool {
    static $ok = null;
    if ($ok !== null) return $ok;
    $f = dirname(__DIR__) . '/croissance-commun.php';
    if (!is_file($f)) return $ok = false;
    require_once $f;
    return $ok = function_exists('c_db');
}

/** Exécute une action financière sans jamais faire échouer l'action du service Créateurs (journal en cas d'erreur). */
function pont(callable $fn) {
    if (!pont_actif()) return null;
    try { return $fn(); }
    catch (Throwable $e) { error_log('[alphabette pont] ' . $e->getMessage()); return null; }
}
