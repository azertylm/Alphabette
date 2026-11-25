<?php
/**
 * newsletter.php — Lot 5 : lettre d'information avec double confirmation, sans traceur (ni pixel, ni lien pisté).
 *   POST { action:"inscrire", email }                   → e-mail de confirmation (même réponse que l'adresse existe ou non)
 *   GET  ?confirmer=<email>&j=<sig>  |  ?desinscrire=<email>&j=<sig>   → petite page de confirmation
 *   GET  ?admin                       (X-Admin-Password) → nombre d'inscrits confirmés, derniers envois
 *   POST { action:"envoyer", sujet, texte, test? }     (admin) → envoi à tous les confirmés (1 envoi réel par 24 h ; test = à l'admin seul)
 */
declare(strict_types=1);
require __DIR__ . '/croissance-commun.php';
f_entetes();

function n_sig(string $but, string $email): string { return substr(f_hmac("newsletter|$but|" . mb_strtolower($email, 'UTF-8')), 0, 32); }
function n_lien(string $but, string $email): string { return 'https://alphabette.eu/api/newsletter.php?' . $but . '=' . rawurlencode($email) . '&j=' . n_sig($but, $email); }
function n_page(string $titre, string $texte): void {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>'
        . htmlspecialchars($titre) . '</title><style>body{font:18px/1.6 system-ui,sans-serif;max-width:560px;margin:10vh auto;padding:0 16px}a{color:#4338ca}</style></head><body><h1>'
        . htmlspecialchars($titre) . '</h1><p>' . htmlspecialchars($texte) . '</p><p><a href="https://alphabette.eu/">Retour au Laboratoire</a></p></body></html>';
    exit;
}

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($methode === 'GET') {
    foreach (array('confirmer', 'desinscrire') as $but) {
        if (!isset($_GET[$but])) continue;
        $email = (string) $_GET[$but];
        if (!f_email_valide($email) || !hash_equals(n_sig($but, $email), (string) ($_GET['j'] ?? ''))) n_page('Lien invalide', 'Ce lien n\'est pas valable.');
        $db = c_db();
        if ($but === 'confirmer') { $db->prepare('UPDATE newsletter SET confirme = 1 WHERE email_hash = ?')->execute(array(f_email_hash($email))); n_page('Inscription confirmée', 'Merci ! Vous recevrez les nouvelles du Laboratoire, au plus une fois par semaine.'); }
        $db->prepare('DELETE FROM newsletter WHERE email_hash = ?')->execute(array(f_email_hash($email)));
        n_page('Désinscription faite', 'Votre adresse est effacée de la liste. Aucun autre message ne vous sera envoyé.');
    }
    if (isset($_GET['admin'])) {
        f_admin();
        $db = c_db();
        f_repondre(200, array('confirmes' => (int) $db->query('SELECT COUNT(*) FROM newsletter WHERE confirme = 1')->fetchColumn(),
            'enAttente' => (int) $db->query('SELECT COUNT(*) FROM newsletter WHERE confirme = 0')->fetchColumn(),
            'envois' => $db->query('SELECT sujet, nb, envoye_le FROM newsletter_envois ORDER BY id DESC LIMIT 20')->fetchAll()));
    }
    f_erreur(400, 'Demande inconnue.');
}
if ($methode !== 'POST') f_erreur(405, 'Méthode non permise.');
$e = f_corps();
$action = (string) ($e['action'] ?? '');

if ($action === 'inscrire') {
    $email = mb_strtolower(trim((string) ($e['email'] ?? '')), 'UTF-8');
    if (!f_email_valide($email)) f_erreur(400, 'Adresse e-mail invalide.');
    if (!f_limite('newsletter|' . f_empreinte_ip(), 10, 3600) || !f_limite('newsletter|' . f_email_hash($email), 3, 86400)) f_erreur(429, 'Trop de demandes.');
    $q = c_db()->prepare('INSERT OR IGNORE INTO newsletter (email_hash, email, confirme, cree_le) VALUES (?, ?, 0, ?)');
    $q->execute(array(f_email_hash($email), $email, f_maintenant()));
    f_mail($email, 'Confirmez votre inscription à la lettre Alphabette', "Bonjour,\n\nPour recevoir les nouvelles du Laboratoire Alphabette, confirmez ici :\n" . n_lien('confirmer', $email) . "\n\nSi vous n'avez rien demandé, ignorez ce message.");
    f_repondre(200, array('ok' => true, 'message' => 'Un e-mail de confirmation vient de partir.'));
}

if ($action === 'envoyer') {
    f_admin();
    $sujet = mb_substr(trim(strip_tags((string) ($e['sujet'] ?? ''))), 0, 140);
    $texte = mb_substr(trim(strip_tags((string) ($e['texte'] ?? ''))), 0, 20000);
    if (mb_strlen($sujet) < 3 || mb_strlen($texte) < 20) f_erreur(400, 'Sujet et texte obligatoires.');
    if (($e['test'] ?? false) === true) { f_mail(ADMIN_EMAIL, '[TEST] ' . $sujet, $texte . "\n\n— Se désinscrire : (lien personnel ajouté à chaque envoi réel)"); f_repondre(200, array('ok' => true, 'test' => true)); }
    $db = c_db();
    $dernier = (int) $db->query('SELECT COALESCE(MAX(envoye_le), 0) FROM newsletter_envois')->fetchColumn();
    if (f_maintenant() - $dernier < 86400) f_erreur(429, 'Un seul envoi par 24 heures.');
    $n = 0;
    foreach ($db->query('SELECT email FROM newsletter WHERE confirme = 1')->fetchAll() as $l) {
        if (f_mail((string) $l['email'], $sujet, $texte . "\n\n—\nVous recevez ce message car vous êtes inscrit(e) à la lettre du Laboratoire Alphabette.\nSe désinscrire en un clic : " . n_lien('desinscrire', (string) $l['email']))) $n++;
    }
    $db->prepare('INSERT INTO newsletter_envois (sujet, nb, envoye_le) VALUES (?, ?, ?)')->execute(array($sujet, $n, f_maintenant()));
    f_repondre(200, array('ok' => true, 'envoyes' => $n));
}
f_erreur(400, 'Action inconnue.');
