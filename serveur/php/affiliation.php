<?php
/**
 * affiliation.php — Lot 5 : acquisition sans friction et sans traceur (alphabette.eu/api/affiliation.php).
 *
 *   GET  ?go=<slug>&ref=<code>[&src=favorites|export|catalogue]  (réécrit depuis /go/<slug>)  → 302 vers l'appli avec ?clic=<id>
 *        Clic enregistré avec une empreinte HMAC du jour (aucun cookie, aucune IP gardée), dédoublonné 30 min.
 *        50 clics uniques = +10 points de visibilité pour le recommandeur.
 *   GET  ?moi                      (connecté) → code anonyme, liens prêts à partager, points de visibilité, gains d'affiliation
 *   GET  ?invite=<code>            → { valide } (rien sur le parrain)
 *   GET  ?acces=<slug>             (connecté) → accès en cours (abonnement, essai, licence, cadeau, jours offerts)
 *   GET  ?vitrine                  → boosts en cours (4 places max), badges
 *   POST { action:"preparer", app, clic?, invite? }  → { commande, lien }  commande d'abonnement 15 €/an (prix fixé ici)
 *   POST { action:"essai", app, ref? }   (connecté) → essai 7 jours SANS carte, 1 à vie par (compte, appli)
 *   POST { action:"parrainage", sponsor }  (connecté) → rattache le compte à son parrain créateur (12 mois)
 *
 * Commissions (prélevées sur les 500 c. d'Alphabette, jamais sur les 1000 c. du créateur) : voir croissance-commun.php.
 */
declare(strict_types=1);
require __DIR__ . '/croissance-commun.php';
f_entetes();

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($methode === 'GET' && isset($_GET['go'])) {
    $slug = c_slug((string) $_GET['go']);
    $src = in_array($_GET['src'] ?? '', array('favorites', 'export'), true) ? (string) $_GET['src'] : 'catalogue';
    $vers = $slug === '' ? '/' : (str_starts_with($slug, 'c-') ? "/c/$slug/" : "/apps/$slug/");
    if (($_GET['site'] ?? '') === 'fr' && $slug !== '' && !str_starts_with($slug, 'c-')) $vers = 'https://alphabette.fr' . $vers; // lien venu de la vitrine
    $ref = c_compte_par_code((string) ($_GET['ref'] ?? ''));
    $clicId = null;
    if ($slug !== '' && $ref) {
        $t = f_maintenant();
        $emp = substr(f_hmac('clic|' . ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200) . '|' . gmdate('Y-m-d', $t)), 0, 32);
        $clicId = f_transaction(function (PDO $db) use ($slug, $src, $ref, $emp, $t) {
            c_db();
            $q = $db->prepare('SELECT id FROM clics WHERE ref_compte_id = ? AND app_slug = ? AND empreinte = ? AND cree_le > ? ORDER BY cree_le DESC LIMIT 1');
            $q->execute(array($ref, $slug, $emp, $t - DEDOUBLONNAGE_CLIC_SECONDES));
            $deja = $q->fetchColumn();
            if ($deja !== false) return (string) $deja;
            $id = c_jeton('clk_');
            $db->prepare('INSERT INTO clics (id, ref_compte_id, app_slug, src, empreinte, cree_le) VALUES (?, ?, ?, ?, ?, ?)')->execute(array($id, $ref, $slug, $src, $emp, $t));
            $db->prepare('INSERT INTO visibilite (compte_id, clics_uniques, points) VALUES (?, 1, 0) ON CONFLICT(compte_id) DO UPDATE SET clics_uniques = clics_uniques + 1')->execute(array($ref));
            $db->prepare('UPDATE visibilite SET points = (clics_uniques / ?) * ? WHERE compte_id = ?')->execute(array(CLICS_PAR_PALIER_VISIBILITE, POINTS_PAR_PALIER_VISIBILITE, $ref));
            return $id;
        });
    }
    header('Referrer-Policy: no-referrer');
    header('Location: ' . $vers . ($clicId ? '?clic=' . $clicId : ''), true, 302);
    exit;
}

if ($methode === 'GET') {
    if (isset($_GET['invite'])) f_repondre(200, array('valide' => c_compte_par_code((string) $_GET['invite']) !== null, 'joursOfferts' => INVITATION_JOURS));
    if (isset($_GET['vitrine'])) {
        $db = c_db(); $t = f_maintenant();
        $q = $db->prepare('SELECT app_slug, debut, fin, origine FROM boosts WHERE fin > ? ORDER BY debut'); $q->execute(array($t));
        $boosts = array_map(function ($b) use ($t) { return array('app' => $b['app_slug'], 'enCours' => (int) $b['debut'] <= $t, 'debut' => gmdate('c', (int) $b['debut']), 'fin' => gmdate('c', (int) $b['fin']), 'origine' => $b['origine']); }, $q->fetchAll());
        $badges = array();
        foreach ($db->query('SELECT app_slug, badge FROM badges ORDER BY cree_le')->fetchAll() as $b) $badges[$b['app_slug']][] = $b['badge'];
        f_repondre(200, array('places' => BOOST_PLACES, 'enCours' => count(array_filter($boosts, function ($b) { return $b['enCours']; })), 'boosts' => $boosts, 'badges' => $badges));
    }
    $c = f_compte_connecte();
    $id = (int) $c['id'];
    if (isset($_GET['acces'])) {
        $slug = c_slug((string) $_GET['acces']);
        if ($slug === '') f_erreur(400, 'Appli inconnue.');
        f_repondre(200, c_acces((string) $c['email_hash'], $slug, $id));
    }
    if (isset($_GET['moi'])) {
        $code = c_code_ref($id);
        $db = c_db();
        $q = $db->prepare('SELECT clics_uniques, points FROM visibilite WHERE compte_id = ?'); $q->execute(array($id));
        $v = $q->fetch() ?: array('clics_uniques' => 0, 'points' => 0);
        $q = $db->prepare("SELECT type, COALESCE(SUM(montant_centimes), 0) AS m, COUNT(*) AS n FROM ecritures WHERE compte_id = ? AND type IN ('commission_parrainage','commission_apporteur','commission_favoris') GROUP BY type");
        $q->execute(array($id));
        $gains = array();
        foreach ($q->fetchAll() as $g) $gains[$g['type']] = array('centimes' => (int) $g['m'], 'ventes' => (int) $g['n']);
        $q = $db->prepare('SELECT COUNT(*) FROM parrainages_createurs WHERE parrain_compte_id = ?'); $q->execute(array($id));
        $filleuls = (int) $q->fetchColumn();
        $q = $db->prepare('SELECT COALESCE(SUM(jours), 0) FROM invitations WHERE parrain_compte_id = ? AND annee = ?'); $q->execute(array($id, gmdate('Y', f_maintenant())));
        $joursAn = (int) $q->fetchColumn();
        f_repondre(200, array('code' => $code,
            'liens' => array('recommander' => "/go/<slug>?ref=$code", 'favoris' => "/go/<slug>?ref=$code&src=favorites",
                'inviter' => "/invite/$code", 'parrainerCreateur' => "/rejoindre-createurs/?sponsor=$code", 'essai' => "/essai/<slug>?ref=$code"),
            'commissions' => array('parrainCreateurCents' => COMMISSION_PARRAIN_CREATEUR, 'apporteurCents' => COMMISSION_APPORTEUR, 'favorisCents' => COMMISSION_FAVORIS,
                'createurGardeCents' => PART_CREATEUR_CENTIMES, 'fenetreJours' => 7),
            'visibilite' => array('clicsUniques' => (int) $v['clics_uniques'], 'points' => (int) $v['points'], 'prochainPalier' => CLICS_PAR_PALIER_VISIBILITE - ((int) $v['clics_uniques'] % CLICS_PAR_PALIER_VISIBILITE)),
            'gains' => $gains, 'filleulsCreateurs' => $filleuls,
            'invitations' => array('joursCetteAnnee' => $joursAn, 'plafondJours' => INVITATION_PLAFOND_JOURS_AN)));
    }
    f_erreur(400, 'Demande inconnue.');
}

if ($methode !== 'POST') f_erreur(405, 'Méthode non permise.');
$e = f_corps();
$action = (string) ($e['action'] ?? '');

if ($action === 'preparer') {
    $slug = c_slug((string) ($e['app'] ?? ''));
    if ($slug === '') f_erreur(400, 'Appli inconnue.');
    if (!f_limite('preparer|' . f_empreinte_ip(), 60, 3600)) f_erreur(429, 'Trop de demandes.');
    $clic = preg_match('/^clk_[a-f0-9]{24}$/', (string) ($e['clic'] ?? '')) ? (string) $e['clic'] : '';
    $invite = preg_match('/^r[a-z0-9]{10}$/', (string) ($e['invite'] ?? '')) ? (string) $e['invite'] : '';
    $id = c_jeton('cmd_');
    c_db()->prepare("INSERT INTO commandes (id, type, compte_id, app_slug, params, montant_centimes, moyen, statut, cree_le) VALUES (?, 'abonnement', NULL, ?, ?, ?, 'carte', 'attente', ?)")
        ->execute(array($id, $slug, json_encode(array('clic' => $clic, 'invite' => $invite)), PRIX_ABONNEMENT_CENTIMES, f_maintenant()));
    $liens = c_liens()['abonnement'] ?? array();
    $l = is_array($liens) ? (string) ($liens[$slug] ?? '') : '';
    $lien = preg_match('#^https://buy\.stripe\.com/[A-Za-z0-9_]+$#', $l) ? $l . '?client_reference_id=' . $id : null;
    f_repondre(200, array('commande' => $id, 'lien' => $lien, 'prixCents' => PRIX_ABONNEMENT_CENTIMES,
        'message' => $lien ? null : 'Le paiement en ligne de cette appli ouvre bientôt. En attendant, essayez-la 7 jours sans carte.'));
}

$c = f_compte_connecte();
$id = (int) $c['id'];

if ($action === 'essai') {
    $slug = c_slug((string) ($e['app'] ?? ''));
    if ($slug === '') f_erreur(400, 'Appli inconnue.');
    $acces = c_acces((string) $c['email_hash'], $slug, $id);
    if ($acces['actif'] && $acces['source'] !== 'essai') f_erreur(409, 'Vous avez déjà accès à cette appli.', array('acces' => $acces));
    $t = f_maintenant();
    $ref = preg_match('/^r[a-z0-9]{10}$/', (string) ($e['ref'] ?? '')) ? (string) $e['ref'] : null;
    $q = c_db()->prepare('INSERT OR IGNORE INTO essais (compte_id, app_slug, debut, fin, ref) VALUES (?, ?, ?, ?, ?)');
    $q->execute(array($id, $slug, $t, $t + ESSAI_JOURS * 86400, $ref));
    if ($q->rowCount() === 0) f_erreur(409, 'Vous avez déjà profité de l\'essai gratuit de cette appli (un seul par personne).', array('code' => 'essai_deja_utilise'));
    f_repondre(200, array('ok' => true, 'fin' => gmdate('c', $t + ESSAI_JOURS * 86400), 'message' => '7 jours offerts, sans carte bancaire. Rien ne sera prélevé ensuite.'));
}

if ($action === 'parrainage') {
    $q = c_db()->prepare('SELECT 1 FROM ecritures WHERE compte_id = ? LIMIT 1'); $q->execute(array($id));
    if ($q->fetchColumn() || (f_maintenant() - (int) $c['cree_le']) > 30 * 86400) f_erreur(409, 'Le parrainage se choisit à l\'inscription seulement.');
    if (!c_enregistrer_parrainage((string) $c['email'], (string) ($e['sponsor'] ?? ''))) f_erreur(400, 'Code de parrainage invalide ou déjà enregistré.');
    f_repondre(200, array('ok' => true, 'dureeMois' => 12));
}

f_erreur(400, 'Action inconnue.');
