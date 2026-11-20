<?php
/**
 * Audit express du Crash-Testeur (alphabette.eu/crash-testeur/) — n'importe quel site, ~30 secondes, sans IA.
 * Publié dans eu/api/crash-audit.php par scripts/build-static.mjs.
 *
 *   POST { url, public: bool, site_web: "" }  → bulletin { note /100, categories, priorites (3), mesures, id? }
 *   GET  ?r=<id>                               → bulletin public enregistré (90 jours)
 *
 * Contrôles : téléphone (viewport, zoom, @media), poids et vitesse (temps de réponse, poids estimé, requêtes,
 * compression, images), accessibilité de base (langue, titre, h1, textes alternatifs, libellés, contrastes déclarés
 * en CSS) et sécurité / traceurs (https, en-têtes, contenu mixte, traceurs publicitaires connus).
 *
 * Sécurité (le serveur va chercher une page à la demande) : http/https seulement, ports 80/443, adresses
 * publiques seulement, adresse IP vérifiée puis épinglée, 3 redirections au plus vérifiées une à une, taille et
 * durée limitées, 20 ressources au plus. Vie privée : résultat « privé » = rien n'est gardé ; « public » = le
 * bulletin (sans paramètres d'adresse) est gardé 90 jours hors du site. Pas d'adresse IP conservée.
 */
declare(strict_types=1);

const HTML_MAX = 1_500_000;
const RESSOURCE_MAX = 400_000;     // octets lus au plus par ressource (au-delà : taille annoncée)
const RESSOURCES_MAX = 20;
const AUDITS_JOUR = 12;            // par visiteur et par jour
const DUREE_PUBLIC = 90 * 86400;

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
header('Content-Type: application/json; charset=utf-8');

function repondre(int $code, array $d): void {
    http_response_code($code);
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function dossier(): string {
    $maison = getenv('HOME') ?: dirname((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__));
    $d = rtrim($maison, '/') . '/alphabette-crash-audit';
    if (!is_dir($d)) @mkdir($d, 0700, true);
    if (!is_dir($d) || !is_writable($d)) repondre(503, array('erreur' => "L'audit est indisponible pour le moment."));
    return $d;
}

function sel(): string {
    $f = dossier() . '/sel.txt';
    if (!is_file($f)) @file_put_contents($f, bin2hex(random_bytes(16)));
    return (string) @file_get_contents($f);
}

/** Compteur par visiteur (empreinte du jour, l'IP n'est pas gardée). */
function limite(): bool {
    $d = dossier();
    $f = $d . '/quotas-' . gmdate('Ymd') . '.json';
    foreach (glob($d . '/quotas-*.json') ?: array() as $ancien) if ($ancien !== $f) @unlink($ancien);
    $k = substr(hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . gmdate('Ymd'), sel()), 0, 20);
    $v = fopen($f . '.lock', 'c');
    flock($v, LOCK_EX);
    $q = is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: array()) : array();
    $ok = ($q[$k] ?? 0) < AUDITS_JOUR;
    if ($ok) { $q[$k] = ($q[$k] ?? 0) + 1; file_put_contents($f, json_encode($q)); }
    flock($v, LOCK_UN);
    fclose($v);
    return $ok;
}

/* ───────────────────────────── lecture réseau sûre ───────────────────────────── */

/** IP publique de l'hôte, ou null (réseau interne, adresse réservée, introuvable). */
function ip_publique(string $hote): ?string {
    $hote = trim(strtolower($hote), '[]');
    $ips = filter_var($hote, FILTER_VALIDATE_IP) ? array($hote) : (@gethostbynamel($hote) ?: array());
    if (!$ips || getenv('ALPHABETTE_AUDIT_LOCAL') === '1') return $ips[0] ?? null; // tests locaux seulement
    foreach ($ips as $ip) if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return null;
    return $ips[0];
}

/** Prépare une poignée curl vers une adresse vérifiée (ou un message d'erreur). */
function poignee(string $url, int $max, float $delai, bool $tete = false) {
    $p = parse_url($url);
    $schema = strtolower((string) ($p['scheme'] ?? ''));
    if (!$p || !in_array($schema, array('http', 'https'), true) || empty($p['host']) || isset($p['user']) || isset($p['pass'])) return "L'adresse doit commencer par https:// (ou http://).";
    $port = (int) ($p['port'] ?? ($schema === 'https' ? 443 : 80));
    if (!in_array($port, array(80, 443), true) && getenv('ALPHABETTE_AUDIT_LOCAL') !== '1') return 'Seuls les ports 80 et 443 sont acceptés.';
    $ip = ip_publique((string) $p['host']);
    if ($ip === null) return 'Adresse introuvable ou non publique.';
    $corps = '';
    $c = curl_init($url);
    curl_setopt_array($c, array(
        CURLOPT_RETURNTRANSFER => false, CURLOPT_FOLLOWLOCATION => false, CURLOPT_HEADER => false, CURLOPT_NOBODY => $tete,
        CURLOPT_TIMEOUT_MS => (int) ($delai * 1000), CURLOPT_CONNECTTIMEOUT_MS => (int) min(4000, $delai * 1000),
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_RESOLVE => array($p['host'] . ':' . $port . ':' . $ip),
        CURLOPT_ENCODING => '', // accepte gzip / br et les décompresse
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Linux; Android 14; Mobile) Alphabette-Crash-Testeur/2.0 (+https://alphabette.eu/crash-testeur/)',
        CURLOPT_HTTPHEADER => array('Accept: text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language: fr,en;q=0.5'),
    ));
    return array('c' => $c, 'corps' => &$corps, 'max' => $max, 'entetes' => array());
}

/** Lit une adresse (corps limité) ; suit 3 redirections au plus, chacune revérifiée. */
function lire(string $url, int $max, float $delai): array {
    for ($i = 0; $i <= 3; $i++) {
        $h = poignee($url, $max, $delai);
        if (is_string($h)) return array('erreur' => $h);
        $corps = ''; $entetes = array(); $taille = 0;
        curl_setopt($h['c'], CURLOPT_WRITEFUNCTION, function ($ch, $m) use (&$corps, &$taille, $max) {
            $taille += strlen($m);
            if (strlen($corps) < $max) $corps .= substr($m, 0, $max - strlen($corps));
            return $taille > $max * 3 ? 0 : strlen($m);
        });
        curl_setopt($h['c'], CURLOPT_HEADERFUNCTION, function ($ch, $l) use (&$entetes) {
            $kv = explode(':', $l, 2);
            if (count($kv) === 2) $entetes[strtolower(trim($kv[0]))][] = trim($kv[1]);
            return strlen($l);
        });
        curl_exec($h['c']);
        $code = (int) curl_getinfo($h['c'], CURLINFO_HTTP_CODE);
        $mesure = array('ttfb' => (float) curl_getinfo($h['c'], CURLINFO_STARTTRANSFER_TIME), 'total' => (float) curl_getinfo($h['c'], CURLINFO_TOTAL_TIME),
            'telecharge' => (int) curl_getinfo($h['c'], CURLINFO_SIZE_DOWNLOAD));
        curl_close($h['c']);
        if ($code >= 300 && $code < 400 && !empty($entetes['location'][0])) {
            $url = absolue((string) $entetes['location'][0], $url);
            continue;
        }
        if ($code === 0) return array('erreur' => "Le site ne répond pas (ou trop lentement).");
        return array('url' => $url, 'code' => $code, 'corps' => $corps, 'entetes' => $entetes, 'mesure' => $mesure, 'redirections' => $i);
    }
    return array('erreur' => 'Trop de redirections.');
}

function absolue(string $lien, string $base): string {
    $lien = trim($lien);
    if (preg_match('#^https?://#i', $lien)) return $lien;
    $b = parse_url($base);
    $origine = $b['scheme'] . '://' . $b['host'] . (isset($b['port']) ? ':' . $b['port'] : '');
    if (strpos($lien, '//') === 0) return $b['scheme'] . ':' . $lien;
    if (strpos($lien, '/') === 0) return $origine . $lien;
    $dir = preg_replace('#/[^/]*$#', '/', $b['path'] ?? '/');
    return $origine . $dir . $lien;
}

/** Ressources lues en parallèle (taille réelle, ou annoncée au-delà de RESSOURCE_MAX) + contenu CSS. */
function lire_ressources(array $urls): array {
    $m = curl_multi_init();
    $res = array();
    foreach ($urls as $i => $u) {
        $h = poignee($u, RESSOURCE_MAX, 8.0);
        if (is_string($h)) continue;
        $res[$i] = array('url' => $u, 'c' => $h['c'], 'corps' => '', 'taille' => 0, 'annonce' => 0, 'encodage' => '');
        $r = &$res[$i];
        curl_setopt($h['c'], CURLOPT_ENCODING, null); // taille réellement transférée
        curl_setopt($h['c'], CURLOPT_HTTPHEADER, array('Accept: */*', 'Accept-Encoding: gzip, br'));
        curl_setopt($h['c'], CURLOPT_WRITEFUNCTION, function ($ch, $morceau) use (&$r) {
            $r['taille'] += strlen($morceau);
            if (strlen($r['corps']) < RESSOURCE_MAX) $r['corps'] .= $morceau;
            return $r['taille'] > RESSOURCE_MAX ? 0 : strlen($morceau);
        });
        curl_setopt($h['c'], CURLOPT_HEADERFUNCTION, function ($ch, $l) use (&$r) {
            if (stripos($l, 'content-length:') === 0) $r['annonce'] = (int) trim(substr($l, 15));
            if (stripos($l, 'content-encoding:') === 0) $r['encodage'] = strtolower(trim(substr($l, 17)));
            return strlen($l);
        });
        unset($r);
        curl_multi_add_handle($m, $h['c']);
    }
    $debut = microtime(true);
    do {
        curl_multi_exec($m, $actifs);
        curl_multi_select($m, 0.5);
    } while ($actifs && microtime(true) - $debut < 12);
    foreach ($res as $i => $r) {
        $res[$i]['code'] = (int) curl_getinfo($r['c'], CURLINFO_HTTP_CODE);
        $res[$i]['poids'] = max($r['taille'], $r['annonce']);
        curl_multi_remove_handle($m, $r['c']);
        curl_close($r['c']);
        unset($res[$i]['c']);
    }
    curl_multi_close($m);
    return $res;
}

/* ───────────────────────────── contrastes ───────────────────────────── */

function couleur(string $v): ?array {
    $v = strtolower(trim($v));
    $noms = array('white' => 'ffffff', 'black' => '000000', 'red' => 'ff0000', 'yellow' => 'ffff00', 'gray' => '808080', 'grey' => '808080', 'silver' => 'c0c0c0', 'blue' => '0000ff', 'green' => '008000', 'orange' => 'ffa500', 'lightgray' => 'd3d3d3', 'lightgrey' => 'd3d3d3');
    if (isset($noms[$v])) $v = '#' . $noms[$v];
    if (preg_match('/^#([0-9a-f]{3})$/', $v, $m)) $v = '#' . $m[1][0] . $m[1][0] . $m[1][1] . $m[1][1] . $m[1][2] . $m[1][2];
    if (preg_match('/^#([0-9a-f]{6})/', $v, $m)) return array(hexdec(substr($m[1], 0, 2)), hexdec(substr($m[1], 2, 2)), hexdec(substr($m[1], 4, 2)));
    if (preg_match('/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/', $v, $m)) return array((int) $m[1], (int) $m[2], (int) $m[3]);
    return null;
}
function luminance(array $c): float {
    $f = function ($x) { $x /= 255; return $x <= 0.03928 ? $x / 12.92 : pow(($x + 0.055) / 1.055, 2.4); };
    return 0.2126 * $f($c[0]) + 0.7152 * $f($c[1]) + 0.0722 * $f($c[2]);
}
function ratio(array $a, array $b): float {
    $l1 = luminance($a); $l2 = luminance($b);
    return (max($l1, $l2) + 0.05) / (min($l1, $l2) + 0.05);
}
/** Paires couleur / fond déclarées ensemble (règles CSS et attributs style) dont le contraste est < 4,5:1. */
function contrastes_faibles(string $css): array {
    $faibles = array(); $vues = 0;
    if (preg_match_all('/([^{}]{1,200})\{([^{}]{1,2000})\}/', $css, $regles, PREG_SET_ORDER)) {
        foreach ($regles as $r) {
            if (!preg_match('/(?:^|;|\s)color\s*:\s*([^;!]+)/i', $r[2], $c) || !preg_match('/background(?:-color)?\s*:\s*([^;!]*?(#[0-9a-f]{3,6}\b|rgba?\([^)]*\)|\b(?:white|black|yellow|gray|grey|silver|lightgray|lightgrey)\b))/i', $r[2], $f)) continue;
            $a = couleur($c[1]); $b = couleur($f[2]);
            if (!$a || !$b) continue;
            $vues++;
            $q = ratio($a, $b);
            if ($q < 4.5) $faibles[] = array('ou' => trim(mb_substr($r[1], 0, 60)), 'ratio' => round($q, 1));
        }
    }
    return array('vues' => $vues, 'faibles' => array_slice($faibles, 0, 5));
}

/* ───────────────────────────── bulletin ───────────────────────────── */

const TRACEURS = array(
    'google-analytics.com' => 'Google Analytics', 'googletagmanager.com' => 'Google Tag Manager', 'doubleclick.net' => 'DoubleClick (publicité)',
    'googlesyndication.com' => 'Google AdSense (publicité)', 'connect.facebook.net' => 'Meta Pixel', 'facebook.com/tr' => 'Meta Pixel',
    'hotjar.com' => 'Hotjar', 'clarity.ms' => 'Microsoft Clarity', 'analytics.tiktok.com' => 'TikTok Pixel', 'snap.licdn.com' => 'LinkedIn Insight',
    'bat.bing.com' => 'Bing Ads', 'criteo' => 'Criteo (publicité)', 'taboola' => 'Taboola (publicité)', 'outbrain' => 'Outbrain (publicité)',
    'segment.com' => 'Segment', 'mixpanel' => 'Mixpanel', 'amplitude.com' => 'Amplitude', 'matomo.cloud' => 'Matomo Cloud', 'yandex' => 'Yandex Metrica',
);

function auditer(string $url): array {
    $page = lire($url, HTML_MAX, 12.0);
    if (isset($page['erreur'])) repondre(422, array('erreur' => $page['erreur']));
    if ($page['code'] >= 400) repondre(422, array('erreur' => "Le site répond « erreur {$page['code']} » : la page n'a pas pu être lue."));
    $html = $page['corps'];
    $final = $page['url'];
    $https = stripos($final, 'https://') === 0;
    $ent = $page['entetes'];
    $tete = function ($n) use ($ent) { return implode(', ', $ent[$n] ?? array()); };

    libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    @$doc->loadHTML('<?xml encoding="utf-8"?>' . $html, LIBXML_NONET | LIBXML_NOWARNING | LIBXML_NOERROR);
    $xp = new DOMXPath($doc);
    $attr = function (string $q, string $a) use ($xp) { $r = array(); foreach ($xp->query($q) ?: array() as $n) $r[] = trim((string) $n->getAttribute($a)); return $r; };

    // Ressources (scripts, feuilles de style, images, cadres)
    $liens = array();
    foreach ($attr('//script[@src]', 'src') as $s) $liens[] = array('type' => 'script', 'url' => $s);
    foreach ($xp->query('//link[@href]') ?: array() as $n) if (stripos((string) $n->getAttribute('rel'), 'stylesheet') !== false) $liens[] = array('type' => 'css', 'url' => trim((string) $n->getAttribute('href')));
    $imgs = $xp->query('//img');
    foreach ($imgs ?: array() as $n) if ($n->getAttribute('src') !== '' && stripos($n->getAttribute('src'), 'data:') !== 0) $liens[] = array('type' => 'image', 'url' => trim((string) $n->getAttribute('src')));
    foreach ($attr('//iframe[@src]', 'src') as $s) $liens[] = array('type' => 'cadre', 'url' => $s);
    $liens = array_values(array_filter($liens, function ($l) { return $l['url'] !== '' && !preg_match('#^(data|javascript|blob|about):#i', $l['url']); }));
    foreach ($liens as &$l) $l['url'] = absolue($l['url'], $final);
    unset($l);
    $hoteSite = preg_replace('/^www\./', '', (string) parse_url($final, PHP_URL_HOST));
    $tiers = array_values(array_unique(array_filter(array_map(function ($l) use ($hoteSite) {
        $h = preg_replace('/^www\./', '', (string) parse_url($l['url'], PHP_URL_HOST));
        return ($h === $hoteSite || substr($h, -strlen('.' . $hoteSite)) === '.' . $hoteSite) ? '' : $h;
    }, $liens))));
    $mixte = $https ? count(array_filter($liens, function ($l) { return stripos($l['url'], 'http://') === 0; })) : 0;

    // Lecture des ressources (CSS d'abord : elles servent aussi aux contrôles), 20 au plus.
    usort($liens, function ($a, $b) { return ($a['type'] === 'css' ? 0 : 1) <=> ($b['type'] === 'css' ? 0 : 1); });
    $aLire = array_slice(array_values(array_unique(array_map(function ($l) { return $l['url']; }, $liens))), 0, RESSOURCES_MAX);
    $res = lire_ressources($aLire);
    $poids = strlen($html);
    $css = '';
    foreach ($xp->query('//style') ?: array() as $n) $css .= $n->textContent . "\n";
    foreach ($res as $r) {
        $poids += $r['poids'];
        if (preg_match('/\.css(\?|$)/i', $r['url']) || stripos(substr($r['corps'], 0, 300), '{') !== false && !preg_match('/\.(js|png|jpe?g|gif|webp|svg|avif)(\?|$)/i', $r['url'])) {
            $css .= (substr($r['corps'], 0, 2) === "\x1f\x8b" ? (string) @gzdecode($r['corps']) : $r['corps']) . "\n";
        }
    }
    $nonLues = max(0, count(array_unique(array_map(function ($l) { return $l['url']; }, $liens))) - count($res));
    $poidsEstime = $poids + $nonLues * 60000; // estimation prudente pour les ressources non lues

    $styleAttr = '';
    foreach ($xp->query('//*[@style]') ?: array() as $n) $styleAttr .= 'x{' . $n->getAttribute('style') . "}\n";

    /* --- contrôles --- */
    $c = array('mobile' => array(), 'vitesse' => array(), 'accessibilite' => array(), 'securite' => array());
    $ajout = function (string $cat, string $cle, bool $ok, int $points, string $bien, string $mal, string $conseil, float $part = -1) use (&$c) {
        $obtenus = $part >= 0 ? (int) round($points * max(0, min(1, $part))) : ($ok ? $points : 0);
        $c[$cat][] = array('cle' => $cle, 'ok' => $obtenus >= $points, 'points' => $obtenus, 'max' => $points, 'texte' => $obtenus >= $points ? $bien : $mal, 'conseil' => $conseil);
    };

    // Téléphone (25)
    $vp = implode(' ', $attr('//meta[@name="viewport"]', 'content'));
    $ajout('mobile', 'viewport', (bool) preg_match('/width\s*=\s*device-width/i', $vp), 12, 'La page s\'adapte à la largeur du téléphone.', 'La page ne déclare pas la largeur du téléphone : elle s\'affiche en tout petit.', 'Ajouter <meta name="viewport" content="width=device-width, initial-scale=1"> dans <head>.');
    $ajout('mobile', 'zoom', !preg_match('/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i', $vp), 5, 'Le zoom avec deux doigts reste possible.', 'Le zoom est bloqué : les personnes qui voient mal ne peuvent pas agrandir.', 'Retirer user-scalable=no et maximum-scale=1 de la balise viewport.');
    $ajout('mobile', 'media', (bool) preg_match('/@media[^{]*(max|min)-width/i', $css), 5, 'La mise en page change selon la taille de l\'écran.', 'Aucune adaptation à la taille d\'écran trouvée dans les styles.', 'Ajouter des règles @media (max-width: 600px) pour réorganiser la page sur téléphone.');
    $largesFixes = $xp->query('//*[@width>700 and not(self::img) and not(self::video) and not(self::canvas) and not(self::iframe)]');
    $ajout('mobile', 'largeur', !$largesFixes || $largesFixes->length === 0, 3, 'Pas de bloc à largeur fixe trop large.', 'Des blocs ont une largeur fixe de plus de 700 pixels : la page déborde sur téléphone.', 'Remplacer les largeurs fixes (width="900") par des largeurs en % ou max-width: 100%.');

    // Poids et vitesse (25)
    $ttfb = $page['mesure']['ttfb'];
    $ajout('vitesse', 'reponse', $ttfb < 0.8, 8, 'Le serveur répond vite (' . number_format($ttfb, 1, ',', '') . ' s).', 'Le serveur met ' . number_format($ttfb, 1, ',', '') . ' s à répondre.', 'Activer le cache de l\'hébergeur (ou une page statique) pour répondre en moins de 0,8 s.', $ttfb < 0.8 ? 1 : ($ttfb < 1.8 ? 0.5 : 0));
    $mo = $poidsEstime / 1048576;
    $ajout('vitesse', 'poids', $mo < 1.5, 8, 'Page légère (' . number_format($mo, 1, ',', '') . ' Mo).', 'Page lourde (environ ' . number_format($mo, 1, ',', '') . ' Mo) : longue à charger en 4G.', 'Compresser les images (WebP, 1600 px de large au plus) et retirer les scripts inutiles : viser moins de 1,5 Mo.', $mo < 1.5 ? 1 : ($mo < 3 ? 0.5 : 0));
    $nbReq = 1 + count(array_unique(array_map(function ($l) { return $l['url']; }, $liens)));
    $ajout('vitesse', 'requetes', $nbReq <= 40, 4, $nbReq . ' fichiers à charger : raisonnable.', $nbReq . ' fichiers à charger : c\'est beaucoup.', 'Regrouper ou retirer des scripts et extensions : moins de 40 fichiers.');
    $nbImg = $imgs ? $imgs->length : 0;
    $paresseuses = count($attr('//img[@loading="lazy"]', 'loading'));
    $ajout('vitesse', 'images', $nbImg <= 6 || $paresseuses >= $nbImg / 2, 3, 'Les images se chargent au bon moment.', $nbImg . ' images chargées d\'un coup.', 'Ajouter loading="lazy" aux images qui ne sont pas en haut de la page.');
    $comp = strtolower($tete('content-encoding'));
    $ajout('vitesse', 'compression', strlen($html) < 20000 || (bool) preg_match('/gzip|br|deflate|zstd/', $comp), 2, 'La page est compressée pendant le transfert.', 'La page n\'est pas compressée pendant le transfert.', 'Activer la compression gzip ou brotli chez l\'hébergeur (souvent une case à cocher ou une ligne dans .htaccess).');

    // Accessibilité (25)
    $lang = $attr('//html', 'lang')[0] ?? '';
    $ajout('accessibilite', 'langue', $lang !== '', 5, 'La langue de la page est déclarée (' . $lang . ').', 'La langue de la page n\'est pas déclarée : les lecteurs d\'écran lisent avec le mauvais accent.', 'Écrire <html lang="fr">.');
    $titre = trim((string) ($xp->query('//title')->item(0)->textContent ?? ''));
    $ajout('accessibilite', 'titre', mb_strlen($titre) >= 3, 4, 'Titre de page présent.', 'La page n\'a pas de titre (onglet et Google).', 'Ajouter un <title> qui dit qui vous êtes et ce que vous faites.');
    $h1 = $xp->query('//h1');
    $nbH1 = $h1 ? $h1->length : 0;
    $ajout('accessibilite', 'h1', $nbH1 === 1, 4, 'Un grand titre principal (h1), comme il faut.', $nbH1 === 0 ? 'Pas de grand titre principal (h1).' : $nbH1 . ' grands titres principaux (h1) : il en faut un seul.', 'Garder un seul <h1> qui résume la page, puis des <h2> pour les parties.');
    $sansAlt = $xp->query('//img[not(@alt)]');
    $nSansAlt = $sansAlt ? $sansAlt->length : 0;
    $ajout('accessibilite', 'alt', $nSansAlt === 0, 6, $nbImg ? 'Toutes les images ont un texte alternatif.' : 'Pas d\'image sans texte alternatif.', $nSansAlt . ' image(s) sans texte alternatif.', 'Ajouter alt="…" à chaque image (alt="" pour une image décorative).', $nbImg ? 1 - $nSansAlt / $nbImg : 1);
    $champs = $xp->query('//input[not(@type="hidden") and not(@type="submit") and not(@type="button") and not(@type="image")]|//select|//textarea');
    $sansLibelle = 0;
    foreach ($champs ?: array() as $n) {
        $id = $n->getAttribute('id');
        $ok = $n->getAttribute('aria-label') !== '' || $n->getAttribute('aria-labelledby') !== '' || $n->getAttribute('title') !== ''
            || ($id !== '' && $xp->query('//label[@for="' . str_replace('"', '', $id) . '"]')->length > 0) || $xp->query('ancestor::label', $n)->length > 0;
        if (!$ok) $sansLibelle++;
    }
    $ajout('accessibilite', 'libelles', $sansLibelle === 0, 3, 'Les champs de formulaire ont un libellé.', $sansLibelle . ' champ(s) de formulaire sans libellé.', 'Relier chaque champ à un <label for="…"> visible.');
    $ct = contrastes_faibles($css . $styleAttr);
    $ajout('accessibilite', 'contraste', count($ct['faibles']) === 0, 3, $ct['vues'] ? 'Les couleurs déclarées ensemble sont bien contrastées.' : 'Pas de contraste faible repéré dans les styles (contrôle partiel).', count($ct['faibles']) . ' couleur(s) de texte peu lisible(s) sur leur fond (ex. ' . ($ct['faibles'][0]['ratio'] ?? '') . ':1, il faut 4,5:1).', 'Foncer le texte ou éclaircir le fond pour atteindre un contraste de 4,5:1 au moins.');

    // Sécurité et traceurs (25)
    $ajout('securite', 'https', $https, 8, 'Connexion chiffrée (https).', 'Pas de connexion chiffrée (http) : le navigateur affiche « Non sécurisé ».', 'Activer le certificat SSL gratuit (Let\'s Encrypt) chez l\'hébergeur et rediriger http vers https.');
    $ajout('securite', 'hsts', !$https || $tete('strict-transport-security') !== '', 3, 'Le https est imposé (HSTS).', 'Le https n\'est pas imposé (en-tête HSTS absent).', 'Ajouter l\'en-tête Strict-Transport-Security: max-age=31536000.', $https ? -1 : 0);
    $ajout('securite', 'csp', $tete('content-security-policy') !== '', 3, 'Une politique de sécurité du contenu (CSP) est en place.', 'Pas de politique de sécurité du contenu (CSP).', 'Ajouter un en-tête Content-Security-Policy qui liste les sources autorisées.');
    $ajout('securite', 'entetes', $tete('x-content-type-options') !== '' && ($tete('x-frame-options') !== '' || stripos($tete('content-security-policy'), 'frame-ancestors') !== false || $tete('referrer-policy') !== ''), 2, 'En-têtes de protection de base présents.', 'En-têtes de protection de base manquants (nosniff, cadre, referrer).', 'Ajouter X-Content-Type-Options: nosniff et Referrer-Policy: strict-origin-when-cross-origin.');
    $ajout('securite', 'mixte', $mixte === 0, 3, 'Aucun contenu non chiffré dans la page.', $mixte . ' fichier(s) chargé(s) en http dans une page https.', 'Remplacer les adresses http:// des images et scripts par https://.');
    $trouves = array();
    $tout = $html . ' ' . implode(' ', array_map(function ($l) { return $l['url']; }, $liens));
    foreach (TRACEURS as $motif => $nom) if (stripos($tout, $motif) !== false) $trouves[$nom] = true;
    $trouves = array_keys($trouves);
    $ajout('securite', 'traceurs', !$trouves, 6, 'Aucun traceur publicitaire ou de mesure d\'audience connu.', count($trouves) . ' traceur(s) : ' . implode(', ', $trouves) . '. Il faut une bannière de consentement, et vos visiteurs sont pistés.', 'Retirer les traceurs inutiles, ou passer à une mesure d\'audience sans cookie hébergée en Europe.', $trouves ? max(0, 1 - count($trouves) / 3) : 1);

    $noms = array('mobile' => 'Téléphone', 'vitesse' => 'Poids et vitesse', 'accessibilite' => 'Accessibilité', 'securite' => 'Sécurité et traceurs');
    $categories = array(); $note = 0; $manques = array();
    foreach ($c as $cat => $controles) {
        $p = array_sum(array_column($controles, 'points'));
        $note += $p;
        $categories[] = array('cle' => $cat, 'nom' => $noms[$cat], 'note' => $p, 'max' => array_sum(array_column($controles, 'max')), 'controles' => $controles);
        foreach ($controles as $x) if (!$x['ok']) $manques[] = array('titre' => $x['texte'], 'conseil' => $x['conseil'], 'gain' => $x['max'] - $x['points'], 'categorie' => $noms[$cat]);
    }
    usort($manques, function ($a, $b) { return $b['gain'] <=> $a['gain']; });
    $p = parse_url($final);
    return array(
        'url' => $p['scheme'] . '://' . $p['host'] . ($p['path'] ?? '/'),
        'date' => gmdate('c'), 'note' => (int) $note, 'categories' => $categories, 'priorites' => array_slice($manques, 0, 3),
        'mesures' => array('reponse_s' => round($ttfb, 2), 'chargement_s' => round($page['mesure']['total'], 2), 'poids_mo' => round($mo, 2),
            'fichiers' => $nbReq, 'domaines_tiers' => count($tiers), 'redirections' => $page['redirections'], 'ressources_lues' => count($res)),
        'traceurs' => $trouves,
        'limites' => 'Audit automatique d\'une seule page, sans navigateur : contrastes vérifiés seulement quand couleur et fond sont déclarés ensemble ; '
            . 'les tailles des boutons et le rendu réel ne sont pas mesurés. Pour un contrôle complet, l\'Atelier qualité du Laboratoire.',
    );
}

/* ───────────────────────────── routes ───────────────────────────── */

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['r'])) {
    $id = (string) $_GET['r'];
    if (!preg_match('/^[a-z0-9]{10}$/', $id)) repondre(404, array('erreur' => 'Bulletin introuvable.'));
    $f = dossier() . '/public/' . $id . '.json';
    $d = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
    if (!is_array($d) || strtotime((string) $d['date']) < time() - DUREE_PUBLIC) repondre(404, array('erreur' => 'Ce bulletin n\'existe plus (gardé 90 jours).'));
    header('Cache-Control: public, max-age=600');
    repondre(200, $d + array('id' => $id, 'public' => true));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') repondre(405, array('erreur' => 'Méthode non prise en charge.'));
$origine = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origine !== '' && !preg_match('#^(https://(www\.)?alphabette\.(eu|fr)|http://(localhost|127\.0\.0\.1)(:\d+)?)$#', $origine)) repondre(403, array('erreur' => 'Origine refusée.'));
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 4096) repondre(413, array('erreur' => 'Demande trop longue.'));
$e = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($e)) repondre(400, array('erreur' => 'Demande illisible.'));
if (!empty($e['site_web'])) repondre(400, array('erreur' => 'Demande refusée.'));
$url = trim((string) ($e['url'] ?? ''));
if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $url) && !preg_match('#^https?://#i', $url)) repondre(400, array('erreur' => 'Seules les adresses http et https sont acceptées.'));
if ($url !== '' && !preg_match('#^https?://#i', $url)) $url = 'https://' . $url;
if (strlen($url) > 500 || !filter_var($url, FILTER_VALIDATE_URL)) repondre(400, array('erreur' => 'Collez l\'adresse complète du site, par exemple https://mon-site.fr'));
if (!limite()) repondre(429, array('erreur' => 'Vous avez fait beaucoup d\'audits aujourd\'hui : revenez demain.'));
@set_time_limit(60);

$bulletin = auditer($url);
if (!empty($e['public'])) {
    $id = substr(bin2hex(random_bytes(8)), 0, 10);
    $d = dossier() . '/public';
    if (!is_dir($d)) @mkdir($d, 0700, true);
    foreach (glob($d . '/*.json') ?: array() as $ancien) if (filemtime($ancien) < time() - DUREE_PUBLIC) @unlink($ancien);
    file_put_contents($d . '/' . $id . '.json', json_encode($bulletin, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $bulletin['id'] = $id;
    $bulletin['public'] = true;
}
repondre(200, $bulletin);
