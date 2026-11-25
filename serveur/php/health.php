<?php
/**
 * health.php — état de santé du service d'alphabette.eu (Lot 6). Publié dans eu/api/ par scripts/build-static.mjs.
 *
 * GET → JSON sans AUCUN secret : état de PHP, accès en écriture au dossier privé, stockage (JSON / SQLite),
 * version du registre et, pour chaque réglage requis, seulement « configured: true|false ».
 * Aucune valeur, aucun chemin complet, aucune adresse n'est renvoyé.
 */
declare(strict_types=1);

require_once __DIR__ . '/lot6-commun.php';

l6_entetes();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') l6_erreur(405, 'Utilisez GET.');

// Même lecture que les services (getenv, SetEnv Apache, REDIRECT_). Seul le booléen sort d'ici, jamais la valeur.
$configure = function (string $nom): bool {
    if ($nom === 'ADMIN_PASSWORD') return l6_env('ADMIN_PASSWORD') !== '' || l6_env('ALPHABETTE_ADMIN_PASSWORD') !== '';
    if ($nom === 'ALPHABETTE_ADMIN_EMAIL') { $e = l6_env($nom); return $e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL) !== false; }
    return l6_env($nom) !== '';
};
$prive = l6_dossier_prive(false);

// Test d'écriture réel (fichier jetable) : « dossier présent » ne prouve pas qu'on peut y écrire.
$ecriture = false;
if ($prive !== null) {
    $essai = $prive . '/.sante-' . bin2hex(random_bytes(4));
    $ecriture = @file_put_contents($essai, 'ok') !== false;
    @unlink($essai);
}

$registre = l6_lire_json(__DIR__ . '/registre.json', array());
$apps = l6_lire_json(__DIR__ . '/apps.json', array());

// Réglages requis : l'ordre n'a pas de sens, seul le booléen est publié.
$requis = array('ADMIN_PASSWORD', 'ALPHABETTE_ADMIN_EMAIL', 'ALPHABETTE_FINANCE_SECRET', 'ALPHABETTE_IBAN_KEY', 'ALPHABETTE_WEBHOOK_SECRET', 'ALPHABETTE_ORIGINE');
$configuration = array();
foreach ($requis as $nom) $configuration[$nom] = array('configured' => $configure($nom));

$manquants = array_keys(array_filter($configuration, function ($c) { return !$c['configured']; }));

l6_repondre(200, array(
    'ok' => $ecriture && PHP_VERSION_ID >= 70400,
    'php' => array('version' => PHP_VERSION, 'ok' => PHP_VERSION_ID >= 70400),
    'dossier_prive' => array('present' => $prive !== null, 'ecriture' => $ecriture),
    'stockage' => array(
        'json' => $ecriture,
        'sqlite' => extension_loaded('pdo_sqlite'),
    ),
    'registre' => array(
        'version' => $registre['version'] ?? null,
        'mis_a_jour' => $registre['updatedAt'] ?? null,
        'nb_applis' => is_array($apps['apps'] ?? null) ? count($apps['apps']) : ($registre['nb_applis'] ?? null),
    ),
    'configuration' => $configuration,
    'configuration_manquante' => $manquants,
));
