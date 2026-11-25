<?php
/**
 * billing.php — compte créateur et tableau de bord « Mes revenus » (alphabette.eu/mes-revenus/).
 * Modèle unique : 15,00 €/an (1500 c.) = 10,00 € créateur (1000 c.) + 5,00 € Alphabette (500 c.). Zéro Pass 40 €, zéro prorata.
 *
 *   GET  ?tarif                                  → { prixCents:1500, createurCents:1000, alphabetteCents:500, seuilVirementCents:2000 }
 *   GET  ?simulation&abonnes=N                   → revenu INDICATIF (N × 1000 c.), aucun engagement
 *   POST { action:"connexion", email }           → envoie un code à 6 chiffres (15 min) par e-mail
 *   POST { action:"code", email, code }          → { jeton }  (à renvoyer en « Authorization: Bearer … », pas de cookie)
 *   POST { action:"deconnexion" }
 *   GET  ?revenus                    (connecté)  → abonnés actifs, revenus, gains en attente / solde disponible, IBAN masqué
 *   GET  ?historique[&type=&app=&du=AAAA-MM-JJ&au=AAAA-MM-JJ&page=1]  (connecté)
 *   POST { action:"iban", iban }     (connecté)  → IBAN chiffré AES-256-GCM, renvoie la forme masquée
 *   POST { action:"lier_app", slug, email }  (admin, X-Admin-Password) → rattache une appli à son créateur
 */
declare(strict_types=1);
require __DIR__ . '/finance-commun.php';
f_entetes();

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function b_slug(string $s): string { return preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', $s) ? $s : ''; }
function b_date(string $s, bool $fin): ?int {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) return null;
    $t = strtotime($s . ($fin ? ' 23:59:59' : ' 00:00:00') . ' UTC');
    return $t === false ? null : $t;
}

if ($methode === 'GET') {
    if (isset($_GET['tarif'])) {
        f_repondre(200, array('prixCents' => PRIX_ABONNEMENT_CENTIMES, 'createurCents' => PART_CREATEUR_CENTIMES,
            'alphabetteCents' => PART_ALPHABETTE_CENTIMES, 'seuilVirementCents' => SEUIL_VIREMENT_CENTIMES,
            'rappel' => '15 €/an = 10 € créateur / 5 € Alphabette'));
    }
    if (isset($_GET['simulation'])) {
        $n = (string) ($_GET['abonnes'] ?? '0');
        if (!ctype_digit($n) || strlen($n) > 7) f_erreur(400, 'Nombre d\'abonnés invalide.');
        $n = (int) $n;
        $c = $n * PART_CREATEUR_CENTIMES;
        f_repondre(200, array('abonnes' => $n, 'revenuAnnuelCents' => $c, 'revenuAnnuel' => f_euros($c),
            'indicatif' => true, 'note' => 'Simulation indicative : ' . $n . ' abonné(s) × 10,00 €. Aucun revenu garanti.'));
    }
    $c = f_compte_connecte();
    $id = (int) $c['id'];
    $db = f_db();
    $t = f_maintenant();

    if (isset($_GET['revenus'])) {
        $q = $db->prepare("SELECT a.slug, (SELECT COUNT(*) FROM abonnements s WHERE s.app_slug = a.slug AND s.statut = 'actif' AND s.fin > ?) AS actifs
                           FROM applis a WHERE a.createur_id = ? ORDER BY a.slug");
        $q->execute(array($t, $id));
        $applis = array(); $actifs = 0;
        foreach ($q->fetchAll() as $a) { $n = (int) $a['actifs']; $actifs += $n; $applis[] = array('slug' => $a['slug'], 'abonnesActifs' => $n, 'revenusCents' => $n * PART_CREATEUR_CENTIMES); }
        $s = f_soldes($id);
        $v = $db->prepare("SELECT id, montant_centimes, statut, cree_le FROM virements WHERE compte_id = ? ORDER BY id DESC LIMIT 1");
        $v->execute(array($id));
        $dernier = $v->fetch() ?: null;
        f_repondre(200, array(
            'email' => $c['email'], 'abonnesActifs' => $actifs, 'revenusCents' => $actifs * PART_CREATEUR_CENTIMES,
            'applis' => $applis, 'seuilVirementCents' => SEUIL_VIREMENT_CENTIMES,
            'progressionVirement' => min(100, intdiv(max(0, $s['availableBalanceCents']) * 100, SEUIL_VIREMENT_CENTIMES)),
            'ibanMasque' => f_iban_masque_compte($c), 'virementEnCours' => $dernier && $dernier['statut'] === 'demande',
            'dernierVirement' => $dernier, 'rappel' => '15 €/an = 10 € créateur / 5 € Alphabette',
        ) + $s);
    }

    if (isset($_GET['historique'])) {
        $where = array('compte_id = ?', "beneficiaire = 'createur'"); $p = array($id);
        $type = (string) ($_GET['type'] ?? '');
        if ($type !== '') { if (!in_array($type, array('vente', 'remboursement', 'virement', 'virement_annule'), true)) f_erreur(400, 'Type inconnu.'); $where[] = 'type = ?'; $p[] = $type; }
        $app = b_slug((string) ($_GET['app'] ?? ''));
        if ($app !== '') { $where[] = 'app_slug = ?'; $p[] = $app; }
        if (($du = b_date((string) ($_GET['du'] ?? ''), false)) !== null) { $where[] = 'cree_le >= ?'; $p[] = $du; }
        if (($au = b_date((string) ($_GET['au'] ?? ''), true)) !== null) { $where[] = 'cree_le <= ?'; $p[] = $au; }
        $page = max(1, min(1000, (int) ($_GET['page'] ?? 1)));
        $q = $db->prepare('SELECT type, montant_centimes, app_slug, libelle, cree_le, disponible_le FROM ecritures WHERE ' . implode(' AND ', $where) . ' ORDER BY id DESC LIMIT 51 OFFSET ' . (($page - 1) * 50));
        $q->execute($p);
        $l = $q->fetchAll();
        $suite = count($l) > 50;
        $l = array_map(function ($e) use ($t) {
            return array('type' => $e['type'], 'montantCents' => (int) $e['montant_centimes'], 'montant' => f_euros((int) $e['montant_centimes']),
                'app' => $e['app_slug'], 'libelle' => $e['libelle'], 'date' => gmdate('c', (int) $e['cree_le']),
                'enAttente' => (int) $e['disponible_le'] > $t, 'disponibleLe' => gmdate('c', (int) $e['disponible_le']));
        }, array_slice($l, 0, 50));
        f_repondre(200, array('lignes' => $l, 'page' => $page, 'suite' => $suite));
    }
    f_erreur(400, 'Demande inconnue.');
}

if ($methode !== 'POST') f_erreur(405, 'Méthode non permise.');
$e = f_corps();
$action = (string) ($e['action'] ?? '');

if ($action === 'connexion') {
    $email = trim((string) ($e['email'] ?? ''));
    if (!f_email_valide($email)) f_erreur(400, 'Adresse e-mail invalide.');
    if (!f_limite('connexion-ip|' . f_empreinte_ip(), 20, 3600) || !f_limite('connexion|' . f_email_hash($email), 5, 3600)) f_erreur(429, 'Trop de demandes : réessayez dans une heure.');
    $c = f_compte_par_email($email, true);
    if (!$c || $c['supprime_le']) f_erreur(503, 'Compte indisponible.');
    $code = f_otp_creer((int) $c['id'], 'connexion');
    f_mail((string) $c['email'], 'Votre code de connexion Alphabette', "Votre code : $code\n\nIl est valable 15 minutes. Si vous n'avez rien demandé, ignorez ce message.");
    f_repondre(200, array('ok' => true, 'message' => 'Un code à 6 chiffres vient de partir par e-mail (valable 15 minutes).'));
}

if ($action === 'code') {
    $email = trim((string) ($e['email'] ?? ''));
    $c = f_email_valide($email) ? f_compte_par_email($email, false) : null;
    if (!$c || $c['supprime_le']) f_erreur(400, 'Code incorrect ou expiré.');
    $r = f_transaction(function (PDO $db) use ($c, $e) { return f_otp_verifier($db, (int) $c['id'], 'connexion', (string) ($e['code'] ?? '')); });
    if ($r !== 'ok') f_erreur($r === 'bloque' ? 429 : 400, $r === 'bloque' ? 'Trop d\'essais : demandez un nouveau code.' : 'Code incorrect ou expiré.');
    f_repondre(200, array('ok' => true, 'jeton' => f_ouvrir_session((int) $c['id'])));
}

if ($action === 'deconnexion') {
    $h = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^Bearer\s+(\S+)$/', $h, $m)) f_db()->prepare('DELETE FROM sessions WHERE jeton_hash = ?')->execute(array(hash('sha256', $m[1])));
    f_repondre(200, array('ok' => true));
}

if ($action === 'iban') {
    $c = f_compte_connecte();
    $iban = f_iban_normaliser((string) ($e['iban'] ?? ''));
    if (!f_iban_valide($iban)) f_erreur(400, 'IBAN invalide : vérifiez les chiffres.');
    $id = (int) $c['id'];
    $chiffre = f_chiffrer($iban, 'iban:' . $id);
    f_db()->prepare('UPDATE comptes SET iban_chiffre = ?, iban_fin = ?, iban_pays = ? WHERE id = ?')->execute(array($chiffre, substr($iban, -4), substr($iban, 0, 4), $id));
    f_repondre(200, array('ok' => true, 'ibanMasque' => substr($iban, 0, 4) . ' •••• •••• ' . substr($iban, -4)));
}

if ($action === 'lier_app') {
    f_admin();
    $slug = b_slug((string) ($e['slug'] ?? ''));
    $email = trim((string) ($e['email'] ?? ''));
    if ($slug === '' || !f_email_valide($email)) f_erreur(400, 'Slug ou e-mail invalide.');
    $c = f_compte_par_email($email, true);
    f_db()->prepare('INSERT INTO applis (slug, createur_id, maj) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET createur_id = excluded.createur_id, maj = excluded.maj')
        ->execute(array($slug, (int) $c['id'], f_maintenant()));
    f_repondre(200, array('ok' => true, 'slug' => $slug, 'compte' => (int) $c['id']));
}

f_erreur(400, 'Action inconnue.');
