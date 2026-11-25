<?php
/**
 * upload-guard.php — pare-feu d'upload des applis de créateurs, scanner statique, doublons et signalements citoyens.
 *
 *   POST multipart (connecté) : archive=<fichier.zip>, slug=<appli>, publier=0|1
 *        → { ok, raisons:[{code,fichier,ligne,detail}], fichiers, octets, sha256, structure, doublon }
 *          publier=1 enregistre l'empreinte SEULEMENT si tout est conforme (la validation reste manuelle).
 *   Ligne de commande (bac à sable, CI) : php upload-guard.php chemin.zip  → même verdict en JSON, code de sortie 0/1
 *   POST { action:"signaler", app_id, motif }  → 3 signalements d'utilisateurs DISTINCTS ⇒ statut paused_abuse + alerte admin
 *   GET  ?statut=<slug>                         → { statut: active | paused_abuse }
 *   POST { action:"reactiver", slug }  (admin)  → remet l'appli en ligne et efface ses signalements
 *
 * Pare-feu : 10 Mo DÉCOMPRESSÉS au total (compté en lisant réellement chaque fichier : un en-tête menteur ne passe pas),
 * 200 fichiers max, extensions exécutables/serveur refusées (même en double extension), liens symboliques, chemins
 * absolus, « ../ », antislash et octets nuls refusés.
 */
declare(strict_types=1);
require __DIR__ . '/finance-commun.php';

const G_MAX_OCTETS = 10 * 1024 * 1024;
const G_MAX_FICHIERS = 200;
const G_SEUIL_SIGNALEMENTS = 3;
const G_EXTENSIONS_INTERDITES = array('exe', 'sh', 'php', 'py', 'rb', 'bat', 'cmd', 'dll', 'so', 'bin', 'msi',
    'phtml', 'phar', 'php3', 'php4', 'php5', 'php7', 'php8', 'pht', 'cgi', 'pl', 'jar', 'com', 'scr', 'vbs', 'ps1', 'dylib', 'apk', 'htaccess', 'htpasswd', 'ini', 'zip', 'gz', 'tar', 'rar', '7z');
const G_EXTENSIONS_TEXTE = array('html', 'htm', 'js', 'mjs', 'cjs', 'css', 'json', 'svg', 'txt', 'md', 'xml', 'webmanifest', 'map', 'ts', 'jsx', 'tsx', 'vue');
const G_MOTIFS = array('illicite', 'arnaque', 'donnees', 'droits', 'contenu', 'bug', 'autre');

/** Règles du scanner statique : [code, motif PCRE, explication]. Toutes BLOQUANTES. */
function g_regles(): array {
    return array(
        array('sortie_cadre', '/\b(?:window\.)?top\.location\b|\bparent\.location\b|\bframeElement\b|\bwindow\.top\s*(?:\.|\[)|\bparent\.document\b/i', 'Tentative de sortir du cadre isolé (top/parent/frameElement).'),
        array('mineur_crypto', '/coinhive|cryptonight|coinimp|crypto-?loot|webminepool|minero\.cc|deepminer|xmrig|stratum\+(?:tcp|ssl)|randomx|monero(?:ocean)?|nicehash|webdollar/i', 'Mineur de cryptomonnaie.'),
        array('phishing_carte', '/autocomplete\s*=\s*["\']?cc-(?:number|csc|exp)|name\s*=\s*["\']?(?:card[_-]?number|numero[_-]?carte|cvv|cvc|cryptogramme)\b/i', 'Formulaire de carte bancaire : les paiements passent uniquement par Alphabette.'),
        array('phishing_identifiants', '/\A(?=[\s\S]*type\s*=\s*["\']?password)(?=[\s\S]*(?:(?:compte|connexion|identifiants?|mot de passe)\W+(?:\w+\W+){0,3}alphabette|alphabette\W+(?:\w+\W+){0,3}(?:compte|connexion|identifiants?|mot de passe)))/i', 'Demande des identifiants Alphabette.'),
        array('eval_obfusque', '/\b(?:eval|Function|setTimeout|setInterval)\s*\(\s*(?:atob|unescape|decodeURIComponent|String\.fromCharCode|escape)\s*\(|\bnew\s+Function\s*\(\s*atob|\beval\s*\(\s*(?:["\'][A-Za-z0-9+\/=]{80,}|_0x)/i', 'Code exécuté depuis un texte caché (eval/atob).'),
        array('exfiltration', '/(?:document\.cookie|JSON\.stringify\s*\(\s*localStorage|Object\.(?:keys|entries)\s*\(\s*localStorage|indexedDB\.databases)[\s\S]{0,600}(?:fetch\s*\(|sendBeacon|XMLHttpRequest|new\s+Image|\.src\s*=|WebSocket)|(?:fetch\s*\(|sendBeacon|new\s+Image\(\)\.src\s*=)[\s\S]{0,300}(?:document\.cookie|localStorage)/i', 'Envoi de cookies ou du stockage local vers l\'extérieur.'),
    );
}

/** Analyse une archive ZIP. Fonction pure (sans base) : utilisée par l'API, la CLI et les tests. */
function g_analyser_zip(string $chemin): array {
    $raisons = array();
    $ajouter = function (string $code, string $fichier, string $detail, int $ligne = 0) use (&$raisons) {
        if (count($raisons) < 100) $raisons[] = array('code' => $code, 'fichier' => $fichier, 'ligne' => $ligne, 'detail' => $detail);
    };
    $z = new ZipArchive();
    if ($z->open($chemin, ZipArchive::RDONLY) !== true) return array('ok' => false, 'raisons' => array(array('code' => 'archive_illisible', 'fichier' => '', 'ligne' => 0, 'detail' => 'Archive ZIP illisible.')));
    $n = $z->numFiles;
    if ($n > G_MAX_FICHIERS) { $z->close(); return array('ok' => false, 'raisons' => array(array('code' => 'trop_de_fichiers', 'fichier' => '', 'ligne' => 0, 'detail' => "$n fichiers (maximum " . G_MAX_FICHIERS . ').'))); }
    // 1er passage : tailles DÉCLARÉES (rejet immédiat d'une bombe annoncée).
    $declare = 0;
    for ($i = 0; $i < $n; $i++) { $s = $z->statIndex($i); $declare += (int) ($s['size'] ?? 0); }
    if ($declare > G_MAX_OCTETS) { $z->close(); return array('ok' => false, 'raisons' => array(array('code' => 'trop_gros', 'fichier' => '', 'ligne' => 0, 'detail' => 'Plus de 10 Mo une fois décompressé.'))); }

    $total = 0; $empreintes = array(); $chemins = array(); $regles = g_regles();
    for ($i = 0; $i < $n; $i++) {
        $s = $z->statIndex($i);
        $nom = (string) ($s['name'] ?? '');
        if ($nom === '' || strpos($nom, "\0") !== false || strpos($nom, '\\') !== false || $nom[0] === '/' || preg_match('#^[A-Za-z]:#', $nom) || preg_match('#(^|/)\.\.(/|$)#', $nom)) {
            $ajouter('chemin_interdit', $nom, 'Chemin dangereux (absolu, « ../ » ou antislash).'); continue;
        }
        $os = 0; $attr = 0;
        if ($z->getExternalAttributesIndex($i, $os, $attr) && $os === ZipArchive::OPSYS_UNIX && ((($attr >> 16) & 0170000) === 0120000)) {
            $ajouter('lien_symbolique', $nom, 'Lien symbolique refusé.'); continue;
        }
        if (substr($nom, -1) === '/') continue; // dossier
        $base = strtolower(basename($nom));
        $morceaux = explode('.', $base);
        array_shift($morceaux);
        foreach ($morceaux as $ext) if (in_array($ext, G_EXTENSIONS_INTERDITES, true)) { $ajouter('extension_interdite', $nom, "Extension « .$ext » refusée."); continue 2; }
        if ($base === '.htaccess' || $base === '.user.ini' || $base === 'web.config') { $ajouter('extension_interdite', $nom, 'Fichier de configuration serveur refusé.'); continue; }

        // Lecture RÉELLE en flux, plafonnée : protège contre les tailles déclarées mensongères.
        $f = $z->getStream($nom);
        if (!$f) { $ajouter('archive_illisible', $nom, 'Fichier illisible.'); continue; }
        $contenu = ''; $h = hash_init('sha256');
        while (!feof($f)) {
            $bloc = fread($f, 65536);
            if ($bloc === false) break;
            $total += strlen($bloc);
            if ($total > G_MAX_OCTETS) { fclose($f); $z->close(); return array('ok' => false, 'raisons' => array(array('code' => 'trop_gros', 'fichier' => $nom, 'ligne' => 0, 'detail' => 'Plus de 10 Mo une fois décompressé (bombe ZIP).'))); }
            hash_update($h, $bloc);
            if (strlen($contenu) < 3 * 1024 * 1024) $contenu .= $bloc;
        }
        fclose($f);
        $empreintes[$nom] = hash_final($h);
        $chemins[] = $nom;
        $ext = (string) end($morceaux);
        if ($ext === 'wasm' && preg_match('/cryptonight|randomx|xmrig|stratum|keccak.{0,40}hashrate/is', $contenu)) $ajouter('mineur_crypto', $nom, 'Module WebAssembly de minage.');
        if (in_array($ext, G_EXTENSIONS_TEXTE, true) || $ext === '') {
            if (strncmp($contenu, "\x7fELF", 4) === 0 || strncmp($contenu, 'MZ', 2) === 0 || strncmp($contenu, '#!', 2) === 0 || stripos(substr($contenu, 0, 4096), '<?php') !== false) {
                $ajouter('executable_deguise', $nom, 'Programme ou script serveur déguisé.'); continue;
            }
            foreach ($regles as $r) {
                if (preg_match($r[1], $contenu, $m, PREG_OFFSET_CAPTURE)) $ajouter($r[0], $nom, $r[2], substr_count(substr($contenu, 0, (int) $m[0][1]), "\n") + 1);
            }
            if (preg_match_all('/\\\\x[0-9a-f]{2}/i', $contenu) > 400 || preg_match('/atob\s*\(\s*["\'][A-Za-z0-9+\/=]{2000,}/', $contenu)) $ajouter('eval_obfusque', $nom, 'Code fortement obfusqué.');
        } elseif (strncmp($contenu, "\x7fELF", 4) === 0 || strncmp($contenu, 'MZ', 2) === 0) {
            $ajouter('executable_deguise', $nom, 'Programme exécutable déguisé.');
        }
    }
    $z->close();
    ksort($empreintes);
    $global = hash('sha256', json_encode($empreintes));
    sort($chemins);
    $structure = hash('sha256', implode("\n", $chemins));
    if (!$chemins) $ajouter('archive_vide', '', 'Archive vide.');
    return array('ok' => !$raisons, 'raisons' => $raisons, 'fichiers' => count($chemins), 'octets' => $total, 'sha256' => $global, 'structure' => $structure);
}

/* ───────────── ligne de commande ───────────── */
if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $v = g_analyser_zip((string) ($argv[1] ?? ''));
    echo json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), "\n";
    exit($v['ok'] ? 0 : 1);
}

f_entetes();
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($methode === 'GET' && isset($_GET['statut'])) {
    $slug = (string) $_GET['statut'];
    if (!preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', $slug)) f_erreur(400, 'Appli inconnue.');
    $q = f_db()->prepare('SELECT statut FROM applis WHERE slug = ?'); $q->execute(array($slug));
    f_repondre(200, array('slug' => $slug, 'statut' => $q->fetchColumn() ?: 'active'));
}
if ($methode !== 'POST') f_erreur(405, 'Méthode non permise.');

/* ───────────── upload d'archive ───────────── */
if (isset($_FILES['archive'])) {
    $c = f_compte_connecte();
    if (!f_limite('upload|' . (int) $c['id'], 30, 3600)) f_erreur(429, 'Trop d\'envois : réessayez dans une heure.');
    $slug = (string) ($_POST['slug'] ?? '');
    if (!preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', $slug)) f_erreur(400, 'Nom d\'appli invalide.');
    $f = $_FILES['archive'];
    if (!is_array($f) || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file((string) $f['tmp_name'])) f_erreur(400, 'Envoi incomplet.');
    if ((int) $f['size'] > G_MAX_OCTETS) f_erreur(413, 'Archive de plus de 10 Mo.');
    $v = g_analyser_zip((string) $f['tmp_name']);
    @unlink((string) $f['tmp_name']);
    $db = f_db();
    $v['doublon'] = null;
    if (isset($v['sha256'])) {
        $q = $db->prepare('SELECT app_slug FROM empreintes WHERE sha256 = ? AND app_slug != ? LIMIT 1'); $q->execute(array($v['sha256'], $slug));
        if ($a = $q->fetchColumn()) { $v['doublon'] = array('type' => 'identique', 'app' => $a); $v['ok'] = false; $v['raisons'][] = array('code' => 'doublon', 'fichier' => '', 'ligne' => 0, 'detail' => "Copie exacte de l'appli « $a »."); }
        else {
            $q = $db->prepare('SELECT app_slug FROM empreintes WHERE structure = ? AND app_slug != ? AND (compte_id IS NULL OR compte_id != ?) LIMIT 1'); $q->execute(array($v['structure'], $slug, (int) $c['id']));
            if ($a = $q->fetchColumn()) { $v['doublon'] = array('type' => 'structure', 'app' => $a); $v['ok'] = false; $v['raisons'][] = array('code' => 'doublon_structure', 'fichier' => '', 'ligne' => 0, 'detail' => "Même structure que l'appli « $a » d'un autre créateur : vérification manuelle."); }
        }
    }
    if ($v['ok'] && ($_POST['publier'] ?? '') === '1') {
        $db->prepare('INSERT INTO empreintes (app_slug, compte_id, sha256, structure, cree_le) VALUES (?, ?, ?, ?, ?) ON CONFLICT(app_slug) DO UPDATE SET sha256 = excluded.sha256, structure = excluded.structure, cree_le = excluded.cree_le WHERE empreintes.compte_id = excluded.compte_id')
            ->execute(array($slug, (int) $c['id'], $v['sha256'], $v['structure'], f_maintenant()));
        $v['enregistre'] = true;
        $v['validation'] = 'manuelle'; // requireManualValidation = true
    }
    f_repondre($v['ok'] ? 200 : 422, $v);
}

$e = f_corps();
$action = (string) ($e['action'] ?? '');

if ($action === 'signaler') {
    $slug = (string) ($e['app_id'] ?? '');
    if (!preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', $slug)) f_erreur(400, 'Appli inconnue.');
    $motif = in_array($e['motif'] ?? '', G_MOTIFS, true) ? (string) $e['motif'] : 'autre';
    // Une panne n'est pas un abus : « Elle ne marche pas » ne compte pas pour la mise en pause.
    if ($motif === 'bug') f_repondre(200, array('ok' => true, 'compte' => false));
    // Utilisateur distinct = compte connecté, sinon empreinte HMAC de la connexion (l'adresse IP n'est jamais écrite).
    $c = f_compte_connecte(false);
    $rapporteur = $c ? 'c:' . (int) $c['id'] : 'ip:' . f_empreinte_ip();
    if (!f_limite('signal|' . $rapporteur, 20, 86400)) f_erreur(429, 'Beaucoup de signalements aujourd\'hui.');
    $r = f_transaction(function (PDO $db) use ($slug, $motif, $rapporteur) {
        $t = f_maintenant();
        $db->prepare('INSERT OR IGNORE INTO signalements (app_slug, rapporteur, motif, cree_le) VALUES (?, ?, ?, ?)')->execute(array($slug, $rapporteur, $motif, $t));
        $q = $db->prepare('SELECT COUNT(DISTINCT rapporteur) FROM signalements WHERE app_slug = ?'); $q->execute(array($slug));
        $n = (int) $q->fetchColumn();
        $db->prepare("INSERT OR IGNORE INTO applis (slug, createur_id, statut, maj) VALUES (?, NULL, 'active', ?)")->execute(array($slug, $t));
        $q = $db->prepare('SELECT statut FROM applis WHERE slug = ?'); $q->execute(array($slug));
        $avant = (string) $q->fetchColumn();
        $bascule = false;
        if ($n >= G_SEUIL_SIGNALEMENTS && $avant !== 'paused_abuse') {
            $db->prepare("UPDATE applis SET statut = 'paused_abuse', maj = ? WHERE slug = ?")->execute(array($t, $slug));
            $bascule = true;
        }
        return array('n' => $n, 'bascule' => $bascule, 'statut' => $bascule ? 'paused_abuse' : $avant);
    });
    if ($r['bascule']) f_mail(ADMIN_EMAIL, '[Alphabette] URGENT — appli mise en pause : ' . $slug,
        "L'appli « $slug » a reçu {$r['n']} signalements d'utilisateurs distincts : elle est passée en paused_abuse.\nVérifier puis réactiver si besoin (upload-guard.php, action « reactiver »).");
    f_repondre(200, array('ok' => true, 'signalements' => $r['n'], 'statut' => $r['statut']));
}

if ($action === 'reactiver') {
    f_admin();
    $slug = (string) ($e['slug'] ?? '');
    f_transaction(function (PDO $db) use ($slug) {
        $db->prepare("UPDATE applis SET statut = 'active', maj = ? WHERE slug = ?")->execute(array(f_maintenant(), $slug));
        $db->prepare('DELETE FROM signalements WHERE app_slug = ?')->execute(array($slug));
    });
    f_repondre(200, array('ok' => true));
}

f_erreur(400, 'Action inconnue.');
