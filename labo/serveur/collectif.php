<?php
/**
 * collectif.php — le Collectif Alphabette sur alphabette.eu (Laboratoire).
 * Publié dans eu/api/collectif.php par scripts/build-static.mjs (OVH Perso : PHP, pas de base de données).
 *
 *   GET  ?soutiens                     → { soutiens: { <app_id>: n } }            (compteurs publics)
 *   GET  ?propositions=1               → propositions SANS les contacts (lu par les agents de tri)
 *   POST { action:"soutenir", app_id } → { ok, soutiens }   (1 soutien par personne, par appli et par jour)
 *   POST { action:"proposer", nom, url, description, categorie, pseudo, contact?, charte:[4 × true], site_web }
 *                                      → { ok, id }          (jamais publiée automatiquement)
 *
 * Données rangées hors du site (~/alphabette-labo-donnees/collectif/). L'adresse IP n'est jamais
 * écrite : seulement une empreinte du jour (sel secret), pour limiter les abus.
 * Chaque proposition est envoyée par e-mail à Valentin (contact compris) ; l'export public
 * pour les agents ne contient pas le contact.
 */
declare(strict_types=1);

const PROPOSITIONS_PAR_JOUR = 3;       // par visiteur
const SOUTIENS_PAR_JOUR = 60;          // par visiteur, toutes applis confondues
const MAX_PROPOSITIONS = 2000;
const CATEGORIES_COLLECTIF = array('Quotidien', 'Santé & bien-être', 'Éducation', 'Culture', 'Outils', 'Jeux', 'Citoyen', 'Autre');
const DESTINATAIRE = 'azertylm@gmail.com';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function repondre(int $code, array $d): void {
    http_response_code($code);
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function erreur(int $code, string $m): void { repondre($code, array('erreur' => $m)); }

function dossier(): string {
    $candidats = array(dirname(__DIR__, 3) . '/alphabette-labo-donnees/collectif', __DIR__ . '/donnees-privees/collectif');
    foreach ($candidats as $i => $d) {
        if (!is_dir($d)) @mkdir($d, 0700, true);
        if (is_dir($d) && is_writable($d)) {
            if ($i > 0 && !file_exists(dirname($d) . '/.htaccess')) @file_put_contents(dirname($d) . '/.htaccess', "Require all denied\nDeny from all\n");
            return $d;
        }
    }
    erreur(503, "Le service du collectif n'est pas disponible pour le moment.");
    return '';
}

function lire_json(string $f, array $defaut): array {
    $d = is_file($f) ? json_decode((string) @file_get_contents($f), true) : null;
    return is_array($d) ? $d : $defaut;
}

/** Lecture + écriture sous verrou exclusif. */
function modifier(string $f, callable $fn) {
    $v = fopen($f . '.lock', 'c');
    if (!$v || !flock($v, LOCK_EX)) erreur(503, 'Service occupé, réessayez dans un instant.');
    $d = lire_json($f, array());
    $r = $fn($d);
    $tmp = $f . '.' . bin2hex(random_bytes(4));
    file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    @chmod($tmp, 0600);
    rename($tmp, $f);
    flock($v, LOCK_UN);
    fclose($v);
    return $r;
}

function texte(string $t, int $max): string {
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags($t)) ?? '');
    return function_exists('mb_substr') ? mb_substr($t, 0, $max, 'UTF-8') : substr($t, 0, $max);
}

/** Empreinte du jour : l'adresse IP n'est jamais écrite. */
function empreinte(string $dossier): string {
    $f = $dossier . '/sel.txt';
    if (!is_file($f)) @file_put_contents($f, bin2hex(random_bytes(16)));
    return substr(hash('sha256', (string) @file_get_contents($f) . '|' . gmdate('Ymd') . '|' . ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 20);
}

/** Compteur par visiteur et par jour ; $unique empêche de refaire deux fois la même chose. */
function limite(string $dossier, string $type, int $max, ?string $unique = null): string {
    $jour = gmdate('Ymd');
    $f = $dossier . '/limites-' . $jour . '.json';
    foreach (glob($dossier . '/limites-*.json') ?: array() as $ancien) {
        if ($ancien !== $f && filemtime($ancien) < time() - 2 * 86400) { @unlink($ancien); @unlink($ancien . '.lock'); }
    }
    $e = empreinte($dossier);
    return modifier($f, function (&$d) use ($type, $max, $e, $unique) {
        $k = $type . ':' . $e;
        if (($d[$k] ?? 0) >= $max) return 'trop';
        if ($unique !== null) {
            $u = $k . ':' . $unique;
            if (isset($d[$u])) return 'deja';
            $d[$u] = 1;
        }
        $d[$k] = ($d[$k] ?? 0) + 1;
        return 'ok';
    });
}

function applis_connues(): array {
    $l = lire_json(__DIR__ . '/apps.json', array('apps' => array()));
    $ids = array();
    foreach ($l['apps'] ?? array() as $a) if (isset($a['id'])) $ids[(string) $a['id']] = true;
    return $ids;
}

$D = dossier();
$SOUTIENS = $D . '/soutiens.json';
$PROPOSITIONS = $D . '/propositions.json';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    if (isset($_GET['soutiens'])) repondre(200, array('soutiens' => (object) lire_json($SOUTIENS, array())));
    if (isset($_GET['propositions'])) {
        $sans_contact = array_map(function ($p) { unset($p['contact']); return $p; }, lire_json($PROPOSITIONS, array())['propositions'] ?? array());
        repondre(200, array('propositions' => $sans_contact));
    }
    repondre(200, array('ok' => true));
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erreur(405, 'Méthode non prise en charge.');

$e = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($e)) erreur(400, 'Demande illisible.');
// Piège à robots : un humain ne voit pas ce champ.
if (!empty($e['site_web'])) repondre(200, array('ok' => true, 'id' => 'ignore'));
$action = (string) ($e['action'] ?? '');

if ($action === 'soutenir') {
    $app = (string) ($e['app_id'] ?? '');
    if (!isset(applis_connues()[$app])) erreur(400, 'Application inconnue.');
    $l = limite($D, 'soutien', SOUTIENS_PAR_JOUR, $app);
    if ($l === 'trop') erreur(429, "Beaucoup de soutiens aujourd'hui : revenez demain.");
    if ($l === 'deja') erreur(409, "Vous avez déjà soutenu cette application aujourd'hui.");
    $n = modifier($SOUTIENS, function (&$d) use ($app) { $d[$app] = (int) ($d[$app] ?? 0) + 1; return $d[$app]; });
    repondre(200, array('ok' => true, 'soutiens' => $n));
}

if ($action === 'proposer') {
    $charte = $e['charte'] ?? array();
    if (!is_array($charte) || count(array_filter($charte, function ($v) { return $v === true; })) !== 4) erreur(400, 'Merci de cocher les 4 points de la charte.');
    $nom = texte((string) ($e['nom'] ?? ''), 60);
    $url = trim((string) ($e['url'] ?? ''));
    $description = texte((string) ($e['description'] ?? ''), 280);
    $categorie = in_array($e['categorie'] ?? '', CATEGORIES_COLLECTIF, true) ? (string) $e['categorie'] : 'Autre';
    $pseudo = texte((string) ($e['pseudo'] ?? ''), 40);
    $contact = texte((string) ($e['contact'] ?? ''), 120);
    if (mb_strlen($nom) < 2) erreur(400, "Indiquez le nom de l'application.");
    if (!filter_var($url, FILTER_VALIDATE_URL) || stripos($url, 'https://') !== 0 || strlen($url) > 300) erreur(400, "L'adresse doit commencer par https://");
    if (mb_strlen($description) < 15) erreur(400, 'Décrivez votre application en une ou deux phrases (15 caractères au moins).');
    if (mb_strlen($pseudo) < 2) erreur(400, 'Indiquez votre nom ou pseudo de créateur.');
    $l = limite($D, 'proposition', PROPOSITIONS_PAR_JOUR);
    if ($l === 'trop') erreur(429, "Vous avez déjà fait 3 propositions aujourd'hui : revenez demain.");
    $id = 'prop_' . time() . '_' . bin2hex(random_bytes(2));
    $p = array(
        'id' => $id, 'nom' => $nom, 'url' => $url, 'description' => $description, 'categorie' => $categorie,
        'pseudo' => $pseudo, 'contact' => $contact, 'charte_acceptee' => true,
        'statut' => 'en_attente', 'date' => gmdate('c'),
    );
    $ok = modifier($PROPOSITIONS, function (&$d) use ($p) {
        $liste = $d['propositions'] ?? array();
        if (count($liste) >= MAX_PROPOSITIONS) return false;
        foreach ($liste as $x) if (($x['url'] ?? '') === $p['url'] && ($x['statut'] ?? '') === 'en_attente') return 'double';
        $liste[] = $p;
        $d['propositions'] = $liste;
        return true;
    });
    if ($ok === 'double') erreur(409, 'Cette application est déjà en cours d\'examen.');
    if ($ok !== true) erreur(503, 'Les propositions sont momentanément fermées.');
    // Prévenir Valentin (l'e-mail est le seul endroit où le contact est transmis).
    if (function_exists('mail')) {
        $corps = "Nouvelle proposition pour le Collectif Alphabette\n\nNom : $nom\nAdresse : $url\nCatégorie : $categorie\nCréateur : $pseudo\nContact : " . ($contact ?: '(non donné)') . "\n\n$description\n\nIdentifiant : $id\nRien n'est publié tant que vous ne l'avez pas validée.";
        @mail(DESTINATAIRE, '=?UTF-8?B?' . base64_encode('[Alphabette] Proposition : ' . $nom) . '?=', $corps,
            "From: collectif@alphabette.eu\r\nContent-Type: text/plain; charset=UTF-8");
    }
    repondre(200, array('ok' => true, 'id' => $id));
}

erreur(400, 'Action inconnue.');
