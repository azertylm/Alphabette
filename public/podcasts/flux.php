<?php
// Relais des Podcasts Alphabette.
// Le navigateur ne peut pas lire directement la plupart des flux RSS (blocage CORS).
// Ce petit relais va chercher le flux (?u=adresse) ou interroge l'annuaire iTunes (?q=mots).
// Il ne garde rien : pas de journal, pas de compte, pas de base de données.
// Sécurité : http/https uniquement, ports 80/443, adresses publiques uniquement
// (pas de réseau interne), redirections contrôlées une à une, taille et durée limitées.
declare(strict_types=1);

const TAILLE_MAX = 5000000;   // 5 Mo
const REDIRECTIONS_MAX = 5;

function fin(int $code, string $message): void {
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

/** Renvoie l'IPv4/IPv6 publique de l'hôte, ou null s'il n'est pas public. */
function adresse_publique(string $hote): ?string {
    $hote = trim($hote, '[]');
    if (filter_var($hote, FILTER_VALIDATE_IP)) {
        $ips = [$hote];
    } else {
        $ips = gethostbynamel($hote) ?: [];
    }
    if (!$ips) return null;
    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return null;
    }
    return $ips[0];
}

function recuperer(string $url, string $accept): array {
    for ($i = 0; $i <= REDIRECTIONS_MAX; $i++) {
        $p = parse_url($url);
        if (!$p || empty($p['scheme']) || empty($p['host'])) fin(400, 'Adresse invalide.');
        $schema = strtolower($p['scheme']);
        if ($schema !== 'http' && $schema !== 'https') fin(400, 'Seules les adresses http et https sont acceptées.');
        $port = $p['port'] ?? ($schema === 'https' ? 443 : 80);
        if ($port !== 80 && $port !== 443) fin(400, 'Port non autorisé.');
        $ip = adresse_publique($p['host']);
        if ($ip === null) fin(400, 'Adresse non autorisée.');

        $corps = '';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_RESOLVE => [$p['host'] . ':' . $port . ':' . (strpos($ip, ':') !== false ? '[' . $ip . ']' : $ip)],
            CURLOPT_USERAGENT => 'AlphabettePodcasts/1.0 (+https://www.alphabette.fr)',
            CURLOPT_HTTPHEADER => ['Accept: ' . $accept],
            CURLOPT_ENCODING => '',
            CURLOPT_HEADER => false,
            CURLOPT_WRITEFUNCTION => function ($ch, $morceau) use (&$corps) {
                $corps .= $morceau;
                return strlen($corps) > TAILLE_MAX ? 0 : strlen($morceau);
            },
        ]);
        $ok = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $redir = (string) curl_getinfo($ch, CURLINFO_REDIRECT_URL);
        $erreur = curl_errno($ch);
        curl_close($ch);

        if ($code >= 300 && $code < 400 && $redir !== '') { $url = $redir; continue; }
        if ($ok === false || $erreur) fin(502, strlen($corps) > TAILLE_MAX ? 'Réponse trop volumineuse.' : 'Le site du podcast ne répond pas.');
        if ($code < 200 || $code >= 300) fin(502, 'Le site du podcast a répondu avec une erreur (' . $code . ').');
        return [$corps, $code];
    }
    fin(502, 'Trop de redirections.');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') fin(405, 'Méthode non autorisée.');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=300');

if (isset($_GET['q'])) {
    $mots = trim((string) $_GET['q']);
    if ($mots === '' || strlen($mots) > 120) fin(400, 'Recherche vide ou trop longue.');
    // Les recherches sont gardées 24 h (l'annuaire limite le nombre de requêtes). Si le dossier
    // temporaire n'est pas accessible, on interroge simplement l'annuaire à chaque fois.
    $cache = sys_get_temp_dir() . '/alphabette-podcasts-' . md5(mb_strtolower($mots)) . '.json';
    header('Content-Type: application/json; charset=utf-8');
    if (is_file($cache) && time() - (int) @filemtime($cache) < 86400) { readfile($cache); exit; }
    $url = 'https://itunes.apple.com/search?media=podcast&entity=podcast&country=FR&limit=24&term=' . rawurlencode($mots);
    [$corps] = recuperer($url, 'application/json');
    if (json_decode($corps) !== null) { @file_put_contents($cache, $corps, LOCK_EX); }
    echo $corps;
    exit;
}

$u = isset($_GET['u']) ? trim((string) $_GET['u']) : '';
if ($u === '' || strlen($u) > 2000) fin(400, 'Adresse du flux manquante.');
[$corps] = recuperer($u, 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5');
header('Content-Type: application/xml; charset=utf-8');
echo $corps;
