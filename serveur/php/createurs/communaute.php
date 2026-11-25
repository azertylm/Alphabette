<?php
/**
 * communaute.php — Lot 5 : Labo Communautaire d'alphabette.eu (gratuit) → statuts + jours gratuits sur alphabette.fr.
 * Comptes du service Créateurs (lien magique, e-mail confirmé). Données : alphabette.sqlite (dossier privé hors du site).
 *
 *   GET  ?moi                         (connecté)  → statut, points, multiplicateur, jours .fr, série, jokers, badges, codes
 *   GET  ?jauge                       → jauge collective (100 contributions validées → +7 j .fr aux actifs des 30 derniers jours)
 *   GET  ?roadmap                     → colonnes Kanban + votes pondérés ; GET ?duels → duels A/B ouverts ; GET ?missions
 *   GET  ?hall                        → Hall of Fame (/credits) : pseudos, statuts, badges (jamais d'e-mail)
 *   POST { action:"contribuer", type:"avis"|"bug"|"idee"|"mission", texte, app?, mission?, erreurs?[≤10], capture? }
 *   POST { action:"duel", duel, choix:"a"|"b" }      5 duels dans la semaine → +1 j .fr (une fois par semaine)
 *   POST { action:"voter_roadmap", item } | { action:"retirer_vote", item }   (3 votes actifs max, pondérés par le statut)
 *   POST { action:"convertir", jours }               → code promo JFR-… signé HMAC-SHA256 (à utiliser sur .fr)
 *   POST { action:"hall", visible:bool }
 *   Admin (session de /admin/validations + X-CSRF) :
 *   GET  ?admin                       → contributions à décider ; GET ?prompt_bug=<id> → prompt prêt à coller dans une IA
 *   POST { action:"decider", id, decision:"valider"|"refuser"|"bug_confirme"|"idee_deployee" }
 *   POST { action:"mission_creer", titre, app?, jours_valide? } | { action:"duel_creer", question, a, b }
 *   POST { action:"roadmap_creer", titre, description?, colonne? } | { action:"roadmap_deplacer", item, colonne }
 *
 * Barème (jours entiers, points en dixièmes pour les multiplicateurs ×1,5) :
 *   avis validé +1 pt +1 j · bug confirmé +5 pts +5 j · idée déployée +15 pts +30 j · Mission Flash +7 j
 *   5 micro-duels / semaine +1 j · série de 4 semaines +10 j + badge Pilier (+1 joker tous les 2 mois) · jauge 100 → +7 j
 *   Statuts : Explorateur ×1 · Bêta-Testeur (5 pts) ×1,5 · Testeur Or (20 pts) ×2 · Architecte (50 pts) ×3
 * Juge IA : réponse JSON STRICTE (verdict valide|refuse|a_verifier) ; toute réponse non conforme → décision humaine.
 * Anti-doublon : similarité > 80 % avec une contribution existante (même appli ou même personne) → « doublon », 0 point.
 */
require __DIR__ . '/_lib.php';

const STATUTS_LABO = array(array('Explorateur', 0, 10), array('Bêta-Testeur', 50, 15), array('Testeur Or', 200, 20), array('Architecte', 500, 30)); // [nom, seuil ×10, multiplicateur ×10]
const BAREME = array('avis' => array(10, 1), 'bug' => array(50, 5), 'idee' => array(150, 30), 'mission' => array(0, 7)); // [points ×10, jours]
const SEUIL_DOUBLON = 0.8;
const JAUGE_OBJECTIF = 100;
const VOTES_ROADMAP_MAX = 3;
const COLONNES = array('idees', 'prevu', 'en_cours', 'fait');

function l_db(): PDO {
    static $pret = false;
    $p = db();
    if ($pret) return $p;
    $p->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS labo_contribs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, appId TEXT NOT NULL DEFAULT '', type TEXT NOT NULL, texte TEXT NOT NULL,
  erreurs TEXT NOT NULL DEFAULT '[]', capture INTEGER NOT NULL DEFAULT 0, missionId INTEGER, statut TEXT NOT NULL, juge TEXT NOT NULL DEFAULT '{}',
  similarite REAL NOT NULL DEFAULT 0, semaine TEXT NOT NULL, createdAt INTEGER NOT NULL, decidedAt INTEGER);
CREATE INDEX IF NOT EXISTS idx_lc_app ON labo_contribs(appId, type);
CREATE INDEX IF NOT EXISTS idx_lc_user ON labo_contribs(userId, statut);
CREATE TABLE IF NOT EXISTS labo_profil (userId INTEGER PRIMARY KEY, points10 INTEGER NOT NULL DEFAULT 0, pilier INTEGER NOT NULL DEFAULT 0,
  jokers INTEGER NOT NULL DEFAULT 0, dernierJoker INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS labo_jours (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, delta INTEGER NOT NULL, motif TEXT NOT NULL,
  ref TEXT NOT NULL, createdAt INTEGER NOT NULL, UNIQUE (userId, motif, ref));
CREATE TABLE IF NOT EXISTS labo_codes (id TEXT PRIMARY KEY, userId INTEGER NOT NULL, jours INTEGER NOT NULL, code TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS labo_missions (id INTEGER PRIMARY KEY AUTOINCREMENT, titre TEXT NOT NULL, appId TEXT NOT NULL DEFAULT '', fin INTEGER NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS labo_duels (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, actif INTEGER NOT NULL DEFAULT 1, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS labo_duel_votes (duelId INTEGER NOT NULL, userId INTEGER NOT NULL, choix TEXT NOT NULL, semaine TEXT NOT NULL, createdAt INTEGER NOT NULL, PRIMARY KEY (duelId, userId));
CREATE TABLE IF NOT EXISTS labo_jauge (cycle INTEGER PRIMARY KEY, total INTEGER NOT NULL DEFAULT 0, atteinteLe INTEGER);
CREATE TABLE IF NOT EXISTS roadmap_items (id INTEGER PRIMARY KEY AUTOINCREMENT, titre TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', colonne TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS roadmap_votes (itemId INTEGER NOT NULL, userId INTEGER NOT NULL, poids10 INTEGER NOT NULL, createdAt INTEGER NOT NULL, PRIMARY KEY (itemId, userId));
INSERT OR IGNORE INTO labo_jauge (cycle, total) VALUES (1, 0);
SQL);
    $pret = true;
    return $p;
}

function semaine(int $t): string { return gmdate('o-\WW', $t); }
function semaine_moins(string $s, int $n): string { $d = new DateTime(); $d->setISODate((int) substr($s, 0, 4), (int) substr($s, 6, 2)); $d->modify("-$n week"); return $d->format('o-\WW'); }

function profil(PDO $p, int $uid): array {
    $p->prepare('INSERT OR IGNORE INTO labo_profil (userId) VALUES (?)')->execute(array($uid));
    $s = $p->prepare('SELECT * FROM labo_profil WHERE userId = ?'); $s->execute(array($uid));
    return $s->fetch();
}
function statut_de(int $points10): array {
    $r = STATUTS_LABO[0];
    foreach (STATUTS_LABO as $s) if ($points10 >= $s[1]) $r = $s;
    return array('nom' => $r[0], 'multiplicateur10' => $r[2], 'multiplicateur' => $r[2] / 10);
}
function jours_solde(PDO $p, int $uid): int { $s = $p->prepare('SELECT COALESCE(SUM(delta), 0) FROM labo_jours WHERE userId = ?'); $s->execute(array($uid)); return (int) $s->fetchColumn(); }

/** Crédite des jours .fr (idempotent par (personne, motif, référence)). DANS une transaction. */
function crediter_jours(PDO $p, int $uid, int $jours, string $motif, string $ref): bool {
    if ($jours <= 0) return false;
    $s = $p->prepare('INSERT OR IGNORE INTO labo_jours (userId, delta, motif, ref, createdAt) VALUES (?, ?, ?, ?, ?)');
    $s->execute(array($uid, $jours, $motif, $ref, time()));
    return $s->rowCount() === 1;
}
/** Points de statut avec le multiplicateur du statut ACTUEL (entiers, dixièmes de point). */
function crediter_points(PDO $p, int $uid, int $points10): int {
    if ($points10 <= 0) return 0;
    $pr = profil($p, $uid);
    $gain = intdiv($points10 * statut_de((int) $pr['points10'])['multiplicateur10'], 10);
    $p->prepare('UPDATE labo_profil SET points10 = points10 + ? WHERE userId = ?')->execute(array($gain, $uid));
    return $gain;
}

/** Similarité de Jaccard sur les trigrammes de mots (0..1). */
function signature(string $t): array {
    $m = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($t, 'UTF-8'), -1, PREG_SPLIT_NO_EMPTY) ?: array();
    if (count($m) < 3) return array_fill_keys($m, true);
    $g = array();
    for ($i = 0; $i + 2 < count($m); $i++) $g[$m[$i] . ' ' . $m[$i + 1] . ' ' . $m[$i + 2]] = true;
    return $g;
}
function similarite(string $a, string $b): float {
    $x = signature($a); $y = signature($b);
    if (!$x || !$y) return 0.0;
    $inter = count(array_intersect_key($x, $y));
    return $inter / (count($x) + count($y) - $inter);
}

/** Juge IA : renvoie TOUJOURS un tableau conforme {verdict, raison, source}. Réponse de l'IA non conforme → « a_verifier ». */
function juge_valider_json(string $brut): ?array {
    $d = json_decode(trim($brut), true);
    if (!is_array($d) || array_keys($d) !== array('verdict', 'raison')) return null;
    if (!in_array($d['verdict'], array('valide', 'refuse', 'a_verifier'), true) || !is_string($d['raison']) || mb_strlen($d['raison']) > 200) return null;
    return $d;
}
function juge(string $type, string $texte): array {
    if (mb_strlen($texte) < 15) return array('verdict' => 'refuse', 'raison' => 'Trop court : décrivez en une ou deux phrases.', 'source' => 'regles');
    if (preg_match_all('#https?://#i', $texte) > 2 || preg_match('/(.)\1{9,}/u', $texte)) return array('verdict' => 'refuse', 'raison' => 'Ressemble à du spam.', 'source' => 'regles');
    if (preg_match('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/i', $texte)) return array('verdict' => 'refuse', 'raison' => 'Retirez e-mails et numéros de téléphone (vie privée).', 'source' => 'regles');
    $brut = getenv('ALPHABETTE_JUGE_REPONSE'); // tests automatisés uniquement (variable du serveur, jamais de la requête)
    if ($brut === false) {
        $cfgF = rtrim((string) (getenv('HOME') ?: ''), '/') . '/alphabette-iadebat/config.json';
        $cfg = is_file($cfgF) ? json_decode((string) file_get_contents($cfgF), true) : null;
        if (is_array($cfg) && !empty($cfg['cle']) && function_exists('curl_init')) {
            $ch = curl_init(rtrim(getenv('IADEBAT_OPENROUTER_BASE') ?: 'https://openrouter.ai', '/') . '/api/v1/chat/completions');
            curl_setopt_array($ch, array(CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12,
                CURLOPT_HTTPHEADER => array('Content-Type: application/json', 'Authorization: Bearer ' . $cfg['cle']),
                CURLOPT_POSTFIELDS => json_encode(array('model' => 'meta-llama/llama-3.3-70b-instruct:free', 'max_tokens' => 120, 'temperature' => 0,
                    'response_format' => array('type' => 'json_object'),
                    'messages' => array(
                        array('role' => 'system', 'content' => 'Tu modères les contributions d\'un laboratoire d\'applications web. Réponds UNIQUEMENT par un objet JSON {"verdict":"valide"|"refuse"|"a_verifier","raison":"<120 caractères>"}. valide = contribution sincère et utile ; refuse = spam, insulte, hors sujet ; a_verifier = doute.'),
                        array('role' => 'user', 'content' => "Type : $type\nContribution : " . mb_substr($texte, 0, 1500)))))));
            $r = json_decode((string) curl_exec($ch), true);
            curl_close($ch);
            $brut = (string) ($r['choices'][0]['message']['content'] ?? '');
        }
    }
    if ($brut === false || $brut === '') return array('verdict' => 'valide', 'raison' => 'Contrôles automatiques passés.', 'source' => 'regles'); // bug, idée, mission : confirmés ensuite par l'équipe
    $v = juge_valider_json((string) $brut);
    return $v ? $v + array('source' => 'ia') : array('verdict' => 'a_verifier', 'raison' => 'Réponse du juge IA non conforme : décision humaine.', 'source' => 'ia_invalide');
}

/** Applique la récompense d'une contribution validée + série + jauge. DANS une transaction. Renvoie le détail. */
function recompenser(PDO $p, array $c, string $niveau): array {
    $uid = (int) $c['userId'];
    $b = BAREME[$niveau === 'bug_confirme' ? 'bug' : ($niveau === 'idee_deployee' ? 'idee' : $c['type'])];
    $r = array('points10' => crediter_points($p, $uid, $b[0]), 'jours' => 0, 'pilier' => false, 'jauge' => false);
    if (crediter_jours($p, $uid, $b[1], $niveau, (string) $c['id'])) $r['jours'] += $b[1];
    // Série de 4 semaines (le joker comble UNE semaine manquante).
    $s = $p->prepare("SELECT DISTINCT semaine FROM labo_contribs WHERE userId = ? AND statut = 'validee'"); $s->execute(array($uid));
    $semaines = array_flip(array_column($s->fetchAll(), 'semaine'));
    $cour = semaine(time());
    $manque = 0;
    for ($i = 0; $i < 4; $i++) if (!isset($semaines[semaine_moins($cour, $i)])) $manque++;
    $pr = profil($p, $uid);
    $dejaRecente = $p->prepare("SELECT COUNT(*) FROM labo_jours WHERE userId = ? AND motif = 'serie' AND ref IN (?, ?, ?)");
    $dejaRecente->execute(array($uid, semaine_moins($cour, 1), semaine_moins($cour, 2), semaine_moins($cour, 3)));
    if (isset($semaines[$cour]) && ($manque === 0 || ($manque === 1 && (int) $pr['jokers'] > 0)) && (int) $dejaRecente->fetchColumn() === 0) {
        if (crediter_jours($p, $uid, 10, 'serie', $cour)) {
            if ($manque === 1) $p->prepare('UPDATE labo_profil SET jokers = jokers - 1 WHERE userId = ?')->execute(array($uid));
            $p->prepare('UPDATE labo_profil SET pilier = 1 WHERE userId = ?')->execute(array($uid));
            $r['jours'] += 10; $r['pilier'] = true;
        }
    }
    $pr = profil($p, $uid);
    if ((int) $pr['pilier'] === 1 && time() - (int) $pr['dernierJoker'] >= 60 * 86400) $p->prepare('UPDATE labo_profil SET jokers = jokers + 1, dernierJoker = ? WHERE userId = ?')->execute(array(time(), $uid));
    // Jauge collective : la 100e contribution validée du cycle offre +7 j aux contributeurs actifs des 30 derniers jours.
    $cycle = (int) $p->query('SELECT MAX(cycle) FROM labo_jauge')->fetchColumn();
    $p->prepare('UPDATE labo_jauge SET total = total + 1 WHERE cycle = ?')->execute(array($cycle));
    $total = (int) $p->query("SELECT total FROM labo_jauge WHERE cycle = $cycle")->fetchColumn();
    if ($total >= JAUGE_OBJECTIF) {
        $p->prepare('UPDATE labo_jauge SET atteinteLe = ? WHERE cycle = ?')->execute(array(time(), $cycle));
        $p->prepare('INSERT INTO labo_jauge (cycle, total) VALUES (?, 0)')->execute(array($cycle + 1));
        $a = $p->prepare("SELECT DISTINCT userId FROM labo_contribs WHERE statut = 'validee' AND decidedAt >= ?"); $a->execute(array(time() - 30 * 86400));
        foreach ($a->fetchAll() as $u) crediter_jours($p, (int) $u['userId'], 7, 'jauge', (string) $cycle);
        $r['jauge'] = true;
    }
    return $r;
}

function l_admin(bool $ecriture): void {
    $j = (string) ($_COOKIE['ab_admin'] ?? '');
    $s = null;
    if (preg_match('/^[a-f0-9]{64}$/', $j)) { $q = db()->prepare('SELECT csrf FROM admin_sessions WHERE hash = ? AND expiresAt > ?'); $q->execute(array(sha256_jeton($j), time())); $s = $q->fetchColumn(); }
    if (!$s) erreur(401, 'Connexion administrateur requise.');
    if ($ecriture && !hash_equals((string) $s, (string) ($_SERVER['HTTP_X_CSRF'] ?? ''))) erreur(403, 'Jeton de sécurité invalide : rechargez la page.');
}

function dossier_captures(): string { $d = dossier_prive() . '/labo-captures'; if (!is_dir($d)) @mkdir($d, 0700, true); return $d; }

$p = l_db();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    if (isset($_GET['jauge'])) {
        $j = $p->query('SELECT cycle, total FROM labo_jauge ORDER BY cycle DESC LIMIT 1')->fetch();
        repondre(200, array('cycle' => (int) $j['cycle'], 'total' => (int) $j['total'], 'objectif' => JAUGE_OBJECTIF, 'recompenseJours' => 7));
    }
    if (isset($_GET['roadmap'])) {
        $u = utilisateur_courant();
        $items = $p->query('SELECT i.*, COALESCE(SUM(v.poids10), 0) AS poids, COUNT(v.userId) AS votants FROM roadmap_items i LEFT JOIN roadmap_votes v ON v.itemId = i.id GROUP BY i.id ORDER BY poids DESC, i.id')->fetchAll();
        $mes = array();
        if ($u) { $s = $p->prepare('SELECT itemId FROM roadmap_votes WHERE userId = ?'); $s->execute(array((int) $u['id'])); $mes = array_map('intval', array_column($s->fetchAll(), 'itemId')); }
        $col = array_fill_keys(COLONNES, array());
        foreach ($items as $i) $col[$i['colonne']][] = array('id' => (int) $i['id'], 'titre' => $i['titre'], 'description' => $i['description'], 'poids' => (int) $i['poids'] / 10, 'votants' => (int) $i['votants'], 'monVote' => in_array((int) $i['id'], $mes, true));
        repondre(200, array('colonnes' => $col, 'votesMax' => VOTES_ROADMAP_MAX, 'mesVotes' => count($mes)));
    }
    if (isset($_GET['duels'])) repondre(200, array('duels' => $p->query('SELECT id, question, a, b FROM labo_duels WHERE actif = 1 ORDER BY id DESC LIMIT 20')->fetchAll()));
    if (isset($_GET['missions'])) { $s = $p->prepare('SELECT id, titre, appId, fin FROM labo_missions WHERE fin > ? ORDER BY fin'); $s->execute(array(time())); repondre(200, array('missions' => $s->fetchAll())); }
    if (isset($_GET['hall'])) {
        $l = $p->query("SELECT u.handle, l.points10, l.pilier, (SELECT COUNT(*) FROM labo_contribs c WHERE c.userId = u.id AND c.statut = 'validee') AS n
                        FROM labo_profil l JOIN users u ON u.id = l.userId WHERE u.hallVisible = 1 AND l.points10 > 0 ORDER BY l.points10 DESC LIMIT 100")->fetchAll();
        repondre(200, array('contributeurs' => array_map(function ($x) { return array('pseudo' => $x['handle'], 'statut' => statut_de((int) $x['points10'])['nom'], 'points' => (int) $x['points10'] / 10, 'contributions' => (int) $x['n'], 'pilier' => (int) $x['pilier'] === 1); }, $l)));
    }
    if (isset($_GET['admin'])) {
        l_admin(false);
        $l = $p->query("SELECT c.id, c.type, c.appId, c.texte, c.statut, c.juge, c.similarite, c.capture, c.createdAt, u.handle FROM labo_contribs c JOIN users u ON u.id = c.userId
                        WHERE c.statut IN ('en_attente','a_verifier') OR (c.statut = 'validee' AND c.type IN ('bug','idee') AND c.decidedAt > ?) ORDER BY c.id DESC LIMIT 200");
        $l->execute(array(time() - 7 * 86400));
        repondre(200, array('contributions' => array_map(function ($c) { $c['juge'] = json_decode($c['juge'], true); return $c; }, $l->fetchAll())));
    }
    if (isset($_GET['prompt_bug'])) {
        l_admin(false);
        $s = $p->prepare("SELECT * FROM labo_contribs WHERE id = ? AND type = 'bug'"); $s->execute(array((int) $_GET['prompt_bug']));
        $c = $s->fetch();
        if (!$c) erreur(404, 'Bug introuvable.');
        $err = json_decode($c['erreurs'], true) ?: array();
        $lignes = array_map(function ($e) { return '- ' . $e['message'] . ($e['source'] !== '' ? ' (' . $e['source'] . ':' . $e['ligne'] . ')' : ''); }, $err);
        repondre(200, array('prompt' => "Tu corriges une application web statique (HTML/CSS/JS, hébergement OVH sans Node) de l'écosystème Alphabette.\n"
            . "Appli : " . ($c['appId'] ?: 'non précisée') . "\nDescription du bug par un testeur :\n" . $c['texte'] . "\n\n"
            . ($lignes ? "Dernières erreurs JavaScript relevées (avec l'accord du testeur) :\n" . implode("\n", $lignes) . "\n\n" : '')
            . ((int) $c['capture'] === 1 ? "Une capture annotée (zones sensibles floutées) est jointe au ticket.\n\n" : '')
            . "Donne : 1) la cause probable, 2) le correctif minimal (diff), 3) un test pour vérifier. Ne touche pas à la double barre Alphabette (@alphabette/shell)."));
    }
    $u = exiger_utilisateur(true);
    if (isset($_GET['moi'])) {
        $uid = (int) $u['id'];
        $pr = profil($p, $uid);
        $st = statut_de((int) $pr['points10']);
        $s = $p->prepare('SELECT id, jours, code, createdAt FROM labo_codes WHERE userId = ? ORDER BY createdAt DESC'); $s->execute(array($uid));
        $codes = $s->fetchAll();
        $s = $p->prepare("SELECT COUNT(*) FROM labo_duel_votes WHERE userId = ? AND semaine = ?"); $s->execute(array($uid, semaine(time())));
        repondre(200, array('statut' => $st['nom'], 'multiplicateur' => $st['multiplicateur'], 'points' => (int) $pr['points10'] / 10,
            'joursFr' => jours_solde($p, $uid), 'pilier' => (int) $pr['pilier'] === 1, 'jokers' => (int) $pr['jokers'], 'duelsCetteSemaine' => (int) $s->fetchColumn(),
            'hallVisible' => (int) $u['hallVisible'] === 1, 'codes' => $codes));
    }
    erreur(400, 'Action inconnue.');
}

exiger_post();
$e = corps_json();
$action = (string) ($e['action'] ?? '');

if (in_array($action, array('decider', 'mission_creer', 'duel_creer', 'roadmap_creer', 'roadmap_deplacer'), true)) {
    l_admin(true);
    if ($action === 'decider') {
        $id = (int) ($e['id'] ?? 0);
        $d = (string) ($e['decision'] ?? '');
        if (!in_array($d, array('valider', 'refuser', 'bug_confirme', 'idee_deployee'), true)) erreur(400, 'Décision inconnue.');
        $r = transaction(function (PDO $p) use ($id, $d) {
            $s = $p->prepare('SELECT * FROM labo_contribs WHERE id = ?'); $s->execute(array($id));
            $c = $s->fetch();
            if (!$c) erreur(404, 'Contribution introuvable.');
            if ($d === 'refuser') { $p->prepare("UPDATE labo_contribs SET statut = 'refusee', decidedAt = ? WHERE id = ?")->execute(array(time(), $id)); return array('statut' => 'refusee'); }
            if ($d === 'bug_confirme' && $c['type'] !== 'bug') erreur(400, 'Ce n\'est pas un bug.');
            if ($d === 'idee_deployee' && $c['type'] !== 'idee') erreur(400, 'Ce n\'est pas une idée.');
            if ($c['statut'] === 'validee' && $d === 'valider') return array('statut' => 'validee', 'deja' => true);
            $deja = $p->prepare('SELECT 1 FROM labo_jours WHERE userId = ? AND motif = ? AND ref = ?'); $deja->execute(array((int) $c['userId'], $d, (string) $c['id']));
            if ($deja->fetchColumn()) return array('statut' => 'validee', 'deja' => true);
            if ($c['statut'] === 'doublon') erreur(409, 'Doublon : aucune récompense.');
            $niveau = $d === 'valider' ? ($c['type'] === 'mission' ? 'mission' : 'avis') : $d;
            if ($d === 'valider' && in_array($c['type'], array('bug', 'idee'), true)) $niveau = 'avis'; // validé sans être confirmé : barème d'un avis
            $p->prepare("UPDATE labo_contribs SET statut = 'validee', decidedAt = ? WHERE id = ?")->execute(array(time(), $id));
            return array('statut' => 'validee') + recompenser($p, $c + array('statut' => 'validee'), $niveau);
        });
        repondre(200, array('ok' => true) + $r);
    }
    if ($action === 'mission_creer') {
        $t = texte((string) ($e['titre'] ?? ''), 140);
        if (mb_strlen($t) < 5) erreur(400, 'Titre trop court.');
        $p->prepare('INSERT INTO labo_missions (titre, appId, fin, createdAt) VALUES (?, ?, ?, ?)')->execute(array($t, texte((string) ($e['app'] ?? ''), 40), time() + max(1, min(14, (int) ($e['jours_valide'] ?? 2)))* 86400, time()));
        repondre(200, array('ok' => true, 'id' => (int) $p->lastInsertId()));
    }
    if ($action === 'duel_creer') {
        $q = texte((string) ($e['question'] ?? ''), 140); $a = texte((string) ($e['a'] ?? ''), 80); $b = texte((string) ($e['b'] ?? ''), 80);
        if ($q === '' || $a === '' || $b === '') erreur(400, 'Question, A et B obligatoires.');
        $p->prepare('INSERT INTO labo_duels (question, a, b, createdAt) VALUES (?, ?, ?, ?)')->execute(array($q, $a, $b, time()));
        repondre(200, array('ok' => true, 'id' => (int) $p->lastInsertId()));
    }
    if ($action === 'roadmap_creer') {
        $col = in_array($e['colonne'] ?? '', COLONNES, true) ? (string) $e['colonne'] : 'idees';
        $t = texte((string) ($e['titre'] ?? ''), 120);
        if (mb_strlen($t) < 3) erreur(400, 'Titre trop court.');
        $p->prepare('INSERT INTO roadmap_items (titre, description, colonne, createdAt) VALUES (?, ?, ?, ?)')->execute(array($t, texte((string) ($e['description'] ?? ''), 500), $col, time()));
        repondre(200, array('ok' => true, 'id' => (int) $p->lastInsertId()));
    }
    $col = (string) ($e['colonne'] ?? '');
    if (!in_array($col, COLONNES, true)) erreur(400, 'Colonne inconnue.');
    $p->prepare('UPDATE roadmap_items SET colonne = ? WHERE id = ?')->execute(array($col, (int) ($e['item'] ?? 0)));
    repondre(200, array('ok' => true));
}

$u = exiger_utilisateur(true);
$uid = (int) $u['id'];

if ($action === 'contribuer') {
    $type = (string) ($e['type'] ?? '');
    if (!isset(BAREME[$type])) erreur(400, 'Type de contribution inconnu.');
    $texte = texte((string) ($e['texte'] ?? ''), 2000);
    $app = preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', (string) ($e['app'] ?? '')) ? (string) $e['app'] : '';
    if (!limite('contrib:' . $uid, 20, 86400) || !limite('contrib-ip:' . empreinte_ip(), 40, 86400)) erreur(429, 'Merci ! Vous avez beaucoup contribué aujourd\'hui : revenez demain.');
    $mission = null;
    if ($type === 'mission') {
        $s = $p->prepare('SELECT * FROM labo_missions WHERE id = ? AND fin > ?'); $s->execute(array((int) ($e['mission'] ?? 0), time()));
        $mission = $s->fetch();
        if (!$mission) erreur(404, 'Mission terminée ou inconnue.');
        $s = $p->prepare("SELECT 1 FROM labo_contribs WHERE userId = ? AND missionId = ? AND statut <> 'refusee'"); $s->execute(array($uid, (int) $mission['id']));
        if ($s->fetchColumn()) erreur(409, 'Vous avez déjà participé à cette mission.');
    }
    // Assistant Bug Pro : 10 erreurs JS au plus (envoyées seulement si le testeur a coché la case), capture annotée et floutée dans le navigateur.
    $erreurs = array();
    if ($type === 'bug' && is_array($e['erreurs'] ?? null)) {
        foreach (array_slice($e['erreurs'], 0, 10) as $x) {
            if (!is_array($x)) continue;
            $erreurs[] = array('message' => texte((string) ($x['message'] ?? ''), 300), 'source' => texte(preg_replace('/[?#].*$/', '', (string) ($x['source'] ?? '')), 200), 'ligne' => (int) ($x['ligne'] ?? 0));
        }
    }
    $capture = null;
    if ($type === 'bug' && is_string($e['capture'] ?? null) && $e['capture'] !== '') {
        if (!preg_match('#^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$#', $e['capture'], $m)) erreur(400, 'Capture illisible.');
        $capture = base64_decode($m[2], true);
        if ($capture === false || strlen($capture) > 800000 || @getimagesizefromstring($capture) === false) erreur(400, 'Capture trop lourde ou invalide (800 Ko max).');
    }
    $verdict = juge($type, $texte);
    $r = transaction(function (PDO $p) use ($uid, $app, $type, $texte, $erreurs, $capture, $mission, $verdict) {
        // Anti-doublon > 80 % : mêmes mots que la contribution d'un autre (même appli) ou de soi-même.
        $s = $p->prepare("SELECT id, texte FROM labo_contribs WHERE (appId = ? OR userId = ?) AND type = ? AND statut <> 'refusee' ORDER BY id DESC LIMIT 300");
        $s->execute(array($app, $uid, $type));
        $max = 0.0;
        foreach ($s->fetchAll() as $o) $max = max($max, similarite($texte, (string) $o['texte']));
        $statut = $max > SEUIL_DOUBLON ? 'doublon' : ($verdict['verdict'] === 'refuse' ? 'refusee' : ($verdict['verdict'] === 'valide' && $type === 'avis' ? 'validee' : ($verdict['verdict'] === 'a_verifier' ? 'a_verifier' : 'en_attente')));
        $p->prepare('INSERT INTO labo_contribs (userId, appId, type, texte, erreurs, capture, missionId, statut, juge, similarite, semaine, createdAt, decidedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute(array($uid, $app, $type, $texte, json_encode($erreurs, JSON_UNESCAPED_UNICODE), $capture !== null ? 1 : 0, $mission ? (int) $mission['id'] : null, $statut,
                json_encode($verdict, JSON_UNESCAPED_UNICODE), round($max, 3), semaine(time()), time(), $statut === 'validee' ? time() : null));
        $id = (int) $p->lastInsertId();
        $rec = $statut === 'validee' ? recompenser($p, array('id' => $id, 'userId' => $uid, 'type' => $type), 'avis') : null;
        return array('id' => $id, 'statut' => $statut, 'similarite' => round($max, 3), 'recompense' => $rec);
    });
    if ($capture !== null) @file_put_contents(dossier_captures() . '/' . $r['id'] . '.img', $capture);
    $messages = array('validee' => 'Merci ! Contribution validée.', 'doublon' => 'Cette contribution ressemble trop à une autre (plus de 80 %) : pas de points cette fois.',
        'refusee' => $verdict['raison'], 'en_attente' => 'Merci ! L\'équipe vérifie et vous crédite dès confirmation.', 'a_verifier' => 'Merci ! Une personne de l\'équipe va la relire.');
    repondre(200, array('ok' => true, 'message' => $messages[$r['statut']], 'juge' => $verdict) + $r);
}

if ($action === 'duel') {
    $d = (int) ($e['duel'] ?? 0); $ch = (string) ($e['choix'] ?? '');
    if (!in_array($ch, array('a', 'b'), true)) erreur(400, 'Choisissez A ou B.');
    $r = transaction(function (PDO $p) use ($d, $ch, $uid) {
        $s = $p->prepare('SELECT 1 FROM labo_duels WHERE id = ? AND actif = 1'); $s->execute(array($d));
        if (!$s->fetchColumn()) erreur(404, 'Duel terminé.');
        $sem = semaine(time());
        $s = $p->prepare('INSERT OR IGNORE INTO labo_duel_votes (duelId, userId, choix, semaine, createdAt) VALUES (?, ?, ?, ?, ?)');
        $s->execute(array($d, $uid, $ch, $sem, time()));
        if ($s->rowCount() === 0) erreur(409, 'Vous avez déjà voté pour ce duel.');
        $s = $p->prepare('SELECT COUNT(*) FROM labo_duel_votes WHERE userId = ? AND semaine = ?'); $s->execute(array($uid, $sem));
        $n = (int) $s->fetchColumn();
        $jour = $n >= 5 && crediter_jours($p, $uid, 1, 'duels', $sem);
        return array('duelsCetteSemaine' => $n, 'jourGagne' => $jour);
    });
    repondre(200, array('ok' => true) + $r);
}

if ($action === 'voter_roadmap' || $action === 'retirer_vote') {
    $item = (int) ($e['item'] ?? 0);
    $r = transaction(function (PDO $p) use ($item, $uid, $action) {
        if ($action === 'retirer_vote') { $p->prepare('DELETE FROM roadmap_votes WHERE itemId = ? AND userId = ?')->execute(array($item, $uid)); return array('retire' => true); }
        $s = $p->prepare("SELECT 1 FROM roadmap_items WHERE id = ? AND colonne <> 'fait'"); $s->execute(array($item));
        if (!$s->fetchColumn()) erreur(404, 'Élément introuvable ou déjà fait.');
        $s = $p->prepare('SELECT COUNT(*) FROM roadmap_votes v JOIN roadmap_items i ON i.id = v.itemId WHERE v.userId = ? AND i.colonne <> \'fait\''); $s->execute(array($uid));
        if ((int) $s->fetchColumn() >= VOTES_ROADMAP_MAX) erreur(409, '3 votes au maximum : retirez-en un pour voter ici.');
        $poids = statut_de((int) profil($p, $uid)['points10'])['multiplicateur10'];
        $s = $p->prepare('INSERT OR IGNORE INTO roadmap_votes (itemId, userId, poids10, createdAt) VALUES (?, ?, ?, ?)'); $s->execute(array($item, $uid, $poids, time()));
        return array('poids' => $poids / 10, 'deja' => $s->rowCount() === 0);
    });
    repondre(200, array('ok' => true) + $r);
}

if ($action === 'convertir') {
    $jours = (int) ($e['jours'] ?? 0);
    if ($jours < 1 || $jours > 365) erreur(400, 'Entre 1 et 365 jours.');
    if (!pont_actif()) erreur(503, 'Conversion indisponible pour le moment.');
    $r = transaction(function (PDO $p) use ($uid, $jours) {
        if (jours_solde($p, $uid) < $jours) erreur(400, 'Pas assez de jours gagnés.');
        $id = bin2hex(random_bytes(8));
        $code = c_code_jours_signer($jours, $id);
        $p->prepare('INSERT INTO labo_jours (userId, delta, motif, ref, createdAt) VALUES (?, ?, ?, ?, ?)')->execute(array($uid, -$jours, 'conversion', $id, time()));
        $p->prepare('INSERT INTO labo_codes (id, userId, jours, code, createdAt) VALUES (?, ?, ?, ?, ?)')->execute(array($id, $uid, $jours, $code, time()));
        return array('code' => $code, 'jours' => $jours, 'reste' => jours_solde($p, $uid));
    });
    repondre(200, array('ok' => true) + $r);
}

if ($action === 'hall') {
    $p->prepare('UPDATE users SET hallVisible = ? WHERE id = ?')->execute(array(($e['visible'] ?? true) === false ? 0 : 1, $uid));
    repondre(200, array('ok' => true));
}

erreur(400, 'Action inconnue.');
