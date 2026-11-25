<?php
/**
 * carte.php — Cartes « application offerte » à usage unique (QR code imprimé).
 *   GET  ?c=XXXX-XXXX-XXXX[&s=<lieu>]  → page de validation (valide / déjà utilisée / inconnue).
 *                                         Deuxième scan par la même personne : « Votre appli vous attend » (cookie ou même empreinte).
 *   POST c, email?, prenom?, mur?      → active la carte (une seule fois, atomique). Prénom publié SEULEMENT si la case « mur » est cochée.
 *   GET  ?ami=<jeton>                  → défi « 3 amis » : page d'accueil d'un ami invité (POST email → compté une fois par e-mail).
 *   GET  ?mur[&json]                   → mur de remerciements public (prénoms consentis, modérés).
 *   GET  ?admin | ?export  (X-Admin-Password) → totaux, par lieu (libellé), scans, défis, liste ; CSV.
 *   POST ?admin  (X-Admin-Password, JSON) action = libelle {lot, libelle} | masquer {lot, numero, masque} | livrer {lot, numero}
 * Les codes imprimés ne sont JAMAIS stockés : seule leur empreinte SHA-256 (data/private/cartes-hashes.txt) est connue du serveur.
 * Source d'un scan : ?s=<lieu> (a-z, 0-9, tiret) sinon « lot-N ». Aucun traceur : compteurs par jour, sans IP ni identifiant.
 * Défi : 3 amis distincts (e-mail) → 2ᵉ appli offerte (statut défi validé + e-mail à l'administrateur ; remise manuelle).
 */
declare(strict_types=1);
require __DIR__ . '/finance-commun.php';

const K_AMIS_REQUIS = 3;

function k_db(): PDO {
    static $pret = false;
    $db = f_db();
    if ($pret) return $db;
    $db->exec('CREATE TABLE IF NOT EXISTS cartes_offre (
      code_hash TEXT PRIMARY KEY, lot INTEGER NOT NULL, numero INTEGER NOT NULL, app TEXT NOT NULL,
      utilise_le INTEGER, empreinte TEXT, email TEXT)');
    $existantes = array();
    foreach ($db->query('PRAGMA table_info(cartes_offre)')->fetchAll() as $col) $existantes[] = $col['name'];
    foreach (array('prenom TEXT', 'mur INTEGER NOT NULL DEFAULT 0', 'masque INTEGER NOT NULL DEFAULT 0', 'source TEXT', 'jeton TEXT',
                   'defi_le INTEGER', 'defi_livre_le INTEGER') as $def) {
        if (!in_array(explode(' ', $def)[0], $existantes, true)) $db->exec('ALTER TABLE cartes_offre ADD COLUMN ' . $def);
    }
    $db->exec('CREATE TABLE IF NOT EXISTS cartes_lots (lot INTEGER PRIMARY KEY, libelle TEXT NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS cartes_scans (source TEXT NOT NULL, jour TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (source, jour))');
    $db->exec('CREATE TABLE IF NOT EXISTS cartes_amis (
      jeton TEXT NOT NULL, email_hash TEXT NOT NULL, empreinte TEXT NOT NULL, cree_le INTEGER NOT NULL, PRIMARY KEY (jeton, email_hash))');
    $fichier = __DIR__ . '/../data/private/cartes-hashes.txt';
    if (is_file($fichier) && (int) $db->query('SELECT COUNT(*) FROM cartes_offre')->fetchColumn() === 0) {
        $db->beginTransaction();
        $q = $db->prepare('INSERT OR IGNORE INTO cartes_offre (code_hash, lot, numero, app) VALUES (?, ?, ?, ?)');
        foreach (file($fichier, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: array() as $l) {
            $p = explode(';', trim($l));
            if (count($p) === 4 && preg_match('/^[a-f0-9]{64}$/', $p[0])) $q->execute(array($p[0], (int) $p[1], (int) $p[2], $p[3]));
        }
        $db->commit();
    }
    $pret = true;
    return $db;
}
function k_norm(string $c): string { return strtoupper(preg_replace('/[^A-Z0-9]/i', '', $c) ?? ''); }
function k_hash(string $c): string { return hash('sha256', 'carte|' . k_norm($c)); }
function k_jeton(string $codeHash): string { return substr(f_hmac('ami|' . $codeHash), 0, 20); }
function k_cookie(string $codeHash): string { return substr(f_hmac('ck|' . $codeHash), 0, 24); }
function k_source(int $lot): string {
    $s = strtolower((string) ($_GET['s'] ?? ''));
    return preg_match('/^[a-z0-9][a-z0-9-]{0,29}$/', $s) ? $s : 'lot-' . $lot;
}
function k_h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function k_prenom_valide(string $p): bool { return (bool) preg_match('/^\p{L}[\p{L}\'’ -]{0,19}$/u', $p); }

function k_page(string $titre, string $corps, int $code = 200, string $script = ''): void {
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
       . '<title>' . k_h($titre) . '</title><style>'
       . 'body{margin:0;font:18px/1.6 system-ui,sans-serif;background:#f8fafc;color:#0f172a}header{background:#182334;color:#fff;padding:12px 16px;font-weight:700}'
       . 'main{max-width:520px;margin:6vh auto;padding:0 16px}.c{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center}'
       . 'h1{font-size:26px;margin:0 0 8px}.ok{color:#047857}.ko{color:#b91c1c}input[type=email],input[type=text]{width:100%;box-sizing:border-box;font:inherit;padding:12px;border:1px solid #94a3b8;border-radius:10px;margin:8px 0}'
       . 'button,a.b{display:inline-block;font:inherit;font-weight:700;background:#4338ca;color:#fff;border:0;border-radius:12px;padding:14px 22px;text-decoration:none;cursor:pointer;min-height:44px;margin:6px 0}'
       . 'button.s,a.s{background:#fff;color:#4338ca;border:2px solid #4338ca}.code{font:700 22px ui-monospace,monospace;letter-spacing:.08em;background:#f1f5f9;border-radius:10px;padding:8px;margin:12px 0}'
       . 'small{color:#475569}label.case{display:flex;gap:10px;text-align:left;align-items:flex-start;margin:10px 0}label.case input{width:24px;height:24px;flex:none}'
       . '.jauge{display:flex;gap:8px;justify-content:center;margin:10px 0}.jauge span{width:44px;height:44px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:22px}.jauge span.on{background:#047857;color:#fff}'
       . '.mur{list-style:none;padding:0;text-align:left}.mur li{padding:8px 0;border-bottom:1px solid #e2e8f0}'
       . '</style></head><body><header>alphabette</header><main><div class="c">' . $corps . '</div></main>' . $script . '</body></html>';
    exit;
}

/** Bloc « défi des 3 amis » (jauge + lien à partager) pour la personne qui a activé sa carte. */
function k_bloc_defi(PDO $db, string $jeton, ?int $defiLe): string {
    $q = $db->prepare('SELECT COUNT(*) FROM cartes_amis WHERE jeton = ?');
    $q->execute(array($jeton));
    $n = (int) $q->fetchColumn();
    $lien = 'https://alphabette.eu/api/carte.php?ami=' . $jeton;
    $jauge = '<div class="jauge" aria-label="' . $n . ' ami(s) sur ' . K_AMIS_REQUIS . '">';
    for ($i = 1; $i <= K_AMIS_REQUIS; $i++) $jauge .= '<span class="' . ($i <= $n ? 'on' : '') . '">' . ($i <= $n ? '✓' : $i) . '</span>';
    $jauge .= '</div>';
    $titre = $defiLe !== null
        ? '<p class="ok"><strong>🎉 Défi réussi : une 2ᵉ appli vous est offerte.</strong><br><small>Nous vous écrivons pour la choisir si vous avez laissé votre e-mail.</small></p>'
        : '<p><strong>Défi d\'équipe :</strong> faites activer ' . K_AMIS_REQUIS . ' amis et gagnez une 2ᵉ appli.<br><small>' . $n . ' / ' . K_AMIS_REQUIS . ' amis pour l\'instant.</small></p>';
    return '<hr style="border:0;border-top:1px solid #e2e8f0;margin:18px 0">' . $titre . $jauge
        . '<div class="code" style="font-size:14px;word-break:break-all" id="lienami">' . k_h($lien) . '</div>'
        . '<button type="button" class="s" id="copier">Copier le lien à envoyer à mes amis</button>';
}
function k_script_defi(): string {
    return '<script>(function(){var b=document.getElementById("copier");if(!b)return;b.onclick=function(){var t=document.getElementById("lienami").textContent;'
        . 'if(navigator.share){navigator.share({title:"Une appli offerte",text:"Activez votre appli offerte Alphabette :",url:t}).catch(function(){})}'
        . 'else if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){b.textContent="Lien copié ✓"})}};})();</script>';
}
/** Script du visuel « story » (canvas 1080×1920, généré dans le navigateur, sans donnée personnelle). */
function k_script_story(string $app): string {
    $nom = json_encode($app, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
    return '<script>(function(){var b=document.getElementById("story");if(!b)return;var nom=' . $nom . ';'
        . 'b.onclick=function(){var c=document.createElement("canvas");c.width=1080;c.height=1920;var x=c.getContext("2d");'
        . 'var g=x.createLinearGradient(0,0,1080,1920);g.addColorStop(0,"#4338ca");g.addColorStop(1,"#db2777");x.fillStyle=g;x.fillRect(0,0,1080,1920);'
        . 'x.fillStyle="#fff";x.textAlign="center";x.font="200px sans-serif";x.fillText("🎁",540,520);'
        . 'x.font="bold 84px sans-serif";x.fillText("J’ai reçu une appli",540,760);x.fillText("offerte !",540,870);'
        . 'x.font="bold 110px sans-serif";var mots=nom.split(" "),l="",y=1130;mots.forEach(function(m){var t=l?l+" "+m:m;if(x.measureText(t).width>900&&l){x.fillText(l,540,y);y+=130;l=m}else l=t});x.fillText(l,540,y);'
        . 'x.font="56px sans-serif";x.fillText("Et vous ? Scannez, c’est offert.",540,1560);'
        . 'x.font="bold 72px sans-serif";x.fillText("alphabette.fr",540,1740);'
        . 'c.toBlob(function(bl){var f=new File([bl],"appli-offerte.png",{type:"image/png"});'
        . 'if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:"Appli offerte"}).catch(function(){})}'
        . 'else{var a=document.createElement("a");a.href=URL.createObjectURL(bl);a.download="appli-offerte.png";a.click()}},"image/png")};})();</script>';
}
function k_fiche_activee(PDO $db, array $carte, string $codeHash, string $intro): void {
    $app = k_h((string) $carte['app']);
    $jeton = (string) ($carte['jeton'] ?: k_jeton($codeHash));
    k_page('Application offerte',
        $intro . '<p><a class="b" href="https://alphabette.fr">Ouvrir Alphabette</a></p>'
        . '<button type="button" class="s" id="story">📸 Créer mon visuel pour ma story</button>'
        . k_bloc_defi($db, $jeton, $carte['defi_le'] !== null ? (int) $carte['defi_le'] : null)
        . '<p><small><a href="?mur">Voir le mur de remerciements</a></small></p>',
        200, k_script_story((string) $carte['app']) . k_script_defi());
}

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* ─────────────── administration ─────────────── */
if (isset($_GET['admin']) || isset($_GET['export'])) {
    header('Cache-Control: no-store');
    f_admin();
    $db = k_db();
    if ($methode === 'POST') {
        $e = f_corps();
        $a = (string) ($e['action'] ?? '');
        $lot = (int) ($e['lot'] ?? 0);
        if ($a === 'libelle') {
            $lib = trim(mb_substr((string) ($e['libelle'] ?? ''), 0, 60, 'UTF-8'));
            if ($lot < 1 || $lib === '') f_erreur(400, 'Lot ou libellé manquant.');
            $db->prepare('INSERT INTO cartes_lots (lot, libelle) VALUES (?, ?) ON CONFLICT(lot) DO UPDATE SET libelle = excluded.libelle')->execute(array($lot, $lib));
            f_repondre(200, array('ok' => true));
        }
        if ($a === 'masquer' || $a === 'livrer') {
            $n = (int) ($e['numero'] ?? 0);
            $sql = $a === 'masquer' ? 'UPDATE cartes_offre SET masque = ? WHERE lot = ? AND numero = ?'
                                    : 'UPDATE cartes_offre SET defi_livre_le = ? WHERE lot = ? AND numero = ? AND defi_le IS NOT NULL';
            $valeur = $a === 'masquer' ? (empty($e['masque']) ? 0 : 1) : f_maintenant();
            $db->prepare($sql)->execute(array($valeur, $lot, $n));
            f_repondre(200, array('ok' => true));
        }
        f_erreur(400, 'Action inconnue.');
    }
    $total = (int) $db->query('SELECT COUNT(*) FROM cartes_offre')->fetchColumn();
    $liste = $db->query('SELECT lot, numero, app, utilise_le, email, prenom, mur, masque, source, defi_le, defi_livre_le FROM cartes_offre WHERE utilise_le IS NOT NULL ORDER BY utilise_le DESC')->fetchAll();
    if (isset($_GET['export'])) {
        header('Content-Type: text/csv; charset=utf-8');
        echo "lot;numero;application;date;email;source;defi\n";
        foreach ($liste as $r) echo $r['lot'] . ';' . $r['numero'] . ';' . $r['app'] . ';' . gmdate('Y-m-d H:i', (int) $r['utilise_le']) . ';' . str_replace(array(';', "\n", '"'), '', (string) $r['email']) . ';' . $r['source'] . ';' . ($r['defi_le'] ? 'oui' : '') . "\n";
        exit;
    }
    $parLot = $db->query('SELECT c.lot, COALESCE(l.libelle, \'\') AS libelle, COUNT(*) AS total, SUM(c.utilise_le IS NOT NULL) AS utilisees
                          FROM cartes_offre c LEFT JOIN cartes_lots l ON l.lot = c.lot GROUP BY c.lot ORDER BY c.lot')->fetchAll();
    $parSource = $db->query('SELECT source, SUM(n) AS scans FROM cartes_scans GROUP BY source ORDER BY scans DESC LIMIT 100')->fetchAll();
    $act = array();
    foreach ($db->query('SELECT source, COUNT(*) AS n FROM cartes_offre WHERE utilise_le IS NOT NULL GROUP BY source')->fetchAll() as $r) $act[(string) $r['source']] = (int) $r['n'];
    foreach ($parSource as &$s) $s['activations'] = $act[$s['source']] ?? 0;
    unset($s);
    $defis = (int) $db->query('SELECT COUNT(*) FROM cartes_offre WHERE defi_le IS NOT NULL')->fetchColumn();
    $amis = (int) $db->query('SELECT COUNT(*) FROM cartes_amis')->fetchColumn();
    f_repondre(200, array('total' => $total, 'utilisees' => count($liste), 'restantes' => $total - count($liste), 'parLot' => $parLot,
        'parSource' => $parSource, 'defisValides' => $defis, 'amisActives' => $amis, 'recentes' => array_slice($liste, 0, 100)));
}

/* ─────────────── mur de remerciements (public, prénoms consentis) ─────────────── */
if ($methode === 'GET' && isset($_GET['mur'])) {
    $db = k_db();
    $lignes = $db->query('SELECT prenom, app, utilise_le FROM cartes_offre WHERE mur = 1 AND masque = 0 AND prenom IS NOT NULL AND utilise_le IS NOT NULL ORDER BY utilise_le DESC LIMIT 200')->fetchAll();
    if (isset($_GET['json'])) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: public, max-age=300');
        echo json_encode(array_map(function ($r) { return array('prenom' => $r['prenom'], 'app' => $r['app'], 'mois' => gmdate('Y-m', (int) $r['utilise_le'])); }, $lignes), JSON_UNESCAPED_UNICODE);
        exit;
    }
    $li = '';
    foreach ($lignes as $r) $li .= '<li><strong>' . k_h((string) $r['prenom']) . '</strong> a reçu <em>' . k_h((string) $r['app']) . '</em></li>';
    k_page('Mur de remerciements', '<h1>💛 Mur de remerciements</h1><p><small>Ils ont activé leur appli offerte et ont accepté d\'apparaître ici (prénom seulement).</small></p>'
        . ($li !== '' ? '<ul class="mur">' . $li . '</ul>' : '<p>Le mur est encore vide. Soyez le premier !</p>'));
}

/* ─────────────── défi : page d'un ami invité ─────────────── */
if (isset($_GET['ami']) || ($methode === 'POST' && isset($_POST['ami']))) {
    $jeton = preg_replace('/[^a-f0-9]/', '', (string) ($_GET['ami'] ?? $_POST['ami'] ?? '')) ?? '';
    $db = k_db();
    $q = $db->prepare('SELECT app, email, defi_le, lot, numero FROM cartes_offre WHERE jeton = ? AND utilise_le IS NOT NULL');
    $q->execute(array($jeton));
    $parrain = strlen($jeton) === 20 ? $q->fetch() : false;
    if (!$parrain) k_page('Lien inconnu', '<h1 class="ko">Lien inconnu</h1><p>Ce lien d\'invitation n\'est pas valable.</p>', 404);
    if ($methode !== 'POST') {
        k_page('Une appli offerte', '<h1>🎁 Un ami vous offre un essai</h1><p>Entrez votre e-mail pour activer vos <strong>7 jours d\'essai</strong>, sans carte bancaire.</p>'
            . '<form method="post"><input type="hidden" name="ami" value="' . k_h($jeton) . '"><label for="e"><small>Votre e-mail</small></label>'
            . '<input id="e" type="email" name="email" required autocomplete="email" maxlength="190"><button type="submit">Activer mon essai</button></form>'
            . '<p><small>Votre e-mail n\'est jamais montré à votre ami.</small></p>');
    }
    if (!f_limite('ami|' . f_empreinte_ip(), 10, 3600)) k_page('Trop d\'essais', '<h1 class="ko">Trop d\'essais</h1><p>Réessayez dans une heure.</p>', 429);
    $email = mb_strtolower(trim((string) ($_POST['email'] ?? '')), 'UTF-8');
    if (!f_email_valide($email)) k_page('E-mail invalide', '<h1 class="ko">Adresse e-mail invalide</h1><p><a class="b" href="?ami=' . k_h($jeton) . '">Retour</a></p>', 400);
    $emp = f_empreinte_ip();
    $pe = mb_strtolower((string) $parrain['email'], 'UTF-8');
    $nouveau = false;
    $atteint = false;
    $compte = 0;
    if ($email !== $pe) {
        f_transaction(function (PDO $d) use ($jeton, $email, $emp, &$nouveau, &$atteint, &$compte) {
            $q = $d->prepare('SELECT COUNT(*) FROM cartes_amis WHERE jeton = ? AND empreinte = ?');
            $q->execute(array($jeton, $emp));
            if ((int) $q->fetchColumn() < 2) { // au plus 2 amis depuis le même appareil/réseau : freine l'auto-parrainage
                $i = $d->prepare('INSERT OR IGNORE INTO cartes_amis (jeton, email_hash, empreinte, cree_le) VALUES (?, ?, ?, ?)');
                $i->execute(array($jeton, f_email_hash($email), $emp, f_maintenant()));
                $nouveau = $i->rowCount() === 1;
            }
            $q = $d->prepare('SELECT COUNT(*) FROM cartes_amis WHERE jeton = ?');
            $q->execute(array($jeton));
            $compte = (int) $q->fetchColumn();
            if ($nouveau && $compte >= K_AMIS_REQUIS) {
                $u = $d->prepare('UPDATE cartes_offre SET defi_le = ? WHERE jeton = ? AND defi_le IS NULL');
                $u->execute(array(f_maintenant(), $jeton));
                $atteint = $u->rowCount() === 1;
            }
        });
    }
    if ($atteint) {
        $ref = $parrain['lot'] . '-' . $parrain['numero'];
        f_mail(f_admin_email(), 'Défi 3 amis réussi — carte ' . $ref, "La carte $ref ({$parrain['app']}) a fait activer " . K_AMIS_REQUIS . " amis : 2e appli à offrir.\nÀ marquer livrée dans /admin-cartes.html.");
        if ($pe !== '') f_mail($pe, 'Votre 2e appli offerte', "Bravo ! 3 amis ont activé leur essai grâce à vous : une 2e appli Alphabette vous est offerte.\nRépondez à ce message avec l'appli de votre choix.");
    }
    k_page('Essai activé', '<h1 class="ok">✅ Merci !</h1><p>Votre essai de 7 jours est enregistré.</p><p><a class="b" href="https://alphabette.eu">Découvrir les applis</a></p>');
}

/* ─────────────── carte : scan, activation ─────────────── */
$code = k_norm((string) ($_GET['c'] ?? $_POST['c'] ?? ''));
if (!isset($_GET['c']) && !isset($_POST['c'])) {
    k_page('Activer ma carte', '<h1>🎁 Activer ma carte</h1><form method="get"><label for="c"><small>Code inscrit sur votre carte</small></label>'
        . '<input id="c" type="text" name="c" maxlength="14" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX" style="text-transform:uppercase">'
        . '<button type="submit">Continuer</button></form>');
}
if (strlen($code) !== 12) k_page('Carte invalide', '<h1 class="ko">Code incomplet</h1><p>Scannez à nouveau le QR code de votre carte.</p>', 400);
if (!f_limite('carte|' . f_empreinte_ip(), 30, 3600)) k_page('Trop d\'essais', '<h1 class="ko">Trop d\'essais</h1><p>Réessayez dans une heure.</p>', 429);
$aff = substr($code, 0, 4) . '-' . substr($code, 4, 4) . '-' . substr($code, 8, 4);
$db = k_db();
$ch = k_hash($code);
$q = $db->prepare('SELECT lot, numero, app, utilise_le, empreinte, jeton, defi_le FROM cartes_offre WHERE code_hash = ?');
$q->execute(array($ch));
$carte = $q->fetch();
if (!$carte) k_page('Carte inconnue', '<h1 class="ko">Carte inconnue</h1><p>Ce code n\'existe pas. Vérifiez votre carte.</p>', 404);
$app = k_h((string) $carte['app']);

if ($methode === 'GET') { // compteur de scans par lieu (par jour, sans identifiant)
    $db->prepare('INSERT INTO cartes_scans (source, jour, n) VALUES (?, ?, 1) ON CONFLICT(source, jour) DO UPDATE SET n = n + 1')
       ->execute(array(k_source((int) $carte['lot']), gmdate('Y-m-d', f_maintenant())));
}

if ($methode === 'POST') {
    $email = mb_strtolower(trim((string) ($_POST['email'] ?? '')), 'UTF-8');
    if ($email !== '' && !f_email_valide($email)) k_page('E-mail invalide', '<h1 class="ko">Adresse e-mail invalide</h1><p><a class="b" href="?c=' . $aff . '">Retour</a></p>', 400);
    $prenom = trim((string) ($_POST['prenom'] ?? ''));
    $mur = !empty($_POST['mur']) && k_prenom_valide($prenom);
    $u = $db->prepare('UPDATE cartes_offre SET utilise_le = ?, empreinte = ?, email = ?, prenom = ?, mur = ?, source = ?, jeton = ? WHERE code_hash = ? AND utilise_le IS NULL');
    $u->execute(array(f_maintenant(), f_empreinte_ip(), $email !== '' ? $email : null, $mur ? $prenom : null, $mur ? 1 : 0,
        k_source((int) $carte['lot']), k_jeton($ch), $ch));
    if ($u->rowCount() === 1) {
        setcookie('ab_carte_' . substr($ch, 0, 8), k_cookie($ch), array('expires' => time() + 31536000, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax'));
        $q->execute(array($ch));
        $carte = $q->fetch();
        k_fiche_activee($db, $carte, $ch, '<h1 class="ok">✅ C\'est validé !</h1><p><strong>' . $app . '</strong> vous est offerte.</p>'
            . ($mur ? '<p><small>Merci ' . k_h($prenom) . ' ! Votre prénom apparaît sur le mur de remerciements.</small></p>' : ''));
    }
    k_page('Carte déjà utilisée', '<h1 class="ko">Carte déjà utilisée</h1><p>Chaque carte ne peut servir qu\'une seule fois.</p>', 409);
}

if ($carte['utilise_le'] !== null) {
    $moi = hash_equals(k_cookie($ch), (string) ($_COOKIE['ab_carte_' . substr($ch, 0, 8)] ?? '')) // même navigateur
        || ($carte['empreinte'] !== null && hash_equals((string) $carte['empreinte'], f_empreinte_ip())); // ou même réseau
    if ($moi) k_fiche_activee($db, $carte, $ch, '<h1 class="ok">👋 Votre appli vous attend</h1><p><strong>' . $app . '</strong> est déjà activée pour vous.</p>');
    k_page('Carte déjà utilisée', '<h1 class="ko">Carte déjà utilisée</h1><p>Cette carte a déjà été activée le ' . gmdate('d/m/Y', (int) $carte['utilise_le']) . '. Chaque carte ne sert qu\'une fois.</p>', 409);
}
k_page('Application offerte', '<h1>🎁 Application offerte</h1><p><strong>' . $app . '</strong></p><div class="code">' . $aff . '</div>'
    . '<form method="post" action="?c=' . $aff . (isset($_GET['s']) ? '&amp;s=' . k_h(k_source((int) $carte['lot'])) : '') . '"><input type="hidden" name="c" value="' . $aff . '">'
    . '<label for="e"><small>E-mail (facultatif, pour vous prévenir des nouveautés)</small></label><input id="e" type="email" name="email" autocomplete="email" maxlength="190">'
    . '<label for="p"><small>Prénom (facultatif)</small></label><input id="p" type="text" name="prenom" maxlength="20" autocomplete="given-name">'
    . '<label class="case"><input type="checkbox" name="mur" value="1"><span>J\'accepte que mon <strong>prénom seulement</strong> apparaisse sur le mur de remerciements (retrait possible sur demande).</span></label>'
    . '<button type="submit">Activer mon application offerte</button></form><p><small>Carte à usage unique.</small></p>');
