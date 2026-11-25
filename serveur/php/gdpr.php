<?php
/**
 * gdpr.php — RGPD du compte et statistiques sans pistage.
 *
 *   GET  ?politique                      → engagements (zéro cookie publicitaire, zéro traceur tiers, durées)
 *   POST { action:"visite", app }        → +1 au compteur du jour de l'appli (aucune IP, aucun cookie, aucun identifiant)
 *   GET  ?export            (connecté)   → « Exporter mes données (JSON) » : tout ce qui concerne le compte
 *   POST { action:"supprimer", confirmation:"SUPPRIMER" }  (connecté) → « Supprimer mon compte »
 *        Anonymise e-mail, pseudo, IBAN, sessions, codes et signalements ; GARDE les seules écritures comptables
 *        et virements (obligation légale : 10 ans, art. L123-22 du Code de commerce), détachés de toute identité.
 */
declare(strict_types=1);
require __DIR__ . '/finance-commun.php';
f_entetes();
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($methode === 'GET' && isset($_GET['politique'])) {
    f_repondre(200, array(
        'cookies' => 'Aucun cookie publicitaire ni de mesure d\'audience. La connexion utilise un jeton gardé sur votre appareil, envoyé seulement à Alphabette.',
        'traceurs_tiers' => 'Aucun.',
        'statistiques' => 'Compteur de visites par appli et par jour, sans adresse IP ni identifiant.',
        'adresse_ip' => 'Jamais enregistrée : seule une empreinte chiffrée sert à limiter les abus.',
        'iban' => 'Chiffré (AES-256-GCM), affiché masqué, lu uniquement pour faire votre virement.',
        'conservation' => 'Écritures comptables : 10 ans (obligation légale). Le reste est effacé à la suppression du compte.',
        'droits' => 'Export JSON et suppression du compte depuis /mes-revenus/. Contact : formulaire des mentions légales sur alphabette.eu.',
    ));
}

if ($methode === 'POST') {
    $e = f_corps();
    $action = (string) ($e['action'] ?? '');

    if ($action === 'visite') {
        $app = (string) ($e['app'] ?? '');
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', $app)) f_erreur(400, 'Appli inconnue.');
        f_db()->prepare('INSERT INTO visites (app_slug, jour, n) VALUES (?, ?, 1) ON CONFLICT(app_slug, jour) DO UPDATE SET n = n + 1')->execute(array($app, gmdate('Y-m-d', f_maintenant())));
        f_repondre(200, array('ok' => true));
    }

    if ($action === 'supprimer') {
        $c = f_compte_connecte();
        if (($e['confirmation'] ?? '') !== 'SUPPRIMER') f_erreur(400, 'Tapez SUPPRIMER pour confirmer.');
        $id = (int) $c['id'];
        $r = f_transaction(function (PDO $db) use ($id) {
            $q = $db->prepare("SELECT COUNT(*) FROM virements WHERE compte_id = ? AND statut = 'demande'"); $q->execute(array($id));
            if ((int) $q->fetchColumn() > 0) return 'virement';
            $t = f_maintenant();
            $db->prepare('UPDATE comptes SET email = NULL, email_hash = NULL, pseudo = NULL, iban_chiffre = NULL, iban_fin = NULL, iban_pays = NULL, supprime_le = ? WHERE id = ?')->execute(array($t, $id));
            $db->prepare('DELETE FROM sessions WHERE compte_id = ?')->execute(array($id));
            $db->prepare('DELETE FROM otp WHERE compte_id = ?')->execute(array($id));
            $db->prepare('DELETE FROM limites WHERE cle LIKE ?')->execute(array('%|' . $id));
            $db->prepare("UPDATE signalements SET rapporteur = 'anon:' || substr(hex(randomblob(12)), 1, 24) WHERE rapporteur = ?")->execute(array('c:' . $id));
            $db->prepare('UPDATE empreintes SET compte_id = NULL WHERE compte_id = ?')->execute(array($id));
            $db->prepare('UPDATE applis SET createur_id = NULL WHERE createur_id = ?')->execute(array($id));
            return 'ok';
        });
        if ($r === 'virement') f_erreur(409, 'Un virement est en cours : attendez qu\'il soit fait, puis supprimez le compte.');
        f_repondre(200, array('ok' => true, 'message' => 'Compte supprimé. Seules les écritures comptables obligatoires sont conservées, sans votre identité.'));
    }
    f_erreur(400, 'Action inconnue.');
}

if ($methode === 'GET' && isset($_GET['export'])) {
    $c = f_compte_connecte();
    $id = (int) $c['id'];
    $db = f_db();
    $sel = function (string $sql) use ($db, $id) { $q = $db->prepare($sql); $q->execute(array($id)); return $q->fetchAll(); };
    $date = function ($t) { return $t ? gmdate('c', (int) $t) : null; };
    $export = array(
        'exporte_le' => gmdate('c'),
        'compte' => array('id' => $id, 'email' => $c['email'], 'pseudo' => $c['pseudo'], 'cree_le' => $date($c['cree_le']), 'iban' => f_iban_masque_compte($c)),
        'applis' => $sel('SELECT slug, statut FROM applis WHERE createur_id = ?'),
        'ecritures' => array_map(function ($e) use ($date) { return array('type' => $e['type'], 'montantCents' => (int) $e['montant_centimes'], 'app' => $e['app_slug'], 'libelle' => $e['libelle'], 'date' => $date($e['cree_le']), 'disponibleLe' => $date($e['disponible_le'])); },
            $sel("SELECT * FROM ecritures WHERE compte_id = ? AND beneficiaire = 'createur' ORDER BY id")),
        'virements' => array_map(function ($v) use ($date) { return array('montantCents' => (int) $v['montant_centimes'], 'iban' => '•••• ' . $v['iban_fin'], 'statut' => $v['statut'], 'demandeLe' => $date($v['cree_le']), 'traiteLe' => $date($v['traite_le'])); },
            $sel('SELECT * FROM virements WHERE compte_id = ? ORDER BY id')),
        'signalements_faits' => $db->query('SELECT app_slug, motif, cree_le FROM signalements WHERE rapporteur = ' . $db->quote('c:' . $id))->fetchAll(),
        'soldes' => f_soldes($id),
    );
    header('Content-Disposition: attachment; filename="alphabette-mes-donnees.json"');
    f_repondre(200, $export);
}

f_erreur(400, 'Demande inconnue.');
