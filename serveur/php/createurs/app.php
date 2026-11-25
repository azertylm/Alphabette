<?php
/**
 * app.php — le cadre d'une appli de créateur : /c/<id>/ (réécrit par .htaccess). Barre Alphabette (retour, titre, créateur, Signaler,
 * Noter) + l'appli dans une <iframe sandbox> SANS allow-same-origin, servie par fichier.php avec « CSP: sandbox ».
 * Le bandeau d'avis (30 s d'usage actif) et le raccourci « Noter » viennent de /assets/alphabette-votes.js.
 */
require __DIR__ . '/_lib.php';
$id = (string) ($_GET['id'] ?? '');
if (!id_app_valide($id)) { http_response_code(404); exit; }
$s = db()->prepare('SELECT s.*, u.handle FROM submissions s JOIN users u ON u.id = s.userId WHERE s.id = ?');
$s->execute(array($id));
$a = $s->fetch();
if (!$a || !in_array($a['status'], STATUTS_PUBLICS, true)) { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); echo "Cette application n'est pas disponible."; exit; }
$h = function (string $t): string { return htmlspecialchars($t, ENT_QUOTES, 'UTF-8'); };
$origine = origine_publique();
header_remove('X-Robots-Tag'); header_remove('Cache-Control');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'");
$src = '/api/createurs/fichier.php/' . $id . '/public/index.html';
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= $h($a['name']) ?> — par <?= $h($a['handle']) ?> | Alphabette</title>
<meta name="description" content="<?= $h($a['description']) ?>">
<link rel="canonical" href="<?= $h($origine . '/c/' . $id . '/') ?>">
<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:site_name" content="Le Laboratoire Alphabette">
<meta property="og:title" content="<?= $h($a['name']) ?> — par <?= $h($a['handle']) ?>">
<meta property="og:description" content="<?= $h($a['description']) ?>">
<meta property="og:url" content="<?= $h($origine . '/c/' . $id . '/') ?>">
<meta property="og:image" content="<?= $h($origine) ?>/og-image.png">
<meta name="twitter:card" content="summary">
<style>
:root{color-scheme:light dark;--f:#fff;--t:#1b1b1f;--d:#55555f;--b:#d6d6de;--a:#5b3df5}
@media (prefers-color-scheme:dark){:root{--f:#121216;--t:#f1f1f4;--d:#b8b8c4;--b:#34343e;--a:#a99bff}}
html[data-ab-calme] *{animation:none!important;transition:none!important}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--f);color:var(--t);font:16px/1.45 system-ui,sans-serif}
body{display:flex;flex-direction:column;min-height:100dvh}
header{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--b);min-height:52px}
header a,header button{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:10px;background:transparent;color:var(--t);font:inherit;text-decoration:none;cursor:pointer;padding:0 8px}
header :focus-visible{outline:3px solid var(--a);outline-offset:2px}
.titre{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.2}.titre strong,.titre span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.titre span{font-size:14px;color:var(--d)}
iframe{flex:1;width:100%;border:0;background:#fff}
</style>
</head>
<body>
<header class="no-print">
  <a href="/" aria-label="Retour au Laboratoire Alphabette">←</a>
  <div class="titre"><strong><?= $h($a['name']) ?></strong><span>par <a href="/createur/<?= $h($a['handle']) ?>/" style="min-width:0;min-height:0;padding:0;display:inline;text-decoration:underline"><?= $h($a['handle']) ?></a> · Collectif Alphabette<?= (int) $a['isPioneer'] === 1 ? ' · Pionnier' : '' ?></span></div>
  <button type="button" id="ab-noter" aria-label="Noter cette application">★ Noter</button>
  <button type="button" id="ab-signaler" aria-label="Signaler un problème ou un abus">⚑</button>
</header>
<iframe title="<?= $h($a['name']) ?>" src="<?= $h($src) ?>" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads" referrerpolicy="no-referrer" allow="fullscreen"></iframe>
<script>window.ALPHABETTE_VOTE={appId:<?= json_encode($id) ?>,api:"/api/createurs/"};</script>
<script src="/assets/alphabette-votes.js" defer></script>
<script>
document.getElementById('ab-signaler').addEventListener('click',function(){
  if(window.alphabetteSignaler)window.alphabetteSignaler(<?= json_encode($id) ?>);
  else location.href='mailto:?subject='+encodeURIComponent('Signalement <?= $h($id) ?>');
});
document.getElementById('ab-noter').addEventListener('click',function(){if(window.alphabetteNoter)window.alphabetteNoter();});
</script>
</body>
</html>
