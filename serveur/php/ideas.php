<?php
/**
 * ideas.php — « La Ruche à Idées » (Lot 6, alphabette.eu) : prolonge la boîte à idées du collectif (api/collectif.php).
 *
 * Mêmes données : idees.json (même dossier privé, mêmes verrous), modération par api/labo/idees-statuts.json
 * (masquee · retenue · realisee). Ajouts : catégorie, vote « J'en ai besoin ! » (1 vote par session), filtres,
 * « Je prends le défi » (créateur connecté) et crédit de 365 jours pour l'auteur d'une idée devenue appli .fr.
 *
 *   GET  ?liste[&filtre=nouvelles|demandees|en_construction|en_ligne][&jeton=<session>]  → { idees: [...] }
 *   POST { action:"idee",   titre, besoin, categorie, jeton, piege, delai_ms }   → 201 { idee, jeton_auteur }
 *   POST { action:"voter",  id, jeton }                                          → 200 { votes }
 *   POST { action:"defi",   id }                  (créateur connecté)            → 200 { lien }
 *   POST { action:"lier",   id, appId }           (créateur connecté)            → 200 { ok }
 *   POST { action:"credit", id, jeton_auteur }                                   → 200 { code, jours } (appli validée sur .fr)
 *
 * Vie privée : le jeton de session et le jeton d'auteur ne sont jamais écrits en clair (seulement leur SHA-256) ;
 * aucune adresse IP n'est écrite. Un jeton de session ne peut voter qu'une fois par idée.
 */
declare(strict_types=1);

require_once __DIR__ . '/lot6-commun.php';

const IDEES_CATEGORIES = array('Quotidien', 'Famille', 'Santé & bien-être', 'Éducation', 'Culture', 'Outils', 'Jeux', 'Citoyen', 'Autre');
const IDEES_MAX = 400;
const IDEES_PAR_JOUR = 3;
const IDEES_VOTES_PAR_JOUR = 60;
const IDEES_VOTANTS_MAX = 20000;
const IDEES_DELAI_MIN_MS = 2500;      // un formulaire rempli en moins de 2,5 s n'est pas écrit par un humain
const IDEES_MOTS_REFUSES = array('viagra', 'casino', 'crypto', 'bitcoin', 'porn', 'porno', 'xxx', 'escort');

l6_entetes();

function i_dossier(): string {
    $candidats = array();
    $env = (string) getenv('ALPHABETTE_COLLECTIF_DIR');
    if ($env !== '') $candidats[] = $env;
    $candidats[] = dirname(__DIR__, 3) . '/alphabette-labo-donnees/collectif';
    $candidats[] = __DIR__ . '/donnees-privees/collectif';
    foreach ($candidats as $i => $d) {
        if (!is_dir($d)) @mkdir($d, 0700, true);
        if (is_dir($d) && is_writable($d)) {
            if (!is_file(dirname($d) . '/.htaccess') && strpos($d, __DIR__) === 0) @file_put_contents(dirname($d) . '/.htaccess', "Require all denied\nDeny from all\n");
            return rtrim($d, '/');
        }
    }
    l6_erreur(503, "La ruche n'est pas disponible pour le moment.");
    return '';
}

function i_texte(string $t, int $max): string {
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags($t)) ?? '');
    return mb_substr($t, 0, $max, 'UTF-8');
}

function i_simplifier(string $t): string {
    $t = mb_strtolower($t, 'UTF-8');
    $t = strtr($t, array('à' => 'a', 'â' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i',
        'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', 'œ' => 'oe', 'æ' => 'ae', 'ÿ' => 'y'));
    return trim(preg_replace('/[^a-z0-9]+/', ' ', $t) ?? '');
}

/** Filtre anti-spam : '' si l'idée passe, sinon le message à afficher. */
function i_refus(string $titre, string $besoin): string {
    $lt = mb_strlen($titre, 'UTF-8');
    $lb = mb_strlen($besoin, 'UTF-8');
    if ($lt < 3 || $lt > 60) return 'Le titre doit faire entre 3 et 60 caractères.';
    if ($lb < 10 || $lb > 240) return 'Décrivez votre besoin en deux phrases (10 à 240 caractères).';
    $tout = $titre . ' ' . $besoin;
    if (preg_match('#https?://|www\.|\b[a-z0-9-]+\.(com|fr|eu|net|org|io|ly|xyz|ru|info)\b#i', $tout)) return 'Pas de lien dans une idée : décrivez-la simplement.';
    if (preg_match('/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', $tout)) return "Pas d'adresse e-mail dans une idée : elle est publique.";
    if (preg_match('/(?:\d[\s.-]?){8,}/', $tout)) return 'Pas de numéro de téléphone dans une idée : elle est publique.';
    if (preg_match('/(.)\1{5,}/u', $tout)) return 'Le texte contient trop de caractères répétés.';
    $lettres = preg_replace('/[^\p{L}]/u', '', $tout) ?? '';
    $maj = preg_replace('/[^\p{Lu}]/u', '', $tout) ?? '';
    if (mb_strlen($lettres, 'UTF-8') >= 12 && mb_strlen($maj, 'UTF-8') > 0.6 * mb_strlen($lettres, 'UTF-8')) return "Merci d'écrire sans tout en majuscules.";
    $mots = explode(' ', i_simplifier($tout));
    foreach (IDEES_MOTS_REFUSES as $m) if (in_array($m, $mots, true)) return 'Cette idée ne peut pas être publiée telle quelle.';
    return '';
}

function i_statuts(): array {
    $d = l6_lire_json(__DIR__ . '/labo/idees-statuts.json');
    return isset($d['statuts']) && is_array($d['statuts']) ? $d['statuts'] : array();
}

function i_hash(string $jeton, string $contexte): string { return hash('sha256', $contexte . '|' . $jeton); }
function i_jeton_valide(string $j): bool { return (bool) preg_match('/^[a-f0-9]{32}$/', $j); }

/** Charge (à la demande) le service Créateurs : session, base SQLite des dépôts. */
function i_createurs(): bool {
    $f = __DIR__ . '/createurs/_lib.php';
    if (!is_file($f)) return false;
    require_once $f;
    return true;
}

/** Statut d'un dépôt de créateur (submissions.status), ou null. */
function i_statut_depot(string $appId): ?string {
    if ($appId === '' || !i_createurs()) return null;
    try {
        $s = db()->prepare('SELECT status FROM submissions WHERE id = ?');
        $s->execute(array($appId));
        $v = $s->fetchColumn();
        return $v === false ? null : (string) $v;
    } catch (Throwable $e) { return null; }
}

function i_en_ligne(?string $statutDepot): bool { return in_array($statutDepot, array('lab_eu', 'eligible_fr', 'published_fr'), true); }

function i_public(array $i, array $statuts, string $jeton = ''): ?array {
    $st = (string) ($statuts[$i['id']] ?? '');
    if ($st === 'masquee') return null;
    $defi = is_array($i['defi'] ?? null) ? $i['defi'] : null;
    $depot = $defi && !empty($defi['app_id']) ? i_statut_depot((string) $defi['app_id']) : null;
    $statut = 'nouvelle';
    if ($defi) $statut = 'en_construction';
    if ($st === 'realisee' || i_en_ligne($depot)) $statut = 'en_ligne';
    return array(
        'id' => $i['id'], 'titre' => $i['titre'], 'besoin' => $i['besoin'] ?? $i['phrase'] ?? '',
        'categorie' => $i['categorie'] ?? 'Autre', 'votes' => (int) $i['votes'], 'date' => $i['date'],
        'statut' => $statut, 'retenue' => $st === 'retenue',
        'createur' => $defi ? (string) $defi['createur'] : null,
        'lien_defi' => $defi && $statut === 'en_construction' ? '/soumettre?ideaId=' . rawurlencode((string) $i['id']) : null,
        'coauteur' => $depot === 'published_fr',
        'a_vote' => $jeton !== '' && in_array(i_hash($jeton, (string) $i['id']), (array) ($i['votants'] ?? array()), true),
    );
}

$D = i_dossier();
$IDEES = $D . '/idees.json';
$methode = (string) ($_SERVER['REQUEST_METHOD'] ?? '');

if ($methode === 'GET') {
    if (!isset($_GET['liste'])) l6_erreur(400, 'Paramètre « liste » attendu.');
    $filtre = (string) ($_GET['filtre'] ?? 'demandees');
    $jeton = (string) ($_GET['jeton'] ?? '');
    if (!i_jeton_valide($jeton)) $jeton = '';
    $statuts = i_statuts();
    $liste = array();
    foreach (l6_lire_json($IDEES)['idees'] ?? array() as $i) {
        $p = i_public((array) $i, $statuts, $jeton);
        if ($p === null) continue;
        if ($filtre === 'en_construction' && $p['statut'] !== 'en_construction') continue;
        if ($filtre === 'en_ligne' && $p['statut'] !== 'en_ligne') continue;
        if (($filtre === 'nouvelles' || $filtre === 'demandees') && $p['statut'] !== 'nouvelle') continue;
        $liste[] = $p;
    }
    usort($liste, function ($a, $b) use ($filtre) {
        return $filtre === 'nouvelles' ? strcmp($b['date'], $a['date']) : ($b['votes'] <=> $a['votes'] ?: strcmp($b['date'], $a['date']));
    });
    l6_repondre(200, array('idees' => $liste, 'filtre' => $filtre));
}

if ($methode !== 'POST') l6_erreur(405, 'Méthode non autorisée.');

$e = l6_corps_json();
$action = (string) ($e['action'] ?? '');
$prive = l6_dossier_prive() ?? $D;

if ($action === 'idee') {
    // Anti-spam : champ piège invisible (un humain ne le remplit pas) + délai minimal + limite quotidienne.
    if (trim((string) ($e['piege'] ?? '')) !== '') l6_repondre(201, array('ok' => true, 'idee' => null)); // on fait croire au robot que c'est passé
    if ((int) ($e['delai_ms'] ?? 0) < IDEES_DELAI_MIN_MS) l6_erreur(429, 'Un peu trop rapide : relisez votre idée puis envoyez-la.');
    $titre = i_texte((string) ($e['titre'] ?? ''), 60);
    $besoin = i_texte((string) ($e['besoin'] ?? ''), 240);
    $categorie = (string) ($e['categorie'] ?? 'Autre');
    if (!in_array($categorie, IDEES_CATEGORIES, true)) $categorie = 'Autre';
    $jeton = (string) ($e['jeton'] ?? '');
    if (!i_jeton_valide($jeton)) l6_erreur(400, 'Session invalide : rechargez la page.');
    $refus = i_refus($titre, $besoin);
    if ($refus !== '') l6_erreur(400, $refus);
    if (!l6_limite($prive, 'idee-par-jour', IDEES_PAR_JOUR, 86400)) l6_erreur(429, 'Merci ! Vous avez déjà proposé ' . IDEES_PAR_JOUR . " idées aujourd'hui : revenez demain.");
    $id = 'idee_' . time() . '_' . bin2hex(random_bytes(2));
    $jetonAuteur = bin2hex(random_bytes(16));
    $cle = i_simplifier($titre);
    $idee = array('id' => $id, 'titre' => $titre, 'phrase' => mb_substr($besoin, 0, 200, 'UTF-8'), 'besoin' => $besoin, 'categorie' => $categorie,
        'votes' => 1, 'date' => gmdate('c'), 'auteur_hash' => i_hash($jetonAuteur, 'auteur|' . $id), 'votants' => array(i_hash($jeton, $id)));
    $r = l6_modifier($IDEES, function (&$d) use ($idee, $cle) {
        $liste = $d['idees'] ?? array();
        if (count($liste) >= IDEES_MAX) return 'plein';
        foreach ($liste as $i) if (i_simplifier((string) $i['titre']) === $cle) return 'double';
        $liste[] = $idee;
        $d['idees'] = $liste;
        return true;
    });
    if ($r === 'double') l6_erreur(409, 'Cette idée existe déjà : votez pour elle avec « J\'en ai besoin ! ».');
    if ($r !== true) l6_erreur(503, 'La ruche est pleine pour le moment : revenez bientôt.');
    $public = i_public($idee, i_statuts(), $jeton);
    l6_repondre(201, array('ok' => true, 'idee' => $public, 'jeton_auteur' => $jetonAuteur));
}

if ($action === 'voter') {
    $id = (string) ($e['id'] ?? '');
    $jeton = (string) ($e['jeton'] ?? '');
    if (!preg_match('/^idee_\d+_[a-f0-9]{4}$/', $id)) l6_erreur(400, 'Idée inconnue.');
    if (!i_jeton_valide($jeton)) l6_erreur(400, 'Session invalide : rechargez la page.');
    if ((string) (i_statuts()[$id] ?? '') === 'masquee') l6_erreur(404, 'Idée introuvable.');
    if (!l6_limite($prive, 'idee-vote', IDEES_VOTES_PAR_JOUR, 86400)) l6_erreur(429, "Beaucoup de votes aujourd'hui : revenez demain.");
    $h = i_hash($jeton, $id);
    $r = l6_modifier($IDEES, function (&$d) use ($id, $h) {
        foreach ($d['idees'] ?? array() as $k => $i) {
            if ($i['id'] !== $id) continue;
            $votants = (array) ($i['votants'] ?? array());
            if (in_array($h, $votants, true)) return 'deja';
            if (count($votants) >= IDEES_VOTANTS_MAX) return 'plein';
            $votants[] = $h;
            $d['idees'][$k]['votants'] = $votants;
            $d['idees'][$k]['votes'] = (int) $i['votes'] + 1;
            return (int) $d['idees'][$k]['votes'];
        }
        return null;
    });
    if ($r === null) l6_erreur(404, 'Idée introuvable.');
    if ($r === 'deja') l6_erreur(409, 'Vous avez déjà voté pour cette idée.');
    if ($r === 'plein') l6_erreur(503, 'Les votes de cette idée sont clos.');
    l6_repondre(200, array('ok' => true, 'votes' => $r));
}

if ($action === 'defi' || $action === 'lier') {
    if (!i_createurs()) l6_erreur(503, "L'espace créateurs n'est pas disponible pour le moment.");
    $u = utilisateur_courant();
    if (!$u) l6_erreur(401, 'Connectez-vous à votre espace créateur pour relever un défi.');
    if ((int) $u['emailVerified'] !== 1) l6_erreur(403, "Confirmez d'abord votre adresse e-mail.");
    $id = (string) ($e['id'] ?? '');
    if (!preg_match('/^idee_\d+_[a-f0-9]{4}$/', $id)) l6_erreur(400, 'Idée inconnue.');
    if ((string) (i_statuts()[$id] ?? '') === 'masquee') l6_erreur(404, 'Idée introuvable.');
    $handle = (string) $u['handle'];
    $appId = (string) ($e['appId'] ?? '');
    if ($action === 'lier') {
        if (!id_app_valide($appId)) l6_erreur(400, "Identifiant d'application invalide.");
        $s = db()->prepare('SELECT 1 FROM submissions WHERE id = ? AND userId = ?');
        $s->execute(array($appId, (int) $u['id']));
        if (!$s->fetchColumn()) l6_erreur(403, "Cette application n'est pas la vôtre.");
    }
    $r = l6_modifier($IDEES, function (&$d) use ($id, $handle, $action, $appId) {
        foreach ($d['idees'] ?? array() as $k => $i) {
            if ($i['id'] !== $id) continue;
            $defi = is_array($i['defi'] ?? null) ? $i['defi'] : null;
            if ($action === 'defi') {
                if ($defi) return $defi['createur'] === $handle ? 'ok' : 'pris';
                $d['idees'][$k]['defi'] = array('createur' => $handle, 'depuis' => gmdate('c'), 'app_id' => null);
                return 'ok';
            }
            if (!$defi || $defi['createur'] !== $handle) return 'pas_le_votre';
            $d['idees'][$k]['defi']['app_id'] = $appId;
            return 'ok';
        }
        return null;
    });
    if ($r === null) l6_erreur(404, 'Idée introuvable.');
    if ($r === 'pris') l6_erreur(409, 'Un autre créateur a déjà relevé ce défi.');
    if ($r === 'pas_le_votre') l6_erreur(403, "Ce défi n'est pas le vôtre.");
    l6_repondre(200, array('ok' => true, 'lien' => '/soumettre?ideaId=' . rawurlencode($id)));
}

if ($action === 'credit') {
    $id = (string) ($e['id'] ?? '');
    $jetonAuteur = (string) ($e['jeton_auteur'] ?? '');
    if (!preg_match('/^idee_\d+_[a-f0-9]{4}$/', $id) || !i_jeton_valide($jetonAuteur)) l6_erreur(400, 'Demande invalide.');
    if (!l6_limite($prive, 'idee-credit', 20, 3600)) l6_erreur(429, 'Trop de demandes : patientez un peu.');
    $trouvee = null;
    foreach (l6_lire_json($IDEES)['idees'] ?? array() as $i) if ($i['id'] === $id) $trouvee = (array) $i;
    if (!$trouvee || !hash_equals((string) ($trouvee['auteur_hash'] ?? ''), i_hash($jetonAuteur, 'auteur|' . $id))) l6_erreur(403, "Seul l'auteur de l'idée peut demander ce crédit.");
    $appId = (string) ($trouvee['defi']['app_id'] ?? '');
    if (i_statut_depot($appId) !== 'published_fr') l6_erreur(409, "L'application n'est pas encore validée sur alphabette.fr : le crédit sera disponible à ce moment-là.");
    // Code « jours .fr » existant (HMAC-SHA256, usage unique) : déterministe, donc le même code si l'auteur le redemande.
    require_once __DIR__ . '/croissance-commun.php';
    $codeId = substr(hash('sha256', 'coauteur|' . $id), 0, 16);
    l6_repondre(200, array('ok' => true, 'jours' => 365, 'app' => $appId, 'code' => c_code_jours_signer(365, $codeId)));
}

l6_erreur(400, 'Action inconnue.');
