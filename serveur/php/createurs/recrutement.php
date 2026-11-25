<?php
/**
 * recrutement.php — Lot 5 : concours de recrutement mensuel des créateurs (alphabette.eu/rejoindre-createurs/).
 *   GET  ?concours=AAAA-MM   → Top 10 des parrains : nombre de filleuls inscrits ce mois-ci avec e-mail CONFIRMÉ sur .eu
 *                              (pseudos seulement ; un filleul compte une fois, jamais soi-même)
 *   POST { action:"clore", mois }   (admin /admin/validations + X-CSRF) → le n° 1 gagne un boost de 15 jours sur .fr pour
 *                              sa meilleure appli (une seule fois par mois ; aucun gagnant s'il n'a pas d'appli publiée)
 */
require __DIR__ . '/_lib.php';

function classement(string $mois): array {
    if (!preg_match('/^(\d{4})-(\d{2})$/', $mois, $m) || (int) $m[2] < 1 || (int) $m[2] > 12) erreur(400, 'Mois invalide (AAAA-MM).');
    $debut = gmmktime(0, 0, 0, (int) $m[2], 1, (int) $m[1]);
    $fin = gmmktime(0, 0, 0, (int) $m[2] + 1, 1, (int) $m[1]);
    $s = db()->prepare('SELECT sponsorCode AS code, COUNT(*) AS n, MIN(verifiedAt) AS premier FROM users
                        WHERE sponsorCode IS NOT NULL AND emailVerified = 1 AND verifiedAt >= ? AND verifiedAt < ? GROUP BY sponsorCode ORDER BY n DESC, premier ASC LIMIT 10');
    $s->execute(array($debut, $fin));
    $l = array();
    foreach ($s->fetchAll() as $r) {
        // Code de parrainage → compte financier → personne du service Créateurs (pour le pseudo et ses applis).
        $email = pont(function () use ($r) { $id = c_compte_par_code((string) $r['code']); return $id ? c_compte_email(c_db(), $id) : null; });
        $u = null;
        if ($email) { $q = db()->prepare('SELECT * FROM users WHERE emailNorm = ?'); $q->execute(array(email_normalise($email))); $u = $q->fetch() ?: null; }
        if (!$u) continue;
        $l[] = array('pseudo' => $u['handle'], 'filleuls' => (int) $r['n'], '_uid' => (int) $u['id'], '_email' => (string) $u['email']);
    }
    return $l;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $mois = (string) ($_GET['concours'] ?? gmdate('Y-m'));
    $l = classement($mois);
    repondre(200, array('mois' => $mois, 'recompense' => 'Boost de 15 jours sur alphabette.fr pour le n° 1',
        'top' => array_map(function ($x, $i) { return array('rang' => $i + 1, 'pseudo' => $x['pseudo'], 'filleuls' => $x['filleuls']); }, $l, array_keys($l))));
}

exiger_post();
$j = (string) ($_COOKIE['ab_admin'] ?? '');
$s = null;
if (preg_match('/^[a-f0-9]{64}$/', $j)) { $q = db()->prepare('SELECT csrf FROM admin_sessions WHERE hash = ? AND expiresAt > ?'); $q->execute(array(sha256_jeton($j), time())); $s = $q->fetchColumn(); }
if (!$s) erreur(401, 'Connexion administrateur requise.');
if (!hash_equals((string) $s, (string) ($_SERVER['HTTP_X_CSRF'] ?? ''))) erreur(403, 'Jeton de sécurité invalide.');
$e = corps_json();
if ((string) ($e['action'] ?? '') !== 'clore') erreur(400, 'Action inconnue.');
$mois = (string) ($e['mois'] ?? '');
if ($mois >= gmdate('Y-m')) erreur(409, 'Le concours se clôt une fois le mois terminé.');
$l = classement($mois);
if (!$l) repondre(200, array('ok' => true, 'gagnant' => null));
$g = $l[0];
$q = db()->prepare("SELECT id FROM submissions WHERE userId = ? AND status IN ('published_fr','eligible_fr','lab_eu') ORDER BY status = 'published_fr' DESC, positiveCount DESC LIMIT 1");
$q->execute(array($g['_uid']));
$app = $q->fetchColumn();
if ($app === false) repondre(200, array('ok' => true, 'gagnant' => $g['pseudo'], 'boost' => null, 'note' => 'Le gagnant n\'a pas encore d\'appli publiée : boost à attribuer plus tard.'));
$b = pont(function () use ($mois, $g, $app) { return c_concours_attribuer($mois, $g['_email'], (string) $app); });
if ($b) envoyer_mail($g['_email'], 'Vous gagnez le concours de recrutement Alphabette !', "Bravo ! Avec {$g['filleuls']} créateurs parrainés en $mois, votre appli est mise en avant 15 jours sur alphabette.fr (du {$b['debut']} au {$b['fin']}).");
repondre(200, array('ok' => true, 'gagnant' => $g['pseudo'], 'boost' => $b));
