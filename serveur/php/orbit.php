<?php
/**
 * ORBIT — relais du Laboratoire (alphabette.eu/api/orbit.php), PHP 8.2, OVH Perso.
 *
 * Rien n'est stocké sur les visiteurs : ni compte, ni adresse IP (empreinte HMAC du jour pour les quotas).
 * Données hors du site : ~/alphabette-orbit/ (cache des fiches, des miniatures et des analyses IA).
 * Clé IA : celle du relais d'IA Débat (~/alphabette-iadebat/config.json), modèles « :free » uniquement.
 * Clé YouTube facultative : ~/alphabette-orbit/config.json {"youtube_cle": "..."} (durées, sous-titres, recherche).
 *
 *   GET  ?sante                       → {ia, youtube_api, gd}
 *   GET  ?metas=yt:ID,tt:ID…          → fiches (titre, auteur, durée, sous-titres, empreinte de miniature…), 20 max
 *   GET  ?meta=<adresse>              → fiche d'une adresse collée (YouTube, TikTok, Instagram, Facebook)
 *   GET  ?miniature=yt:ID             → miniature servie depuis alphabette.eu (Google/TikTok ne voient pas le visiteur)
 *   POST {action:"analyser", id}      → titre propre, langue, orbite, ton, sujets, actu/débat, sans son, résumé
 *   POST {action:"angle", id, candidats:[{id,titre}]}    → vidéo d'un autre point de vue
 *   POST {action:"plongee", id, candidats:[{id,titre}]}  → 5 étapes de plus en plus pointues
 */

declare(strict_types=1);

const OPENROUTER = 'https://openrouter.ai';
const ORBITES = array('culture-generale', 'humour', 'tech-ia', 'sport', 'musique-live', 'bricolage');
const TONS = array('drole', 'educatif', 'debat', 'inspirant');
const MODELES_PREFERES = array(
    'meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-small-3.2-24b-instruct:free',
    'deepseek/deepseek-chat-v3-0324:free', 'qwen/qwen-2.5-72b-instruct:free', 'google/gemini-2.0-flash-exp:free',
);
const QUOTA_META_IP = 400;      // fiches non encore en cache, par jour et par appareil
const QUOTA_IA_IP = 40;         // analyses IA non encore en cache, par jour et par appareil
const QUOTA_IA_TOTAL = 300;     // pour tout le site, par jour (le compte OpenRouter est partagé)

/* ───────────────────────────── utilitaires ───────────────────────────── */

function repondre(int $code, array $d): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function maison(): string { return rtrim((string) (getenv('HOME') ?: dirname((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__))), '/'); }

function dossier(string $sous = ''): string {
    $d = maison() . '/alphabette-orbit' . ($sous !== '' ? '/' . $sous : '');
    if (!is_dir($d)) @mkdir($d, 0700, true);
    if (!is_dir($d) || !is_writable($d)) repondre(503, array('erreur' => 'ORBIT est momentanément indisponible.'));
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

function config_ia(): array { return lire_json(maison() . '/alphabette-iadebat/config.json', array()); }
function config_orbit(): array { return lire_json(maison() . '/alphabette-orbit/config.json', array()); }

function ip_visiteur(): string {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        $fw = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0]);
        if (filter_var($fw, FILTER_VALIDATE_IP)) $ip = $fw;
    }
    return $ip;
}

/** Empreinte de l'appareil valable un jour : l'adresse IP n'est jamais écrite. */
function empreinte(string $jour): string {
    $sel = (string) (config_ia()['secret'] ?? '') ?: hash('sha256', __FILE__ . maison());
    return substr(hash_hmac('sha256', ip_visiteur() . '|orbit|' . $jour, $sel), 0, 20);
}

/** Décompte d'un quota du jour ; renvoie false si la limite est atteinte. */
function compter(string $type, int $limiteIp, int $limiteTotal = 0): bool {
    $jour = gmdate('Y-m-d');
    $d = dossier();
    foreach (glob($d . '/quotas-*.json') ?: array() as $f) {
        if (filemtime($f) < time() - 2 * 86400) { @unlink($f); @unlink($f . '.lock'); }
    }
    $e = empreinte($jour);
    return (bool) modifier($d . '/quotas-' . $jour . '.json', function (&$q) use ($type, $e, $limiteIp, $limiteTotal) {
        $n = (int) ($q[$type][$e] ?? 0);
        $t = (int) ($q[$type . '_total'] ?? 0);
        if ($n >= $limiteIp || ($limiteTotal > 0 && $t >= $limiteTotal)) return false;
        $q[$type][$e] = $n + 1;
        $q[$type . '_total'] = $t + 1;
        return true;
    });
}

function http(string $methode, string $url, ?array $corps = null, array $entetes = array(), int $delai = 15): array {
    $c = curl_init($url);
    $h = array('Accept-Language: fr-FR,fr;q=0.9,en;q=0.5');
    foreach ($entetes as $k => $v) $h[] = $k . ': ' . $v;
    if ($corps !== null) $h[] = 'Content-Type: application/json';
    curl_setopt_array($c, array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $methode,
        CURLOPT_HTTPHEADER => $h,
        CURLOPT_TIMEOUT => $delai,
        CURLOPT_CONNECTTIMEOUT => min(8, $delai),
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADER => true,
        CURLOPT_MAXFILESIZE => 6 * 1024 * 1024,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; ORBIT-Alphabette/1.0; +https://alphabette.eu/orbit/)',
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    ));
    if ($corps !== null) curl_setopt($c, CURLOPT_POSTFIELDS, json_encode($corps, JSON_UNESCAPED_UNICODE));
    $r = curl_exec($c);
    $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
    $taille = (int) curl_getinfo($c, CURLINFO_HEADER_SIZE);
    curl_close($c);
    $r = is_string($r) ? $r : '';
    $tete = substr($r, 0, $taille);
    $lieu = preg_match('/^location:\s*(\S+)/mi', $tete, $m) ? trim($m[1]) : '';
    return array('code' => $code, 'corps' => (string) substr($r, $taille), 'lieu' => $lieu);
}

/* ───────────────────────────── adresses → identifiants ───────────────────────────── */

const PREFIXES = array('yt' => 'youtube', 'tt' => 'tiktok', 'ig' => 'instagram', 'fb' => 'facebook');

function id_valide(string $id): bool {
    return (bool) preg_match('/^(yt:[A-Za-z0-9_-]{11}|tt:\d{8,25}|ig:[A-Za-z0-9_-]{5,40}|fb:\d{5,25})$/', $id);
}

/** Adresse collée → identifiant ORBIT (« yt:… », « tt:… »…) ; suit au plus 3 redirections des liens courts. */
function identifier(string $adresse, int $sauts = 0): ?array {
    $adresse = trim($adresse);
    if (!preg_match('#^https?://#i', $adresse)) $adresse = 'https://' . $adresse;
    $u = parse_url($adresse);
    $hote = strtolower(preg_replace('/^(www\.|m\.|mobile\.|web\.)/', '', (string) ($u['host'] ?? '')));
    $chemin = (string) ($u['path'] ?? '');
    parse_str((string) ($u['query'] ?? ''), $q);
    if ($hote === 'youtu.be' && preg_match('#^/([A-Za-z0-9_-]{11})#', $chemin, $m)) return array('id' => 'yt:' . $m[1], 'vertical' => false);
    if (in_array($hote, array('youtube.com', 'music.youtube.com', 'youtube-nocookie.com'), true)) {
        if (preg_match('#^/(shorts)/([A-Za-z0-9_-]{11})#', $chemin, $m)) return array('id' => 'yt:' . $m[2], 'vertical' => true);
        if (preg_match('#^/(embed|live|v)/([A-Za-z0-9_-]{11})#', $chemin, $m)) return array('id' => 'yt:' . $m[2], 'vertical' => false);
        if (isset($q['v']) && preg_match('/^[A-Za-z0-9_-]{11}$/', (string) $q['v'])) return array('id' => 'yt:' . $q['v'], 'vertical' => false);
    }
    if ($hote === 'tiktok.com' && preg_match('#/video/(\d{8,25})#', $chemin, $m)) return array('id' => 'tt:' . $m[1], 'vertical' => true, 'url' => 'https://www.tiktok.com' . $chemin);
    if (in_array($hote, array('vm.tiktok.com', 'vt.tiktok.com'), true) || ($hote === 'tiktok.com' && preg_match('#^/t/#', $chemin))) {
        if ($sauts >= 3) return null;
        $r = http('GET', 'https://' . $hote . $chemin);
        return $r['lieu'] ? identifier($r['lieu'], $sauts + 1) : null;
    }
    if ($hote === 'instagram.com' && preg_match('#^/(p|reel|reels|tv)/([A-Za-z0-9_-]{5,40})#', $chemin, $m)) return array('id' => 'ig:' . $m[2], 'vertical' => $m[1] !== 'p');
    if (in_array($hote, array('facebook.com', 'fb.watch'), true)) {
        if (preg_match('#/(videos|reel)/(\d{5,25})#', $chemin, $m)) return array('id' => 'fb:' . $m[2], 'vertical' => $m[1] === 'reel');
        if (isset($q['v']) && preg_match('/^\d{5,25}$/', (string) $q['v'])) return array('id' => 'fb:' . $q['v'], 'vertical' => false);
        if (($hote === 'fb.watch' || preg_match('#^/share/[vr]/#', $chemin)) && $sauts < 3) {
            $r = http('GET', 'https://' . ($hote === 'fb.watch' ? 'fb.watch' : 'www.facebook.com') . $chemin);
            return $r['lieu'] ? identifier($r['lieu'], $sauts + 1) : null;
        }
    }
    return null;
}

function url_publique(string $id, string $urlTikTok = ''): string {
    [$p, $v] = explode(':', $id, 2);
    switch ($p) {
        case 'yt': return 'https://www.youtube.com/watch?v=' . $v;
        case 'tt': return $urlTikTok ?: 'https://www.tiktok.com/@/video/' . $v;
        case 'ig': return 'https://www.instagram.com/p/' . $v . '/';
        default:   return 'https://www.facebook.com/watch/?v=' . $v;
    }
}

/* ───────────────────────────── fiches (métadonnées) ───────────────────────────── */

function fichier_cache(string $type, string $id): string {
    return dossier('cache') . '/' . $type . '-' . str_replace(':', '_', $id) . '.json';
}

function duree_iso(string $iso): ?int {
    if (!preg_match('/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/', $iso, $m)) return null;
    return ((int) ($m[1] ?? 0)) * 86400 + ((int) ($m[2] ?? 0)) * 3600 + ((int) ($m[3] ?? 0)) * 60 + (int) ($m[4] ?? 0);
}

function decoder_json_page(string $s): string { $d = json_decode('"' . $s . '"'); return is_string($d) ? $d : ''; }

function meta_youtube(string $v, array &$f): void {
    $o = http('GET', 'https://www.youtube.com/oembed?format=json&url=' . rawurlencode('https://www.youtube.com/watch?v=' . $v));
    if ($o['code'] === 200) {
        $d = json_decode($o['corps'], true) ?: array();
        $f['titre'] = (string) ($d['title'] ?? '');
        $f['auteur'] = (string) ($d['author_name'] ?? '');
        $f['integrable'] = true;
    } elseif (in_array($o['code'], array(401, 403), true)) {
        $f['integrable'] = false;   // propriétaire : lecture hors YouTube interdite
    } elseif ($o['code'] === 404 || $o['code'] === 400) {
        $f['introuvable'] = true;
        return;
    }
    $f['miniature_source'] = 'https://i.ytimg.com/vi/' . $v . '/hqdefault.jpg';
    $cle = (string) (config_orbit()['youtube_cle'] ?? '');
    if ($cle !== '') {
        $r = http('GET', 'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=' . $v . '&key=' . rawurlencode($cle));
        $it = $r['code'] === 200 ? (json_decode($r['corps'], true)['items'][0] ?? null) : null;
        if ($it) {
            $f['duree_s'] = duree_iso((string) ($it['contentDetails']['duration'] ?? ''));
            $f['sous_titres'] = ($it['contentDetails']['caption'] ?? '') === 'true';
            $f['description'] = mb_substr((string) ($it['snippet']['description'] ?? ''), 0, 1200);
            $f['langue'] = substr((string) ($it['snippet']['defaultAudioLanguage'] ?? $it['snippet']['defaultLanguage'] ?? ''), 0, 2) ?: null;
            if (!$f['titre']) $f['titre'] = (string) ($it['snippet']['title'] ?? '');
            $f['source_infos'] = 'api-youtube';
            return;
        }
    }
    // Sans clé : la page publique de la vidéo contient la durée, la description et la liste des sous-titres.
    $p = http('GET', 'https://www.youtube.com/watch?v=' . $v . '&hl=fr', null, array('Cookie' => 'CONSENT=YES+1; SOCS=CAI'));
    if ($p['code'] === 200) {
        if (preg_match('/"lengthSeconds":"(\d+)"/', $p['corps'], $m)) $f['duree_s'] = (int) $m[1];
        if (preg_match('/"shortDescription":"((?:[^"\\\\]|\\\\.)*)"/', $p['corps'], $m)) $f['description'] = mb_substr(decoder_json_page($m[1]), 0, 1200);
        $f['sous_titres'] = strpos($p['corps'], '"captionTracks"') !== false;
        if (preg_match('/"isLiveContent":true/', $p['corps'])) $f['direct'] = true;
        $f['source_infos'] = 'page-youtube';
    }
}

function meta_tiktok(string $v, string $url, array &$f): void {
    $o = http('GET', 'https://www.tiktok.com/oembed?url=' . rawurlencode($url ?: 'https://www.tiktok.com/@/video/' . $v));
    if ($o['code'] !== 200) { $f['introuvable'] = $o['code'] === 404 || $o['code'] === 400; return; }
    $d = json_decode($o['corps'], true) ?: array();
    $f['titre'] = (string) ($d['title'] ?? '');
    $f['auteur'] = (string) ($d['author_name'] ?? '');
    $f['miniature_source'] = (string) ($d['thumbnail_url'] ?? '');
    $f['integrable'] = true;
    $f['source_infos'] = 'oembed-tiktok';
}

/** Empreinte visuelle (dHash 64 bits) d'une image, pour reconnaître le même clip republié ailleurs. */
function dhash($img): string {
    $p = imagecreatetruecolor(9, 8);
    imagecopyresampled($p, $img, 0, 0, 0, 0, 9, 8, imagesx($img), imagesy($img));
    $bits = '';
    for ($y = 0; $y < 8; $y++) {
        for ($x = 0; $x < 8; $x++) {
            $a = imagecolorat($p, $x, $y); $b = imagecolorat($p, $x + 1, $y);
            $la = (($a >> 16) & 255) * 0.3 + (($a >> 8) & 255) * 0.59 + ($a & 255) * 0.11;
            $lb = (($b >> 16) & 255) * 0.3 + (($b >> 8) & 255) * 0.59 + ($b & 255) * 0.11;
            $bits .= $la > $lb ? '1' : '0';
        }
    }
    imagedestroy($p);
    $hex = '';
    foreach (str_split($bits, 4) as $q) $hex .= dechex(bindec($q));
    return $hex;
}

/** Télécharge la miniature une fois, la réduit (480 px), la garde et calcule son empreinte. */
function preparer_miniature(string $id, string $source, array &$f): void {
    if ($source === '' || !function_exists('imagecreatefromstring')) return;
    $u = parse_url($source);
    $hote = strtolower((string) ($u['host'] ?? ''));
    if (!preg_match('/(^|\.)(ytimg\.com|tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|ibyteimg\.com)$/', $hote)) return;
    $r = http('GET', $source);
    if ($r['code'] !== 200 || $r['corps'] === '') return;
    $img = @imagecreatefromstring($r['corps']);
    if (!$img) return;
    // YouTube : bandes noires des miniatures 4:3 retirées avant l'empreinte (sinon un Short et sa copie TikTok diffèrent).
    $w = imagesx($img); $h = imagesy($img);
    if (strpos($id, 'yt:') === 0 && abs($w / max(1, $h) - 4 / 3) < 0.05) {
        $hc = (int) round($w * 9 / 16);
        $crop = imagecrop($img, array('x' => 0, 'y' => (int) (($h - $hc) / 2), 'width' => $w, 'height' => $hc));
        if ($crop) { imagedestroy($img); $img = $crop; $w = imagesx($img); $h = imagesy($img); }
    }
    $f['empreinte_image'] = dhash($img);
    $lw = min(480, $w); $lh = (int) round($h * $lw / max(1, $w));
    $r2 = imagecreatetruecolor($lw, $lh);
    imagecopyresampled($r2, $img, 0, 0, 0, 0, $lw, $lh, $w, $h);
    imagejpeg($r2, dossier('miniatures') . '/' . str_replace(':', '_', $id) . '.jpg', 78);
    imagedestroy($r2); imagedestroy($img);
    $f['miniature'] = 'api/orbit.php?miniature=' . rawurlencode($id);
    $f['ratio'] = $lw > 0 ? round($lh / $lw, 3) : null;
}

function fiche(string $id, bool $vertical = false, string $urlTikTok = '', bool $creer = true): ?array {
    $fc = fichier_cache('meta', $id);
    $c = lire_json($fc, array());
    // Une fiche vit 30 jours (une vidéo peut être retirée ou rendue privée), 1 jour si elle a échoué.
    if ($c && ($c['lu'] ?? 0) > time() - (empty($c['echec']) ? 30 * 86400 : 86400)) return $c;
    if (!$creer) return $c ?: null;
    if (!compter('meta', QUOTA_META_IP)) return $c ?: array('id' => $id, 'erreur' => 'quota');
    [$p, $v] = explode(':', $id, 2);
    $f = array(
        'id' => $id, 'plateforme' => PREFIXES[$p], 'url' => url_publique($id, $urlTikTok),
        'titre' => '', 'auteur' => '', 'duree_s' => null, 'sous_titres' => null, 'description' => '',
        'langue' => null, 'vertical' => $vertical || $p === 'tt', 'miniature' => null, 'empreinte_image' => null,
        'integrable' => null, 'source_infos' => 'adresse', 'lu' => time(),
    );
    if ($p === 'yt') meta_youtube($v, $f);
    elseif ($p === 'tt') meta_tiktok($v, $urlTikTok, $f);
    // Instagram et Facebook : leur oEmbed exige un jeton Meta ; on garde la plateforme et l'adresse, sans inventer de titre.
    if (!empty($f['miniature_source'])) preparer_miniature($id, (string) $f['miniature_source'], $f);
    unset($f['miniature_source']);
    if (!empty($f['introuvable'])) $f['echec'] = true;
    ecrire_json($fc, $f);
    return $f;
}

/* ───────────────────────────── IA (OpenRouter, modèles gratuits) ───────────────────────────── */

function modeles_gratuits(): array {
    $f = dossier() . '/modeles-gratuits.json';
    $c = lire_json($f, array());
    if (!empty($c['ids']) && ($c['lu'] ?? 0) > time() - 6 * 3600) return $c['ids'];
    $r = http('GET', OPENROUTER . '/api/v1/models', null, array(), 20);
    $dispo = array();
    if ($r['code'] === 200) {
        foreach ((json_decode($r['corps'], true)['data'] ?? array()) as $m) {
            $id = (string) ($m['id'] ?? '');
            if (substr($id, -5) === ':free' && in_array('text', $m['architecture']['output_modalities'] ?? array('text'), true)) $dispo[] = $id;
        }
    }
    $ids = array_values(array_unique(array_merge(array_values(array_intersect(MODELES_PREFERES, $dispo)),
        array_values(array_filter($dispo, function ($id) { return (bool) preg_match('/(llama|mistral|deepseek|qwen|gemini|gemma)/i', $id); })))));
    if (!$ids) $ids = $c['ids'] ?? MODELES_PREFERES;
    ecrire_json($f, array('lu' => time(), 'ids' => $ids));
    return $ids;
}

/** Demande à l'IA une réponse JSON ; renvoie [tableau, modèle] ou null (saturé / pas de clé). */
function ia_json(string $systeme, string $prompt, int $maxTokens = 500): ?array {
    $cle = (string) (config_ia()['cle'] ?? '');
    if ($cle === '') return null;
    $liste = array_slice(modeles_gratuits(), 0, 6);
    foreach (array_chunk($liste, 3) as $groupe) {
        $r = http('POST', OPENROUTER . '/api/v1/chat/completions', array(
            'model' => $groupe[0],
            'models' => $groupe,
            'messages' => array(array('role' => 'system', 'content' => $systeme), array('role' => 'user', 'content' => $prompt)),
            'max_tokens' => $maxTokens,
            'temperature' => 0.2,
            'provider' => array('max_price' => array('prompt' => 0, 'completion' => 0)),   // jamais un centime
        ), array('Authorization' => 'Bearer ' . $cle, 'HTTP-Referer' => 'https://alphabette.eu/orbit/', 'X-Title' => 'ORBIT - Alphabette'), 45);
        if ($r['code'] !== 200) continue;
        $d = json_decode($r['corps'], true);
        $texte = (string) ($d['choices'][0]['message']['content'] ?? '');
        $j = extraire_json($texte);
        if ($j !== null) return array($j, (string) ($d['model'] ?? $groupe[0]));
    }
    return null;
}

function extraire_json(string $t): ?array {
    $t = trim(preg_replace('/^```(?:json)?|```$/m', '', $t));
    $a = strpos($t, '{'); $b = strrpos($t, '}');
    if ($a === false || $b === false || $b <= $a) return null;
    $d = json_decode(substr($t, $a, $b - $a + 1), true);
    return is_array($d) ? $d : null;
}

function texte_video(array $f): string {
    $d = trim((string) ($f['description'] ?? ''));
    return 'Plateforme : ' . $f['plateforme'] . "\nTitre : " . ($f['titre'] ?: '(inconnu)') . "\nAuteur : " . ($f['auteur'] ?: '(inconnu)')
        . "\nDurée : " . ($f['duree_s'] !== null ? $f['duree_s'] . ' s' : 'inconnue')
        . "\nDescription : " . ($d !== '' ? mb_substr($d, 0, 900) : '(aucune)');
}

const SYS_ANALYSE = "Tu classes des vidéos pour ORBIT, un lecteur vidéo sans algorithme. Réponds UNIQUEMENT par un objet JSON, sans texte autour. "
    . "N'invente rien : appuie-toi seulement sur le titre et la description fournis ; si une information manque, mets null.";

function consigne_analyse(array $f): string {
    return texte_video($f) . "\n\nJSON attendu :\n"
        . '{"titre_propre": "titre clair et honnête en français, sans majuscules criardes ni appât, 70 caractères max",'
        . '"langue": "code ISO 639-1 de la langue parlée (ou null)",'
        . '"orbite": "une valeur parmi ' . implode(', ', ORBITES) . '",'
        . '"ton": "une valeur parmi ' . implode(', ', TONS) . '",'
        . '"sujets": ["2 à 4 mots-clés en français"],'
        . '"actu_debat": true si la vidéo traite d\'actualité, de politique, de société ou d\'un sujet controversé,'
        . '"sans_son": true si on peut la comprendre sans le son (texte à l\'écran, visuel, sous-titres incrustés), false si la parole est indispensable, null si on ne sait pas,'
        . '"resume": "une seule phrase factuelle (25 mots max) qui dit ce que la vidéo montre vraiment, en français"}';
}

function nettoyer_analyse(array $j): array {
    $o = in_array($j['orbite'] ?? '', ORBITES, true) ? $j['orbite'] : null;
    $t = in_array($j['ton'] ?? '', TONS, true) ? $j['ton'] : null;
    $s = array_slice(array_values(array_filter(array_map(function ($x) { return is_string($x) ? mb_substr(trim($x), 0, 30) : ''; }, (array) ($j['sujets'] ?? array())))), 0, 4);
    return array(
        'titre_propre' => is_string($j['titre_propre'] ?? null) ? mb_substr(trim($j['titre_propre']), 0, 90) : null,
        'langue' => is_string($j['langue'] ?? null) && preg_match('/^[a-z]{2}$/', $j['langue']) ? $j['langue'] : null,
        'orbite' => $o, 'ton' => $t, 'sujets' => $s,
        'actu_debat' => ($j['actu_debat'] ?? null) === true,
        'sans_son' => is_bool($j['sans_son'] ?? null) ? $j['sans_son'] : null,
        'resume' => is_string($j['resume'] ?? null) ? mb_substr(trim($j['resume']), 0, 220) : null,
    );
}

/** Candidats envoyés par la page (catalogue + imports) : 60 max, titres courts. */
function candidats(array $corps, string $sauf): array {
    $l = array();
    foreach ((array) ($corps['candidats'] ?? array()) as $c) {
        $id = (string) ($c['id'] ?? ''); $ti = trim((string) ($c['titre'] ?? ''));
        if (!id_valide($id) || $id === $sauf || $ti === '') continue;
        $l[$id] = mb_substr($ti, 0, 110);
        if (count($l) >= 60) break;
    }
    return $l;
}

function recherche_youtube(string $requete): ?array {
    $cle = (string) (config_orbit()['youtube_cle'] ?? '');
    if ($cle === '' || !compter('recherche', 30, 90)) return null;   // 100 unités par recherche, 10 000 par jour
    $r = http('GET', 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=moderate&maxResults=1&relevanceLanguage=fr&q=' . rawurlencode($requete) . '&key=' . rawurlencode($cle));
    $it = $r['code'] === 200 ? (json_decode($r['corps'], true)['items'][0] ?? null) : null;
    $v = (string) ($it['id']['videoId'] ?? '');
    return preg_match('/^[A-Za-z0-9_-]{11}$/', $v) ? array('id' => 'yt:' . $v, 'titre' => html_entity_decode((string) ($it['snippet']['title'] ?? ''), ENT_QUOTES)) : null;
}

/* ───────────────────────────── routes ───────────────────────────── */

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (isset($_GET['sante'])) {
    repondre(200, array('ia' => (string) (config_ia()['cle'] ?? '') !== '', 'youtube_api' => (bool) (config_orbit()['youtube_cle'] ?? ''), 'gd' => function_exists('imagecreatefromstring')));
}

if (isset($_GET['miniature'])) {
    $id = (string) $_GET['miniature'];
    $f = id_valide($id) ? dossier('miniatures') . '/' . str_replace(':', '_', $id) . '.jpg' : '';
    if ($f === '' || !is_file($f)) { http_response_code(404); exit; }
    header('Content-Type: image/jpeg');
    header('Cache-Control: public, max-age=2592000, immutable');
    header('X-Content-Type-Options: nosniff');
    readfile($f);
    exit;
}

if (isset($_GET['meta'])) {
    $i = identifier((string) $_GET['meta']);
    if (!$i) repondre(422, array('erreur' => "Adresse non reconnue. ORBIT accepte les liens YouTube, TikTok, Instagram et Facebook."));
    $f = fiche($i['id'], (bool) $i['vertical'], (string) ($i['url'] ?? ''));
    repondre(200, array('fiche' => $f));
}

if (isset($_GET['metas'])) {
    $ids = array_slice(array_values(array_unique(array_filter(explode(',', (string) $_GET['metas']), 'id_valide'))), 0, 20);
    $vert = array_flip(array_filter(explode(',', (string) ($_GET['verticales'] ?? '')), 'id_valide'));
    $l = array();
    $debut = microtime(true);
    foreach ($ids as $id) {
        // Au-delà de 12 s, on rend ce qui est en cache : la page redemandera le reste.
        $l[] = fiche($id, isset($vert[$id]), '', microtime(true) - $debut < 12) ?? array('id' => $id, 'attente' => true);
    }
    repondre(200, array('fiches' => $l));
}

if ($methode === 'POST') {
    $brut = (string) file_get_contents('php://input', false, null, 0, 64 * 1024);
    $corps = json_decode($brut, true);
    if (!is_array($corps)) repondre(400, array('erreur' => 'Requête illisible.'));
    $action = (string) ($corps['action'] ?? '');
    $id = (string) ($corps['id'] ?? '');
    if (!id_valide($id)) repondre(400, array('erreur' => 'Vidéo inconnue.'));
    $f = fiche($id, false, '', false);
    if (!$f || empty($f['plateforme'])) $f = fiche($id);
    if (!$f || !empty($f['echec'])) repondre(404, array('erreur' => 'Vidéo introuvable ou retirée.'));
    $sansCle = (string) (config_ia()['cle'] ?? '') === '';

    if ($action === 'analyser') {
        $fc = fichier_cache('ia', $id);
        $c = lire_json($fc, array());
        if ($c) repondre(200, array('analyse' => $c, 'cache' => true));
        $consigne = array('systeme' => SYS_ANALYSE, 'prompt' => consigne_analyse($f));
        if ($sansCle) repondre(503, array('erreur' => "L'IA gratuite d'ORBIT n'est pas encore branchée.", 'consigne' => $consigne));
        if (!compter('ia', QUOTA_IA_IP, QUOTA_IA_TOTAL)) repondre(429, array('erreur' => "L'IA gratuite d'ORBIT a atteint sa limite du jour.", 'consigne' => $consigne));
        $r = ia_json($consigne['systeme'], $consigne['prompt']);
        if (!$r) repondre(503, array('erreur' => 'IA gratuite momentanément saturée.', 'sature' => true, 'consigne' => $consigne));
        $a = nettoyer_analyse($r[0]) + array('modele' => $r[1], 'source' => trim((string) ($f['description'] ?? '')) !== '' ? 'titre et description' : 'titre seul', 'date' => gmdate('Y-m-d'));
        ecrire_json($fc, $a);
        repondre(200, array('analyse' => $a));
    }

    if ($action === 'angle' || $action === 'plongee') {
        $cands = candidats($corps, $id);
        $cle = $action . '-' . substr(hash('sha256', implode('|', array_keys($cands))), 0, 12);
        $fc = fichier_cache($cle, $id);
        $c = lire_json($fc, array());
        if ($c && ($c['lu'] ?? 0) > time() - 7 * 86400) repondre(200, $c + array('cache' => true));
        $liste = '';
        foreach ($cands as $cid => $ti) $liste .= $cid . ' — ' . $ti . "\n";
        $sys = SYS_ANALYSE . " Pour choisir dans la liste, recopie exactement l'identifiant (ex. yt:abc). N'invente jamais d'identifiant.";
        if ($action === 'angle') {
            $prompt = texte_video($f) . "\n\nVidéos disponibles :\n" . ($liste ?: "(aucune)\n")
                . "\nTrouve une vidéo qui traite du MÊME sujet sous un AUTRE point de vue (opposé, critique ou complémentaire). JSON attendu :\n"
                . '{"angle": "en 1 phrase, le point de vue de la vidéo actuelle puis l\'autre point de vue à chercher", "id": "identifiant pris dans la liste, ou null si aucune ne convient", "recherche": "requête de recherche YouTube en français pour trouver l\'autre point de vue"}';
        } else {
            $prompt = texte_video($f) . "\n\nVidéos disponibles :\n" . ($liste ?: "(aucune)\n")
                . "\nCompose une plongée de 5 étapes sur le même sujet, de la plus accessible à la plus pointue. Pour chaque étape, prends une vidéo de la liste si elle convient vraiment, sinon null. JSON attendu :\n"
                . '{"sujet": "le sujet en 4 mots", "etapes": [{"niveau": 1, "titre": "ce qu\'on apprend à cette étape (8 mots max)", "id": "identifiant ou null", "recherche": "requête YouTube précise en français"}, … jusqu\'au niveau 5]}';
        }
        $consigne = array('systeme' => $sys, 'prompt' => $prompt);
        if ($sansCle) repondre(503, array('erreur' => "L'IA gratuite d'ORBIT n'est pas encore branchée.", 'consigne' => $consigne));
        if (!compter('ia', QUOTA_IA_IP, QUOTA_IA_TOTAL)) repondre(429, array('erreur' => "L'IA gratuite d'ORBIT a atteint sa limite du jour.", 'consigne' => $consigne));
        $r = ia_json($sys, $prompt, $action === 'plongee' ? 700 : 300);
        if (!$r) repondre(503, array('erreur' => 'IA gratuite momentanément saturée.', 'sature' => true, 'consigne' => $consigne));
        $j = $r[0];
        $verifier = function ($x) use ($cands) { $x = is_string($x) ? trim($x) : ''; return isset($cands[$x]) ? $x : null; };
        if ($action === 'angle') {
            $res = array('angle' => mb_substr((string) ($j['angle'] ?? ''), 0, 240), 'id' => $verifier($j['id'] ?? null), 'recherche' => mb_substr((string) ($j['recherche'] ?? ''), 0, 120));
            if (!$res['id'] && $res['recherche'] !== '' && ($t = recherche_youtube($res['recherche']))) $res['trouve'] = $t;
        } else {
            $etapes = array();
            foreach (array_slice((array) ($j['etapes'] ?? array()), 0, 5) as $n => $e) {
                if (!is_array($e)) continue;
                $et = array('niveau' => $n + 1, 'titre' => mb_substr((string) ($e['titre'] ?? ''), 0, 80), 'id' => $verifier($e['id'] ?? null), 'recherche' => mb_substr((string) ($e['recherche'] ?? ''), 0, 120));
                if (!$et['id'] && $et['recherche'] !== '' && ($t = recherche_youtube($et['recherche']))) $et['trouve'] = $t;
                $etapes[] = $et;
            }
            $res = array('sujet' => mb_substr((string) ($j['sujet'] ?? ''), 0, 60), 'etapes' => $etapes);
        }
        $res += array('modele' => $r[1], 'lu' => time());
        ecrire_json($fc, $res);
        repondre(200, $res);
    }
    repondre(400, array('erreur' => 'Action inconnue.'));
}

repondre(400, array('erreur' => 'Requête inconnue.'));
