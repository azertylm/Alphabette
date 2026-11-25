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
 * Sécurité : HMAC-SHA256 de « t.corps » avec le secret ALPHABETTE_WEBHOOK_SECRET, comparaison à temps constant,
 * horodatage à ±5 minutes (anti-rejeu). Idempotence stricte : providerEventId (id Stripe evt_…) clé primaire,
 * insérée dans la MÊME transaction que les écritures → un événement rejoué ne compte jamais deux fois.
 */
declare(strict_types=1);
require __DIR__ . '/finance-commun.php';
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
        $app = (string) ($o['metadata']['app'] ?? '');
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', $app)) return $fin('ignore_sans_appli');
        $montant = $o['amount_total'] ?? null;
        if (!is_int($montant) || $montant !== PRIX_ABONNEMENT_CENTIMES || strtolower((string) ($o['currency'] ?? '')) !== 'eur') {
            $alerte = "Paiement reçu avec un montant inattendu (" . var_export($montant, true) . ") pour $app — événement $evId ignoré.";
            return $fin('ignore_montant');
        }
        $ref = (string) ($o['payment_intent'] ?? '') ?: (string) ($o['id'] ?? '');
        if ($ref === '') return $fin('ignore_sans_reference');
        $email = (string) ($o['customer_details']['email'] ?? '');
        $q = $db->prepare('INSERT OR IGNORE INTO abonnements (app_slug, abonne_hash, paiement_ref, montant_centimes, debut, fin, statut, provider_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $q->execute(array($app, $email !== '' ? f_email_hash($email) : null, $ref, PRIX_ABONNEMENT_CENTIMES, $t, $t + DUREE_ABONNEMENT_SECONDES, 'actif', $evId));
        if ($q->rowCount() === 0) return $fin('deja_enregistre'); // même paiement reçu sous un autre événement
        $abo = (int) $db->lastInsertId();
        $db->prepare('INSERT OR IGNORE INTO applis (slug, createur_id, maj) VALUES (?, NULL, ?)')->execute(array($app, $t));
        $q = $db->prepare('SELECT createur_id FROM applis WHERE slug = ?'); $q->execute(array($app));
        $createur = $q->fetchColumn();
        $e = $db->prepare('INSERT INTO ecritures (compte_id, beneficiaire, type, montant_centimes, app_slug, abonnement_id, provider_event_id, disponible_le, cree_le, libelle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        if ($createur) $e->execute(array((int) $createur, 'createur', 'vente', PART_CREATEUR_CENTIMES, $app, $abo, $evId, $t + f_delai_disponibilite(), $t, 'Abonnement 15 €/an — part créateur'));
        else $e->execute(array(null, 'alphabette', 'vente_sans_createur', PART_CREATEUR_CENTIMES, $app, $abo, $evId, $t, $t, 'Abonnement 15 €/an — appli d\'Alphabette'));
        $e->execute(array(null, 'alphabette', 'commission', PART_ALPHABETTE_CENTIMES, $app, $abo, $evId, $t, $t, 'Abonnement 15 €/an — part Alphabette'));
        return $fin('abonnement_cree');
    }

    if ($type === 'charge.refunded') {
        $ref = (string) ($o['payment_intent'] ?? '');
        if ($ref === '') return $fin('ignore_sans_reference');
        $q = $db->prepare("SELECT * FROM abonnements WHERE paiement_ref = ? AND statut = 'actif'"); $q->execute(array($ref));
        $abo = $q->fetch();
        if (!$abo) return $fin('ignore_inconnu');
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
        return $fin('rembourse');
    }
    return $fin('ignore_type');
});

if ($alerte) f_mail(ADMIN_EMAIL, '[Alphabette] Paiement à vérifier', $alerte);
f_repondre(200, array('recu' => true, 'resultat' => $resultat));
