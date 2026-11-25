<?php
/**
 * createur.php — page publique d'un créateur : /createur/<pseudo>/ (réécrit par .htaccess), avec balises Open Graph.
 */
require __DIR__ . '/_lib.php';
$handle = strtolower((string) ($_GET['handle'] ?? ''));
header_remove('X-Robots-Tag'); header_remove('Cache-Control');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=60');
$h = function (string $t): string { return htmlspecialchars($t, ENT_QUOTES, 'UTF-8'); };
$u = null;
if (preg_match('/^[a-z0-9-]{3,30}$/', $handle)) {
    $s = db()->prepare('SELECT * FROM users WHERE handle = ?'); $s->execute(array($handle)); $u = $s->fetch();
}
$apps = array();
if ($u) {
    $s = db()->prepare("SELECT * FROM submissions WHERE userId = ? AND status IN ('lab_eu','eligible_fr','published_fr') ORDER BY validatedAt DESC");
    $s->execute(array((int) $u['id'])); $apps = $s->fetchAll();
}
if (!$u || !$apps) { http_response_code(404); }
$o = origine_publique();
$titre = $u && $apps ? $handle . ' — créateur sur le Laboratoire Alphabette' : 'Créateur introuvable';
$desc = $apps ? count($apps) . ' application' . (count($apps) > 1 ? 's' : '') . ' : ' . implode(', ', array_slice(array_map(function ($a) { return $a['name']; }, $apps), 0, 4)) : "Ce créateur n'a pas encore d'application publiée.";
?><!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $h($titre) ?></title>
<meta name="description" content="<?= $h($desc) ?>">
<?php if ($apps): ?><link rel="canonical" href="<?= $h($o . '/createur/' . $handle . '/') ?>">
<?php else: ?><meta name="robots" content="noindex"><?php endif; ?>
<meta property="og:type" content="profile"><meta property="og:locale" content="fr_FR"><meta property="og:site_name" content="Le Laboratoire Alphabette">
<meta property="og:title" content="<?= $h($titre) ?>"><meta property="og:description" content="<?= $h($desc) ?>">
<meta property="og:url" content="<?= $h($o . '/createur/' . $handle . '/') ?>"><meta property="og:image" content="<?= $h($o) ?>/og-image.png">
<meta name="twitter:card" content="summary">
<style>:root{color-scheme:light dark}body{font:17px/1.5 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px}a{color:#5b3df5;min-height:44px;display:inline-block}
ul{list-style:none;padding:0;display:grid;gap:12px}li{border:1px solid #8884;border-radius:12px;padding:12px 14px}.b{display:inline-block;padding:1px 10px;border-radius:99px;border:1px solid #5b3df5;font-size:14px;margin-left:6px}
@media (prefers-color-scheme:dark){a{color:#a99bff}}</style></head>
<body>
<p><a href="/decouvrir/">← Découvrir les applications</a></p>
<h1><?= $h($handle) ?></h1>
<?php if (!$apps): ?><p>Ce créateur n'a pas encore d'application publiée.</p><?php else: ?>
<p><?= $h($desc) ?></p>
<ul>
<?php foreach ($apps as $a): ?>
<li><a href="/c/<?= $h($a['id']) ?>/"><strong><?= $h($a['name']) ?></strong></a><?= (int) $a['isPioneer'] === 1 ? '<span class="b">Pionnier</span>' : '' ?><br><?= $h($a['description']) ?><br><small><?= (int) $a['positiveCount'] ?> avis positif<?= (int) $a['positiveCount'] > 1 ? 's' : '' ?> · <?= $h($a['category']) ?></small></li>
<?php endforeach; ?>
</ul>
<?php endif; ?>
</body></html>
