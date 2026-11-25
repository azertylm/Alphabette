<?php
/**
 * admin.php — console de modération (/admin/validations et /admin/avis-suspects).
 * Protégée par ADMIN_PASSWORD (variable d'environnement, ou SetEnv Apache, ou fichier data/private/admin-password.txt).
 * Fermée tant qu'aucun mot de passe n'est défini. Session : cookie HttpOnly 8 h + jeton CSRF (en-tête X-CSRF).
 *
 *   POST { action:"connexion", mot_de_passe }                      → { ok, csrf }       (5 essais / 15 min / connexion)
 *   GET  ?session                                                  → { connecte, csrf?, reglages? }
 *   GET  ?validations                                              → { en_attente:[…], pionniers_restants }
 *   POST { action:"valider", id } | { action:"refuser", id, motif }
 *   POST { action:"reglage", requireManualValidation:bool }
 *   GET  ?avis_suspects                                            → { alertes:[{ id, appId, nom, motif, votes:[…] }] }
 *   POST { action:"invalider_vote", vote_id, motif? }              → recalcul atomique des compteurs
 *   POST { action:"ecarter_alerte", flag_id } | { action:"pause_abus", flag_id } | { action:"publier_fr", app_id }
 */
require __DIR__ . '/_lib.php';

function mot_de_passe_admin(): string {
    $p = (string) (getenv('ADMIN_PASSWORD') ?: ($_SERVER['ADMIN_PASSWORD'] ?? ''));
    if ($p === '' && is_file(dossier_prive() . '/admin-password.txt')) $p = trim((string) file_get_contents(dossier_prive() . '/admin-password.txt'));
    return $p;
}

function session_admin(): ?array {
    $j = (string) ($_COOKIE['ab_admin'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $j)) return null;
    $s = db()->prepare('SELECT csrf FROM admin_sessions WHERE hash = ? AND expiresAt > ?');
    $s->execute(array(sha256_jeton($j), time()));
    $c = $s->fetchColumn();
    return $c === false ? null : array('csrf' => (string) $c);
}
function exiger_admin(bool $ecriture): void {
    $s = session_admin();
    if (!$s) erreur(401, 'Connexion administrateur requise.');
    if ($ecriture && !hash_equals($s['csrf'], (string) ($_SERVER['HTTP_X_CSRF'] ?? ''))) erreur(403, 'Jeton de sécurité invalide : rechargez la page.');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    if (isset($_GET['session'])) {
        $s = session_admin();
        repondre(200, $s ? array('connecte' => true, 'csrf' => $s['csrf'], 'reglages' => array('requireManualValidation' => validation_manuelle()))
                         : array('connecte' => false, 'configure' => mot_de_passe_admin() !== ''));
    }
    exiger_admin(false);
    if (isset($_GET['validations'])) {
        $l = array();
        $s = db()->query("SELECT s.*, u.handle FROM submissions s JOIN users u ON u.id = s.userId WHERE s.status = 'pending_admin_review' ORDER BY s.createdAt ASC LIMIT 200");
        foreach ($s->fetchAll() as $a) {
            $l[] = array('id' => $a['id'], 'nom' => $a['name'], 'description' => $a['description'], 'categorie' => $a['category'], 'type' => $a['sourceType'],
                'source' => $a['sourceRef'], 'depotRecupere' => (int) $a['sourceFetched'] === 1, 'hashOriginal' => $a['originalHash'], 'createur' => $a['handle'],
                'depuis' => (int) $a['createdAt'],
                // Aperçu sans cookie : l'iframe isolée (origine opaque) charge les fichiers avec ce jeton d'une heure.
                'apercu' => (int) $a['sourceFetched'] === 1 ? 'api/createurs/fichier.php/' . $a['id'] . '/' . jeton_fichier($a['id'], 'apercu') . '/index.html' : null);
        }
        $n = (int) db()->query('SELECT COUNT(*) FROM submissions WHERE isPioneer = 1')->fetchColumn();
        repondre(200, array('en_attente' => $l, 'pionniers_restants' => max(0, PIONNIERS_MAX - $n), 'reglages' => array('requireManualValidation' => validation_manuelle())));
    }
    if (isset($_GET['avis_suspects'])) {
        $out = array();
        foreach (db()->query("SELECT f.*, s.name FROM flags f JOIN submissions s ON s.id = f.appId WHERE f.status = 'open' AND f.reason = 'flag_security_review' ORDER BY f.createdAt DESC LIMIT 100")->fetchAll() as $f) {
            $v = db()->prepare('SELECT v.id, v.positive, v.comment, v.valid, v.createdAt, v.sessionSeconds, v.subnetHash, u.handle, u.createdAt AS compte_le
                FROM votes v JOIN users u ON u.id = v.userId WHERE v.appId = ? ORDER BY v.createdAt DESC LIMIT 200');
            $v->execute(array($f['appId']));
            $votes = array();
            foreach ($v->fetchAll() as $x) $votes[] = array('id' => (int) $x['id'], 'positif' => (int) $x['positive'] === 1, 'commentaire' => $x['comment'], 'valide' => (int) $x['valid'] === 1,
                'le' => (int) $x['createdAt'], 'secondes' => (int) $x['sessionSeconds'], 'reseau' => substr($x['subnetHash'], 0, 6), 'pseudo' => $x['handle'],
                'compteRecent' => (int) $x['createdAt'] - (int) $x['compte_le'] < 86400);
            $out[] = array('id' => (int) $f['id'], 'appId' => $f['appId'], 'nom' => $f['name'], 'motif' => $f['details'], 'le' => (int) $f['createdAt'], 'votes' => $votes);
        }
        repondre(200, array('alertes' => $out));
    }
    if (isset($_GET['signalements'])) {
        $s = db()->query("SELECT id, appId, details, createdAt FROM flags WHERE status = 'open' AND reason = 'signalement' ORDER BY createdAt DESC LIMIT 100");
        repondre(200, array('signalements' => array_map(function ($f) { return array('id' => (int) $f['id'], 'appId' => $f['appId'], 'details' => $f['details'], 'le' => (int) $f['createdAt']); }, $s->fetchAll())));
    }
    erreur(400, 'Action inconnue.');
}

exiger_post();
$e = corps_json();
$action = (string) ($e['action'] ?? '');

if ($action === 'connexion') {
    $attendu = mot_de_passe_admin();
    if ($attendu === '') erreur(503, "La console est fermée : aucun mot de passe administrateur n'est défini (ADMIN_PASSWORD).");
    if (!limite('admin:' . empreinte_ip(), 5, 900)) erreur(429, 'Trop d\'essais : réessayez dans 15 minutes.');
    if (!hash_equals(hash('sha256', $attendu), hash('sha256', (string) ($e['mot_de_passe'] ?? '')))) erreur(401, 'Mot de passe incorrect.');
    $jeton = bin2hex(random_bytes(32)); $csrf = bin2hex(random_bytes(16));
    db()->prepare('DELETE FROM admin_sessions WHERE expiresAt < ?')->execute(array(time()));
    db()->prepare('INSERT INTO admin_sessions(hash, csrf, expiresAt) VALUES (?, ?, ?)')->execute(array(sha256_jeton($jeton), $csrf, time() + 8 * 3600));
    cookie_pose('ab_admin', $jeton, 8 * 3600);
    repondre(200, array('ok' => true, 'csrf' => $csrf));
}
exiger_admin(true);

function charger_soumission(PDO $p, string $id): array {
    if (!id_app_valide($id)) erreur(400, 'Soumission inconnue.');
    $s = $p->prepare('SELECT * FROM submissions WHERE id = ?'); $s->execute(array($id));
    $a = $s->fetch();
    if (!$a) erreur(404, 'Soumission introuvable.');
    return $a;
}

if ($action === 'reglage') {
    $v = ($e['requireManualValidation'] ?? true) === false ? 'false' : 'true';
    db()->prepare('INSERT OR REPLACE INTO admin_settings(key, value) VALUES (?, ?)')->execute(array('requireManualValidation', $v));
    repondre(200, array('ok' => true, 'requireManualValidation' => $v === 'true'));
}

if ($action === 'valider') {
    $id = (string) ($e['id'] ?? '');
    $a = null;
    try {
        $r = transaction(function (PDO $p) use ($id, &$a) {
            $a = charger_soumission($p, $id);
            if ($a['status'] !== 'pending_admin_review') throw new RuntimeException('statut');
            if ((int) $a['sourceFetched'] !== 1) {          // dépôt GitHub : nouvelle tentative de récupération au moment de valider
                $g = url_github_valide($a['sourceRef']);
                $zip = $g ? telecharger_github($g['owner'], $g['repo']) : null;
                if (!$zip) throw new RuntimeException('github');
                $tmp = dossier_depot($a['id']) . '/original';
                supprimer_dossier($tmp);
                $x = extraire_zip($zip, $tmp);
                $hash = hash_file('sha256', $zip);
                @unlink($zip);
                if (!$x['ok']) throw new RuntimeException('zip:' . $x['erreur']);
                $p->prepare('UPDATE submissions SET sourceFetched = 1, originalHash = ? WHERE id = ?')->execute(array($hash, $a['id']));
                $a['sourceFetched'] = 1;
            }
            return valider_soumission($p, $a);
        });
    } catch (RuntimeException $x) {
        $m = $x->getMessage();
        if ($m === 'statut') erreur(409, "Cette soumission n'est plus en attente.");
        if ($m === 'github') erreur(502, "GitHub est indisponible : l'appli ne peut pas encore être récupérée. Réessayez plus tard.");
        erreur(422, preg_replace('/^zip:/', '', $m));
    }
    repondre(200, array('ok' => true) + $r);
}

if ($action === 'refuser') {
    $id = (string) ($e['id'] ?? '');
    $motif = texte((string) ($e['motif'] ?? ''), 400);
    if (mb_strlen($motif) < 5) erreur(400, 'Indiquez un motif de refus (il sera montré au créateur).');
    transaction(function (PDO $p) use ($id, $motif) {
        $a = charger_soumission($p, $id);
        if ($a['status'] !== 'pending_admin_review') erreur(409, "Cette soumission n'est plus en attente.");
        $p->prepare("UPDATE submissions SET status = 'rejected', rejectionReason = ?, updatedAt = ? WHERE id = ?")->execute(array($motif, time(), $id));
        $u = $p->prepare('SELECT email FROM users WHERE id = ?'); $u->execute(array((int) $a['userId']));
        envoyer_mail((string) $u->fetchColumn(), 'Votre appli demande une correction', "Bonjour,\n\n« " . $a['name'] . " » n'a pas pu être validée pour l'instant :\n\n$motif\n\nVous pouvez la corriger et la renvoyer en un clic : " . origine_publique() . "/soumettre/\n\nAlphabette");
    });
    repondre(200, array('ok' => true));
}

if ($action === 'invalider_vote') {
    $vid = (int) ($e['vote_id'] ?? 0);
    $motif = texte((string) ($e['motif'] ?? 'avis frauduleux'), 200);
    $r = transaction(function (PDO $p) use ($vid, $motif) {
        $s = $p->prepare('SELECT appId FROM votes WHERE id = ?'); $s->execute(array($vid));
        $app = $s->fetchColumn();
        if ($app === false) erreur(404, 'Avis introuvable.');
        $p->prepare('UPDATE votes SET valid = 0, invalidReason = ?, updatedAt = ? WHERE id = ?')->execute(array($motif, time(), $vid));
        return recalculer($p, (string) $app);
    });
    repondre(200, array('ok' => true) + $r);
}

if ($action === 'ecarter_alerte' || $action === 'pause_abus') {
    $fid = (int) ($e['flag_id'] ?? 0);
    $r = transaction(function (PDO $p) use ($fid, $action) {
        $s = $p->prepare("SELECT * FROM flags WHERE id = ? AND status = 'open'"); $s->execute(array($fid));
        $f = $s->fetch();
        if (!$f) erreur(404, 'Alerte introuvable ou déjà traitée.');
        if ($action === 'pause_abus') {
            $p->prepare("UPDATE flags SET status = 'actioned', closedAt = ? WHERE id = ?")->execute(array(time(), $fid));
            $p->prepare("UPDATE submissions SET status = 'paused_abuse', updatedAt = ? WHERE id = ?")->execute(array(time(), $f['appId']));
            $p->prepare('DELETE FROM transfer_tokens WHERE appId = ? AND usedAt IS NULL')->execute(array($f['appId']));
            return array('statut' => 'paused_abuse');
        }
        $p->prepare("UPDATE flags SET status = 'dismissed', closedAt = ? WHERE id = ?")->execute(array(time(), $fid));
        $t = $p->prepare('SELECT statusBeforeFlag, status FROM submissions WHERE id = ?'); $t->execute(array($f['appId']));
        $sub = $t->fetch();
        if ($sub && $sub['status'] === 'flag_security_review') {
            $retour = in_array($sub['statusBeforeFlag'], array('lab_eu', 'eligible_fr'), true) ? 'lab_eu' : 'lab_eu';
            $p->prepare('UPDATE submissions SET status = ?, statusBeforeFlag = NULL, updatedAt = ? WHERE id = ?')->execute(array($retour, time(), $f['appId']));
        }
        return recalculer($p, $f['appId']);
    });
    repondre(200, array('ok' => true) + $r);
}

if ($action === 'publier_fr') {
    $id = (string) ($e['app_id'] ?? '');
    transaction(function (PDO $p) use ($id) {
        $a = charger_soumission($p, $id);
        $t = $p->prepare('SELECT 1 FROM transfers WHERE appId = ?'); $t->execute(array($id));
        if ($a['status'] !== 'eligible_fr' || !$t->fetchColumn()) erreur(409, "L'appli doit être éligible et le créateur doit avoir lancé le transfert.");
        $p->prepare("UPDATE submissions SET status = 'published_fr', updatedAt = ? WHERE id = ?")->execute(array(time(), $id));
        $p->prepare("UPDATE transfers SET status = 'publie' WHERE appId = ?")->execute(array($id));
        // Lot 5 : l'appli est rattachée à son créateur dans le moteur financier (10 € par abonnement vendu, versés à son solde).
        $u = $p->prepare('SELECT email FROM users WHERE id = ?'); $u->execute(array((int) $a['userId']));
        $email = (string) $u->fetchColumn();
        pont(function () use ($id, $email) { c_lier_app($id, $email); return true; });
    });
    repondre(200, array('ok' => true));
}
erreur(400, 'Action inconnue.');
