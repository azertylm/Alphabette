<?php
/**
 * payouts.php — virements aux créateurs. Seuil : 20,00 € (2000 c.) de SOLDE DISPONIBLE + IBAN valide.
 *
 *   POST { action:"demander" }          (connecté) → envoie un code à 6 chiffres (15 min) par e-mail
 *   POST { action:"confirmer", code }   (connecté) → crée le virement du solde disponible entier
 *   GET  ?admin                         (X-Admin-Password) → virements à faire, IBAN déchiffré pour l'admin seulement
 *   POST { action:"marquer_paye"|"rejeter", id }  (admin)
 *
 * Verrous : transaction BEGIN IMMEDIATE + index unique « un seul virement 'demande' par compte » → un double clic,
 * deux onglets ou un rejeu du code ne créent jamais deux virements. Le code est à usage unique (5 essais max).
 */
declare(strict_types=1);
require __DIR__ . '/finance-commun.php';
f_entetes();

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function p_iban_clair(array $c): ?string {
    if (empty($c['iban_chiffre'])) return null;
    $i = f_dechiffrer((string) $c['iban_chiffre'], 'iban:' . (int) $c['id']);
    return ($i !== null && f_iban_valide($i)) ? $i : null;
}

/** Contrôles communs ; renvoie le solde disponible (centimes) ou arrête avec un message clair. */
function p_controles(PDO $db, array $c): int {
    $s = f_soldes((int) $c['id']);
    if ($s['availableBalanceCents'] < SEUIL_VIREMENT_CENTIMES)
        f_erreur(400, 'Le virement s\'ouvre à partir de 20,00 € disponibles (vous avez ' . f_euros($s['availableBalanceCents']) . ').', array('code' => 'seuil'));
    if (p_iban_clair($c) === null) f_erreur(400, 'Ajoutez d\'abord un IBAN valide.', array('code' => 'iban'));
    $q = $db->prepare("SELECT COUNT(*) FROM virements WHERE compte_id = ? AND statut = 'demande'"); $q->execute(array((int) $c['id']));
    if ((int) $q->fetchColumn() > 0) f_erreur(409, 'Un virement est déjà en cours.', array('code' => 'en_cours'));
    return $s['availableBalanceCents'];
}

if ($methode === 'GET' && isset($_GET['admin'])) {
    f_admin();
    $l = f_db()->query("SELECT v.*, c.email, c.iban_chiffre, c.id AS cid FROM virements v JOIN comptes c ON c.id = v.compte_id WHERE v.statut = 'demande' ORDER BY v.id")->fetchAll();
    f_repondre(200, array('virements' => array_map(function ($v) {
        return array('id' => (int) $v['id'], 'montantCents' => (int) $v['montant_centimes'], 'montant' => f_euros((int) $v['montant_centimes']),
            'email' => $v['email'], 'iban' => p_iban_clair(array('id' => $v['cid'], 'iban_chiffre' => $v['iban_chiffre'])), 'demandeLe' => gmdate('c', (int) $v['cree_le']));
    }, $l)));
}
if ($methode !== 'POST') f_erreur(405, 'Méthode non permise.');
$e = f_corps();
$action = (string) ($e['action'] ?? '');

if ($action === 'demander') {
    $c = f_compte_connecte();
    $dispo = p_controles(f_db(), $c);
    if (!f_limite('virement|' . (int) $c['id'], 5, 3600)) f_erreur(429, 'Trop de demandes : réessayez dans une heure.');
    $code = f_otp_creer((int) $c['id'], 'virement');
    f_mail((string) $c['email'], 'Confirmez votre virement Alphabette',
        "Code de confirmation : $code (valable 15 minutes).\nMontant : " . f_euros($dispo) . "\nIBAN : " . f_iban_masque_compte($c) . "\n\nSi vous n'avez rien demandé, ignorez ce message et changez votre adresse e-mail.");
    f_repondre(200, array('ok' => true, 'message' => 'Code envoyé par e-mail : saisissez-le pour confirmer.', 'montantCents' => $dispo));
}

if ($action === 'confirmer') {
    $c = f_compte_connecte();
    $id = (int) $c['id'];
    $code = (string) ($e['code'] ?? '');
    $r = f_transaction(function (PDO $db) use ($c, $id, $code) {
        $otp = f_otp_verifier($db, $id, 'virement', $code);
        if ($otp !== 'ok') return array('otp' => $otp);
        $montant = p_controles($db, $c); // revérifié sous verrou
        $t = f_maintenant();
        $db->prepare("INSERT INTO virements (compte_id, montant_centimes, iban_fin, statut, cree_le) VALUES (?, ?, ?, 'demande', ?)")->execute(array($id, $montant, $c['iban_fin'], $t));
        $vid = (int) $db->lastInsertId();
        $db->prepare("INSERT INTO ecritures (compte_id, beneficiaire, type, montant_centimes, virement_id, disponible_le, cree_le, libelle) VALUES (?, 'createur', 'virement', ?, ?, ?, ?, ?)")
            ->execute(array($id, -$montant, $vid, $t, $t, 'Virement demandé vers ' . f_iban_masque_compte($c)));
        return array('otp' => 'ok', 'id' => $vid, 'montant' => $montant);
    });
    if ($r['otp'] !== 'ok') f_erreur($r['otp'] === 'bloque' ? 429 : 400, $r['otp'] === 'bloque' ? 'Trop d\'essais : redemandez un code.' : 'Code incorrect ou expiré.');
    f_mail(f_admin_email(), '[Alphabette] Virement créateur à faire', 'Virement n° ' . $r['id'] . ' : ' . f_euros($r['montant']) . " (voir payouts.php?admin).");
    f_repondre(200, array('ok' => true, 'virement' => $r['id'], 'montantCents' => $r['montant'], 'message' => 'Virement demandé : ' . f_euros($r['montant']) . '. Il part sous 7 jours ouvrés.'));
}

if ($action === 'marquer_paye' || $action === 'rejeter') {
    f_admin();
    $vid = (int) ($e['id'] ?? 0);
    $ok = f_transaction(function (PDO $db) use ($vid, $action) {
        $q = $db->prepare("SELECT * FROM virements WHERE id = ? AND statut = 'demande'"); $q->execute(array($vid));
        $v = $q->fetch();
        if (!$v) return false;
        $t = f_maintenant();
        $db->prepare('UPDATE virements SET statut = ?, traite_le = ? WHERE id = ?')->execute(array($action === 'rejeter' ? 'annule' : 'paye', $t, $vid));
        if ($action === 'rejeter') $db->prepare("INSERT INTO ecritures (compte_id, beneficiaire, type, montant_centimes, virement_id, disponible_le, cree_le, libelle) VALUES (?, 'createur', 'virement_annule', ?, ?, ?, ?, 'Virement annulé : somme recréditée')")
            ->execute(array((int) $v['compte_id'], (int) $v['montant_centimes'], $vid, $t, $t));
        return true;
    });
    if (!$ok) f_erreur(404, 'Virement introuvable ou déjà traité.');
    f_repondre(200, array('ok' => true));
}

f_erreur(400, 'Action inconnue.');
