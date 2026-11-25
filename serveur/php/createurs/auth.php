<?php
/**
 * auth.php — comptes par lien magique (aucun mot de passe), session par cookie HttpOnly.
 *   POST { action:"demander", email, handle? }   → { ok }          envoie le lien (5 par heure et par connexion, 3 par adresse)
 *   GET  ?verifier=<jeton>                        → confirme l'e-mail (emailVerified), ouvre la session, redirige vers /soumettre/
 *   GET  ?moi                                     → { connecte, utilisateur? }
 *   POST { action:"profil", handle }              → { ok, utilisateur }
 *   POST { action:"quitter" }                     → { ok }
 */
require __DIR__ . '/_lib.php';

if (isset($_GET['verifier'])) {
    $jeton = (string) $_GET['verifier'];
    if (!preg_match('/^[a-f0-9]{64}$/', $jeton)) { header('Location: ' . origine_publique() . '/soumettre/?lien=invalide'); exit; }
    $uid = transaction(function (PDO $p) use ($jeton) {
        $s = $p->prepare('SELECT userId FROM login_tokens WHERE hash = ? AND usedAt IS NULL AND expiresAt > ?');
        $s->execute(array(sha256_jeton($jeton), time()));
        $id = $s->fetchColumn();
        if ($id === false) return null;
        $p->prepare('UPDATE login_tokens SET usedAt = ? WHERE hash = ?')->execute(array(time(), sha256_jeton($jeton)));
        $p->prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')->execute(array((int) $id));
        return (int) $id;
    });
    if ($uid === null) { header('Location: ' . origine_publique() . '/soumettre/?lien=expire'); exit; }
    creer_session($uid);
    header('Location: ' . origine_publique() . '/soumettre/?connecte=1');
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
            $p->prepare('INSERT INTO users(email, emailNorm, handle, createdAt) VALUES (?, ?, ?, ?)')->execute(array($email, $norm, $handle, time()));
            $id = (int) $p->lastInsertId();
        }
        $p->prepare('INSERT INTO login_tokens(hash, userId, expiresAt) VALUES (?, ?, ?)')->execute(array(sha256_jeton($jeton), (int) $id, time() + 1800));
    });
    envoyer_mail($email, 'Votre lien de connexion Alphabette', "Bonjour,\n\nPour confirmer votre adresse et vous connecter (valable 30 minutes, une seule fois) :\n" . origine_publique() . "/api/createurs/auth.php?verifier=$jeton\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nAlphabette");
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
