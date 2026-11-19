<?php
/**
 * IA Débat — « Mode Découverte » : un visiteur lance un débat sans aucune clé.
 *
 * Ce petit service tourne sur l'hébergement OVH (PHP). Il garde la clé OpenRouter
 * d'Alphabette HORS du dossier web (jamais envoyée au navigateur) et relaie les
 * répliques vers OpenRouter, qui sert les 6 IA (ChatGPT, Claude, Gemini, DeepSeek,
 * Mistral, Llama) avec une seule clé.
 *
 *   GET  ?etat                         → { actif, quota, debats_restants }
 *   POST { action:"debut", sujet }      → { ticket, debats_restants }   (compte 1 débat)
 *   POST { action:"generer", ticket, orateur, systeme, prompt, max_tokens, temperature, divers? }
 *                                       → { texte, modele, fournisseur }
 *   GET/POST ?installer                → installation de la clé (lien à jeton secret, connexion OpenRouter)
 *
 * Coûts maîtrisés : 3 débats par jour et par adresse IP, 40 répliques par débat,
 * 100 débats par jour au total, réponses plafonnées, modèles économiques choisis ici
 * (le navigateur ne choisit jamais le modèle). Vie privée : l'adresse IP n'est pas
 * gardée, seulement une empreinte qui change chaque jour (fichiers effacés après 2 jours).
 */
declare(strict_types=1);

const QUOTA_DEBATS_JOUR = 3;
const APPELS_PAR_DEBAT = 40;
const QUOTA_DIVERS_JOUR = 6;            // sujets suggérés, etc. hors débat
const PLAFOND_DEBATS_TOTAL_JOUR = 100;  // garde-fou global du budget
const MAX_TOKENS = 2000;
const MAX_CARACTERES = 24000;
const PRIX_MAX_ENTREE = 0.000003;       // $ par jeton (3 $ le million) : gammes économiques seulement
const PRIX_MAX_SORTIE = 0.000015;       // $ par jeton (15 $ le million)
// Empreinte SHA-256 du jeton d'installation (le jeton lui-même n'est pas dans le code).
const JETON_INSTALLATION_SHA256 = '17e8513a89b4be4701678fdbe93d16a267834aea2a4b0a1ed9920a57914eb4e5';

define('OPENROUTER', rtrim(getenv('IADEBAT_OPENROUTER_BASE') ?: 'https://openrouter.ai', '/'));

const ORATEURS = array(
    'chatgpt'  => array('prefixe' => 'openai/',    'nom' => 'ChatGPT',  'fournisseur' => 'openai',    'gammes' => array('/-mini/', '/^openai\/gpt-[0-9.]+$/', '/./')),
    'claude'   => array('prefixe' => 'anthropic/', 'nom' => 'Claude',   'fournisseur' => 'anthropic', 'gammes' => array('/haiku/', '/sonnet/')),
    'gemini'   => array('prefixe' => 'google/',    'nom' => 'Gemini',   'fournisseur' => 'gemini',    'gammes' => array('/flash(?!-lite)/', '/flash-lite/', '/./')),
    'deepseek' => array('prefixe' => 'deepseek/',  'nom' => 'DeepSeek', 'fournisseur' => 'deepseek',  'gammes' => array('/deepseek-chat/', '/v[0-9]/', '/./')),
    'mistral'  => array('prefixe' => 'mistralai/', 'nom' => 'Mistral',  'fournisseur' => 'mistral',   'gammes' => array('/mistral-small/', '/mistral-medium/', '/./')),
    'llama'    => array('prefixe' => 'meta-llama/', 'nom' => 'Llama',   'fournisseur' => 'llama',     'gammes' => array('/llama-4-scout/', '/llama-3\.3-70b/', '/70b/', '/./')),
);
const EXCLUS = '/(:free|:batch|:extended|:beta|:thinking|:online|omni|image|vision|audio|search|online|guard|embed|tts|realtime|preview|exp-|codex|oss|gemma|codestral|devstral|pixtral|distill|prover|nano|deep-research)/i';

/* ───────────────────────────── utilitaires ───────────────────────────── */

function repondre(int $code, array $d): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function dossier(): string {
    $maison = getenv('HOME') ?: dirname((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__));
    $d = rtrim($maison, '/') . '/alphabette-iadebat';
    if (!is_dir($d)) @mkdir($d, 0700, true);
    if (!is_dir($d) || !is_writable($d)) repondre(503, array('erreur' => 'Le Mode Découverte est indisponible pour le moment.'));
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

/** Lecture + écriture sous verrou exclusif. */
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

function config(): array { return lire_json(dossier() . '/config.json', array()); }

function b64url(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }

function ip_visiteur(): string {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    // Derrière un relais interne seulement, on prend l'adresse transmise.
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        $fw = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0]);
        if (filter_var($fw, FILTER_VALIDATE_IP)) $ip = $fw;
    }
    return $ip;
}

/** Empreinte de l'adresse IP, valable un jour (l'adresse elle-même n'est jamais écrite). */
function empreinte(array $cfg, string $jour): string {
    return substr(hash_hmac('sha256', ip_visiteur() . '|' . $jour, (string) $cfg['secret']), 0, 20);
}

function fichier_jour(string $jour): string {
    $d = dossier();
    // Ménage : on ne garde que les 2 derniers jours.
    foreach (glob($d . '/quotas-*.json') ?: array() as $f) {
        if (filemtime($f) < time() - 2 * 86400) { @unlink($f); @unlink($f . '.lock'); }
    }
    return $d . '/quotas-' . $jour . '.json';
}

function signer(array $cfg, string $donnees): string { return b64url(hash_hmac('sha256', $donnees, (string) $cfg['secret'], true)); }

/* ───────────────────────────── choix des modèles ───────────────────────────── */

function catalogue(): array {
    $f = dossier() . '/modeles.json';
    $c = lire_json($f, array());
    if (!empty($c['modeles']) && ($c['lu'] ?? 0) > time() - 6 * 3600) return $c['modeles'];
    $r = http('GET', OPENROUTER . '/api/v1/models', null, array());
    $liste = array();
    if ($r['code'] === 200) {
        foreach ((json_decode($r['corps'], true)['data'] ?? array()) as $m) {
            if (!isset($m['id'])) continue;
            $sorties = $m['architecture']['output_modalities'] ?? array('text');
            if (!in_array('text', $sorties, true)) continue;
            $liste[] = array(
                'id' => (string) $m['id'],
                'cree' => (int) ($m['created'] ?? 0),
                'entree' => (float) ($m['pricing']['prompt'] ?? 1),
                'sortie' => (float) ($m['pricing']['completion'] ?? 1),
            );
        }
    }
    if ($liste) ecrire_json($f, array('lu' => time(), 'modeles' => $liste));
    return $liste ?: ($c['modeles'] ?? array());
}

/** Modèles d'un orateur, du plus adapté au moins adapté. $gratuits : seulement les « :free ». */
function modeles_pour(string $orateur, bool $gratuits): array {
    $o = ORATEURS[$orateur];
    $candidats = array();
    foreach (catalogue() as $m) {
        if (strpos($m['id'], $o['prefixe']) !== 0) continue;
        if ($gratuits) {
            if (substr($m['id'], -5) !== ':free') continue;
            if (preg_match(str_replace(':free|', '', EXCLUS), substr($m['id'], 0, -5))) continue;
        } else {
            if (preg_match(EXCLUS, $m['id'])) continue;
            if ($m['entree'] <= 0 || $m['entree'] > PRIX_MAX_ENTREE || $m['sortie'] > PRIX_MAX_SORTIE) continue;
        }
        $rang = count($o['gammes']);
        foreach ($o['gammes'] as $i => $g) { if (preg_match($g, $m['id'])) { $rang = $i; break; } }
        $m['rang'] = $rang;
        $candidats[] = $m;
    }
    usort($candidats, function ($a, $b) { return $a['rang'] <=> $b['rang'] ?: $b['cree'] <=> $a['cree']; });
    return array_map(function ($m) { return $m['id']; }, $candidats);
}

/** Secours : un modèle économique d'un autre fournisseur, si celui de l'orateur est saturé. */
function secours(string $orateur, bool $gratuits): array {
    $ids = array();
    foreach (array('deepseek', 'gemini', 'mistral', 'chatgpt') as $autre) {
        if ($autre === $orateur) continue;
        $l = modeles_pour($autre, $gratuits);
        if ($l) $ids[] = $l[0];
        if (count($ids) >= 2) break;
    }
    // Aucun modèle gratuit chez nos 6 fournisseurs : routeur gratuit d'OpenRouter (la réplique dit lequel a écrit).
    if ($gratuits && !$ids) $ids[] = 'openrouter/free';
    return $ids;
}

/* ───────────────────────────── appel OpenRouter ───────────────────────────── */

function http(string $methode, string $url, ?array $corps, array $entetes): array {
    $c = curl_init($url);
    $h = array('Accept: application/json');
    foreach ($entetes as $k => $v) $h[] = $k . ': ' . $v;
    if ($corps !== null) $h[] = 'Content-Type: application/json';
    curl_setopt_array($c, array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $methode,
        CURLOPT_HTTPHEADER => $h,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CONNECTTIMEOUT => 10,
    ));
    if ($corps !== null) curl_setopt($c, CURLOPT_POSTFIELDS, json_encode($corps, JSON_UNESCAPED_UNICODE));
    $r = curl_exec($c);
    $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    return array('code' => $code, 'corps' => is_string($r) ? $r : '');
}

function message_erreur(string $corps): string {
    $d = json_decode($corps, true);
    $m = $d['error']['message'] ?? $d['message'] ?? $corps;
    return mb_substr(preg_replace('/\s+/', ' ', (string) $m), 0, 160);
}

/** Essaie les modèles dans l'ordre ; bascule sur 429 / 5xx / modèle introuvable ; 402 (plus de crédit) → modèles gratuits. */
function generer(array $cfg, string $orateur, string $systeme, string $prompt, int $maxTokens, float $temperature): array {
    $gratuits = false;
    for ($passe = 0; $passe < 2; $passe++) {
        $liste = array_values(array_unique(array_merge(array_slice(modeles_pour($orateur, $gratuits), 0, 2), secours($orateur, $gratuits))));
        if (!$liste) break;
        $derniere = '';
        foreach ($liste as $i => $modele) {
            $corps = array(
                'model' => $modele,
                'models' => array_slice($liste, $i, 3),   // secours automatique côté OpenRouter
                'messages' => array(array('role' => 'system', 'content' => $systeme), array('role' => 'user', 'content' => $prompt)),
                'max_tokens' => $maxTokens,
                'temperature' => $temperature,
            );
            if (!$gratuits) $corps['provider'] = array('data_collection' => 'deny', 'allow_fallbacks' => true);
            $r = http('POST', OPENROUTER . '/api/v1/chat/completions', $corps, array(
                'Authorization' => 'Bearer ' . $cfg['cle'],
                'HTTP-Referer' => 'https://alphabette.eu/apps/iadebat/',
                'X-Title' => 'IA Debat - Alphabette',
            ));
            if ($r['code'] === 200) {
                $d = json_decode($r['corps'], true);
                $texte = (string) ($d['choices'][0]['message']['content'] ?? '');
                if (trim($texte) !== '') {
                    $utilise = (string) ($d['model'] ?? $modele);
                    return array('texte' => $texte, 'modele' => $utilise, 'fournisseur' => fournisseur_de($utilise), 'gratuit' => $gratuits);
                }
                $derniere = 'réponse vide';
                continue;
            }
            $derniere = message_erreur($r['corps']);
            if ($r['code'] === 402) break;                         // plus de crédit : passe aux gratuits
            if ($r['code'] === 401 || $r['code'] === 403) repondre(503, array('erreur' => 'Le Mode Découverte est en maintenance. Connectez OpenRouter ou ajoutez votre clé (Mode Expert).'));
            // 429, 5xx, 404, 400 « model » : modèle suivant
        }
        if (isset($r) && $r['code'] !== 402) break;
        $gratuits = true;
    }
    repondre(502, array('erreur' => ORATEURS[$orateur]['nom'] . ' est momentanément indisponible (' . ($derniere ?? 'aucun modèle') . '). Réessayez dans un instant.'));
}

function fournisseur_de(string $modele): string {
    foreach (ORATEURS as $o) { if (strpos($modele, $o['prefixe']) === 0) return $o['fournisseur']; }
    return explode('/', $modele)[0];
}

/* ───────────────────────────── installation de la clé ───────────────────────────── */

// OpenRouter renvoie sur l'adresse de retour SANS « ?installer » (il remplace la requête par ?code=…).
if (isset($_GET['installer']) || (isset($_GET['code']) && ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET')) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $e = json_decode((string) file_get_contents('php://input'), true) ?: array();
        $jeton = (string) ($e['jeton'] ?? '');
        $cle = trim((string) ($e['cle'] ?? ''));
        if (!hash_equals(JETON_INSTALLATION_SHA256, hash('sha256', $jeton))) repondre(403, array('erreur' => 'Lien d\'installation invalide.'));
        if (!preg_match('/^sk-or-[A-Za-z0-9_-]{20,}$/', $cle)) repondre(400, array('erreur' => 'Clé OpenRouter invalide.'));
        $test = http('GET', OPENROUTER . '/api/v1/key', null, array('Authorization' => 'Bearer ' . $cle));
        if ($test['code'] !== 200) repondre(400, array('erreur' => 'OpenRouter refuse cette clé (' . $test['code'] . ').'));
        $cfg = config();
        $cfg['cle'] = $cle;
        $cfg['secret'] = $cfg['secret'] ?? b64url(random_bytes(32));
        $cfg['installee'] = gmdate('c');
        ecrire_json(dossier() . '/config.json', $cfg);
        $info = json_decode($test['corps'], true)['data'] ?? array();
        repondre(200, array('ok' => true, 'credit_limite' => $info['limit'] ?? null, 'gratuit' => $info['is_free_tier'] ?? null));
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://openrouter.ai");
    $installee = !empty(config()['cle']);
    ?><!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>IA Débat — installer le Mode Découverte</title>
<style>body{font:18px/1.5 system-ui,sans-serif;background:#0e0e12;color:#e5e7eb;max-width:560px;margin:40px auto;padding:0 16px}button{font:inherit;font-weight:700;background:#00f5c4;color:#000;border:0;border-radius:10px;padding:14px 20px;min-height:48px;cursor:pointer}#m{margin-top:20px}</style></head>
<body><h1>Mode Découverte d'IA Débat</h1>
<p><?= $installee ? 'Une clé est déjà installée. Vous pouvez la remplacer.' : 'Aucune clé installée pour l\'instant.' ?></p>
<p>Le bouton vous envoie sur OpenRouter pour autoriser une clé. Elle sera rangée sur le serveur d'Alphabette, hors du site, et ne sera jamais visible des visiteurs.</p>
<button id="b">Connecter OpenRouter</button><p id="m" role="status"></p>
<script>
(async () => {
  const m = document.getElementById('m');
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const jetonUrl = new URLSearchParams(location.hash.slice(1)).get('jeton');
  if (jetonUrl) { sessionStorage.setItem('iad_jeton', jetonUrl); history.replaceState(null, '', location.pathname + '?installer'); }
  const code = new URLSearchParams(location.search).get('code');
  if (code) {
    m.textContent = 'Installation…';
    try {
      const r = await fetch('https://openrouter.ai/api/v1/auth/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: sessionStorage.getItem('iad_verif'), code_challenge_method: 'S256' }) });
      const d = await r.json();
      if (!d.key) throw new Error(d.error?.message || 'OpenRouter n\'a pas donné de clé.');
      const s = await fetch(location.pathname + '?installer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jeton: sessionStorage.getItem('iad_jeton'), cle: d.key }) });
      const t = await s.json();
      if (!s.ok) throw new Error(t.erreur);
      sessionStorage.clear();
      history.replaceState(null, '', location.pathname + '?installer');
      m.textContent = '✅ Mode Découverte installé. Les visiteurs peuvent débattre sans clé.';
    } catch (e) { m.textContent = '❌ ' + e.message; }
  }
  document.getElementById('b').onclick = async () => {
    if (!sessionStorage.getItem('iad_jeton')) { m.textContent = '❌ Ouvrez le lien d\'installation complet (avec #jeton=…).'; return; }
    const v = b64(crypto.getRandomValues(new Uint8Array(32)));
    sessionStorage.setItem('iad_verif', v);
    const defi = b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
    location.href = 'https://openrouter.ai/auth?callback_url=' + encodeURIComponent(location.origin + location.pathname + '?installer') +
      '&code_challenge=' + defi + '&code_challenge_method=S256&key_label=' + encodeURIComponent('IA Débat - Mode Découverte');
  };
})();
</script></body></html><?php
    exit;
}

/* ───────────────────────────── service ───────────────────────────── */

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$origine = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if (preg_match('#^https://([a-z0-9-]+\.)?alphabette\.(fr|eu)$#', $origine)) {
    header('Access-Control-Allow-Origin: ' . $origine);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') repondre(204, array());

$cfg = config();
$actif = !empty($cfg['cle']) && !empty($cfg['secret']);
$jour = gmdate('Y-m-d');

if (isset($_GET['etat'])) {
    if (!$actif) repondre(200, array('actif' => false, 'quota' => QUOTA_DEBATS_JOUR, 'debats_restants' => 0));
    $q = lire_json(fichier_jour($jour), array());
    $n = (int) ($q['ip'][empreinte($cfg, $jour)]['debats'] ?? 0);
    repondre(200, array('actif' => true, 'quota' => QUOTA_DEBATS_JOUR, 'debats_restants' => max(0, QUOTA_DEBATS_JOUR - $n)));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') repondre(405, array('erreur' => 'Méthode non prise en charge.'));
if (!$actif) repondre(503, array('erreur' => 'Le Mode Découverte n\'est pas encore ouvert. Connectez OpenRouter ou ajoutez votre clé (Mode Expert).', 'inactif' => true));

$e = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($e)) repondre(400, array('erreur' => 'Demande illisible.'));
$action = (string) ($e['action'] ?? '');
$ip = empreinte($cfg, $jour);
$fichier = fichier_jour($jour);
$MSG_QUOTA = 'Vous avez utilisé vos ' . QUOTA_DEBATS_JOUR . ' débats gratuits du jour. Pour continuer : « Se connecter avec OpenRouter » (1 clic) ou vos clés en Mode Expert. Nouveaux débats gratuits demain.';

if ($action === 'debut') {
    $res = modifier($fichier, function (&$q) use ($ip) {
        $n = (int) ($q['ip'][$ip]['debats'] ?? 0);
        if ($n >= QUOTA_DEBATS_JOUR) return array('refus' => 'quota');
        if ((int) ($q['total'] ?? 0) >= PLAFOND_DEBATS_TOTAL_JOUR) return array('refus' => 'plafond');
        $q['ip'][$ip]['debats'] = $n + 1;
        $q['total'] = (int) ($q['total'] ?? 0) + 1;
        return array('restants' => QUOTA_DEBATS_JOUR - $n - 1);
    });
    if (($res['refus'] ?? '') === 'quota') repondre(429, array('erreur' => $MSG_QUOTA, 'quota' => true, 'debats_restants' => 0));
    if (($res['refus'] ?? '') === 'plafond') repondre(429, array('erreur' => 'Le Mode Découverte est très demandé aujourd\'hui : réessayez demain, ou connectez OpenRouter en 1 clic.', 'quota' => true));
    $donnees = b64url(json_encode(array('j' => $jour, 'h' => $ip, 'n' => b64url(random_bytes(9)))));
    repondre(200, array('ticket' => $donnees . '.' . signer($cfg, $donnees), 'debats_restants' => $res['restants']));
}

if ($action === 'generer') {
    $orateur = (string) ($e['orateur'] ?? '');
    if (!isset(ORATEURS[$orateur])) repondre(400, array('erreur' => 'IA inconnue.'));
    $systeme = mb_substr((string) ($e['systeme'] ?? ''), 0, 4000);
    $prompt = mb_substr((string) ($e['prompt'] ?? ''), 0, MAX_CARACTERES);
    if (trim($prompt) === '') repondre(400, array('erreur' => 'Demande vide.'));
    $maxTokens = max(50, min(MAX_TOKENS, (int) ($e['max_tokens'] ?? 700)));
    $temperature = max(0.0, min(1.2, (float) ($e['temperature'] ?? 0.8)));

    $ticket = (string) ($e['ticket'] ?? '');
    $divers = !empty($e['divers']);
    $refus = '';
    if ($ticket !== '') {
        $p = explode('.', $ticket);
        $t = count($p) === 2 && hash_equals(signer($cfg, $p[0]), $p[1]) ? json_decode(base64_decode(strtr($p[0], '-_', '+/')), true) : null;
        if (!is_array($t) || ($t['j'] ?? '') !== $jour || ($t['h'] ?? '') !== $ip) repondre(401, array('erreur' => 'Ticket expiré.', 'ticket' => true));
        $refus = modifier($fichier, function (&$q) use ($t) {
            $n = (int) ($q['tickets'][$t['n']] ?? 0);
            if ($n >= APPELS_PAR_DEBAT) return 'debat';
            $q['tickets'][$t['n']] = $n + 1;
            return '';
        });
        if ($refus === 'debat') repondre(429, array('erreur' => 'Ce débat gratuit a atteint sa longueur maximale (' . APPELS_PAR_DEBAT . ' répliques). Lancez un nouveau débat, ou connectez OpenRouter pour continuer sans limite.', 'quota' => true, 'fin_debat' => true));
    } elseif ($divers) {
        $refus = modifier($fichier, function (&$q) use ($ip) {
            $n = (int) ($q['ip'][$ip]['divers'] ?? 0);
            if ($n >= QUOTA_DIVERS_JOUR) return 'divers';
            $q['ip'][$ip]['divers'] = $n + 1;
            return '';
        });
        if ($refus) repondre(429, array('erreur' => $MSG_QUOTA, 'quota' => true));
    } else {
        repondre(401, array('erreur' => 'Ticket manquant.', 'ticket' => true));
    }
    repondre(200, generer($cfg, $orateur, $systeme, $prompt, $maxTokens, $temperature));
}

repondre(400, array('erreur' => 'Action inconnue.'));
