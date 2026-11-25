<?php
/**
 * auth.php — comptes par lien magique (aucun mot de passe), session par cookie HttpOnly.
 *   POST { action:"demander", email, handle?, sponsor? }   → { ok }   (sponsor : code de parrainage créateur, Lot 5)          envoie le lien (5 par heure et par connexion, 3 par adresse)
 *   GET  ?verifier=<jeton>                        → confirme l'e-mail (emailVerified), ouvre la session, redirige vers /soumettre/
 *   GET  ?moi                                     → { connecte, utilisateur? }
 *   POST { action:"profil", handle }              → { ok, utilisateur }
 *   POST { action:"quitter" }                     → { ok }
 */
require __DIR__ . '/_lib.php';
const RETOURS_PERMIS = array('/soumettre/', '/contribuer/', '/roadmap/', '/rejoindre-createurs/', '/creations/studio-partage/');

if (isset($_GET['verifier'])) {
    $jeton = (string) $_GET['verifier'];
    if (!preg_match('/^[a-f0-9]{64}$/', $jeton)) { header('Location: ' . origine_publique() . '/soumettre/?lien=invalide'); exit; }
    $uid = transaction(function (PDO $p) use ($jeton) {
        $s = $p->prepare('SELECT userId FROM login_tokens WHERE hash = ? AND usedAt IS NULL AND expiresAt > ?');
        $s->execute(array(sha256_jeton($jeton), time()));
        $id = $s->fetchColumn();
        if ($id === false) return null;
        $p->prepare('UPDATE login_tokens SET usedAt = ? WHERE hash = ?')->execute(array(time(), sha256_jeton($jeton)));
        $p->prepare('UPDATE users SET emailVerified = 1, verifiedAt = COALESCE(verifiedAt, ?) WHERE id = ?')->execute(array(time(), (int) $id));
        return (int) $id;
    });
    // Lot 5 : parrainage créateur (12 mois, +1 € par abonnement vendu, prélevé sur la part Alphabette) enregistré à la 1re confirmation.
    if ($uid !== null) {
        $u = db()->prepare('SELECT email, sponsorCode FROM users WHERE id = ?'); $u->execute(array($uid)); $u = $u->fetch();
        if ($u && (string) $u['sponsorCode'] !== '') pont(function () use ($u) { return c_enregistrer_parrainage((string) $u['email'], (string) $u['sponsorCode']); });
    }
    if ($uid === null) { header('Location: ' . origine_publique() . '/soumettre/?lien=expire'); exit; }
    creer_session($uid);
    // Lot 5 : retour vers la page d'où vient la demande (liste fermée : jamais une adresse extérieure).
    $retour = in_array($_GET['retour'] ?? '', RETOURS_PERMIS, true) ? (string) $_GET['retour'] : '/soumettre/';
    header('Location: ' . origine_publique() . $retour . '?connecte=1');
    exit;
}

if (isset($_GET['moi'])) {
    $u = utilisateur_courant();
    repondre(200, $u ? array('connecte' => true, 'utilisateur' => identifiant_public($u)) : array('connecte' => false));
}

exiger_post();
$e = corps_json();
$action = (string) ($e['action'] ?? '');

if ($action === 'demander') {
    $email = trim((string) ($e['email'] ?? ''));
    $norm = email_normalise($email);
    if ($norm === '' || strlen($email) > 120) erreur(400, "Cette adresse e-mail n'a pas l'air valide.");
    if (!limite('lien-ip:' . empreinte_ip(), 5, 3600) || !limite('lien-mail:' . hash('sha256', $norm), 3, 3600)) erreur(429, 'Trop de demandes : réessayez dans une heure.');
    $jeton = bin2hex(random_bytes(32));
    transaction(function (PDO $p) use ($email, $norm, $e, $jeton) {
        $s = $p->prepare('SELECT id FROM users WHERE emailNorm = ?');
        $s->execute(array($norm));
        $id = $s->fetchColumn();
        if ($id === false) {
            $base = preg_replace('/[^a-z0-9]+/', '-', strtolower(explode('@', $norm)[0])) ?? 'createur';
            $base = trim(substr($base, 0, 20), '-') ?: 'createur';
            do { $handle = $base . '-' . bin2hex(random_bytes(2)); $t = $p->prepare('SELECT 1 FROM users WHERE handle = ?'); $t->execute(array($handle)); } while ($t->fetchColumn());
            $sponsor = preg_match('/^r[a-z0-9]{10}$/', (string) ($e['sponsor'] ?? '')) ? (string) $e['sponsor'] : null;
            $p->prepare('INSERT INTO users(email, emailNorm, handle, createdAt, sponsorCode) VALUES (?, ?, ?, ?, ?)')->execute(array($email, $norm, $handle, time(), $sponsor));
            $id = (int) $p->lastInsertId();
        }
        $p->prepare('INSERT INTO login_tokens(hash, userId, expiresAt) VALUES (?, ?, ?)')->execute(array(sha256_jeton($jeton), (int) $id, time() + 1800));
    });
    envoyer_mail($email, 'Votre lien de connexion Alphabette', "Bonjour,\n\nPour confirmer votre adresse et vous connecter (valable 30 minutes, une seule fois) :\n" . origine_publique() . "/api/createurs/auth.php?verifier=$jeton" . (in_array($e['retour'] ?? '', RETOURS_PERMIS, true) ? '&retour=' . rawurlencode((string) $e['retour']) : '') . "\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nAlphabette");
    repondre(200, array('ok' => true));   // même réponse que l'adresse existe ou non
}

if ($action === 'profil') {
    $u = exiger_utilisateur();
    $h = strtolower(trim((string) ($e['handle'] ?? '')));
    if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/', $h)) erreur(400, 'Pseudo : 3 à 30 caractères, lettres minuscules, chiffres et tirets.');
    try { db()->prepare('UPDATE users SET handle = ? WHERE id = ?')->execute(array($h, (int) $u['id'])); }
    catch (PDOException $x) { erreur(409, 'Ce pseudo est déjà pris.'); }
    $u['handle'] = $h;
    repondre(200, array('ok' => true, 'utilisateur' => identifiant_public($u)));
}

if ($action === 'quitter') {
    $j = (string) ($_COOKIE['ab_session'] ?? '');
    if (preg_match('/^[a-f0-9]{64}$/', $j)) db()->prepare('DELETE FROM sessions WHERE hash = ?')->execute(array(sha256_jeton($j)));
    cookie_pose('ab_session', '', 0);
    repondre(200, array('ok' => true));
}
erreur(400, 'Action inconnue.');
