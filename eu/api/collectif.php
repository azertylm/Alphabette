<?php
/**
 * collectif.php — le Collectif Alphabette sur alphabette.eu (Laboratoire).
 * Publié dans eu/api/collectif.php par scripts/build-static.mjs (OVH Perso : PHP, pas de base de données).
 *
 *   GET  ?soutiens                     → { soutiens: { <app_id>: n } }            (compteurs publics)
 *   GET  ?propositions=1               → propositions SANS les contacts (lu par les agents de tri)
 *   POST { action:"soutenir", app_id } → { ok, soutiens }   (1 soutien par personne, par appli et par jour)
 *   GET  ?signalements=1               → signalements SANS les contacts (lu par les agents, 200 derniers)
 *   POST { action:"proposer", nom, url | depot (+ dossier), description, categorie, pseudo, contact?, charte:[5 × true], site_web }
 *                                      → { ok, id }          (jamais publiée automatiquement)
 *        Salle d'embarquement (alphabette.eu/embarquement/) : formulaire:"embarquement", regles:[4 × true] à la place
 *        de charte (contrôles de sécurité/anti-traceurs, .eu seulement — jamais alphabette.fr —, zéro pub et zéro
 *        revente de données, charte des créateurs), duree (ms passées sur le formulaire, piège à robots).
 *        File d'attente privée : propositions.json, hors du site (jamais servie, jamais indexée).
 *        url   : l'appli a sa propre adresse https ;
 *        depot : « pseudo/depot » GitHub public avec les fichiers déjà construits → hébergée et isolée par
 *                Alphabette (bac à sable, voir docs/labo/ATELIER-QUALITE.md).
 *   GET  ?idees=1                      → { idees: [{ id, titre, phrase, votes, date, statut }] }  (boîte à idées, triées par votes)
 *   POST { action:"idee", titre, phrase, site_web }   → { ok, idee }   (« Quelle prochaine appli ? », publiée tout de suite,
 *                                                                      filtre anti-spam ; modération : api/labo/idees-statuts.json)
 *   POST { action:"voter_idee", id }   → { ok, votes }   (1 vote par idée et par appareil via localStorage ; ici, par empreinte
 *                                                         du jour : 5 votes au plus pour une même idée, 60 en tout)
 *   POST { action:"signaler", app_id, motif, details, contact?, adresse?, site_web }
 *                                      → { ok }   (e-mail immédiat à Valentin : mécanisme de signalement de l'hébergeur)
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
const SIGNALEMENTS_PAR_JOUR = 10;      // par visiteur
const MAX_SIGNALEMENTS = 5000;
const MOTIFS_SIGNALEMENT = array('illicite' => 'Contenu illicite ou dangereux', 'arnaque' => 'Arnaque ou hameçonnage',
    'donnees' => 'Collecte abusive de données personnelles', 'droits' => 'Atteinte à des droits (auteur, image, marque)',
    'bug' => 'Ne marche pas', 'autre' => 'Autre');
const POINTS_CHARTE = 5;
const REGLES_EMBARQUEMENT = array('controles_securite_anti_traceurs', 'alphabette_eu_seulement_jamais_fr', 'zero_pub_zero_revente', 'charte_createurs');
const DUREE_MINIMUM_MS = 2500;         // un humain ne remplit pas le formulaire en moins de 2,5 s
const CATEGORIES_COLLECTIF = array('Quotidien', 'Santé & bien-être', 'Éducation', 'Culture', 'Outils', 'Jeux', 'Citoyen', 'Autre');
const DESTINATAIRE = 'azertylm@gmail.com';
const IDEES_PAR_JOUR = 3;              // par visiteur
const VOTES_IDEES_PAR_JOUR = 60;       // par visiteur, toutes idées confondues
// Le « 1 vote par idée » est tenu par l'appareil (localStorage) : une même connexion (famille, box, réseau mobile
// partagé) peut voter quelques fois pour la même idée, pas plus.
const VOTES_MEME_IDEE_PAR_JOUR = 5;
const MAX_IDEES = 1000;
/** Mots qui font refuser une idée d'office (le reste est modéré par les agents chaque soir). */
const MOTS_REFUSES = array('connard', 'connasse', 'salope', 'encule', 'enculé', 'pute', 'nique', 'batard', 'bâtard', 'pd', 'nazi',
    'viagra', 'casino', 'crypto', 'bitcoin', 'porn', 'porno', 'xxx', 'escort');

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
$SIGNALEMENTS = $D . '/signalements.json';
$IDEES = $D . '/idees.json';

/** Statuts posés par les agents ou Valentin (masquee, retenue, realisee) : api/labo/idees-statuts.json. */
function statuts_idees(): array {
    $d = lire_json(__DIR__ . '/labo/idees-statuts.json', array());
    return isset($d['statuts']) && is_array($d['statuts']) ? $d['statuts'] : array();
}

/** Forme simplifiée d'un texte (sans accents ni ponctuation) : détecte les doublons et les mots refusés. */
function simplifier(string $t): string {
    $t = mb_strtolower($t, 'UTF-8');
    $t = strtr($t, array('à' => 'a', 'â' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i',
        'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', 'œ' => 'oe', 'æ' => 'ae', 'ÿ' => 'y'));
    return trim(preg_replace('/[^a-z0-9]+/', ' ', $t) ?? '');
}

/** Filtre anti-spam d'une idée : '' si elle passe, sinon le message d'erreur à afficher. */
function refus_idee(string $titre, string $phrase): string {
    $l_titre = mb_strlen($titre, 'UTF-8');
    $l_phrase = mb_strlen($phrase, 'UTF-8');
    if ($l_titre < 3 || $l_titre > 60) return 'Le titre doit faire entre 3 et 60 caractères.';
    if ($l_phrase < 10 || $l_phrase > 160) return 'Décrivez votre idée en une phrase (10 à 160 caractères).';
    $tout = $titre . ' ' . $phrase;
    if (preg_match('#https?://|www\.|\b[a-z0-9-]+\.(com|fr|eu|net|org|io|ly|xyz|ru|info)\b#i', $tout)) return 'Pas de lien dans une idée : décrivez-la simplement.';
    if (preg_match('/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', $tout)) return "Pas d'adresse e-mail dans une idée : elle est publique.";
    if (preg_match('/(?:\d[\s.-]?){8,}/', $tout)) return 'Pas de numéro de téléphone dans une idée : elle est publique.';
    if (preg_match('/(.)\1{5,}/u', $tout)) return 'Le texte contient trop de caractères répétés.';
    $lettres = preg_replace('/[^\p{L}]/u', '', $tout) ?? '';
    $majuscules = preg_replace('/[^\p{Lu}]/u', '', $tout) ?? '';
    if (mb_strlen($lettres, 'UTF-8') >= 12 && mb_strlen($majuscules, 'UTF-8') > 0.6 * mb_strlen($lettres, 'UTF-8')) return 'Merci d\'écrire sans tout en majuscules.';
    $mots = explode(' ', simplifier($tout));
    foreach (MOTS_REFUSES as $m) if (in_array(simplifier($m), $mots, true)) return 'Cette idée ne peut pas être publiée telle quelle.';
    return '';
}

/** Idées publiques (sans les masquées), triées par votes décroissants puis les plus récentes. */
function idees_publiques(string $fichier): array {
    $statuts = statuts_idees();
    $liste = array();
    foreach (lire_json($fichier, array())['idees'] ?? array() as $i) {
        $st = (string) ($statuts[$i['id']] ?? '');
        if ($st === 'masquee') continue;
        $liste[] = array('id' => $i['id'], 'titre' => $i['titre'], 'phrase' => $i['phrase'], 'votes' => (int) $i['votes'],
            'date' => $i['date'], 'statut' => in_array($st, array('retenue', 'realisee'), true) ? $st : null);
    }
    usort($liste, function ($a, $b) { return $b['votes'] <=> $a['votes'] ?: strcmp($b['date'], $a['date']); });
    return $liste;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    if (isset($_GET['idees'])) repondre(200, array('idees' => idees_publiques($IDEES)));
    if (isset($_GET['soutiens'])) repondre(200, array('soutiens' => (object) lire_json($SOUTIENS, array())));
    if (isset($_GET['propositions'])) {
        $sans_contact = array_map(function ($p) { unset($p['contact']); return $p; }, lire_json($PROPOSITIONS, array())['propositions'] ?? array());
        repondre(200, array('propositions' => $sans_contact));
    }
    if (isset($_GET['signalements'])) {
        $liste = array_slice(lire_json($SIGNALEMENTS, array())['signalements'] ?? array(), -200);
        // Lecture par les agents : jamais le contact ; e-mails et numéros masqués dans le texte (le détail complet est dans l'e-mail à Valentin).
        $masquer = function (string $t): string {
            $t = preg_replace('/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', '[e-mail masqué]', $t) ?? '';
            return preg_replace('/(?:\+?\d[\s.-]?){8,}/', '[numéro masqué]', $t) ?? '';
        };
        repondre(200, array('signalements' => array_map(function ($x) use ($masquer) { unset($x['contact']); $x['details'] = $masquer((string) ($x['details'] ?? '')); return $x; }, $liste)));
    }
    repondre(200, array('ok' => true));
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') erreur(405, 'Méthode non prise en charge.');

// Seules les pages d'Alphabette écrivent ici (un autre site ne peut pas poster à la place d'un visiteur).
$origine = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origine !== '' && !preg_match('#^(https://(www\.)?alphabette\.(eu|fr)|http://(localhost|127\.0\.0\.1)(:\d+)?)$#', $origine)) erreur(403, 'Origine refusée.');
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) erreur(413, 'Demande trop longue.');
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
    $embarquement = ($e['formulaire'] ?? '') === 'embarquement';
    if ($embarquement) {
        // Salle d'embarquement : les 4 règles du Laboratoire, chacune cochée ; formulaire rempli trop vite = robot.
        $regles = $e['regles'] ?? array();
        if (!is_array($regles) || count($regles) !== count(REGLES_EMBARQUEMENT) || count(array_filter($regles, function ($v) { return $v === true; })) !== count(REGLES_EMBARQUEMENT)) erreur(400, 'Merci de cocher les ' . count(REGLES_EMBARQUEMENT) . ' règles du Laboratoire.');
        if ((int) ($e['duree'] ?? 0) < DUREE_MINIMUM_MS) repondre(200, array('ok' => true, 'id' => 'ignore'));
    } else {
        $charte = $e['charte'] ?? array();
        if (!is_array($charte) || count(array_filter($charte, function ($v) { return $v === true; })) !== POINTS_CHARTE) erreur(400, 'Merci de cocher les ' . POINTS_CHARTE . ' points de la charte.');
    }
    $nom = texte((string) ($e['nom'] ?? ''), 60);
    $url = trim((string) ($e['url'] ?? ''));
    // Sans hébergement : dépôt GitHub public (fichiers déjà construits), hébergé et isolé par Alphabette.
    $depot = trim(preg_replace('#^(https?://)?(www\.)?github\.com/#i', '', (string) ($e['depot'] ?? '')) ?? '', " /\t\n");
    $depot = preg_replace('#\.git$#', '', $depot) ?? '';
    $sous_dossier = trim((string) ($e['dossier'] ?? ''), " /");
    if ($depot !== '') {
        if (!preg_match('#^[A-Za-z0-9][A-Za-z0-9-]{0,38}/(?!\.\.?$)[A-Za-z0-9_.-]{1,100}$#', $depot)) erreur(400, 'Le dépôt GitHub doit avoir la forme pseudo/nom-du-depot.');
        if ($sous_dossier !== '' && (!preg_match('#^[A-Za-z0-9_./-]{1,80}$#', $sous_dossier) || strpos($sous_dossier, '..') !== false)) erreur(400, 'Dossier du site invalide (par exemple : dist).');
        if ($url === 'https://') $url = '';
    }
    $description = texte((string) ($e['description'] ?? ''), 280);
    $categorie = in_array($e['categorie'] ?? '', CATEGORIES_COLLECTIF, true) ? (string) $e['categorie'] : 'Autre';
    $pseudo = texte((string) ($e['pseudo'] ?? ''), 40);
    $contact = texte((string) ($e['contact'] ?? ''), 120);
    if (mb_strlen($nom) < 2) erreur(400, "Indiquez le nom de l'application.");
    if ($depot === '' && (!filter_var($url, FILTER_VALIDATE_URL) || stripos($url, 'https://') !== 0 || strlen($url) > 300)) erreur(400, "L'adresse doit commencer par https://");
    if ($url !== '' && (!filter_var($url, FILTER_VALIDATE_URL) || stripos($url, 'https://') !== 0 || strlen($url) > 300)) erreur(400, "L'adresse doit commencer par https://");
    if (mb_strlen($description) < 15) erreur(400, 'Décrivez votre application en une ou deux phrases (15 caractères au moins).');
    if (mb_strlen($pseudo) < 2) erreur(400, 'Indiquez votre nom ou pseudo de créateur.');
    // Anti-spam simple : pas de lien dans le nom ni le pseudo, un lien au plus dans la description.
    if (preg_match('#https?://|www\.#i', $nom . ' ' . $pseudo)) erreur(400, 'Pas de lien dans le nom ni dans le pseudo.');
    if (preg_match_all('#https?://|www\.#i', $description) > 1) erreur(400, 'Un seul lien au plus dans la description.');
    $l = limite($D, 'proposition', PROPOSITIONS_PAR_JOUR);
    if ($l === 'trop') erreur(429, "Vous avez déjà fait 3 propositions aujourd'hui : revenez demain.");
    $id = 'prop_' . time() . '_' . bin2hex(random_bytes(2));
    $p = array(
        'id' => $id, 'nom' => $nom, 'url' => $url, 'description' => $description, 'categorie' => $categorie,
        'pseudo' => $pseudo, 'contact' => $contact, 'charte_acceptee' => true, 'charte_points' => $embarquement ? count(REGLES_EMBARQUEMENT) : POINTS_CHARTE,
        'formulaire' => $embarquement ? 'embarquement' : 'proposer', 'regles_acceptees' => $embarquement ? REGLES_EMBARQUEMENT : array(),
        'domaine' => 'alphabette.eu',
        'mode' => $depot !== '' ? 'heberge' : 'lien', 'depot' => $depot, 'dossier' => $sous_dossier,
        'statut' => 'en_attente', 'date' => gmdate('c'),
    );
    $ok = modifier($PROPOSITIONS, function (&$d) use ($p) {
        $liste = $d['propositions'] ?? array();
        if (count($liste) >= MAX_PROPOSITIONS) return false;
        foreach ($liste as $x) {
            $meme = $p['depot'] !== '' ? ($x['depot'] ?? '') === $p['depot'] : ($x['url'] ?? '') === $p['url'];
            if ($meme && ($x['statut'] ?? '') === 'en_attente') return 'double';
        }
        $liste[] = $p;
        $d['propositions'] = $liste;
        return true;
    });
    if ($ok === 'double') erreur(409, 'Cette application est déjà en cours d\'examen.');
    if ($ok !== true) erreur(503, 'Les propositions sont momentanément fermées.');
    // Prévenir Valentin (l'e-mail est le seul endroit où le contact est transmis).
    if (function_exists('mail')) {
        $ou = $depot !== '' ? "Dépôt GitHub (hébergée par Alphabette) : https://github.com/$depot" . ($sous_dossier !== '' ? " — dossier $sous_dossier" : '') . ($url !== '' ? "\nAdresse : $url" : '') : "Adresse : $url";
        $corps = "Nouvelle proposition pour le Collectif Alphabette" . ($embarquement ? " (Salle d'embarquement)" : '') . "\n\nNom : $nom\n$ou\nCatégorie : $categorie\nCréateur : $pseudo\nContact : " . ($contact ?: '(non donné)') . "\n\n$description\n\nIdentifiant : $id\nL'Atelier qualité la contrôle au prochain passage. Rien n'est publié tant que vous ne l'avez pas validée.\nRègle : appli de créateur = alphabette.eu seulement, jamais transférée sur alphabette.fr.";
        @mail(DESTINATAIRE, '=?UTF-8?B?' . base64_encode('[Alphabette] Proposition : ' . $nom) . '?=', $corps,
            "From: collectif@alphabette.eu\r\nContent-Type: text/plain; charset=UTF-8");
    }
    repondre(200, array('ok' => true, 'id' => $id));
}

if ($action === 'idee') {
    $titre = texte((string) ($e['titre'] ?? ''), 80);
    $phrase = texte((string) ($e['phrase'] ?? ''), 200);
    $refus = refus_idee($titre, $phrase);
    if ($refus !== '') erreur(400, $refus);
    $cle = simplifier($titre);
    foreach (lire_json($IDEES, array())['idees'] ?? array() as $i) {
        if (simplifier((string) $i['titre']) === $cle) erreur(409, 'Cette idée est déjà proposée : votez pour elle dans la liste.');
    }
    $l = limite($D, 'idee', IDEES_PAR_JOUR);
    if ($l === 'trop') erreur(429, "Merci ! Vous avez déjà proposé " . IDEES_PAR_JOUR . " idées aujourd'hui : revenez demain.");
    $id = 'idee_' . time() . '_' . bin2hex(random_bytes(2));
    $idee = array('id' => $id, 'titre' => $titre, 'phrase' => $phrase, 'votes' => 1, 'date' => gmdate('c'));
    $ok = modifier($IDEES, function (&$d) use ($idee, $cle) {
        $liste = $d['idees'] ?? array();
        if (count($liste) >= MAX_IDEES) return 'plein';
        foreach ($liste as $i) if (simplifier((string) $i['titre']) === $cle) return 'double';
        $liste[] = $idee;
        $d['idees'] = $liste;
        return true;
    });
    if ($ok === 'double') erreur(409, 'Cette idée est déjà proposée : votez pour elle dans la liste.');
    if ($ok !== true) erreur(503, 'La boîte à idées est pleine pour le moment : revenez bientôt.');
    // L'auteur a voté pour sa propre idée (le « 1 » de départ) : son appareil le retient (localStorage).
    repondre(201, array('ok' => true, 'idee' => $idee + array('statut' => null)));
}

if ($action === 'voter_idee') {
    $id = (string) ($e['id'] ?? '');
    if (!preg_match('/^idee_\d+_[a-f0-9]{4}$/', $id)) erreur(400, 'Idée inconnue.');
    if ((string) (statuts_idees()[$id] ?? '') === 'masquee') erreur(404, 'Idée introuvable.');
    if (limite($D, 'vote_idee:' . $id, VOTES_MEME_IDEE_PAR_JOUR) === 'trop') erreur(409, 'Cette idée a déjà reçu vos votes aujourd\'hui depuis cette connexion.');
    if (limite($D, 'votes_idees', VOTES_IDEES_PAR_JOUR) === 'trop') erreur(429, "Beaucoup de votes aujourd'hui : revenez demain.");
    $n = modifier($IDEES, function (&$d) use ($id) {
        foreach ($d['idees'] ?? array() as $k => $i) {
            if ($i['id'] === $id) { $d['idees'][$k]['votes'] = (int) $i['votes'] + 1; return $d['idees'][$k]['votes']; }
        }
        return null;
    });
    if ($n === null) erreur(404, 'Idée introuvable.');
    repondre(200, array('ok' => true, 'votes' => $n));
}

if ($action === 'signaler') {
    $app = (string) ($e['app_id'] ?? '');
    if (!isset(applis_connues()[$app])) erreur(400, 'Application inconnue.');
    $motif = (string) ($e['motif'] ?? '');
    if (!isset(MOTIFS_SIGNALEMENT[$motif])) erreur(400, 'Choisissez un motif.');
    $details = texte((string) ($e['details'] ?? ''), 1000);
    if (mb_strlen($details) < 5) erreur(400, 'Décrivez le problème en quelques mots.');
    $contact = texte((string) ($e['contact'] ?? ''), 120);
    $adresse = trim((string) ($e['adresse'] ?? ''));
    if (!preg_match('#^https://(www\.)?alphabette\.(eu|fr)/#', $adresse) || strlen($adresse) > 300) $adresse = '';
    $l = limite($D, 'signalement', SIGNALEMENTS_PAR_JOUR);
    if ($l === 'trop') erreur(429, "Beaucoup de signalements aujourd'hui depuis votre connexion : écrivez à " . DESTINATAIRE . '.');
    $id = 'sig_' . time() . '_' . bin2hex(random_bytes(2));
    $urgent = in_array($motif, array('illicite', 'arnaque', 'donnees', 'droits'), true);
    $ok = modifier($SIGNALEMENTS, function (&$d) use ($id, $app, $motif, $details, $contact, $adresse, $urgent) {
        $liste = $d['signalements'] ?? array();
        if (count($liste) >= MAX_SIGNALEMENTS) $liste = array_slice($liste, -MAX_SIGNALEMENTS + 1);
        $liste[] = array('id' => $id, 'app_id' => $app, 'motif' => $motif, 'details' => $details, 'contact' => $contact,
            'adresse' => $adresse, 'urgent' => $urgent, 'statut' => 'a_traiter', 'date' => gmdate('c'));
        $d['signalements'] = $liste;
        return true;
    });
    if ($ok !== true) erreur(503, 'Signalement impossible pour le moment : écrivez à ' . DESTINATAIRE . '.');
    if (function_exists('mail')) {
        $corps = "Signalement sur le Laboratoire Alphabette" . ($urgent ? ' — À TRAITER SANS DÉLAI' : '') . "\n\nApplication : $app\nMotif : " . MOTIFS_SIGNALEMENT[$motif]
            . "\nPage : " . ($adresse ?: '(non indiquée)') . "\nContact : " . ($contact ?: '(non donné)') . "\n\n$details\n\nIdentifiant : $id\n"
            . "Pour une appli du collectif : la retirer = enlever sa fiche de data/apps-communaute.json (ou dire à Claude « retire <app> »).";
        @mail(DESTINATAIRE, '=?UTF-8?B?' . base64_encode('[Alphabette] ' . ($urgent ? 'URGENT — ' : '') . 'Signalement : ' . $app) . '?=', $corps,
            "From: collectif@alphabette.eu\r\nContent-Type: text/plain; charset=UTF-8");
    }
    repondre(200, array('ok' => true, 'id' => $id));
}

erreur(400, 'Action inconnue.');
