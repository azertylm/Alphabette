<?php
/**
 * feedback.php — avis des visiteurs du Laboratoire alphabette.eu.
 * Publié dans eu/api/feedback.php par scripts/build-static.mjs (hébergement OVH Perso : PHP).
 *
 *   GET                 → résumé public par application (moyenne, nombre de notes, top 3 des demandes, votes bêta)
 *   GET ?export=1       → tous les avis (schéma complet, lu par les agents via le workflow labo-avis.yml)
 *   GET ?etat=1         → santé du service (lieu de stockage, nombre d'avis)
 *   GET ?ouverts=<app>  → tickets ouverts d'une appli (id, catégorie, texte, +1) pour le dédoublonnage
 *   POST {action:"avis", …, source:"formulaire"|"sondage", declencheur}  (micro-sondage après une action réussie)
 *   POST {action:"avis", app_id, rating, category, comment, version_tested, telemetry, site_web}
 *   POST {action:"plus1", id}
 *   POST {action:"ab", app_id, choix:"actuelle"|"beta"}
 *   POST {action:"ab", app_id, test_id, ticket_id?, choix:"A"|"B"}   (barre « Bac à sable A/B » en direct)
 *   POST {action:"avis", …, source:"voix", urgence:1-5}              (retour vocal structuré dans le navigateur)
 *
 * Données : un fichier JSON rangé HORS du dossier publié (le dépôt Git d'OVH ne le touche pas).
 * Vie privée : aucune adresse IP n'est conservée. Seule une empreinte salée, changée chaque jour,
 * sert à limiter les abus ; les fichiers de limites de plus de 2 jours sont supprimés.
 * Les statuts (rejected, implemented…) viennent de api/labo/decisions.json, écrit par les agents.
 * Compatible PHP 7.0 et plus.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const MAX_AVIS = 20000;
const MAX_COMMENTAIRE = 1000;
const AVIS_PAR_JOUR = 8;     // par visiteur (empreinte du jour), toutes applis confondues
const VOTES_PAR_JOUR = 80;
const CATEGORIES = array('Bug', 'Idée', 'Design', 'Autre');
const STATUTS_OUVERTS = array('pending', 'approved_auto', 'needs_human_review');

function repondre($code, $donnees) {
    http_response_code($code);
    echo json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function erreur($code, $message) { repondre($code, array('erreur' => $message)); }

/** Dossier de données : hors web en priorité, sinon dossier protégé à côté de ce fichier. */
function dossier_donnees() {
    $candidats = array(
        dirname(__DIR__, 3) . '/alphabette-labo-donnees',
        __DIR__ . '/donnees-privees',
    );
    foreach ($candidats as $i => $dossier) {
        if (!is_dir($dossier)) @mkdir($dossier, 0700, true);
        if (is_dir($dossier) && is_writable($dossier)) {
            if ($i > 0 && !file_exists($dossier . '/.htaccess')) {
                @file_put_contents($dossier . '/.htaccess', "Require all denied\nDeny from all\n");
            }
            return array($dossier, $i === 0 ? 'hors-web' : 'web-protege');
        }
    }
    erreur(503, "Le service des avis n'est pas disponible pour le moment.");
}

list($DOSSIER, $LIEU) = dossier_donnees();
$FICHIER = $DOSSIER . '/feedbacks.json';

function lire_json($chemin, $defaut) {
    if (!is_file($chemin)) return $defaut;
    $d = json_decode((string) @file_get_contents($chemin), true);
    return is_array($d) ? $d : $defaut;
}

/** Lecture + écriture sous verrou exclusif : deux avis simultanés ne s'écrasent pas. */
function modifier($fichier, $fonction) {
    $verrou = fopen($fichier . '.lock', 'c');
    if (!$verrou || !flock($verrou, LOCK_EX)) erreur(503, 'Service occupé, réessayez dans un instant.');
    $donnees = lire_json($fichier, array('avis' => array(), 'ab' => array()));
    if (!isset($donnees['avis'])) $donnees['avis'] = array();
    if (!isset($donnees['ab'])) $donnees['ab'] = array();
    $resultat = $fonction($donnees);
    $tmp = $fichier . '.tmp';
    file_put_contents($tmp, json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    rename($tmp, $fichier);
    flock($verrou, LOCK_UN);
    fclose($verrou);
    return $resultat;
}

function applis_connues() {
    $liste = lire_json(__DIR__ . '/apps.json', array('apps' => array()));
    $ids = array();
    foreach ((isset($liste['apps']) ? $liste['apps'] : array()) as $a) if (isset($a['id'])) $ids[$a['id']] = isset($a['url']) ? (string) $a['url'] : '';
    return $ids;
}

/** Retrouve l'id d'une appli d'après son chemin sur .eu (« /apps/bonplan/ ») : pour les micro-sondages. */
function app_par_chemin($chemin, $connues) {
    $chemin = (string) $chemin;
    if ($chemin === '') return '';
    foreach ($connues as $id => $url) if ($url !== '' && strpos($url, $chemin) === 0) return $id;
    return '';
}

function decisions() {
    $d = lire_json(__DIR__ . '/labo/decisions.json', array());
    return isset($d['decisions']) && is_array($d['decisions']) ? $d['decisions'] : array();
}

/** Applique les décisions des agents (statut, analyse, message public) sur un avis brut. */
function avec_decision($avis, $decisions) {
    if (isset($decisions[$avis['id']]) && is_array($decisions[$avis['id']])) {
        $d = $decisions[$avis['id']];
        foreach (array('status', 'ai_analysis', 'changelog_public_message') as $champ) {
            if (array_key_exists($champ, $d)) $avis[$champ] = $d[$champ];
        }
    }
    return $avis;
}

function texte_propre($t, $max) {
    $t = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) $t);
    $t = trim(preg_replace('/[ \t]+/u', ' ', $t));
    return function_exists('mb_substr') ? mb_substr($t, 0, $max, 'UTF-8') : substr($t, 0, $max);
}

/** Filtre « zéro connaissance » (identique à packages/shell/src/labo/confidentialite.ts) : clés, jetons,
 *  e-mails, IBAN, cartes, téléphones, IP, paramètres d'adresse, longues suites. Appliqué au serveur
 *  aussi, au cas où un envoi contournerait le navigateur. */
function masquer($t, $max = 300) {
    $motifs = array(
        '/\b((?:https?|wss?):\/\/[^\s?#"\'<>)]+)[?#][^\s"\'<>)]*/i' => '$1?…',
        '/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/' => '[clé masquée]',
        '/\bAIza[0-9A-Za-z_-]{20,}/' => '[clé masquée]',
        '/\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/' => '[clé masquée]',
        '/\bxox[abposr]-[A-Za-z0-9-]{10,}/' => '[clé masquée]',
        '/\b(?:pk|sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/' => '[clé masquée]',
        '/\bAKIA[0-9A-Z]{16}\b/' => '[clé masquée]',
        '/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/' => '[jeton masqué]',
        '/\b(?:Bearer|Basic|Token)\s+[A-Za-z0-9._~+\/=-]{8,}/i' => '[jeton masqué]',
        '/\b(?:api[_-]?key|apikey|token|secret|password|passwd|mot[_ -]?de[_ -]?passe|cl[ée])\s*[:=]\s*\S+/iu' => '[secret masqué]',
        '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/' => '[e-mail masqué]',
        '/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/i' => '[IBAN masqué]',
        '/\b(?:\d[ -]?){13,19}\b/' => '[numéro masqué]',
        '/(?:\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/' => '[téléphone masqué]',
        '/\b(?:\d{1,3}\.){3}\d{1,3}\b/' => '[IP masquée]',
        '/\b[A-Za-z0-9_\-+\/=]{32,}\b/' => '[masqué]',
    );
    $t = (string) $t;
    foreach ($motifs as $motif => $remplacement) {
        $r = preg_replace($motif, $remplacement, $t);
        if ($r !== null) $t = $r;
    }
    return texte_propre($t, $max);
}

/** Limite par visiteur et par jour, sans garder d'adresse IP (empreinte salée du jour). */
function compter($dossier, $type, $max, $cle_unique = null) {
    $sel_fichier = $dossier . '/sel.txt';
    if (!is_file($sel_fichier)) @file_put_contents($sel_fichier, bin2hex(random_bytes(16)));
    $sel = (string) @file_get_contents($sel_fichier);
    $jour = gmdate('Ymd');
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    $empreinte = substr(hash('sha256', $sel . '|' . $jour . '|' . $ip), 0, 20);
    $fichier = $dossier . '/limites-' . $jour . '.json';
    foreach ((glob($dossier . '/limites-*.json') ?: array()) as $ancien) {
        if ($ancien !== $fichier && filemtime($ancien) < time() - 2 * 86400) @unlink($ancien);
    }
    return modifier($fichier, function (&$d) use ($type, $max, $empreinte, $cle_unique) {
        // Le fichier de limites réutilise la même structure : on range les compteurs dans « avis ».
        $c = &$d['avis'];
        $k = $type . ':' . $empreinte;
        $n = isset($c[$k]) ? $c[$k] : 0;
        if ($n >= $max) return 'trop';
        if ($cle_unique !== null) {
            $u = $type . ':' . $empreinte . ':' . $cle_unique;
            if (isset($c[$u])) return 'deja';
            $c[$u] = 1;
        }
        $c[$k] = $n + 1;
        return 'ok';
    });
}

/* ------------------------------- Lecture ------------------------------- */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $donnees = lire_json($FICHIER, array('avis' => array(), 'ab' => array()));
    $decisions = decisions();
    $tous = array();
    foreach ((isset($donnees['avis']) ? $donnees['avis'] : array()) as $a) $tous[] = avec_decision($a, $decisions);

    if (isset($_GET['etat'])) {
        repondre(200, array('ok' => true, 'stockage' => $LIEU, 'nb_avis' => count($tous), 'php' => PHP_VERSION));
    }
    if (isset($_GET['test'])) {
        $t = (string) $_GET['test'];
        $r = isset($donnees['ab_tests'][$t]) ? $donnees['ab_tests'][$t] : null;
        repondre(200, array('test' => $r ? array('A' => $r['A'], 'B' => $r['B']) : array('A' => 0, 'B' => 0)));
    }
    if (isset($_GET['ouverts'])) {
        $app = (string) $_GET['ouverts'];
        $liste = array();
        foreach ($tous as $a) {
            if ($a['app_id'] === $app && $a['comment'] !== '' && in_array($a['status'], STATUTS_OUVERTS, true)) {
                $liste[] = array('id' => $a['id'], 'category' => $a['category'], 'comment' => $a['comment'], 'upvotes' => $a['upvotes'], 'status' => $a['status']);
            }
        }
        usort($liste, function ($x, $y) { return $y['upvotes'] - $x['upvotes']; });
        repondre(200, array('tickets' => array_slice($liste, 0, 100)));
    }
    if (isset($_GET['export'])) {
        repondre(200, array('genere_le' => gmdate('c'), 'feedbacks' => $tous, 'ab' => isset($donnees['ab']) ? $donnees['ab'] : (object) array(),
            'ab_tests' => isset($donnees['ab_tests']) ? $donnees['ab_tests'] : (object) array()));
    }

    $apps = array();
    foreach ($tous as $a) {
        $id = $a['app_id'];
        if (!isset($apps[$id])) $apps[$id] = array('somme' => 0, 'nb_notes' => 0, 'nb_avis' => 0, 'ouverts' => array());
        $apps[$id]['nb_avis']++;
        if (isset($a['rating']) && is_int($a['rating'])) { $apps[$id]['somme'] += $a['rating']; $apps[$id]['nb_notes']++; }
        if ($a['comment'] !== '' && in_array($a['status'], STATUTS_OUVERTS, true)) $apps[$id]['ouverts'][] = $a;
    }
    $resume = array();
    foreach ($apps as $id => $s) {
        usort($s['ouverts'], function ($x, $y) {
            if ($x['upvotes'] !== $y['upvotes']) return $y['upvotes'] - $x['upvotes'];
            return strcmp($y['timestamp'], $x['timestamp']);
        });
        $top = array();
        foreach (array_slice($s['ouverts'], 0, 3) as $a) {
            $top[] = array('id' => $a['id'], 'category' => $a['category'], 'comment' => $a['comment'], 'upvotes' => $a['upvotes'],
                'timestamp' => $a['timestamp'], 'status' => $a['status'], 'version_tested' => $a['version_tested']);
        }
        $resume[$id] = array(
            'moyenne' => $s['nb_notes'] ? round($s['somme'] / $s['nb_notes'], 1) : null,
            'nb_notes' => $s['nb_notes'],
            'nb_avis' => $s['nb_avis'],
            'top' => $top,
        );
    }
    foreach ((isset($donnees['ab']) ? $donnees['ab'] : array()) as $id => $ab) {
        if (!isset($resume[$id])) $resume[$id] = array('moyenne' => null, 'nb_notes' => 0, 'nb_avis' => 0, 'top' => array());
        $resume[$id]['ab'] = $ab;
    }
    repondre(200, array('maj' => gmdate('c'), 'apps' => (object) $resume));
}

/* ------------------------------- Écriture ------------------------------ */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') erreur(405, 'Méthode non prise en charge.');
$brut = file_get_contents('php://input', false, null, 0, 20000);
$entree = json_decode((string) $brut, true);
if (!is_array($entree)) erreur(400, 'Requête illisible.');
$action = isset($entree['action']) ? $entree['action'] : '';

if ($action === 'avis') {
    // Piège à robots : un humain ne voit pas ce champ.
    if (!empty($entree['site_web'])) repondre(200, array('ok' => true, 'id' => 'fb_ignore'));
    $app = isset($entree['app_id']) ? (string) $entree['app_id'] : '';
    $connues = applis_connues();
    if (!isset($connues[$app])) $app = app_par_chemin(isset($entree['chemin']) ? $entree['chemin'] : '', $connues);
    if (!isset($connues[$app])) erreur(400, 'Application inconnue.');
    $note = isset($entree['rating']) && is_numeric($entree['rating']) ? (int) $entree['rating'] : null;
    if ($note !== null && ($note < 1 || $note > 5)) $note = null;
    $categorie = isset($entree['category']) && in_array($entree['category'], CATEGORIES, true) ? $entree['category'] : 'Autre';
    $commentaire = masquer(isset($entree['comment']) ? $entree['comment'] : '', MAX_COMMENTAIRE);
    $source = isset($entree['source']) && in_array($entree['source'], array('sondage', 'voix'), true) ? $entree['source'] : 'formulaire';
    $urgence = isset($entree['urgence']) && is_numeric($entree['urgence']) ? max(1, min(5, (int) $entree['urgence'])) : null;
    $declencheur = $source === 'sondage' ? masquer(isset($entree['declencheur']) ? $entree['declencheur'] : '', 60) : null;
    if ($source === 'sondage' && $note === null) erreur(400, 'Choisissez une note.');
    if ($note === null && (function_exists('mb_strlen') ? mb_strlen($commentaire, 'UTF-8') : strlen($commentaire)) < 5) {
        erreur(400, 'Choisissez une note ou écrivez quelques mots.');
    }
    $version = isset($entree['version_tested']) && $entree['version_tested'] === 'beta' ? 'beta' : 'main';
    $t = isset($entree['telemetry']) && is_array($entree['telemetry']) ? $entree['telemetry'] : array();
    $erreurs = array();
    foreach (array_slice(isset($t['console_errors']) && is_array($t['console_errors']) ? $t['console_errors'] : array(), -10) as $e) {
        if (is_string($e) && $e !== '') $erreurs[] = masquer($e);
    }
    $telemetrie = array(
        'viewport' => texte_propre(isset($t['viewport']) ? $t['viewport'] : '', 40),
        'platform' => texte_propre(isset($t['platform']) ? $t['platform'] : '', 40),
        'console_errors' => $erreurs,
        'stockage_cles' => array(),
    );
    // Noms de réglages seulement (jamais de valeurs), et rien qui évoque un secret.
    foreach (array_slice(isset($t['stockage_cles']) && is_array($t['stockage_cles']) ? $t['stockage_cles'] : array(), 0, 30) as $nom) {
        if (is_string($nom) && preg_match('/^[A-Za-z0-9_.:-]{1,60}$/', $nom) && !preg_match('/key|cle|token|secret|pass|auth|session|cookie|mail|user|membre|account|compte|iban|card|carte|phone|tel/i', $nom)) {
            $telemetrie['stockage_cles'][] = $nom;
        }
    }

    $limite = compter($DOSSIER, 'avis', AVIS_PAR_JOUR);
    if ($limite !== 'ok') erreur(429, "Merci pour vos avis ! Vous en avez déjà envoyé beaucoup aujourd'hui : revenez demain.");

    $id = 'fb_' . time() . '_' . substr(bin2hex(random_bytes(3)), 0, 4);
    $avis = array(
        'id' => $id,
        'app_id' => $app,
        'version_tested' => $version,
        'rating' => $note,
        'category' => $categorie,
        'comment' => $commentaire,
        'upvotes' => 1,
        'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
        'source' => $source,
        'declencheur' => $declencheur,
        'urgence' => $urgence,
        'telemetry' => $telemetrie,
        'status' => 'pending',
        'ai_analysis' => array('relevance_score' => null, 'intervention_level' => null, 'reasoning' => null, 'proposed_fix' => null),
        'changelog_public_message' => null,
    );
    $ok = modifier($FICHIER, function (&$d) use ($avis) {
        if (count($d['avis']) >= MAX_AVIS) return false;
        $d['avis'][] = $avis;
        return true;
    });
    if (!$ok) erreur(503, 'Le laboratoire a reçu beaucoup d’avis : réessayez un peu plus tard.');
    repondre(201, array('ok' => true, 'id' => $id));
}

if ($action === 'plus1') {
    $id = isset($entree['id']) ? (string) $entree['id'] : '';
    if (!preg_match('/^fb_\d+_[a-f0-9]{4}$/', $id)) erreur(400, 'Avis inconnu.');
    $limite = compter($DOSSIER, 'vote', VOTES_PAR_JOUR, $id);
    if ($limite === 'trop') erreur(429, "Beaucoup de votes aujourd'hui : revenez demain.");
    if ($limite === 'deja') erreur(409, 'Vous avez déjà soutenu cette demande.');
    $n = modifier($FICHIER, function (&$d) use ($id) {
        foreach ($d['avis'] as &$a) {
            if ($a['id'] === $id) { $a['upvotes'] = (int) $a['upvotes'] + 1; return $a['upvotes']; }
        }
        return null;
    });
    if ($n === null) erreur(404, 'Avis introuvable.');
    repondre(200, array('ok' => true, 'upvotes' => $n));
}

if ($action === 'ab' && isset($entree['test_id'])) {
    $app = isset($entree['app_id']) ? (string) $entree['app_id'] : '';
    $connues = applis_connues();
    if (!isset($connues[$app])) erreur(400, 'Application inconnue.');
    $test = (string) $entree['test_id'];
    if (!preg_match('/^[a-z0-9_-]{1,60}$/', $test)) erreur(400, 'Test inconnu.');
    $ticket = isset($entree['ticket_id']) && preg_match('/^fb_\d+_[a-f0-9]{4}$/', (string) $entree['ticket_id']) ? (string) $entree['ticket_id'] : null;
    $choix = isset($entree['choix']) && $entree['choix'] === 'B' ? 'B' : 'A';
    $limite = compter($DOSSIER, 'ab', VOTES_PAR_JOUR, $app . '#' . $test);
    if ($limite === 'trop') erreur(429, "Beaucoup de votes aujourd'hui : revenez demain.");
    if ($limite === 'deja') erreur(409, 'Vous avez déjà voté pour ce test.');
    $res = modifier($FICHIER, function (&$d) use ($app, $test, $ticket, $choix) {
        if (!isset($d['ab_tests'])) $d['ab_tests'] = array();
        if (!isset($d['ab_tests'][$test])) $d['ab_tests'][$test] = array('app_id' => $app, 'ticket_id' => $ticket, 'A' => 0, 'B' => 0);
        if ($d['ab_tests'][$test]['app_id'] !== $app) return null;
        $d['ab_tests'][$test][$choix]++;
        // Le vote est aussi inscrit sur le ticket concerné, pour les agents.
        if ($ticket !== null) {
            foreach ($d['avis'] as &$a) {
                if ($a['id'] === $ticket) {
                    if (!isset($a['ab'])) $a['ab'] = array('test_id' => $test, 'A' => 0, 'B' => 0);
                    $a['ab'][$choix]++;
                    break;
                }
            }
        }
        return $d['ab_tests'][$test];
    });
    if ($res === null) erreur(400, 'Ce test appartient à une autre application.');
    repondre(200, array('ok' => true, 'test' => $res));
}

if ($action === 'ab') {
    $app = isset($entree['app_id']) ? (string) $entree['app_id'] : '';
    $connues = applis_connues();
    if (!isset($connues[$app])) erreur(400, 'Application inconnue.');
    $choix = isset($entree['choix']) && $entree['choix'] === 'beta' ? 'beta' : 'actuelle';
    $limite = compter($DOSSIER, 'ab', VOTES_PAR_JOUR, $app);
    if ($limite === 'trop') erreur(429, "Beaucoup de votes aujourd'hui : revenez demain.");
    if ($limite === 'deja') erreur(409, 'Vous avez déjà voté pour cette application.');
    $ab = modifier($FICHIER, function (&$d) use ($app, $choix) {
        if (!isset($d['ab'][$app])) $d['ab'][$app] = array('actuelle' => 0, 'beta' => 0);
        $d['ab'][$app][$choix]++;
        return $d['ab'][$app];
    });
    repondre(200, array('ok' => true, 'ab' => $ab));
}

erreur(400, 'Action inconnue.');
