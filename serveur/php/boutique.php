<?php
/**
 * boutique.php — Lot 5 : monétisation directe complémentaire, 100 % en centimes, par carte (Stripe) ou par solde créateur.
 *
 *   GET  ?catalogue                     → prix, répartitions, moyens ouverts, places de boost libres
 *   GET  ?bounties                      → bounties ouvertes et attribuées (sans identité)
 *   GET  ?transparence=<slug>           → revenus publics de l'appli SI le créateur l'a choisi
 *   GET  ?licences          (connecté)  → mes packs et leurs codes (attribués, activés)
 *   GET  ?mes               (connecté)  → mes commandes
 *   POST { action:"commander", produit, app, moyen:"carte"|"solde", … }   (connecté, sauf café par carte)
 *        produit : boost | pack (nb 5/10/25) | domaine (domaine, shell_conserve:true) | cadeau (nb) | pourboire | audit_pro | bounty (titre, description, montant)
 *   POST { action:"activer", code }                       (connecté) → licence LIC-… ou cadeau ALPHA-… : 1 an d'accès
 *   POST { action:"utiliser_code_jours", code, app }      (connecté) → code JFR-… du Labo (signé HMAC-SHA256, usage unique)
 *   POST { action:"licence_attribuer", licence, email }   (acheteur du pack) → envoie le code à la personne
 *   POST { action:"licence_reattribuer", licence }        (acheteur) → retire la licence et en crée une neuve
 *   POST { action:"bounty_attribuer", id, email }         (auteur ou admin) → 90 % contributeur / 10 % Alphabette
 *   POST { action:"bounty_annuler", id }                  (admin) → somme rendue au solde de l'auteur
 *   POST { action:"transparence", app, publique }         (créateur de l'appli)
 *
 * Règles : prix calculés ICI (jamais par la page) ; débit de solde et effet de l'achat dans la MÊME transaction ;
 * un pack ne paie jamais moins de 10,00 € par licence au créateur ; un boost n'est vendu que si une des 4 places est libre.
 */
declare(strict_types=1);
require __DIR__ . '/croissance-commun.php';
f_entetes();

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($methode === 'GET') {
    if (isset($_GET['catalogue'])) {
        $db = c_db(); $t = f_maintenant();
        $liens = c_liens();
        $ouvert = function (string $p) use ($liens) { return (bool) preg_match('#^https://buy\.stripe\.com/#', (string) ($liens[$p] ?? '')); };
        $packs = array();
        foreach (PRIX_PACKS as $nb => $prix) $packs[] = array('nb' => $nb, 'prixCents' => $prix, 'createurCents' => c_part_createur_pack($nb), 'alphabetteCents' => $prix - c_part_createur_pack($nb), 'carte' => $ouvert("pack_$nb"));
        $place = c_prochaine_place($db, BOOST_JOURS * 86400, $t);
        f_repondre(200, array(
            'boost' => array('prixCents' => PRIX_BOOST, 'jours' => BOOST_JOURS, 'places' => BOOST_PLACES, 'placeLibre' => $place <= $t, 'prochainePlace' => gmdate('c', $place), 'carte' => $ouvert('boost')),
            'packs' => $packs,
            'domaine' => array('prixCents' => PRIX_DOMAINE, 'duree' => '1 an', 'condition' => 'Double barre @alphabette/shell conservée', 'carte' => $ouvert('domaine')),
            'cadeau' => array('prixCents' => PRIX_CODE_CADEAU, 'duree' => '1 an', 'format' => 'ALPHA-XXXX-XXXX', 'carte' => $ouvert('cadeau')),
            'pourboire' => array('prixCents' => PRIX_POURBOIRE, 'createurCents' => PART_CREATEUR_POURBOIRE, 'alphabetteCents' => PRIX_POURBOIRE - PART_CREATEUR_POURBOIRE, 'carte' => $ouvert('pourboire')),
            'auditPro' => array('prixCents' => PRIX_AUDIT_PRO, 'carte' => $ouvert('audit_pro')),
            'bounty' => array('minimumCents' => BOUNTY_MINIMUM, 'contributeurPourcent' => BOUNTY_POURCENT_CONTRIBUTEUR, 'carte' => $ouvert('bounty')),
            'solde' => true, 'rappel' => '15 €/an = 10 € créateur / 5 € Alphabette'));
    }
    if (isset($_GET['bounties'])) {
        $l = c_db()->query("SELECT id, titre, description, app_slug, montant_centimes, statut, cree_le, clos_le FROM bounties WHERE statut IN ('ouvert','attribue') ORDER BY statut = 'attribue', id DESC LIMIT 200")->fetchAll();
        f_repondre(200, array('bounties' => array_map(function ($b) {
            return array('id' => (int) $b['id'], 'titre' => $b['titre'], 'description' => $b['description'], 'app' => $b['app_slug'], 'montantCents' => (int) $b['montant_centimes'],
                'montant' => f_euros((int) $b['montant_centimes']), 'contributeurCents' => intdiv((int) $b['montant_centimes'] * BOUNTY_POURCENT_CONTRIBUTEUR, 100),
                'statut' => $b['statut'], 'creeLe' => gmdate('c', (int) $b['cree_le']));
        }, $l)));
    }
    if (isset($_GET['transparence'])) {
        $slug = c_slug((string) $_GET['transparence']);
        $db = c_db();
        $q = $db->prepare('SELECT publique FROM transparence WHERE app_slug = ?'); $q->execute(array($slug));
        if ((int) $q->fetchColumn() !== 1) f_repondre(200, array('publique' => false));
        $q = $db->prepare("SELECT COUNT(*) FROM abonnements WHERE app_slug = ? AND statut = 'actif' AND fin > ?"); $q->execute(array($slug, f_maintenant()));
        $n = (int) $q->fetchColumn();
        $q = $db->prepare("SELECT COALESCE(SUM(montant_centimes), 0) FROM ecritures WHERE app_slug = ? AND beneficiaire = 'createur' AND type IN ('vente','remboursement','vente_pack','pourboire')"); $q->execute(array($slug));
        $r = (int) $q->fetchColumn();
        f_repondre(200, array('publique' => true, 'abonnesActifs' => $n, 'revenusCreateurCents' => $r, 'revenusCreateur' => f_euros($r)));
    }
    $c = f_compte_connecte();
    $id = (int) $c['id'];
    if (isset($_GET['licences'])) {
        $db = c_db();
        $q = $db->prepare('SELECT * FROM packs WHERE acheteur_compte_id = ? ORDER BY id DESC'); $q->execute(array($id));
        $packs = array();
        foreach ($q->fetchAll() as $p) {
            $l = $db->prepare('SELECT * FROM licences WHERE pack_id = ? ORDER BY id'); $l->execute(array((int) $p['id']));
            $packs[] = array('id' => (int) $p['id'], 'app' => $p['app_slug'], 'nb' => (int) $p['nb'], 'licences' => array_map(function ($x) use ($p) {
                return array('id' => (int) $x['id'], 'code' => $x['statut'] === 'revoquee' ? null : f_dechiffrer((string) $x['code_chiffre'], 'licence:' . (int) $p['id']),
                    'statut' => $x['statut'], 'attribuee' => $x['attribuee_a'] !== null, 'activeLe' => $x['active_le'] ? gmdate('c', (int) $x['active_le']) : null);
            }, $l->fetchAll()));
        }
        f_repondre(200, array('packs' => $packs));
    }
    if (isset($_GET['mes'])) {
        $q = c_db()->prepare('SELECT id, type, app_slug, montant_centimes, moyen, statut, cree_le FROM commandes WHERE compte_id = ? ORDER BY cree_le DESC LIMIT 100'); $q->execute(array($id));
        f_repondre(200, array('commandes' => $q->fetchAll()));
    }
    f_erreur(400, 'Demande inconnue.');
}

if ($methode !== 'POST') f_erreur(405, 'Méthode non permise.');
$e = f_corps();
$action = (string) ($e['action'] ?? '');

if ($action === 'commander') {
    $produit = (string) ($e['produit'] ?? '');
    $moyen = (string) ($e['moyen'] ?? 'carte');
    if (!in_array($moyen, array('carte', 'solde'), true)) f_erreur(400, 'Moyen de paiement inconnu.');
    $c = ($produit === 'pourboire' && $moyen === 'carte') ? f_compte_connecte(false) : f_compte_connecte();
    $id = $c ? (int) $c['id'] : null;
    if (!f_limite('commande|' . ($id ?? f_empreinte_ip()), 30, 3600)) f_erreur(429, 'Trop de commandes : réessayez dans une heure.');
    $slug = c_slug((string) ($e['app'] ?? ''));
    $db = c_db();
    $t = f_maintenant();
    $p = array();
    $estCreateur = $slug !== '' && $id !== null && c_createur_de($db, $slug) === $id;
    switch ($produit) {
        case 'boost':
            if (!$estCreateur) f_erreur(403, 'Seul le créateur de l\'appli peut la booster.');
            $place = c_prochaine_place($db, BOOST_JOURS * 86400, $t);
            if ($place > $t) f_erreur(409, 'Les 4 places de boost sont prises. Prochaine place libre le ' . gmdate('d/m/Y', $place) . '.', array('prochainePlace' => gmdate('c', $place)));
            break;
        case 'pack':
            $p['nb'] = (int) ($e['nb'] ?? 0);
            if (!isset(PRIX_PACKS[$p['nb']])) f_erreur(400, 'Pack de 5, 10 ou 25 licences.');
            $q = $db->prepare('SELECT 1 FROM applis WHERE slug = ?'); $q->execute(array($slug));
            if (!$q->fetchColumn()) f_erreur(404, 'Cette appli n\'est pas (encore) sur alphabette.fr.');
            break;
        case 'domaine':
            if (!$estCreateur) f_erreur(403, 'Seul le créateur de l\'appli peut lui donner un domaine.');
            $d = strtolower(trim((string) ($e['domaine'] ?? '')));
            if (!preg_match('/^(?=.{4,190}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/', $d) || preg_match('/(^|\.)alphabette\.(fr|eu)$/', $d)) f_erreur(400, 'Nom de domaine invalide.');
            if (($e['shell_conserve'] ?? null) !== true) f_erreur(400, 'Le domaine personnalisé garde la double barre Alphabette (@alphabette/shell) : cochez la case.');
            $q = $db->prepare('SELECT 1 FROM domaines WHERE domaine = ?'); $q->execute(array($d));
            if ($q->fetchColumn()) f_erreur(409, 'Ce domaine est déjà enregistré.');
            $p['domaine'] = $d; $p['shell_conserve'] = true;
            break;
        case 'cadeau':
            if (!$estCreateur) f_erreur(403, 'Les codes cadeaux s\'achètent par le créateur de l\'appli (il offre sa part de 10 €).');
            $p['nb'] = (int) ($e['nb'] ?? 1);
            break;
        case 'pourboire':
            if ($slug === '') f_erreur(400, 'Appli inconnue.');
            break;
        case 'audit_pro':
            if (!$estCreateur) f_erreur(403, 'L\'audit IA Pro se commande par le créateur de l\'appli.');
            break;
        case 'bounty':
            $p['montant'] = (int) ($e['montant'] ?? 0);
            $titre = mb_substr(trim(strip_tags((string) ($e['titre'] ?? ''))), 0, 120);
            $desc = mb_substr(trim(strip_tags((string) ($e['description'] ?? ''))), 0, 2000);
            if (mb_strlen($titre) < 5 || mb_strlen($desc) < 20) f_erreur(400, 'Titre (5 caractères) et description (20 caractères) obligatoires.');
            break;
        default: f_erreur(400, 'Produit inconnu.');
    }
    $prix = c_prix($produit, $p);
    if ($prix === null) f_erreur(400, 'Quantité ou montant invalide.');
    $cmd = array('id' => c_jeton('cmd_'), 'type' => $produit, 'compte_id' => $id, 'app_slug' => $slug ?: null, 'params' => json_encode($p), 'montant_centimes' => $prix);

    $r = f_transaction(function (PDO $db) use ($cmd, $moyen, $produit, $id, $t, $e) {
        $db->prepare("INSERT INTO commandes (id, type, compte_id, app_slug, params, montant_centimes, moyen, statut, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, 'attente', ?)")
            ->execute(array($cmd['id'], $cmd['type'], $cmd['compte_id'], $cmd['app_slug'], $cmd['params'], $cmd['montant_centimes'], $moyen, $t));
        if ($produit === 'bounty') {
            $db->prepare("INSERT INTO bounties (titre, description, app_slug, auteur_compte_id, montant_centimes, statut, commande_id, cree_le) VALUES (?, ?, ?, ?, ?, 'en_attente_paiement', ?, ?)")
                ->execute(array(mb_substr(trim(strip_tags((string) $e['titre'])), 0, 120), mb_substr(trim(strip_tags((string) $e['description'])), 0, 2000), $cmd['app_slug'], $id, $cmd['montant_centimes'], $cmd['id'], $t));
        }
        if ($moyen === 'carte') return array('mails' => array(), 'paye' => false);
        if (!c_debiter_solde($db, (int) $id, $cmd['montant_centimes'], $cmd['id'], 'Achat payé avec mon solde : ' . $produit, $t)) return array('solde' => false);
        return array('mails' => c_executer($db, $cmd, $cmd['id'], $t), 'paye' => true);
    });
    if (isset($r['solde'])) f_erreur(402, 'Solde disponible insuffisant (' . f_euros(f_soldes((int) $id)['availableBalanceCents']) . ') pour ' . f_euros($prix) . '.', array('code' => 'solde'));
    c_envoyer($r['mails']);
    $lien = $moyen === 'carte' ? c_lien_paiement($produit === 'pack' ? 'pack_' . $p['nb'] : $produit, $cmd['id']) : null;
    f_repondre(200, array('ok' => true, 'commande' => $cmd['id'], 'prixCents' => $prix, 'prix' => f_euros($prix), 'paye' => $r['paye'], 'lien' => $lien,
        'message' => $r['paye'] ? 'Payé avec votre solde : c\'est fait.' : ($lien ? null : 'Le paiement par carte ouvre bientôt. Vous pouvez payer avec votre solde créateur.')));
}

if ($action === 'bounty_annuler') {
    f_admin();
    $bid = (int) ($e['id'] ?? 0);
    $ok = f_transaction(function (PDO $db) use ($bid) {
        c_db();
        $q = $db->prepare("SELECT * FROM bounties WHERE id = ? AND statut = 'ouvert'"); $q->execute(array($bid));
        $b = $q->fetch();
        if (!$b) return false;
        $t = f_maintenant(); $m = (int) $b['montant_centimes'];
        $db->prepare("UPDATE bounties SET statut = 'annule', clos_le = ? WHERE id = ?")->execute(array($t, $bid));
        c_ecrire($db, null, 'alphabette', 'sequestre_libere', -$m, $b['app_slug'], null, 'bounty:' . $bid, $t, $t, 'Bounty annulé : séquestre rendu');
        c_ecrire($db, (int) $b['auteur_compte_id'], 'createur', 'bounty_rembourse', $m, $b['app_slug'], null, 'bounty:' . $bid, $t, $t, 'Bounty annulé : somme rendue sur votre solde');
        return true;
    });
    if (!$ok) f_erreur(404, 'Bounty introuvable ou déjà clos.');
    f_repondre(200, array('ok' => true));
}

$c = f_compte_connecte();
$id = (int) $c['id'];

if ($action === 'activer') {
    $code = strtoupper(trim((string) ($e['code'] ?? '')));
    if (!preg_match('/^(LIC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}|ALPHA-[A-Z2-9]{4}-[A-Z2-9]{4})$/', $code)) f_erreur(400, 'Code invalide.');
    if (!f_limite('activer|' . $id, 10, 3600)) f_erreur(429, 'Trop d\'essais.');
    $moi = (string) $c['email_hash'];
    $r = f_transaction(function (PDO $db) use ($code, $moi) {
        c_db(); $t = f_maintenant(); $h = c_hash_code($code);
        if (str_starts_with($code, 'LIC-')) {
            $q = $db->prepare('SELECT * FROM licences WHERE code_hash = ?'); $q->execute(array($h));
            $l = $q->fetch();
            if (!$l || $l['statut'] === 'revoquee') return array('erreur' => 'Code inconnu.');
            if ($l['statut'] === 'active') return $l['active_par'] === $moi ? array('app' => $l['app_slug'], 'fin' => (int) $l['fin'], 'deja' => true) : array('erreur' => 'Cette licence est déjà utilisée.');
            if ($l['attribuee_a'] !== null && $l['attribuee_a'] !== $moi) return array('erreur' => 'Cette licence est réservée à une autre adresse e-mail.');
            $fin = c_donner_acces($db, $moi, (string) $l['app_slug'], 365, 'licence', (string) $l['id'], $t);
            $db->prepare("UPDATE licences SET statut = 'active', active_par = ?, active_le = ?, fin = ? WHERE id = ?")->execute(array($moi, $t, $fin, (int) $l['id']));
            return array('app' => $l['app_slug'], 'fin' => $fin);
        }
        $q = $db->prepare('SELECT * FROM cadeaux WHERE code_hash = ?'); $q->execute(array($h));
        $g = $q->fetch();
        if (!$g) return array('erreur' => 'Code inconnu.');
        if ($g['active_par'] !== null) return array('erreur' => 'Ce code cadeau a déjà été utilisé.');
        $fin = c_donner_acces($db, $moi, (string) $g['app_slug'], 365, 'cadeau', $h, $t);
        $db->prepare('UPDATE cadeaux SET active_par = ?, active_le = ? WHERE code_hash = ?')->execute(array($moi, $t, $h));
        return array('app' => $g['app_slug'], 'fin' => $fin);
    });
    if (isset($r['erreur'])) f_erreur(400, $r['erreur']);
    f_repondre(200, array('ok' => true, 'app' => $r['app'], 'fin' => gmdate('c', $r['fin']), 'deja' => !empty($r['deja'])));
}

if ($action === 'utiliser_code_jours') {
    $slug = c_slug((string) ($e['app'] ?? ''));
    $v = c_code_jours_verifier((string) ($e['code'] ?? ''));
    if ($slug === '' || !$v) f_erreur(400, 'Code ou appli invalide.');
    $moi = (string) $c['email_hash'];
    $fin = f_transaction(function (PDO $db) use ($v, $slug, $moi, $id) {
        c_db(); $t = f_maintenant();
        $q = $db->prepare('INSERT OR IGNORE INTO codes_jours_utilises (code_id, compte_id, jours, utilise_le) VALUES (?, ?, ?, ?)');
        $q->execute(array($v['id'], $id, $v['jours'], $t));
        if ($q->rowCount() === 0) return null;
        return c_donner_acces($db, $moi, $slug, $v['jours'], 'jours_labo', $v['id'], $t);
    });
    if ($fin === null) f_erreur(409, 'Ce code a déjà servi.');
    f_repondre(200, array('ok' => true, 'jours' => $v['jours'], 'app' => $slug, 'fin' => gmdate('c', $fin)));
}

if ($action === 'licence_attribuer' || $action === 'licence_reattribuer') {
    $lid = (int) ($e['licence'] ?? 0);
    $email = trim((string) ($e['email'] ?? ''));
    if ($action === 'licence_attribuer' && !f_email_valide($email)) f_erreur(400, 'Adresse e-mail invalide.');
    $r = f_transaction(function (PDO $db) use ($lid, $id, $email, $action) {
        c_db();
        $q = $db->prepare('SELECT l.*, p.acheteur_compte_id FROM licences l JOIN packs p ON p.id = l.pack_id WHERE l.id = ?'); $q->execute(array($lid));
        $l = $q->fetch();
        if (!$l || (int) $l['acheteur_compte_id'] !== $id || $l['statut'] === 'revoquee') return array('erreur' => 'Licence introuvable.');
        if ($action === 'licence_attribuer') {
            if ($l['statut'] === 'active') return array('erreur' => 'Licence déjà activée : réattribuez-la.');
            $db->prepare('UPDATE licences SET attribuee_a = ? WHERE id = ?')->execute(array(f_email_hash($email), $lid));
            return array('code' => f_dechiffrer((string) $l['code_chiffre'], 'licence:' . (int) $l['pack_id']), 'app' => $l['app_slug']);
        }
        // Réattribution : la place n'est jamais perdue. L'ancienne licence est retirée (son accès s'arrête), une neuve la remplace.
        $t = f_maintenant();
        $db->prepare("UPDATE licences SET statut = 'revoquee' WHERE id = ?")->execute(array($lid));
        $db->prepare("UPDATE droits SET fin = ? WHERE source = 'licence' AND source_id = ? AND fin > ?")->execute(array($t, (string) $lid, $t));
        $code = c_code_lisible('LIC', 3);
        $db->prepare('INSERT INTO licences (pack_id, code_hash, code_chiffre, code_fin, app_slug) VALUES (?, ?, ?, ?, ?)')
            ->execute(array((int) $l['pack_id'], c_hash_code($code), f_chiffrer($code, 'licence:' . (int) $l['pack_id']), substr($code, -4), $l['app_slug']));
        return array('code' => $code, 'nouvelle' => (int) $db->lastInsertId());
    });
    if (isset($r['erreur'])) f_erreur(400, $r['erreur']);
    if ($action === 'licence_attribuer') {
        f_mail($email, 'Une licence Alphabette pour vous', "Bonjour,\n\nVoici votre licence d'un an pour « {$r['app']} » : {$r['code']}\nActivez-la sur alphabette.eu/essai/{$r['app']}/ (connexion par code e-mail, sans mot de passe).\n\nAlphabette");
        f_repondre(200, array('ok' => true));
    }
    f_repondre(200, array('ok' => true, 'licence' => $r['nouvelle'], 'code' => $r['code']));
}

if ($action === 'bounty_attribuer') {
    $bid = (int) ($e['id'] ?? 0);
    $email = trim((string) ($e['email'] ?? ''));
    if (!f_email_valide($email)) f_erreur(400, 'Adresse e-mail du contributeur invalide.');
    $estAdmin = isset($_SERVER['HTTP_X_ADMIN_PASSWORD']);
    if ($estAdmin) f_admin();
    $contrib = f_compte_par_email($email, true);
    $r = f_transaction(function (PDO $db) use ($bid, $id, $estAdmin, $contrib) {
        c_db();
        $q = $db->prepare("SELECT b.*, c.paye_le FROM bounties b LEFT JOIN commandes c ON c.id = b.commande_id WHERE b.id = ? AND b.statut = 'ouvert'"); $q->execute(array($bid));
        $b = $q->fetch();
        if (!$b) return array('erreur' => 'Bounty introuvable ou déjà clos.');
        if (!$estAdmin && (int) $b['auteur_compte_id'] !== $id) return array('erreur' => 'Seul l\'auteur de la bounty peut l\'attribuer.');
        if ((int) $contrib['id'] === (int) $b['auteur_compte_id']) return array('erreur' => 'On ne peut pas s\'attribuer sa propre bounty.');
        $t = f_maintenant(); $m = (int) $b['montant_centimes'];
        $partC = intdiv($m * BOUNTY_POURCENT_CONTRIBUTEUR, 100);
        $db->prepare("UPDATE bounties SET statut = 'attribue', contributeur_compte_id = ?, clos_le = ? WHERE id = ?")->execute(array((int) $contrib['id'], $t, $bid));
        c_ecrire($db, null, 'alphabette', 'sequestre_libere', -$m, $b['app_slug'], null, 'bounty:' . $bid, $t, $t, 'Bounty attribuée : séquestre libéré');
        c_ecrire($db, (int) $contrib['id'], 'createur', 'bounty', $partC, $b['app_slug'], null, 'bounty:' . $bid, max($t, (int) $b['paye_le'] + f_delai_disponibilite()), $t, 'Bounty « ' . $b['titre'] . ' » (90 %)');
        c_ecrire($db, null, 'alphabette', 'commission_bounty', $m - $partC, $b['app_slug'], null, 'bounty:' . $bid, $t, $t, 'Bounty : part Alphabette (10 %)');
        return array('contributeurCents' => $partC, 'alphabetteCents' => $m - $partC);
    });
    if (isset($r['erreur'])) f_erreur(400, $r['erreur']);
    f_mail($email, 'Votre bounty Alphabette est attribuée', 'Merci ! ' . f_euros($r['contributeurCents']) . ' ont été ajoutés à votre solde (alphabette.eu/mes-revenus/).');
    f_repondre(200, array('ok' => true) + $r);
}

if ($action === 'transparence') {
    $slug = c_slug((string) ($e['app'] ?? ''));
    if ($slug === '' || c_createur_de(c_db(), $slug) !== $id) f_erreur(403, 'Seul le créateur de l\'appli peut choisir.');
    c_db()->prepare('INSERT INTO transparence (app_slug, publique, maj) VALUES (?, ?, ?) ON CONFLICT(app_slug) DO UPDATE SET publique = excluded.publique, maj = excluded.maj')
        ->execute(array($slug, ($e['publique'] ?? false) === true ? 1 : 0, f_maintenant()));
    f_repondre(200, array('ok' => true, 'publique' => ($e['publique'] ?? false) === true));
}

f_erreur(400, 'Action inconnue.');
