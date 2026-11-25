<?php
/**
 * badge.php — Lot 5 : badge SVG à intégrer partout (/api/badge.php?slug=<slug>), sans traceur ni cookie.
 *   <a href="https://alphabette.eu/go/<slug>?ref=<code>&src=export"><img src="https://alphabette.eu/api/badge.php?slug=<slug>" alt="Sur Alphabette"></a>
 * Affiche le vrai statut (Laboratoire .eu / éligible / sur alphabette.fr) et le vrai nombre d'avis positifs. Jamais de faux chiffre.
 */
require __DIR__ . '/_lib.php';
header_remove('X-Robots-Tag'); header_remove('Cache-Control'); header_remove('Set-Cookie');
header('Content-Type: image/svg+xml; charset=utf-8');
header('Cache-Control: public, max-age=600');
header('Access-Control-Allow-Origin: *');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'");
$slug = strtolower((string) ($_GET['slug'] ?? ''));
$nom = 'Alphabette'; $etat = 'Laboratoire'; $avis = null;
if (preg_match('/^c-[a-f0-9]{8}$/', $slug)) {
    $s = db()->prepare('SELECT name, status, positiveCount FROM submissions WHERE id = ?'); $s->execute(array($slug));
    $a = $s->fetch();
    if ($a && in_array($a['status'], STATUTS_PUBLICS, true)) {
        $nom = $a['name'];
        $etat = $a['status'] === 'published_fr' ? 'Sur Alphabette.fr' : ($a['status'] === 'eligible_fr' ? 'Prête pour .fr' : 'Laboratoire .eu');
        $avis = (int) $a['positiveCount'];
    }
} elseif (preg_match('/^[a-z0-9][a-z0-9-]{0,40}$/', $slug)) {
    $nom = ucfirst(str_replace('-', ' ', $slug)); $etat = 'Sur Alphabette.fr';
}
$h = function (string $t): string { return htmlspecialchars($t, ENT_QUOTES | ENT_XML1, 'UTF-8'); };
$gauche = mb_substr($nom, 0, 28);
$droite = $etat . ($avis !== null && $avis > 0 ? ' · ' . $avis . ' 👍' : '');
$lg = 18 + (int) ceil(mb_strlen($gauche) * 7.2); $ld = 18 + (int) ceil(mb_strlen($droite) * 6.8);
$w = 28 + $lg + $ld;
echo '<svg xmlns="http://www.w3.org/2000/svg" width="' . $w . '" height="28" role="img" aria-label="' . $h($gauche . ' — ' . $droite) . '"><title>' . $h($gauche . ' — ' . $droite) . '</title>'
   . '<rect rx="6" width="' . $w . '" height="28" fill="#182334"/><rect rx="6" x="' . (28 + $lg) . '" width="' . $ld . '" height="28" fill="#3355d1"/>'
   . '<circle cx="14" cy="14" r="9" fill="#3355d1"/><text x="14" y="18.5" fill="#fff" font-family="system-ui,sans-serif" font-size="13" font-weight="700" text-anchor="middle">a</text>'
   . '<text x="' . (28 + 8) . '" y="18.5" fill="#fff" font-family="system-ui,sans-serif" font-size="12.5" font-weight="700">' . $h($gauche) . '</text>'
   . '<text x="' . (28 + $lg + 9) . '" y="18.5" fill="#fff" font-family="system-ui,sans-serif" font-size="12">' . $h($droite) . '</text></svg>';
