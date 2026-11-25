<?php
/**
 * webhooks.php — réception SIGNÉE des événements de paiement Stripe pour l'abonnement 15 €/an.
 *
 *   POST (corps brut Stripe, en-tête Stripe-Signature: t=…,v1=…)
 *     checkout.session.completed  (payment_status = paid, amount_total = 1500, currency = eur, metadata.app = <slug>)
 *        → abonnement 365 jours + écritures 1000 c. créateur (en attente 14 jours) + 500 c. Alphabette
 *     charge.refunded             (payment_intent d'un abonnement)
 *        → abonnement « rembourse » + écritures inverses -1000 c. / -500 c.
 *
 *     Lot 5 : client_reference_id = « cmd_… » (commande préparée par affiliation.php ou boutique.php)
 *        → abonnement : commissions d'affiliation prélevées sur les 500 c. d'Alphabette (le créateur garde 1000 c.)
 *        → boost, pack, domaine, cadeau, pourboire, audit IA Pro, bounty : montant contrôlé contre la commande
 *
 * Sécurité : HMAC-SHA256 de « t.corps » avec le secret ALPHABETTE_WEBHOOK_SECRET, comparaison à temps constant,
 * horodatage à ±5 minutes (anti-rejeu). Idempotence stricte : providerEventId (id Stripe evt_…) clé primaire,
 * insérée dans la MÊME transaction que les écritures → un événement rejoué ne compte jamais deux fois.
 */
declare(strict_types=1);
require __DIR__ . '/croissance-commun.php'; // Lot 5 : affiliation et boutique (charge aussi finance-commun.php)
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

const TOLERANCE_SIGNATURE = 300;

/** Vérifie l'en-tête Stripe-Signature. Fonction pure (testée). */
function w_signature_valide(string $corps, string $entete, string $secret, int $maintenant): bool {
    if ($secret === '' || $entete === '') return false;
    $t = null; $v1 = array();
    foreach (explode(',', $entete) as $morceau) {
        $kv = explode('=', trim($morceau), 2);
        if (count($kv) !== 2) continue;
        if ($kv[0] === 't' && ctype_digit($kv[1])) $t = (int) $kv[1];
        if ($kv[0] === 'v1') $v1[] = $kv[1];
    }
    if ($t === null || !$v1 || abs($maintenant - $t) > TOLERANCE_SIGNATURE) return false;
    $attendu = hash_hmac('sha256', $t . '.' . $corps, $secret);
    foreach ($v1 as $s) if (hash_equals($attendu, $s)) return true;
    return false;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') f_erreur(405, 'Méthode non permise.');
$corps = file_get_contents('php://input') ?: '';
if (strlen($corps) > 262144) f_erreur(413, 'Événement trop gros.');
$secret = f_reglage('ALPHABETTE_WEBHOOK_SECRET', 'webhook_secret');
if ($secret === '') f_erreur(503, 'Webhook non configuré.');
if (!w_signature_valide($corps, (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? ''), $secret, f_maintenant())) f_erreur(400, 'Signature invalide.');

$ev = json_decode($corps, true);
$evId = is_array($ev) ? (string) ($ev['id'] ?? '') : '';
if (!preg_match('/^evt_[A-Za-z0-9_]{6,80}$/', $evId)) f_erreur(400, 'Événement illisible.');
$type = (string) ($ev['type'] ?? '');
$o = is_array($ev['data']['object'] ?? null) ? $ev['data']['object'] : array();

$alerte = null;
$resultat = f_transaction(function (PDO $db) use ($evId, $type, $o, &$alerte) {
    $t = f_maintenant();
    $ins = $db->prepare('INSERT OR IGNORE INTO webhook_events (provider_event_id, type, resultat, recu_le) VALUES (?, ?, ?, ?)');
    $ins->execute(array($evId, $type, 'en_cours', $t));
    if ($ins->rowCount() === 0) return 'deja_traite';
    $fin = function (string $r) use ($db, $evId) { $db->prepare('UPDATE webhook_events SET resultat = ? WHERE provider_event_id = ?')->execute(array($r, $evId)); return $r; };

    if ($type === 'checkout.session.completed') {
        if (($o['payment_status'] ?? '') !== 'paid') return $fin('ignore_non_paye');
        $montant = $o['amount_total'] ?? null;
        $devise = strtolower((string) ($o['currency'] ?? ''));
        $email = (string) ($o['customer_details']['email'] ?? '');
        $acheteur = $email !== '' ? f_email_hash($email) : null;
        // Lot 5 : commande préparée côté serveur (prix calculé ici, jamais par la page).
        $cmd = null;
        $cref = (string) ($o['client_reference_id'] ?? '');
        if (preg_match('/^cmd_[a-f0-9]{24}$/', $cref)) {
            $q = c_db()->prepare('SELECT * FROM commandes WHERE id = ?'); $q->execute(array($cref));
            $cmd = $q->fetch() ?: null;
        }
        if ($cmd && $cmd['type'] !== 'abonnement') {
            if (!is_int($montant) || $montant !== (int) $cmd['montant_centimes'] || $devise !== 'eur') {
                $alerte = "Paiement de " . var_export($montant, true) . " c. pour la commande {$cmd['id']} ({$cmd['type']}, attendu {$cmd['montant_centimes']} c.) — événement $evId ignoré.";
                return $fin('ignore_montant');
            }
            $mails = c_executer($db, $cmd, $evId, $t);
            $GLOBALS['mails_apres'] = $mails;
            return $fin('commande_' . $cmd['type']);
        }
        $app = (string) ($o['metadata']['app'] ?? ($cmd['app_slug'] ?? ''));
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', $app)) return $fin('ignore_sans_appli');
        if (!is_int($montant) || $montant !== PRIX_ABONNEMENT_CENTIMES || $devise !== 'eur') {
            $alerte = "Paiement reçu avec un montant inattendu (" . var_export($montant, true) . ") pour $app — événement $evId ignoré.";
            return $fin('ignore_montant');
        }
        $ref = (string) ($o['payment_intent'] ?? '') ?: (string) ($o['id'] ?? '');
        if ($ref === '') return $fin('ignore_sans_reference');
        $q = $db->prepare('INSERT OR IGNORE INTO abonnements (app_slug, abonne_hash, paiement_ref, montant_centimes, debut, fin, statut, provider_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $q->execute(array($app, $acheteur, $ref, PRIX_ABONNEMENT_CENTIMES, $t, $t + DUREE_ABONNEMENT_SECONDES, 'actif', $evId));
        if ($q->rowCount() === 0) return $fin('deja_enregistre'); // même paiement reçu sous un autre événement
        $abo = (int) $db->lastInsertId();
        $db->prepare('INSERT OR IGNORE INTO applis (slug, createur_id, maj) VALUES (?, NULL, ?)')->execute(array($app, $t));
        if ($cmd) $db->prepare("UPDATE commandes SET statut = 'payee', paye_le = ?, provider_event_id = ? WHERE id = ?")->execute(array($t, $evId, $cmd['id']));
        // 1000 c. créateur (toujours) ; affiliation éventuelle prélevée sur les 500 c. d'Alphabette.
        c_repartir_abonnement($db, $abo, $app, $cmd && $cmd['app_slug'] === $app ? $cmd : null, $evId, $t, $acheteur);
        return $fin('abonnement_cree');
    }

    if ($type === 'charge.refunded') {
        $ref = (string) ($o['payment_intent'] ?? '');
        if ($ref === '') return $fin('ignore_sans_reference');
        $q = $db->prepare("SELECT * FROM abonnements WHERE paiement_ref = ? AND statut = 'actif'"); $q->execute(array($ref));
        $abo = $q->fetch();
        if (!$abo) { $alerte = "Remboursement Stripe $ref sans abonnement connu (boost, pack, cadeau… ?) : à vérifier à la main."; return $fin('ignore_inconnu'); }
        // Remboursement total seulement (aucun prorata) : on inverse exactement les écritures d'origine.
        $db->prepare("UPDATE abonnements SET statut = 'rembourse', fin = ? WHERE id = ?")->execute(array($t, (int) $abo['id']));
        $q = $db->prepare("SELECT * FROM ecritures WHERE abonnement_id = ? AND montant_centimes > 0"); $q->execute(array((int) $abo['id']));
        $inv = $db->prepare('INSERT INTO ecritures (compte_id, beneficiaire, type, montant_centimes, app_slug, abonnement_id, provider_event_id, disponible_le, cree_le, libelle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($q->fetchAll() as $orig) {
            $inv->execute(array($orig['compte_id'], $orig['beneficiaire'], $orig['beneficiaire'] === 'createur' ? 'remboursement' : 'remboursement_alphabette',
                -(int) $orig['montant_centimes'], $orig['app_slug'], (int) $abo['id'], $evId,
                // Si la vente était encore en attente, l'annulation reste dans « en attente » ; sinon débit immédiat.
                max($t, (int) $orig['disponible_le']), $t,'Remboursement de l\'abonnement'));
        }
        // Lot 5 : les jours offerts au parrain d'une invitation disparaissent avec l'abonnement remboursé.
        c_db();
        $db->prepare("DELETE FROM droits WHERE source = 'invitation' AND source_id = ?")->execute(array((string) $abo['id']));
        $db->prepare('DELETE FROM invitations WHERE abonnement_id = ?')->execute(array((int) $abo['id']));
        return $fin('rembourse');
    }
    return $fin('ignore_type');
});

if (!empty($GLOBALS['mails_apres'])) c_envoyer($GLOBALS['mails_apres']);
if ($alerte) f_mail(ADMIN_EMAIL, '[Alphabette] Paiement à vérifier', $alerte);
f_repondre(200, array('recu' => true, 'resultat' => $resultat));
