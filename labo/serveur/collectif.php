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
 *        de charte (contrôles de sécurité/anti-traceurs, .eu d'abord (passage sur alphabette.fr seulement après examen et accord explicite du créateur), zéro pub et zéro
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
 * Laboratoire d'Octet (docs/labo/LABORATOIRE-OCTET.md) :
 *   POST { action:"idee", titre, probleme, phrase, public_cible?, categorie?, pseudo?, jeton, site_web }   (nouveau formulaire)
 *   GET  ?idee=<id>                    → idée + commentaires + avis + historique des étapes (ou { fusion_vers })
 *   POST { action:"voter_idee", id, jeton } / { action:"retirer_vote_idee", id, jeton }   (un soutien par appareil)
 *   POST { action:"commenter", id, texte, pseudo?, parent? }   |   { action:"signaler_contenu", type, id, motif }
 *   POST { action:"noter_prototype", id, note 1-5, essai:true, commentaire?, pseudo?, jeton }   (prototype testable seulement)
 *   POST { action:"admin_*" }          → secret serveur ALPHABETTE_LABO_ADMIN_TOKEN (en-tête X-Labo-Admin) : étapes, accord du créateur,
 *                                        revue, prototype, masquer, fermer, fusionner. « disponible_fr » reste bloqué sans accord explicite,
 *                                        revue ET conditions de location validées (data/labo/conditions-location.json).
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

// --- Laboratoire d'Octet : parcours des idées, discussion, notes de prototype (voir docs/labo/LABORATOIRE-OCTET.md) ---
const ETAPES = array('nouvelle' => 'Nouvelle idée', 'discussion' => 'En discussion', 'a_explorer' => 'À explorer',
    'prototype' => 'Prototype en cours', 'test_eu' => 'En test sur alphabette.eu', 'candidate_fr' => 'Candidate pour alphabette.fr',
    'disponible_fr' => 'Disponible sur alphabette.fr', 'pause' => 'En pause', 'refusee' => 'Refusée', 'archivee' => 'Archivée');
const COMMENTAIRES_PAR_JOUR = 15;      // par visiteur
const MAX_COMMENTAIRES = 20000;
const NOTES_PAR_JOUR = 10;             // par visiteur
const SIGNALEMENTS_CONTENU_PAR_JOUR = 10;
const MOTIFS_CONTENU = array('spam' => 'Spam ou publicité', 'insulte' => 'Propos blessants', 'donnees' => 'Donnée personnelle', 'hors_sujet' => 'Hors sujet', 'autre' => 'Autre');
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
    return refus_contenu($titre . ' ' . $phrase);
}

/** Contrôle du contenu public (liens, e-mail, téléphone, majuscules, mots refusés) : '' si le texte passe. */
function refus_contenu(string $tout): string {
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

// ---------------------------------------------------------------------------------------------------
// Laboratoire d'Octet : étapes, discussion, votes sans compte, notes de prototype, modération.
// Fichiers privés (hors du site) : lab-meta.json (étapes, prototype, accords), lab-votes.json (empreintes de vote),
// lab-commentaires.json, lab-notes.json, lab-signalements.json. Aucune adresse IP n'est écrite.
// ---------------------------------------------------------------------------------------------------
$LAB_META = $D . '/lab-meta.json';
$LAB_VOTES = $D . '/lab-votes.json';
$LAB_COMS = $D . '/lab-commentaires.json';
$LAB_NOTES = $D . '/lab-notes.json';
$LAB_SIGN = $D . '/lab-signalements.json';

/** Conditions juridiques et commerciales d'une location sur alphabette.fr : tant qu'elles ne sont pas validées par l'équipe, rien ne se publie. */
function lab_conditions_validees(): bool {
    $d = lire_json(__DIR__ . '/labo/conditions-location.json', array());
    return ($d['validees'] ?? false) === true;
}

/** Empreinte d'un vote : le jeton de l'appareil n'est jamais écrit en clair. */
function lab_hash(string $dossier, string $jeton, string $id): string {
    empreinte($dossier); // crée le sel si besoin
    return hash_hmac('sha256', $jeton . '|' . $id, (string) @file_get_contents($dossier . '/sel.txt'));
}

function lab_pseudo(?string $p): ?string {
    $p = texte((string) $p, 24);
    if ($p === '') return null;
    if (mb_strlen($p, 'UTF-8') < 2 || refus_contenu($p) !== '') erreur(400, 'Le pseudonyme doit faire de 2 à 24 caractères, sans lien, e-mail ni numéro.');
    return $p;
}

function lab_valide_id(string $id): string {
    if (!preg_match('/^idee_\d+_[a-f0-9]{4}$/', $id)) erreur(400, 'Idée inconnue.');
    return $id;
}

/** Idée existante et visible (ni masquée par les agents, ni masquée/fusionnée par l'équipe) : renvoie [idée, méta]. */
function lab_idee_visible(string $id): array {
    global $IDEES, $LAB_META;
    if ((string) (statuts_idees()[$id] ?? '') === 'masquee') erreur(404, 'Idée introuvable.');
    $meta = lire_json($LAB_META, array())['meta'][$id] ?? array();
    if (!empty($meta['masquee'])) erreur(404, 'Idée introuvable.');
    foreach (lire_json($IDEES, array())['idees'] ?? array() as $i) if ($i['id'] === $id) return array($i, $meta);
    erreur(404, 'Idée introuvable.');
    return array();
}

function lab_resume_notes(array $notes, string $id): array {
    $v = array();
    foreach ($notes as $n) if ($n['idee'] === $id && empty($n['masque'])) $v[] = (int) $n['valeur'];
    // Jamais « 0/5 » quand personne n'a noté : la moyenne est alors null (« Pas encore noté »).
    return array('nb_avis' => count($v), 'moyenne' => $v ? round(array_sum($v) / count($v), 1) : null);
}

function lab_idee_public(array $i, array $meta, string $legacy, array $coms, array $notes): array {
    $etape = (string) ($meta['etape'] ?? 'nouvelle');
    if (!isset(ETAPES[$etape])) $etape = 'nouvelle';
    $n = 0; $derniere = (string) $i['date'];
    foreach ($coms as $c) if ($c['idee'] === $i['id'] && empty($c['masque'])) { $n++; if ($c['date'] > $derniere) $derniere = $c['date']; }
    foreach (($meta['historique'] ?? array()) as $h) if ($h['date'] > $derniere) $derniere = $h['date'];
    $proto = $meta['prototype'] ?? null;
    return array('id' => $i['id'], 'titre' => $i['titre'], 'phrase' => $i['phrase'], 'votes' => (int) $i['votes'], 'date' => $i['date'],
        'statut' => in_array($legacy, array('retenue', 'realisee'), true) ? $legacy : null,
        'probleme' => $i['probleme'] ?? null, 'public_cible' => $i['public_cible'] ?? null, 'categorie' => $i['categorie'] ?? null,
        'pseudo' => $i['pseudo'] ?? null, 'etape' => $etape, 'etape_libelle' => ETAPES[$etape], 'ferme' => !empty($meta['ferme']),
        'nb_commentaires' => $n, 'derniere_activite' => $derniere,
        'prototype' => $proto ? array('app_id' => $proto['app_id'], 'testable' => !empty($proto['testable'])) + lab_resume_notes($notes, $i['id']) : null,
        'note_decision' => $meta['note_decision'] ?? null);
}

/** Idées publiques (sans les masquées ni les fusionnées), triées par votes décroissants puis les plus récentes. */
function idees_publiques(string $fichier): array {
    global $LAB_META, $LAB_COMS, $LAB_NOTES;
    $statuts = statuts_idees();
    $metas = lire_json($LAB_META, array())['meta'] ?? array();
    $coms = lire_json($LAB_COMS, array())['commentaires'] ?? array();
    $notes = lire_json($LAB_NOTES, array())['notes'] ?? array();
    $liste = array();
    foreach (lire_json($fichier, array())['idees'] ?? array() as $i) {
        $st = (string) ($statuts[$i['id']] ?? '');
        $m = $metas[$i['id']] ?? array();
        if ($st === 'masquee' || !empty($m['masquee']) || !empty($m['fusion_vers'])) continue;
        $liste[] = lab_idee_public($i, $m, $st, $coms, $notes);
    }
    usort($liste, function ($a, $b) { return $b['votes'] <=> $a['votes'] ?: strcmp($b['date'], $a['date']); });
    return $liste;
}

/** Contrôle d'accès administrateur : jamais fondé sur ce que envoie le navigateur, seulement sur un secret serveur. */
function lab_admin(array $e): void {
    global $D;
    $attendu = (string) getenv('ALPHABETTE_LABO_ADMIN_TOKEN');
    if ($attendu === '' && is_file($D . '/admin-token.txt')) $attendu = trim((string) @file_get_contents($D . '/admin-token.txt'));
    if (strlen($attendu) < 24) erreur(503, "L'administration du Laboratoire n'est pas configurée (variable ALPHABETTE_LABO_ADMIN_TOKEN).");
    $fourni = (string) ($_SERVER['HTTP_X_LABO_ADMIN'] ?? ($e['jeton_admin'] ?? ''));
    if ($fourni !== '' && hash_equals($attendu, $fourni)) return;
    if (limite($D, 'admin_echec', 20) === 'trop') erreur(429, 'Trop d\'essais : réessayez demain.');
    erreur(403, 'Accès refusé.');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    if (isset($_GET['idee'])) {
        $id = lab_valide_id((string) $_GET['idee']);
        $m = lire_json($LAB_META, array())['meta'][$id] ?? array();
        if (!empty($m['fusion_vers'])) repondre(200, array('fusion_vers' => $m['fusion_vers']));
        list($i, $meta) = lab_idee_visible($id);
        $coms = lire_json($LAB_COMS, array())['commentaires'] ?? array();
        $notes = lire_json($LAB_NOTES, array())['notes'] ?? array();
        $vis = array();
        foreach ($coms as $c) if ($c['idee'] === $id && empty($c['masque'])) $vis[] = array('id' => $c['id'], 'parent' => $c['parent'], 'texte' => $c['texte'], 'pseudo' => $c['pseudo'], 'date' => $c['date']);
        $avis = array();
        foreach ($notes as $n) if ($n['idee'] === $id && empty($n['masque'])) $avis[] = array('id' => $n['id'], 'valeur' => (int) $n['valeur'], 'commentaire' => $n['commentaire'], 'pseudo' => $n['pseudo'], 'date' => $n['date']);
        $hist = array_map(function ($h) { return array('vers' => $h['vers'], 'libelle' => ETAPES[$h['vers']] ?? $h['vers'], 'date' => $h['date'], 'note' => $h['note'] ?? null); }, $meta['historique'] ?? array());
        repondre(200, array('idee' => lab_idee_public($i, $meta, (string) (statuts_idees()[$id] ?? ''), $coms, $notes), 'commentaires' => $vis, 'avis' => $avis, 'historique' => $hist));
    }
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
    // Nouveau formulaire du Laboratoire d'Octet (champ « probleme » présent) ; l'ancien (titre + phrase) reste accepté.
    $v2 = array_key_exists('probleme', $e);
    $titre = texte((string) ($e['titre'] ?? ''), 80);
    $phrase = texte((string) ($e['phrase'] ?? ''), $v2 ? 400 : 200);
    $extra = array();
    if ($v2) {
        $probleme = texte((string) $e['probleme'], 300);
        $cible = texte((string) ($e['public_cible'] ?? ''), 120);
        $categorie = texte((string) ($e['categorie'] ?? ''), 40);
        $lt = mb_strlen($titre, 'UTF-8'); $lp = mb_strlen($probleme, 'UTF-8'); $ls = mb_strlen($phrase, 'UTF-8');
        if ($lt < 5 || $lt > 80) erreur(400, 'Le titre doit faire entre 5 et 80 caractères.');
        if ($lp < 10 || $lp > 300) erreur(400, 'Décrivez le problème en 10 à 300 caractères.');
        if ($ls < 10 || $ls > 400) erreur(400, 'Décrivez la solution en 10 à 400 caractères.');
        if ($categorie !== '' && !in_array($categorie, CATEGORIES_COLLECTIF, true)) erreur(400, 'Catégorie inconnue.');
        if (($r = refus_contenu($titre . ' ' . $probleme . ' ' . $phrase . ' ' . $cible)) !== '') erreur(400, $r);
        $extra = array('probleme' => $probleme, 'public_cible' => $cible !== '' ? $cible : null, 'categorie' => $categorie !== '' ? $categorie : null, 'pseudo' => lab_pseudo($e['pseudo'] ?? ''));
        $refus = '';
    } else {
        $refus = refus_idee($titre, $phrase);
    }
    if ($refus !== '') erreur(400, $refus);
    $cle = simplifier($titre);
    foreach (lire_json($IDEES, array())['idees'] ?? array() as $i) {
        if (simplifier((string) $i['titre']) === $cle) erreur(409, 'Cette idée est déjà proposée : votez pour elle dans la liste.');
    }
    $l = limite($D, 'idee', IDEES_PAR_JOUR);
    if ($l === 'trop') erreur(429, "Merci ! Vous avez déjà proposé " . IDEES_PAR_JOUR . " idées aujourd'hui : revenez demain.");
    $id = 'idee_' . time() . '_' . bin2hex(random_bytes(2));
    $idee = array('id' => $id, 'titre' => $titre, 'phrase' => $phrase, 'votes' => 1, 'date' => gmdate('c')) + $extra;
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
    // Nouveau client : le soutien de l'auteur est lié à son appareil (il ne peut pas soutenir sa propre idée une seconde fois).
    if ($v2 && isset($e['jeton']) && preg_match('/^[a-f0-9]{32,64}$/', (string) $e['jeton'])) {
        $h = lab_hash($D, (string) $e['jeton'], $id);
        modifier($LAB_VOTES, function (&$d) use ($id, $h) { $d['votes'][$id] = array($h); });
    }
    repondre(201, array('ok' => true, 'idee' => lab_idee_public($idee, array(), '', array(), array())));
}

// ===== Laboratoire d'Octet : actions publiques =====

if ($action === 'voter_idee' && isset($e['jeton'])) {
    // Un soutien par appareil : jeton aléatoire gardé dans le navigateur, seule son empreinte salée est stockée.
    // Limite honnête : vider le navigateur permet de soutenir à nouveau ; le plafond par connexion et par jour reste en place.
    $id = lab_valide_id((string) ($e['id'] ?? ''));
    $jeton = (string) $e['jeton'];
    if (!preg_match('/^[a-f0-9]{32,64}$/', $jeton)) erreur(400, 'Jeton invalide.');
    lab_idee_visible($id);
    $h = lab_hash($D, $jeton, $id);
    $deja = in_array($h, lire_json($LAB_VOTES, array())['votes'][$id] ?? array(), true);
    if ($deja) repondre(409, array('erreur' => 'Vous soutenez déjà cette idée.', 'deja' => true));
    if (limite($D, 'vote_idee:' . $id, VOTES_MEME_IDEE_PAR_JOUR) === 'trop') erreur(409, 'Cette idée a déjà reçu vos soutiens aujourd\'hui depuis cette connexion.');
    if (limite($D, 'votes_idees', VOTES_IDEES_PAR_JOUR) === 'trop') erreur(429, "Beaucoup de soutiens aujourd'hui : revenez demain.");
    $nouveau = modifier($LAB_VOTES, function (&$d) use ($id, $h) {
        $l = $d['votes'][$id] ?? array();
        if (in_array($h, $l, true)) return false;
        $l[] = $h;
        $d['votes'][$id] = $l;
        return true;
    });
    if (!$nouveau) repondre(409, array('erreur' => 'Vous soutenez déjà cette idée.', 'deja' => true));
    $n = modifier($IDEES, function (&$d) use ($id) {
        foreach ($d['idees'] ?? array() as $k => $i) if ($i['id'] === $id) { $d['idees'][$k]['votes'] = (int) $i['votes'] + 1; return $d['idees'][$k]['votes']; }
        return null;
    });
    repondre(200, array('ok' => true, 'votes' => (int) $n, 'a_vote' => true));
}

if ($action === 'retirer_vote_idee') {
    $id = lab_valide_id((string) ($e['id'] ?? ''));
    $jeton = (string) ($e['jeton'] ?? '');
    if (!preg_match('/^[a-f0-9]{32,64}$/', $jeton)) erreur(400, 'Jeton invalide.');
    if (limite($D, 'retrait_vote', 30) === 'trop') erreur(429, "Beaucoup d'actions aujourd'hui : revenez demain.");
    $h = lab_hash($D, $jeton, $id);
    $retire = modifier($LAB_VOTES, function (&$d) use ($id, $h) {
        $l = $d['votes'][$id] ?? array();
        $k = array_search($h, $l, true);
        if ($k === false) return false;
        unset($l[$k]);
        $d['votes'][$id] = array_values($l);
        return true;
    });
    if (!$retire) erreur(404, 'Vous ne souteniez pas cette idée depuis cet appareil.');
    $n = modifier($IDEES, function (&$d) use ($id) {
        foreach ($d['idees'] ?? array() as $k => $i) if ($i['id'] === $id) { $d['idees'][$k]['votes'] = max(0, (int) $i['votes'] - 1); return $d['idees'][$k]['votes']; }
        return null;
    });
    repondre(200, array('ok' => true, 'votes' => (int) $n, 'a_vote' => false));
}

if ($action === 'commenter') {
    $id = lab_valide_id((string) ($e['id'] ?? ''));
    list(, $meta) = lab_idee_visible($id);
    if (!empty($meta['ferme'])) erreur(403, 'La discussion de cette idée est fermée.');
    $t = texte((string) ($e['texte'] ?? ''), 500);
    $lt = mb_strlen($t, 'UTF-8');
    if ($lt < 3) erreur(400, 'Écrivez au moins quelques mots.');
    if (($r = refus_contenu($t)) !== '') erreur(400, str_replace('dans une idée', 'dans un commentaire', $r));
    $pseudo = lab_pseudo($e['pseudo'] ?? '');
    $parent = isset($e['parent']) && $e['parent'] !== '' && $e['parent'] !== null ? (string) $e['parent'] : null;
    if ($parent !== null && !preg_match('/^com_\d+_[a-f0-9]{4}$/', $parent)) erreur(400, 'Commentaire parent inconnu.');
    if (limite($D, 'commentaire', COMMENTAIRES_PAR_JOUR) === 'trop') erreur(429, 'Beaucoup de commentaires aujourd\'hui : revenez demain.');
    $com = array('id' => 'com_' . time() . '_' . bin2hex(random_bytes(2)), 'idee' => $id, 'parent' => null, 'texte' => $t, 'pseudo' => $pseudo, 'date' => gmdate('c'), 'masque' => false);
    $res = modifier($LAB_COMS, function (&$d) use ($com, $parent) {
        $l = $d['commentaires'] ?? array();
        if (count($l) >= MAX_COMMENTAIRES) return 'plein';
        if ($parent !== null) {
            // Un seul niveau de réponses : répondre à une réponse renvoie au commentaire d'origine (fil lisible et modérable).
            foreach ($l as $c) if ($c['id'] === $parent && $c['idee'] === $com['idee']) { $com['parent'] = $c['parent'] ?? $c['id']; break; }
            if ($com['parent'] === null) return 'parent';
        }
        $l[] = $com;
        $d['commentaires'] = $l;
        return $com;
    });
    if ($res === 'plein') erreur(503, 'La discussion est pleine pour le moment.');
    if ($res === 'parent') erreur(404, 'Commentaire parent introuvable.');
    repondre(201, array('ok' => true, 'commentaire' => array('id' => $res['id'], 'parent' => $res['parent'], 'texte' => $res['texte'], 'pseudo' => $res['pseudo'], 'date' => $res['date'])));
}

if ($action === 'signaler_contenu') {
    $type = (string) ($e['type'] ?? '');
    $cid = (string) ($e['id'] ?? '');
    $motif = (string) ($e['motif'] ?? '');
    if (!in_array($type, array('idee', 'commentaire', 'avis'), true) || !isset(MOTIFS_CONTENU[$motif])) erreur(400, 'Signalement incomplet.');
    $re = array('idee' => '/^idee_\d+_[a-f0-9]{4}$/', 'commentaire' => '/^com_\d+_[a-f0-9]{4}$/', 'avis' => '/^avis_\d+_[a-f0-9]{4}$/');
    if (!preg_match($re[$type], $cid)) erreur(400, 'Contenu inconnu.');
    $l = limite($D, 'signaler_contenu', SIGNALEMENTS_CONTENU_PAR_JOUR);
    if ($l === 'trop') erreur(429, 'Beaucoup de signalements aujourd\'hui : revenez demain.');
    if (limite($D, 'sc:' . $cid, 1) === 'trop') repondre(200, array('ok' => true)); // déjà signalé depuis cette connexion aujourd'hui
    $sig = array('id' => 'sig_' . time() . '_' . bin2hex(random_bytes(2)), 'type' => $type, 'cible' => $cid, 'motif' => $motif,
        'details' => texte((string) ($e['details'] ?? ''), 200), 'date' => gmdate('c'), 'etat' => 'nouveau');
    modifier($LAB_SIGN, function (&$d) use ($sig) { $d['signalements'] = array_slice(array_merge($d['signalements'] ?? array(), array($sig)), -3000); });
    repondre(200, array('ok' => true));
}

if ($action === 'noter_prototype') {
    $id = lab_valide_id((string) ($e['id'] ?? ''));
    list(, $meta) = lab_idee_visible($id);
    // Pas de note étoilée pour une simple idée : seulement un prototype que l'équipe a rendu testable.
    if (empty($meta['prototype']['testable'])) erreur(403, "Cette idée n'a pas encore de prototype à essayer : vous pouvez la soutenir et en discuter.");
    if (($e['essai'] ?? false) !== true) erreur(400, 'Cochez « J\'ai réellement essayé ce prototype » pour laisser une note.');
    $note = $e['note'] ?? null;
    if (!is_int($note) || $note < 1 || $note > 5) erreur(400, 'La note va de 1 à 5.');
    $jeton = (string) ($e['jeton'] ?? '');
    if (!preg_match('/^[a-f0-9]{32,64}$/', $jeton)) erreur(400, 'Jeton invalide.');
    $c = texte((string) ($e['commentaire'] ?? ''), 400);
    if ($c !== '' && ($r = refus_contenu($c)) !== '') erreur(400, str_replace('dans une idée', 'dans un avis', $r));
    $pseudo = lab_pseudo($e['pseudo'] ?? '');
    if (limite($D, 'note_proto', NOTES_PAR_JOUR) === 'trop') erreur(429, 'Beaucoup d\'avis aujourd\'hui : revenez demain.');
    $h = lab_hash($D, $jeton, 'note:' . $id);
    $res = modifier($LAB_NOTES, function (&$d) use ($id, $h, $note, $c, $pseudo) {
        $l = $d['notes'] ?? array();
        foreach ($l as $k => $n) if ($n['idee'] === $id && $n['hash'] === $h) { // un avis par appareil : il se met à jour
            $l[$k]['valeur'] = $note; $l[$k]['commentaire'] = $c; $l[$k]['pseudo'] = $pseudo; $l[$k]['date'] = gmdate('c');
            $d['notes'] = $l;
            return 'maj';
        }
        $l[] = array('id' => 'avis_' . time() . '_' . bin2hex(random_bytes(2)), 'idee' => $id, 'hash' => $h, 'valeur' => $note, 'commentaire' => $c, 'pseudo' => $pseudo, 'date' => gmdate('c'), 'masque' => false);
        $d['notes'] = array_slice($l, -20000);
        return 'cree';
    });
    $resume = lab_resume_notes(lire_json($LAB_NOTES, array())['notes'] ?? array(), $id);
    repondre($res === 'cree' ? 201 : 200, array('ok' => true, 'maj' => $res === 'maj') + $resume);
}

// ===== Laboratoire d'Octet : administration (secret serveur ; jamais l'état envoyé par le navigateur) =====

if (strpos($action, 'admin_') === 0) {
    lab_admin($e);
    $conn = function (string $id) use ($IDEES): array {
        foreach (lire_json($IDEES, array())['idees'] ?? array() as $i) if ($i['id'] === $id) return $i;
        erreur(404, 'Idée introuvable.');
        return array();
    };
    $maj_meta = function (string $id, callable $fn) use ($LAB_META) {
        return modifier($LAB_META, function (&$d) use ($id, $fn) {
            $m = $d['meta'][$id] ?? array();
            $r = $fn($m);
            if (is_array($r) && isset($r['__erreur'])) return $r;
            $m['maj'] = gmdate('c');
            $d['meta'][$id] = $m;
            return $r;
        });
    };
    $verifie = function ($r) { if (is_array($r) && isset($r['__erreur'])) erreur((int) $r['__code'], (string) $r['__erreur']); };
    $ko = function (int $code, string $m): array { return array('__code' => $code, '__erreur' => $m); };

    if ($action === 'admin_liste') {
        $metas = lire_json($LAB_META, array())['meta'] ?? array();
        $coms = lire_json($LAB_COMS, array())['commentaires'] ?? array();
        $notes = lire_json($LAB_NOTES, array())['notes'] ?? array();
        $sorties = array();
        foreach (lire_json($IDEES, array())['idees'] ?? array() as $i) {
            $m = $metas[$i['id']] ?? array();
            $sorties[] = lab_idee_public($i, $m, (string) (statuts_idees()[$i['id']] ?? ''), $coms, $notes)
                + array('masquee' => !empty($m['masquee']) || (string) (statuts_idees()[$i['id']] ?? '') === 'masquee', 'fusion_vers' => $m['fusion_vers'] ?? null,
                    'accord_createur' => !empty($m['accord_createur']), 'revue_ok' => !empty($m['revue_ok']));
        }
        $sigs = array_values(array_filter(lire_json($LAB_SIGN, array())['signalements'] ?? array(), function ($x) { return ($x['etat'] ?? '') === 'nouveau'; }));
        repondre(200, array('idees' => $sorties, 'signalements' => $sigs, 'conditions_location_validees' => lab_conditions_validees(),
            'commentaires_masquables' => array_map(function ($c) { return array('id' => $c['id'], 'idee' => $c['idee'], 'texte' => $c['texte'], 'masque' => !empty($c['masque'])); }, array_slice($coms, -200))));
    }

    if ($action === 'admin_statut') {
        $id = lab_valide_id((string) ($e['id'] ?? ''));
        $conn($id);
        $etape = (string) ($e['etape'] ?? '');
        if (!isset(ETAPES[$etape])) erreur(400, 'Étape inconnue.');
        $note = texte((string) ($e['note'] ?? ''), 200);
        $r = $maj_meta($id, function (&$m) use ($etape, $note, $ko) {
            if ($etape === 'candidate_fr' || $etape === 'disponible_fr') {
                if (empty($m['prototype']['app_id'])) return $ko(409, 'Un prototype doit être associé avant toute candidature pour alphabette.fr.');
            }
            if ($etape === 'disponible_fr') {
                $manque = array();
                if (empty($m['accord_createur'])) $manque[] = "l'accord explicite du créateur";
                if (empty($m['revue_ok'])) $manque[] = 'la revue éditoriale et technique';
                if (!lab_conditions_validees()) $manque[] = 'les conditions de location validées par l\'équipe (data/labo/conditions-location.json)';
                if ($manque) return $ko(409, 'Publication sur alphabette.fr bloquée : il manque ' . implode(', ', $manque) . '.');
            }
            $ancien = (string) ($m['etape'] ?? 'nouvelle');
            $m['etape'] = $etape;
            if ($note !== '') $m['note_decision'] = $note;
            $m['historique'] = array_slice(array_merge($m['historique'] ?? array(), array(array('de' => $ancien, 'vers' => $etape, 'date' => gmdate('c'), 'note' => $note !== '' ? $note : null))), -50);
            return true;
        });
        $verifie($r);
        repondre(200, array('ok' => true, 'etape' => $etape));
    }

    if ($action === 'admin_accord' || $action === 'admin_revue') {
        $id = lab_valide_id((string) ($e['id'] ?? ''));
        $conn($id);
        $cle = $action === 'admin_accord' ? 'accord_createur' : 'revue_ok';
        $val = ($e['valeur'] ?? false) === true;
        $maj_meta($id, function (&$m) use ($cle, $val) { $m[$cle] = $val; $m[$cle . '_date'] = gmdate('c'); return true; });
        repondre(200, array('ok' => true, $cle => $val));
    }

    if ($action === 'admin_prototype') {
        $id = lab_valide_id((string) ($e['id'] ?? ''));
        $conn($id);
        $app = (string) ($e['app_id'] ?? '');
        // Jamais d'adresse libre : seulement une application déjà connue du registre d'Alphabette.
        if (!preg_match('/^[a-z0-9-]{2,40}$/', $app) || !isset(applis_connues()[$app])) erreur(400, "Cette application n'existe pas dans le registre.");
        $testable = ($e['testable'] ?? false) === true;
        $maj_meta($id, function (&$m) use ($app, $testable) { $m['prototype'] = array('app_id' => $app, 'testable' => $testable); return true; });
        repondre(200, array('ok' => true));
    }

    if ($action === 'admin_masquer') {
        $type = (string) ($e['type'] ?? 'idee');
        $cid = (string) ($e['id'] ?? '');
        $masque = ($e['masque'] ?? true) === true;
        if ($type === 'idee') {
            lab_valide_id($cid); $conn($cid);
            $maj_meta($cid, function (&$m) use ($masque) { $m['masquee'] = $masque; return true; });
        } elseif ($type === 'commentaire' || $type === 'avis') {
            $f = $type === 'commentaire' ? $LAB_COMS : $LAB_NOTES; $k = $type === 'commentaire' ? 'commentaires' : 'notes';
            $ok = modifier($f, function (&$d) use ($k, $cid, $masque) {
                foreach ($d[$k] ?? array() as $n => $c) if ($c['id'] === $cid) { $d[$k][$n]['masque'] = $masque; return true; }
                return false;
            });
            if (!$ok) erreur(404, 'Contenu introuvable.');
        } else erreur(400, 'Type inconnu.');
        repondre(200, array('ok' => true));
    }

    if ($action === 'admin_fermer') {
        $id = lab_valide_id((string) ($e['id'] ?? ''));
        $conn($id);
        $f = ($e['ferme'] ?? true) === true;
        $maj_meta($id, function (&$m) use ($f) { $m['ferme'] = $f; return true; });
        repondre(200, array('ok' => true, 'ferme' => $f));
    }

    if ($action === 'admin_fusionner') {
        // Les doublons se rejoignent sans rien perdre : soutiens (sans doubler un même appareil) et commentaires passent à l'idée cible.
        $id = lab_valide_id((string) ($e['id'] ?? ''));
        $vers = lab_valide_id((string) ($e['vers'] ?? ''));
        if ($id === $vers) erreur(400, 'Choisissez une autre idée comme cible.');
        $conn($id); $conn($vers);
        // Les empreintes de vote sont liées à chaque idée : elles ne se comparent pas. Les soutiens de la source s'ajoutent au total
        // de la cible ; une personne qui avait soutenu les deux doublons peut compter deux fois (limite connue, documentée).
        $ids_src = $conn($id)['votes'];
        modifier($IDEES, function (&$d) use ($id, $vers) {
            $v = 0;
            foreach ($d['idees'] ?? array() as $i) if ($i['id'] === $id) $v = (int) $i['votes'];
            foreach ($d['idees'] ?? array() as $k => $i) if ($i['id'] === $vers) $d['idees'][$k]['votes'] = (int) $i['votes'] + $v;
        });
        modifier($LAB_COMS, function (&$d) use ($id, $vers) { foreach ($d['commentaires'] ?? array() as $k => $c) if ($c['idee'] === $id) $d['commentaires'][$k]['idee'] = $vers; });
        $maj_meta($id, function (&$m) use ($vers) { $m['fusion_vers'] = $vers; return true; });
        repondre(200, array('ok' => true, 'fusionnee_vers' => $vers, 'votes_transferes' => (int) $ids_src));
    }

    if ($action === 'admin_signalement') {
        $sid = (string) ($e['id'] ?? '');
        $ok = modifier($LAB_SIGN, function (&$d) use ($sid) {
            foreach ($d['signalements'] ?? array() as $k => $x) if ($x['id'] === $sid) { $d['signalements'][$k]['etat'] = 'traite'; return true; }
            return false;
        });
        if (!$ok) erreur(404, 'Signalement introuvable.');
        repondre(200, array('ok' => true));
    }

    erreur(400, 'Action d\'administration inconnue.');
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
