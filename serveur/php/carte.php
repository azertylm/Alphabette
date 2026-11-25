<?php
/**
 * carte.php — Cartes « application offerte » à usage unique (QR code imprimé).
 *   GET  ?c=XXXX-XXXX-XXXX            → page de validation (code valide / déjà utilisé / inconnu)
 *   POST (formulaire) c=…, email?      → active la carte (une seule fois, atomique) et enregistre la date
 *   GET  ?admin   (X-Admin-Password)   → totaux + liste des cartes activées
 *   GET  ?export  (X-Admin-Password)   → CSV des cartes activées
 * Les codes imprimés ne sont JAMAIS stockés : seule leur empreinte SHA-256 (data/private/cartes-hashes.txt) est connue du serveur.
 */
declare(strict_types=1);
require __DIR__ . '/finance-commun.php';

function k_db(): PDO {
    static $pret = false;
    $db = f_db();
    if ($pret) return $db;
    $db->exec('CREATE TABLE IF NOT EXISTS cartes_offre (
      code_hash TEXT PRIMARY KEY, lot INTEGER NOT NULL, numero INTEGER NOT NULL, app TEXT NOT NULL,
      utilise_le INTEGER, empreinte TEXT, email TEXT)');
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
function k_page(string $titre, string $corps, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
       . '<title>' . htmlspecialchars($titre) . '</title><style>'
       . 'body{margin:0;font:18px/1.6 system-ui,sans-serif;background:#f8fafc;color:#0f172a}header{background:#182334;color:#fff;padding:12px 16px;font-weight:700}'
       . 'main{max-width:520px;margin:6vh auto;padding:0 16px}.c{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center}'
       . 'h1{font-size:26px;margin:0 0 8px}.ok{color:#047857}.ko{color:#b91c1c}input[type=email]{width:100%;box-sizing:border-box;font:inherit;padding:12px;border:1px solid #94a3b8;border-radius:10px;margin:8px 0}'
       . 'button,a.b{display:inline-block;font:inherit;font-weight:700;background:#4338ca;color:#fff;border:0;border-radius:12px;padding:14px 22px;text-decoration:none;cursor:pointer;min-height:44px}'
       . '.code{font:700 22px ui-monospace,monospace;letter-spacing:.08em;background:#f1f5f9;border-radius:10px;padding:8px;margin:12px 0}small{color:#475569}'
       . '</style></head><body><header>alphabette</header><main><div class="c">' . $corps . '</div></main></body></html>';
    exit;
}

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($methode === 'GET' && (isset($_GET['admin']) || isset($_GET['export']))) {
    header('Cache-Control: no-store');
    f_admin();
    $db = k_db();
    $total = (int) $db->query('SELECT COUNT(*) FROM cartes_offre')->fetchColumn();
    $liste = $db->query('SELECT lot, numero, app, utilise_le, email FROM cartes_offre WHERE utilise_le IS NOT NULL ORDER BY utilise_le DESC')->fetchAll();
    if (isset($_GET['export'])) {
        header('Content-Type: text/csv; charset=utf-8');
        echo "lot;numero;application;date;email\n";
        foreach ($liste as $r) echo $r['lot'] . ';' . $r['numero'] . ';' . $r['app'] . ';' . gmdate('Y-m-d H:i', (int) $r['utilise_le']) . ';' . str_replace(array(';', "\n", '"'), '', (string) $r['email']) . "\n";
        exit;
    }
    $parLot = $db->query('SELECT lot, COUNT(*) AS total, SUM(utilise_le IS NOT NULL) AS utilisees FROM cartes_offre GROUP BY lot ORDER BY lot')->fetchAll();
    f_repondre(200, array('total' => $total, 'utilisees' => count($liste), 'restantes' => $total - count($liste), 'parLot' => $parLot, 'recentes' => array_slice($liste, 0, 100)));
}

$code = k_norm((string) ($_GET['c'] ?? $_POST['c'] ?? ''));
if (!isset($_GET['c']) && !isset($_POST['c'])) {
    k_page('Activer ma carte', '<h1>🎁 Activer ma carte</h1><form method="get"><label for="c"><small>Code inscrit sur votre carte</small></label>'
        . '<input id="c" name="c" maxlength="14" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX" style="width:100%;box-sizing:border-box;font:inherit;padding:12px;border:1px solid #94a3b8;border-radius:10px;margin:8px 0;text-transform:uppercase">'
        . '<button type="submit">Continuer</button></form>');
}
if (strlen($code) !== 12) k_page('Carte invalide', '<h1 class="ko">Code incomplet</h1><p>Scannez à nouveau le QR code de votre carte.</p>', 400);
if (!f_limite('carte|' . f_empreinte_ip(), 30, 3600)) k_page('Trop d\'essais', '<h1 class="ko">Trop d\'essais</h1><p>Réessayez dans une heure.</p>', 429);
$aff = substr($code, 0, 4) . '-' . substr($code, 4, 4) . '-' . substr($code, 8, 4);
$db = k_db();
$q = $db->prepare('SELECT lot, numero, app, utilise_le FROM cartes_offre WHERE code_hash = ?');
$q->execute(array(k_hash($code)));
$carte = $q->fetch();
if (!$carte) k_page('Carte inconnue', '<h1 class="ko">Carte inconnue</h1><p>Ce code n\'existe pas. Vérifiez votre carte.</p>', 404);
$app = htmlspecialchars((string) $carte['app']);

if ($methode === 'POST') {
    $email = mb_strtolower(trim((string) ($_POST['email'] ?? '')), 'UTF-8');
    if ($email !== '' && !f_email_valide($email)) k_page('E-mail invalide', '<h1 class="ko">Adresse e-mail invalide</h1><p><a class="b" href="?c=' . $aff . '">Retour</a></p>', 400);
    $u = $db->prepare('UPDATE cartes_offre SET utilise_le = ?, empreinte = ?, email = ? WHERE code_hash = ? AND utilise_le IS NULL');
    $u->execute(array(f_maintenant(), f_empreinte_ip(), $email !== '' ? $email : null, k_hash($code)));
    if ($u->rowCount() === 1) {
        k_page('Application offerte', '<h1 class="ok">✅ C\'est validé !</h1><p><strong>' . $app . '</strong> vous est offerte.</p><p><a class="b" href="https://alphabette.fr">Ouvrir Alphabette</a></p><small>Cette carte est maintenant utilisée.</small>');
    }
    k_page('Carte déjà utilisée', '<h1 class="ko">Carte déjà utilisée</h1><p>Chaque carte ne peut servir qu\'une seule fois.</p>', 409);
}

if ($carte['utilise_le'] !== null) {
    k_page('Carte déjà utilisée', '<h1 class="ko">Carte déjà utilisée</h1><p>Cette carte a déjà été activée le ' . gmdate('d/m/Y', (int) $carte['utilise_le']) . '. Chaque carte ne sert qu\'une fois.</p>', 409);
}
k_page('Application offerte', '<h1>🎁 Application offerte</h1><p><strong>' . $app . '</strong></p><div class="code">' . $aff . '</div>'
    . '<form method="post" action="?c=' . $aff . '"><input type="hidden" name="c" value="' . $aff . '">'
    . '<label for="e"><small>E-mail (facultatif, pour vous prévenir des nouveautés)</small></label><input id="e" type="email" name="email" autocomplete="email" maxlength="190">'
    . '<button type="submit">Activer mon application offerte</button></form><p><small>Carte à usage unique.</small></p>');
