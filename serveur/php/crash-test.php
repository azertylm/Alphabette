<?php
/**
 * Le Crash-Testeur (alphabette.eu/crash-testeur/) — l'IA teste une appli web en 10 secondes.
 *
 * Réutilise la clé OpenRouter d'Alphabette installée pour IA Débat (~/alphabette-iadebat/config.json,
 * hors du site, jamais envoyée au navigateur).
 *
 *   GET  ?etat   → { actif, gratuit:{quota,restants}, premium:{quota,restants} }
 *   POST { mode:"gratuit"|"premium", ton:"constructif"|"sans_filtre", image?: "data:image/…;base64,…",
 *          url?: "https://…", phrase?: "…" }
 *        → { rapport:{…}, modele, gratuit, source:"capture"|"page"|"description" }
 *
 * Vie privée : la capture est transmise au modèle puis oubliée — jamais écrite sur le disque.
 * La page d'une URL est lue une fois (https, adresse publique, 500 Ko et 8 s au plus), jamais gardée.
 * L'adresse IP n'est pas conservée : seulement une empreinte du jour pour les quotas.
 */
declare(strict_types=1);

const QUOTA_GRATUIT = 5;               // crash-tests gratuits par jour et par visiteur
const QUOTA_PREMIUM = 1;               // crash-test Premium offert par jour et par visiteur
const PLAFOND_PREMIUM_TOTAL = 30;      // garde-fou du budget premium, par jour
const IMAGE_MAX = 2_600_000;           // ~1,9 Mo d'image (en base64)
const PAGE_MAX = 500_000;
const PRIX_MAX_ENTREE = 0.000002;
const PRIX_MAX_SORTIE = 0.000010;
define('OPENROUTER', rtrim(getenv('IADEBAT_OPENROUTER_BASE') ?: 'https://openrouter.ai', '/'));

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');

function repondre(int $code, array $d): void {
    http_response_code($code);
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function dossier(): string {
    $maison = getenv('HOME') ?: dirname((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__));
    $d = rtrim($maison, '/') . '/alphabette-iadebat';
    if (!is_dir($d) || !is_writable($d)) repondre(503, array('erreur' => 'Le Crash-Testeur est indisponible pour le moment.'));
    return $d;
}

function lire_json(string $f, array $defaut): array {
    $t = is_file($f) ? @file_get_contents($f) : false;
    $d = $t ? json_decode($t, true) : null;
    return is_array($d) ? $d : $defaut;
}

function ecrire_json(string $f, array $d): void {
    $tmp = $f . '.' . bin2hex(random_bytes(4));
    file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    @chmod($tmp, 0600);
    rename($tmp, $f);
}

function modifier(string $f, callable $fn) {
    $v = fopen($f . '.lock', 'c');
    if (!$v || !flock($v, LOCK_EX)) repondre(503, array('erreur' => 'Service occupé, réessayez dans un instant.'));
    $d = lire_json($f, array());
    $r = $fn($d);
    ecrire_json($f, $d);
    flock($v, LOCK_UN);
    fclose($v);
    return $r;
}

function empreinte(array $cfg, string $jour): string {
    return substr(hash_hmac('sha256', 'crash|' . ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $jour, (string) $cfg['secret']), 0, 20);
}

function fichier_jour(string $jour): string {
    $d = dossier();
    foreach (glob($d . '/crash-*.json') ?: array() as $f) {
        if (filemtime($f) < time() - 2 * 86400) { @unlink($f); @unlink($f . '.lock'); }
    }
    return $d . '/crash-' . $jour . '.json';
}

function http(string $methode, string $url, ?array $corps, array $entetes, int $delai = 60): array {
    $c = curl_init($url);
    $h = array('Accept: application/json');
    foreach ($entetes as $k => $v) $h[] = $k . ': ' . $v;
    if ($corps !== null) $h[] = 'Content-Type: application/json';
    curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $methode, CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => $delai, CURLOPT_CONNECTTIMEOUT => 10));
    if ($corps !== null) curl_setopt($c, CURLOPT_POSTFIELDS, json_encode($corps, JSON_UNESCAPED_UNICODE));
    $r = curl_exec($c);
    $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    return array('code' => $code, 'corps' => is_string($r) ? $r : '');
}

/* ───────────────────────────── modèles ───────────────────────────── */

function catalogue(): array {
    $f = dossier() . '/modeles-vision.json';
    $c = lire_json($f, array());
    if (!empty($c['modeles']) && ($c['lu'] ?? 0) > time() - 6 * 3600) return $c['modeles'];
    $r = http('GET', OPENROUTER . '/api/v1/models', null, array(), 20);
    $liste = array();
    if ($r['code'] === 200) {
        foreach ((json_decode($r['corps'], true)['data'] ?? array()) as $m) {
            if (!isset($m['id']) || !in_array('text', $m['architecture']['output_modalities'] ?? array('text'), true)) continue;
            $liste[] = array(
                'id' => (string) $m['id'], 'cree' => (int) ($m['created'] ?? 0),
                'image' => in_array('image', $m['architecture']['input_modalities'] ?? array(), true),
                'entree' => (float) ($m['pricing']['prompt'] ?? 1), 'sortie' => (float) ($m['pricing']['completion'] ?? 1),
            );
        }
    }
    if ($liste) ecrire_json($f, array('lu' => time(), 'modeles' => $liste));
    return $liste ?: ($c['modeles'] ?? array());
}

function est_gratuit(string $id): bool { return substr($id, -5) === ':free' || $id === 'openrouter/free'; }

/** Modèles à essayer, dans l'ordre. Gratuit : uniquement « :free ». Image : uniquement les modèles qui lisent les images. */
function modeles(bool $gratuit, bool $image): array {
    $exclus = '/(:batch|:extended|:beta|:thinking|:online|guard|embed|tts|audio|code|reasoning|1\.7b|search|lyria)/i';
    $l = array_filter(catalogue(), function ($m) use ($gratuit, $image, $exclus) {
        if (preg_match($exclus, $m['id'])) return false;
        if ($image && !$m['image']) return false;
        if ($gratuit) return substr($m['id'], -5) === ':free';
        return substr($m['id'], -5) !== ':free' && $m['entree'] > 0 && $m['entree'] <= PRIX_MAX_ENTREE && $m['sortie'] <= PRIX_MAX_SORTIE;
    });
    // Premium : les familles éprouvées d'abord (Gemini Flash, GPT mini, Claude Haiku, Llama 4), puis le plus récent.
    $rang = function ($id) use ($gratuit) {
        if ($gratuit) return preg_match('/-vl|gemma|nemotron/i', $id) ? 0 : 1;
        foreach (array('/google\/gemini-[0-9.]+-flash(?!-lite)/', '/openai\/gpt-[0-9.]+-mini/', '/anthropic\/claude-haiku/', '/meta-llama\/llama-4/') as $i => $g) if (preg_match($g, $id)) return $i;
        return 9;
    };
    usort($l, function ($a, $b) use ($rang) { return $rang($a['id']) <=> $rang($b['id']) ?: $b['cree'] <=> $a['cree']; });
    $ids = array_slice(array_map(function ($m) { return $m['id']; }, array_values($l)), 0, 4);
    if ($gratuit && !$image) $ids[] = 'openrouter/free';
    return $ids;
}

/* ───────────────────────────── lecture d'une URL ───────────────────────────── */

/** Lit une page publique en https, sans suivre les redirections, avec l'adresse IP vérifiée puis épinglée. */
function lire_page(string $url): array {
    $p = parse_url($url);
    if (!$p || ($p['scheme'] ?? '') !== 'https' || empty($p['host']) || isset($p['user']) || isset($p['pass'])) return array('erreur' => "L'adresse doit commencer par https://");
    $hote = strtolower($p['host']);
    $port = (int) ($p['port'] ?? 443);
    if ($port !== 443) return array('erreur' => 'Seul le port 443 est accepté.');
    $ips = filter_var($hote, FILTER_VALIDATE_IP) ? array($hote) : (@gethostbynamel($hote) ?: array());
    if (!$ips) return array('erreur' => 'Adresse introuvable.');
    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return array('erreur' => 'Adresse non publique refusée.');
    }
    $html = '';
    $c = curl_init($url);
    curl_setopt_array($c, array(
        CURLOPT_RETURNTRANSFER => false, CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_RESOLVE => array($hote . ':443:' . $ips[0]),
        CURLOPT_USERAGENT => 'Alphabette-Crash-Testeur/1.0 (+https://alphabette.eu/crash-testeur/)',
        CURLOPT_HTTPHEADER => array('Accept: text/html', 'Accept-Language: fr,en;q=0.5'),
        CURLOPT_WRITEFUNCTION => function ($ch, $morceau) use (&$html) {
            $html .= $morceau;
            return strlen($html) > PAGE_MAX ? 0 : strlen($morceau);
        },
    ));
    curl_exec($c);
    $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    if ($code >= 300 && $code < 400) return array('erreur' => 'La page redirige ailleurs : donnez l\'adresse finale, ou une capture d\'écran.');
    if ($code !== 200 || $html === '') return array('erreur' => "La page n'a pas pu être lue ($code). Ajoutez une capture d'écran.");

    $titre = preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m) ? html_entity_decode(trim($m[1])) : '';
    $desc = preg_match('/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)/i', $html, $m) ? html_entity_decode($m[1]) : '';
    $viewport = (bool) preg_match('/<meta[^>]+name=["\']viewport["\']/i', $html);
    $lang = preg_match('/<html[^>]+lang=["\']([a-z-]+)/i', $html, $m) ? $m[1] : '';
    preg_match_all('/<h[1-3][^>]*>(.*?)<\/h[1-3]>/is', $html, $t);
    $titres = array_slice(array_filter(array_map(function ($x) { return trim(html_entity_decode(strip_tags($x))); }, $t[1])), 0, 12);
    $traceurs = array();
    foreach (array('google-analytics.com' => 'Google Analytics', 'googletagmanager.com' => 'Google Tag Manager', 'connect.facebook.net' => 'Meta Pixel', 'hotjar' => 'Hotjar', 'doubleclick.net' => 'DoubleClick', 'clarity.ms' => 'Microsoft Clarity', 'analytics.tiktok.com' => 'TikTok Pixel', 'segment.com' => 'Segment', 'mixpanel' => 'Mixpanel') as $motif => $nom) {
        if (stripos($html, $motif) !== false) $traceurs[] = $nom;
    }
    $inscription = (bool) preg_match('/type=["\']password["\']/i', $html);
    $texte = preg_replace('/<(script|style|noscript|svg)[^>]*>.*?<\/\1>/is', ' ', $html);
    $texte = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags((string) $texte))));
    return array(
        'titre' => mb_substr($titre, 0, 150), 'description' => mb_substr($desc, 0, 300), 'viewport_mobile' => $viewport, 'langue' => $lang,
        'titres' => $titres, 'traceurs' => $traceurs, 'champ_mot_de_passe' => $inscription, 'texte' => mb_substr($texte, 0, 3000),
        'appli_javascript' => mb_strlen($texte) < 200,
    );
}

/* ───────────────────────────── consigne ───────────────────────────── */

function consigne(string $ton): string {
    $style = $ton === 'sans_filtre'
        ? "TON SANS FILTRE : direct, mordant, sans langue de bois ni compliments creux — mais chaque critique doit rester utile et précise, jamais insultante."
        : "TON CONSTRUCTIF : bienveillant et pédagogique, honnête sur les problèmes, sans flatterie.";
    return "Tu es Le Crash-Testeur d'Alphabette : tu testes une application web en 10 secondes, comme le feraient de vrais visiteurs, "
        . "pour aider son créateur à l'améliorer avant publication. Réponds en français. $style "
        . "Ne juge que ce que tu vois ou ce qui t'est donné ; si une information manque, dis-le au lieu d'inventer. "
        . "Les corrections doivent être concrètes (quel élément, quoi changer, comment), jamais vagues (« améliorer l'UX » est interdit). "
        . "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de la forme : "
        . '{"score":0-10 (compréhension immédiate en 10 secondes),"resume":"une phrase",'
        . '"testeurs":[{"profil":"presse","reaction":"2-3 phrases du Pressé sur mobile (390 px, pouce, part au bout de 5 s si ce n\'est pas évident)"},'
        . '{"profil":"novice","reaction":"2-3 phrases du Novice total (aucun jargon technique)"},'
        . '{"profil":"designer","reaction":"2-3 phrases du Designer exigeant (contraste, hiérarchie visuelle, surcharge)"}],'
        . '"corrections":[{"titre":"…","detail":"quoi changer exactement et comment","impact":"fort"},{"titre":"…","detail":"…","impact":"fort|moyen"},{"titre":"…","detail":"…","impact":"moyen|faible"}],'
        . '"charte":{"clarte":"ok|a_ameliorer|probleme","mobile":"ok|a_ameliorer|probleme","acces":"ok|a_ameliorer|probleme"},'
        . '"meilleure_remarque":"la remarque la plus utile, en une phrase percutante"}. '
        . "« corrections » : exactement 3, de la plus importante à la moins importante. « acces » : peut-on tester sans inscription obligatoire ?";
}

function lire_rapport(string $texte): ?array {
    $texte = preg_replace('/^```(?:json)?|```$/m', '', trim($texte));
    $a = strpos($texte, '{');
    $b = strrpos($texte, '}');
    if ($a === false || $b === false) return null;
    $d = json_decode(substr($texte, $a, $b - $a + 1), true);
    if (!is_array($d) || !isset($d['score'], $d['testeurs'], $d['corrections'])) return null;
    $d['score'] = max(0, min(10, (float) $d['score']));
    $d['corrections'] = array_slice(array_values((array) $d['corrections']), 0, 3);
    $d['testeurs'] = array_slice(array_values((array) $d['testeurs']), 0, 3);
    return $d;
}

/* ───────────────────────────── service ───────────────────────────── */

$cfg = lire_json(dossier() . '/config.json', array());
$actif = !empty($cfg['cle']) && !empty($cfg['secret']);
$jour = gmdate('Y-m-d');
$fichier = $actif ? fichier_jour($jour) : '';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    if (!$actif) repondre(200, array('actif' => false));
    $q = lire_json($fichier, array());
    $moi = $q['ip'][empreinte($cfg, $jour)] ?? array();
    $p = ((int) ($q['total_p'] ?? 0) >= PLAFOND_PREMIUM_TOTAL) ? 0 : max(0, QUOTA_PREMIUM - (int) ($moi['p'] ?? 0));
    repondre(200, array('actif' => true, 'gratuit' => array('quota' => QUOTA_GRATUIT, 'restants' => max(0, QUOTA_GRATUIT - (int) ($moi['g'] ?? 0))),
        'premium' => array('quota' => QUOTA_PREMIUM, 'restants' => $p)));
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') repondre(405, array('erreur' => 'Méthode non prise en charge.'));
if (!$actif) repondre(503, array('erreur' => "Le Crash-Testeur n'est pas encore ouvert."));

$e = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($e)) repondre(400, array('erreur' => 'Demande illisible.'));
$premium = ($e['mode'] ?? '') === 'premium';
$ton = ($e['ton'] ?? '') === 'sans_filtre' ? 'sans_filtre' : 'constructif';
$image = (string) ($e['image'] ?? '');
$url = trim((string) ($e['url'] ?? ''));
$phrase = mb_substr(trim((string) ($e['phrase'] ?? '')), 0, 300);

if ($image !== '') {
    if (strlen($image) > IMAGE_MAX || !preg_match('#^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$#', $image)) repondre(400, array('erreur' => 'Image trop lourde ou dans un format non pris en charge (JPEG, PNG, WebP).'));
}
if ($image === '' && $url === '' && mb_strlen($phrase) < 10) repondre(400, array('erreur' => "Ajoutez une capture d'écran, une adresse, ou une phrase qui décrit votre appli."));

// Quota (compté avant l'appel, rendu si l'IA échoue).
$ip = empreinte($cfg, $jour);
$refus = modifier($fichier, function (&$q) use ($ip, $premium) {
    $k = $premium ? 'p' : 'g';
    $n = (int) ($q['ip'][$ip][$k] ?? 0);
    if ($n >= ($premium ? QUOTA_PREMIUM : QUOTA_GRATUIT)) return 'quota';
    if ($premium && (int) ($q['total_p'] ?? 0) >= PLAFOND_PREMIUM_TOTAL) return 'plafond';
    $q['ip'][$ip][$k] = $n + 1;
    if ($premium) $q['total_p'] = (int) ($q['total_p'] ?? 0) + 1;
    return '';
});
if ($refus) repondre(429, array('quota' => true, 'erreur' => $premium
    ? 'Votre crash-test Premium offert du jour est utilisé. Le Mode Gratuit reste disponible, ou connectez OpenRouter en 1 clic.'
    : 'Vous avez fait vos ' . QUOTA_GRATUIT . ' crash-tests gratuits du jour. Revenez demain, ou passez en Premium.'));
$rendre = function () use ($fichier, $ip, $premium) {
    modifier($fichier, function (&$q) use ($ip, $premium) {
        $k = $premium ? 'p' : 'g';
        $q['ip'][$ip][$k] = max(0, (int) ($q['ip'][$ip][$k] ?? 1) - 1);
        if ($premium) $q['total_p'] = max(0, (int) ($q['total_p'] ?? 1) - 1);
    });
};

// Contexte : page lue (URL) et phrase du créateur.
$page = null;
$avertissement = '';
if ($url !== '') {
    $page = lire_page($url);
    if (isset($page['erreur'])) {
        if ($image === '' && mb_strlen($phrase) < 10) { $rendre(); repondre(400, array('erreur' => $page['erreur'])); }
        $avertissement = $page['erreur'];
        $page = null;
    }
}
$contexte = array();
if ($phrase !== '') $contexte[] = "Le créateur décrit son appli ainsi : « $phrase ».";
if ($url !== '') $contexte[] = "Adresse : $url";
if ($page) $contexte[] = 'Ce que contient la page (lecture du code, pas de rendu visuel) : ' . json_encode($page, JSON_UNESCAPED_UNICODE);
if ($image !== '') $contexte[] = "La capture d'écran jointe montre l'application : juge surtout ce que tu vois.";
else $contexte[] = "Aucune capture d'écran : tu ne vois pas l'apparence ; pour le designer et les contrastes, signale ce que tu ne peux pas vérifier.";
$contenu = $image !== ''
    ? array(array('type' => 'text', 'text' => implode("\n", $contexte)), array('type' => 'image_url', 'image_url' => array('url' => $image)))
    : implode("\n", $contexte);

$liste = modeles(!$premium, $image !== '');
if (!$premium) $liste = array_values(array_filter($liste, 'est_gratuit'));   // verrou : jamais de modèle payant en gratuit
$derniere = '';
foreach ($liste as $modele) {
    $corps = array(
        'model' => $modele,
        'messages' => array(array('role' => 'system', 'content' => consigne($ton)), array('role' => 'user', 'content' => $contenu)),
        'max_tokens' => 1400, 'temperature' => $ton === 'sans_filtre' ? 0.8 : 0.5,
    );
    if ($premium) $corps['provider'] = array('data_collection' => 'deny', 'allow_fallbacks' => true);
    $r = http('POST', OPENROUTER . '/api/v1/chat/completions', $corps, array(
        'Authorization' => 'Bearer ' . $cfg['cle'], 'HTTP-Referer' => 'https://alphabette.eu/crash-testeur/', 'X-Title' => 'Le Crash-Testeur - Alphabette',
    ));
    if ($r['code'] === 200) {
        $d = json_decode($r['corps'], true);
        $rapport = lire_rapport((string) ($d['choices'][0]['message']['content'] ?? ''));
        if ($rapport) {
            repondre(200, array('rapport' => $rapport, 'modele' => (string) ($d['model'] ?? $modele), 'gratuit' => !$premium,
                'source' => $image !== '' ? 'capture' : ($page ? 'page' : 'description'), 'avertissement' => $avertissement));
        }
        $derniere = 'réponse illisible';
        continue;
    }
    $derniere = (string) (json_decode($r['corps'], true)['error']['message'] ?? $r['code']);
    // 429 / 5xx / modèle indisponible / image refusée : modèle suivant.
}
$rendre();
repondre(503, array('erreur' => $premium
    ? "Les modèles Premium n'ont pas répondu (" . mb_substr($derniere, 0, 120) . '). Réessayez dans un instant.'
    : 'Serveur gratuit momentanément saturé (' . mb_substr($derniere, 0, 120) . "). Réessayez dans un instant, ou passez en Premium.", 'sature' => true));
