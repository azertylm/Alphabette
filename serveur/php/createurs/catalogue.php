<?php
/**
 * catalogue.php — découvrabilité (public, lecture seule) :
 *   GET ?blocs=1                         → { pionniers:[…], nouveautes:[…], presque:[…], categories:[…] }
 *        pionniers = « Pionniers & Coups de projecteur » ; presque = « À un pas d'Alphabette.fr » (6 à 9 avis positifs, ≥ 75 %)
 *   GET ?q=texte&cat=Jeux&limite=24      → { apps:[…] }     (recherche instantanée dans les applis publiées)
 */
require __DIR__ . '/_lib.php';
header_remove('Cache-Control'); header_remove('X-Robots-Tag');
header('Cache-Control: public, max-age=60');

function fiche(array $a): array {
    $pos = (int) $a['positiveCount']; $neg = (int) $a['negativeCount'];
    return array('id' => $a['id'], 'nom' => $a['name'], 'description' => $a['description'], 'categorie' => $a['category'], 'createur' => $a['handle'],
        'pionnier' => (int) $a['isPioneer'] === 1, 'positifs' => $pos, 'negatifs' => $neg, 'ratio' => $pos + $neg > 0 ? round($pos / ($pos + $neg), 3) : 0,
        'statut' => $a['status'], 'url' => '/c/' . $a['id'] . '/', 'depuis' => (int) $a['validatedAt']);
}
function lister(string $where, array $args, string $ordre, int $limite): array {
    $s = db()->prepare("SELECT s.*, u.handle FROM submissions s JOIN users u ON u.id = s.userId WHERE s.status IN ('lab_eu','eligible_fr','published_fr') $where ORDER BY $ordre LIMIT $limite");
    $s->execute($args);
    return array_map('fiche', $s->fetchAll());
}

if (isset($_GET['blocs'])) {
    $pion = lister('AND s.isPioneer = 1', array(), 's.positiveCount DESC, s.validatedAt ASC', 12);
    $projecteur = lister('AND s.isPioneer = 0 AND s.positiveCount >= 3 AND s.positiveCount * 4 >= (s.positiveCount + s.negativeCount) * 3', array(), 's.positiveCount DESC, s.validatedAt DESC', 6);
    repondre(200, array(
        'pionniers' => $pion, 'projecteur' => $projecteur,
        'nouveautes' => lister('', array(), 's.validatedAt DESC', 12),
        'presque' => lister("AND s.status = 'lab_eu' AND s.positiveCount BETWEEN 6 AND 9 AND s.positiveCount * 4 >= (s.positiveCount + s.negativeCount) * 3", array(), 's.positiveCount DESC', 12),
        'categories' => CATEGORIES));
}
$q = texte((string) ($_GET['q'] ?? ''), 60);
$cat = (string) ($_GET['cat'] ?? '');
$limite = max(1, min(60, (int) ($_GET['limite'] ?? 24)));
$where = ''; $args = array();
if ($q !== '') {
    $like = '%' . str_replace(array('\\', '%', '_'), array('\\\\', '\\%', '\\_'), $q) . '%';
    $where .= " AND (s.name LIKE ? ESCAPE '\\' OR s.description LIKE ? ESCAPE '\\' OR u.handle LIKE ? ESCAPE '\\')";
    array_push($args, $like, $like, $like);
}
if ($cat !== '' && in_array($cat, CATEGORIES, true)) { $where .= ' AND s.category = ?'; $args[] = $cat; }
repondre(200, array('apps' => lister($where, $args, 's.positiveCount DESC, s.validatedAt DESC', $limite)));
