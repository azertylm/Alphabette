<?php
/**
 * croissance-commun.php — Lot 5 : socle partagé par affiliation.php, boutique.php, newsletter.php et webhooks.php.
 * Jamais appelé seul (404). Même base que le Lot 3 : ~/alphabette-finance/finance.sqlite (tout en CENTIMES ENTIERS).
 *
 * RÈGLE ABSOLUE : la part créateur d'un abonnement vendu reste 1000 c. (10,00 €). Toute commission d'affiliation
 * est prélevée sur la part Alphabette (500 c.) :
 *   parrain créateur +100 c. (12 mois) · apporteur catalogue +150 c. (ou vitrine « Mes 3 applis préférées » +100 c.)
 *   → cumul maximal 250 c., Alphabette garde au moins 250 c. Contrôlé au chargement ET à chaque vente.
 */
declare(strict_types=1);

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) { http_response_code(404); exit; }
require_once __DIR__ . '/finance-commun.php';

const COMMISSION_PARRAIN_CREATEUR = 100;
const COMMISSION_APPORTEUR = 150;
const COMMISSION_FAVORIS = 100;
const DUREE_PARRAINAGE_SECONDES = 365 * 86400;
const FENETRE_ATTRIBUTION_SECONDES = 7 * 86400;
const DEDOUBLONNAGE_CLIC_SECONDES = 30 * 60;
const CLICS_PAR_PALIER_VISIBILITE = 50;
const POINTS_PAR_PALIER_VISIBILITE = 10;
const ESSAI_JOURS = 7;
const INVITATION_JOURS = 90;
const INVITATION_PLAFOND_JOURS_AN = 365;

const PRIX_BOOST = 1000;
const BOOST_JOURS = 7;
const BOOST_PLACES = 4;
const PRIX_PACKS = array(5 => 6500, 10 => 12000, 25 => 27500);
const PART_CREATEUR_PACK_POURCENT = 75;
const PRIX_DOMAINE = 2000;
const PRIX_CODE_CADEAU = 500;
const PRIX_POURBOIRE = 300;
const PART_CREATEUR_POURBOIRE = 200;
const PRIX_AUDIT_PRO = 500;
const BOUNTY_MINIMUM = 1000;
const BOUNTY_POURCENT_CONTRIBUTEUR = 90;

if (COMMISSION_PARRAIN_CREATEUR + max(COMMISSION_APPORTEUR, COMMISSION_FAVORIS) > PART_ALPHABETTE_CENTIMES) { http_response_code(500); exit; }
if (PART_CREATEUR_POURBOIRE > PRIX_POURBOIRE) { http_response_code(500); exit; }

/** Schéma du Lot 5 (créé une fois, à côté des tables du Lot 3). */
function c_db(): PDO {
    static $pret = false;
    $db = f_db();
    if ($pret) return $db;
    $db->exec(<<<SQL
CREATE TABLE IF NOT EXISTS codes_ref (compte_id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS parrainages_createurs (
  filleul_compte_id INTEGER PRIMARY KEY, parrain_compte_id INTEGER NOT NULL, debut INTEGER NOT NULL, fin INTEGER NOT NULL,
  CHECK (filleul_compte_id <> parrain_compte_id));
CREATE TABLE IF NOT EXISTS clics (
  id TEXT PRIMARY KEY, ref_compte_id INTEGER NOT NULL, app_slug TEXT NOT NULL, src TEXT NOT NULL, empreinte TEXT NOT NULL, cree_le INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS clics_dedup ON clics (ref_compte_id, app_slug, empreinte, cree_le);
CREATE TABLE IF NOT EXISTS visibilite (compte_id INTEGER PRIMARY KEY, clics_uniques INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS commandes (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, compte_id INTEGER, app_slug TEXT, params TEXT NOT NULL DEFAULT '{}',
  montant_centimes INTEGER NOT NULL CHECK (montant_centimes >= 0), moyen TEXT NOT NULL, statut TEXT NOT NULL,
  cree_le INTEGER NOT NULL, paye_le INTEGER, provider_event_id TEXT);
CREATE TABLE IF NOT EXISTS droits (
  id INTEGER PRIMARY KEY, beneficiaire_hash TEXT NOT NULL, app_slug TEXT, source TEXT NOT NULL, source_id TEXT,
  debut INTEGER, fin INTEGER, jours INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS droits_benef ON droits (beneficiaire_hash, app_slug);
CREATE TABLE IF NOT EXISTS essais (compte_id INTEGER NOT NULL, app_slug TEXT NOT NULL, debut INTEGER NOT NULL, fin INTEGER NOT NULL, ref TEXT,
  PRIMARY KEY (compte_id, app_slug));
CREATE TABLE IF NOT EXISTS invitations (
  abonnement_id INTEGER PRIMARY KEY, parrain_compte_id INTEGER NOT NULL, annee TEXT NOT NULL, jours INTEGER NOT NULL, cree_le INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS boosts (
  id INTEGER PRIMARY KEY, app_slug TEXT NOT NULL, debut INTEGER NOT NULL, fin INTEGER NOT NULL, origine TEXT NOT NULL, ref TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS badges (app_slug TEXT NOT NULL, badge TEXT NOT NULL, cree_le INTEGER NOT NULL, PRIMARY KEY (app_slug, badge));
CREATE TABLE IF NOT EXISTS packs (id INTEGER PRIMARY KEY, commande_id TEXT UNIQUE, app_slug TEXT NOT NULL, acheteur_compte_id INTEGER NOT NULL,
  nb INTEGER NOT NULL, cree_le INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS licences (
  id INTEGER PRIMARY KEY, pack_id INTEGER NOT NULL, code_hash TEXT NOT NULL UNIQUE, code_chiffre TEXT NOT NULL, code_fin TEXT NOT NULL,
  app_slug TEXT NOT NULL, attribuee_a TEXT, active_par TEXT, active_le INTEGER, fin INTEGER, statut TEXT NOT NULL DEFAULT 'libre');
CREATE TABLE IF NOT EXISTS cadeaux (
  code_hash TEXT PRIMARY KEY, code_fin TEXT NOT NULL, app_slug TEXT NOT NULL, acheteur_compte_id INTEGER NOT NULL, commande_id TEXT,
  cree_le INTEGER NOT NULL, active_par TEXT, active_le INTEGER);
CREATE TABLE IF NOT EXISTS domaines (
  id INTEGER PRIMARY KEY, app_slug TEXT NOT NULL, domaine TEXT NOT NULL UNIQUE, compte_id INTEGER NOT NULL, debut INTEGER NOT NULL, fin INTEGER NOT NULL,
  shell_conserve INTEGER NOT NULL CHECK (shell_conserve = 1), statut TEXT NOT NULL, commande_id TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS audits_pro (id INTEGER PRIMARY KEY, compte_id INTEGER, app_slug TEXT NOT NULL, statut TEXT NOT NULL, commande_id TEXT UNIQUE, cree_le INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bounties (
  id INTEGER PRIMARY KEY, titre TEXT NOT NULL, description TEXT NOT NULL, app_slug TEXT, auteur_compte_id INTEGER NOT NULL,
  montant_centimes INTEGER NOT NULL CHECK (montant_centimes >= 1000), statut TEXT NOT NULL, contributeur_compte_id INTEGER,
  commande_id TEXT UNIQUE, cree_le INTEGER NOT NULL, clos_le INTEGER);
CREATE TABLE IF NOT EXISTS transparence (app_slug TEXT PRIMARY KEY, publique INTEGER NOT NULL DEFAULT 0, maj INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS codes_jours_utilises (code_id TEXT PRIMARY KEY, compte_id INTEGER NOT NULL, jours INTEGER NOT NULL, utilise_le INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS newsletter (email_hash TEXT PRIMARY KEY, email TEXT NOT NULL, confirme INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS newsletter_envois (id INTEGER PRIMARY KEY, sujet TEXT NOT NULL, nb INTEGER NOT NULL, envoye_le INTEGER NOT NULL);
SQL);
    $pret = true;
    return $db;
}

function c_slug(string $s): string { return preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', $s) ? $s : ''; }
function c_jeton(string $prefixe, int $octets = 12): string { return $prefixe . bin2hex(random_bytes($octets)); }

/** Code de recommandation anonyme d'un compte : « r » + 10 caractères, ne révèle ni l'e-mail ni l'identifiant. */
function c_code_ref(int $compte_id): string {
    $db = c_db();
    $q = $db->prepare('SELECT code FROM codes_ref WHERE compte_id = ?'); $q->execute(array($compte_id));
    $c = $q->fetchColumn();
    if ($c !== false) return (string) $c;
    for ($i = 0; $i < 5; $i++) {
        $code = 'r' . substr(strtr(base64_encode(hash_hmac('sha256', "ref|$compte_id|$i", f_secret('ALPHABETTE_FINANCE_SECRET', 'secret.key'), true)), '+/', 'xy'), 0, 10);
        $code = strtolower(preg_replace('/[^a-z0-9]/i', 'z', $code));
        try { $db->prepare('INSERT INTO codes_ref (compte_id, code) VALUES (?, ?)')->execute(array($compte_id, $code)); return $code; }
        catch (PDOException $e) { /* collision très improbable : on essaie la variante suivante */ }
    }
    f_erreur(503, 'Code indisponible.');
    return '';
}

function c_compte_par_code(string $code): ?int {
    if (!preg_match('/^r[a-z0-9]{10}$/', $code)) return null;
    $q = c_db()->prepare('SELECT compte_id FROM codes_ref WHERE code = ?'); $q->execute(array($code));
    $id = $q->fetchColumn();
    return $id === false ? null : (int) $id;
}

function c_createur_de(PDO $db, string $slug): ?int {
    $q = $db->prepare('SELECT createur_id FROM applis WHERE slug = ?'); $q->execute(array($slug));
    $c = $q->fetchColumn();
    return $c ? (int) $c : null;
}

function c_ecrire(PDO $db, ?int $compte, string $benef, string $type, int $montant, ?string $app, ?int $abo, string $ref, int $dispo, int $t, string $libelle): void {
    $db->prepare('INSERT INTO ecritures (compte_id, beneficiaire, type, montant_centimes, app_slug, abonnement_id, provider_event_id, disponible_le, cree_le, libelle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute(array($compte, $benef, $type, $montant, $app, $abo, $ref, $dispo, $t, $libelle));
}

/**
 * Répartition d'un abonnement 15 €/an vendu (appelée DANS la transaction du webhook).
 * Renvoie le détail en centimes ; la somme fait toujours exactement 1500.
 */
function c_repartir_abonnement(PDO $db, int $abo, string $app, ?array $commande, string $evId, int $t, ?string $acheteur_hash): array {
    c_db();
    $createur = c_createur_de($db, $app);
    $dispo = $t + f_delai_disponibilite();
    $detail = array('createur' => PART_CREATEUR_CENTIMES, 'parrain' => 0, 'apporteur' => 0, 'alphabette' => 0);
    if ($createur) c_ecrire($db, $createur, 'createur', 'vente', PART_CREATEUR_CENTIMES, $app, $abo, $evId, $dispo, $t, 'Abonnement 15 €/an — part créateur');
    else c_ecrire($db, null, 'alphabette', 'vente_sans_createur', PART_CREATEUR_CENTIMES, $app, $abo, $evId, $t, $t, 'Abonnement 15 €/an — appli d\'Alphabette');

    $emailDe = function (int $id) use ($db): string { $q = $db->prepare('SELECT email_hash FROM comptes WHERE id = ?'); $q->execute(array($id)); return (string) $q->fetchColumn(); };
    // 1. Parrainage créateur : 12 mois à partir de l'inscription du filleul.
    if ($createur) {
        $q = $db->prepare('SELECT parrain_compte_id FROM parrainages_createurs WHERE filleul_compte_id = ? AND debut <= ? AND fin > ?');
        $q->execute(array($createur, $t, $t));
        $parrain = $q->fetchColumn();
        if ($parrain !== false && (int) $parrain !== $createur && $emailDe((int) $parrain) !== (string) $acheteur_hash) {
            $detail['parrain'] = COMMISSION_PARRAIN_CREATEUR;
            c_ecrire($db, (int) $parrain, 'createur', 'commission_parrainage', COMMISSION_PARRAIN_CREATEUR, $app, $abo, $evId, $dispo, $t, 'Parrainage créateur (prélevé sur la part Alphabette)');
        }
    }
    // 2. Apporteur (lien /go/<slug>?ref=… ou vitrine « Mes 3 applis préférées ») : 7 jours, sans traceur, anti-auto-attribution.
    $params = $commande ? (json_decode((string) $commande['params'], true) ?: array()) : array();
    $clicId = (string) ($params['clic'] ?? '');
    if ($clicId !== '') {
        $q = $db->prepare('SELECT * FROM clics WHERE id = ?'); $q->execute(array($clicId));
        $clic = $q->fetch();
        if ($clic && $clic['app_slug'] === $app && $t - (int) $clic['cree_le'] <= FENETRE_ATTRIBUTION_SECONDES && (int) $clic['cree_le'] <= $t) {
            $ref = (int) $clic['ref_compte_id'];
            $auto = $ref === $createur || ($acheteur_hash !== null && $emailDe($ref) === $acheteur_hash);
            if (!$auto) {
                $m = $clic['src'] === 'favorites' ? COMMISSION_FAVORIS : COMMISSION_APPORTEUR;
                $detail['apporteur'] = $m;
                c_ecrire($db, $ref, 'createur', $clic['src'] === 'favorites' ? 'commission_favoris' : 'commission_apporteur', $m, $app, $abo, $evId, $dispo, $t,
                    $clic['src'] === 'favorites' ? 'Recommandation « Mes 3 applis préférées »' : 'Apport catalogue (lien recommandé)');
            }
        }
    }
    $detail['alphabette'] = PART_ALPHABETTE_CENTIMES - $detail['parrain'] - $detail['apporteur'];
    if ($detail['alphabette'] < 0 || array_sum($detail) !== PRIX_ABONNEMENT_CENTIMES || $detail['createur'] !== PART_CREATEUR_CENTIMES) {
        throw new RuntimeException('Répartition invalide : vente refusée.');
    }
    c_ecrire($db, null, 'alphabette', 'commission', $detail['alphabette'], $app, $abo, $evId, $t, $t, 'Abonnement 15 €/an — part Alphabette (après affiliation)');

    // 3. Parrainage utilisateur (/invite/<code>) : +90 jours pour le parrain, plafond 365 jours par année civile.
    $invite = (string) ($params['invite'] ?? '');
    $parrainU = $invite !== '' ? c_compte_par_code($invite) : null;
    if ($parrainU && $emailDe($parrainU) !== (string) $acheteur_hash) {
        $annee = gmdate('Y', $t);
        $q = $db->prepare('SELECT COALESCE(SUM(jours), 0) FROM invitations WHERE parrain_compte_id = ? AND annee = ?'); $q->execute(array($parrainU, $annee));
        $jours = min(INVITATION_JOURS, INVITATION_PLAFOND_JOURS_AN - (int) $q->fetchColumn());
        if ($jours > 0) {
            $db->prepare('INSERT OR IGNORE INTO invitations (abonnement_id, parrain_compte_id, annee, jours, cree_le) VALUES (?, ?, ?, ?, ?)')->execute(array($abo, $parrainU, $annee, $jours, $t));
            c_ajouter_jours($db, $emailDe($parrainU), $jours, 'invitation', (string) $abo, $t);
            $detail['jours_parrain'] = $jours;
        }
    }
    // Jours en attente (invitation reçue avant d'être abonné) : appliqués dès le 1er abonnement de l'acheteur.
    if ($acheteur_hash) {
        $q = $db->prepare('SELECT id, jours FROM droits WHERE beneficiaire_hash = ? AND app_slug IS NULL AND jours > 0'); $q->execute(array($acheteur_hash));
        foreach ($q->fetchAll() as $d) {
            $q2 = $db->prepare('SELECT fin FROM abonnements WHERE id = ?'); $q2->execute(array($abo));
            $debut = (int) $q2->fetchColumn();
            $db->prepare('UPDATE droits SET app_slug = ?, debut = ?, fin = ? WHERE id = ?')->execute(array($app, $debut, $debut + (int) $d['jours'] * 86400, (int) $d['id']));
        }
    }
    return $detail;
}

/** Ajoute des jours d'accès à la suite de l'abonnement actif le plus long (sinon : en attente du prochain abonnement). */
function c_ajouter_jours(PDO $db, string $benef_hash, int $jours, string $source, string $source_id, int $t): void {
    $q = $db->prepare("SELECT app_slug, fin FROM abonnements WHERE abonne_hash = ? AND statut = 'actif' AND fin > ? ORDER BY fin DESC LIMIT 1");
    $q->execute(array($benef_hash, $t));
    $a = $q->fetch();
    if ($a) {
        $q = $db->prepare('SELECT COALESCE(MAX(fin), 0) FROM droits WHERE beneficiaire_hash = ? AND app_slug = ?'); $q->execute(array($benef_hash, $a['app_slug']));
        $debut = max((int) $a['fin'], (int) $q->fetchColumn());
        $db->prepare('INSERT INTO droits (beneficiaire_hash, app_slug, source, source_id, debut, fin, jours, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute(array($benef_hash, $a['app_slug'], $source, $source_id, $debut, $debut + $jours * 86400, $jours, $t));
    } else {
        $db->prepare('INSERT INTO droits (beneficiaire_hash, app_slug, source, source_id, debut, fin, jours, cree_le) VALUES (?, NULL, ?, ?, NULL, NULL, ?, ?)')
            ->execute(array($benef_hash, $source, $source_id, $jours, $t));
    }
}

/** Droit d'accès direct (licence, cadeau, code jours, essai) à partir de maintenant ou de la fin du droit en cours. */
function c_donner_acces(PDO $db, string $benef_hash, string $app, int $jours, string $source, string $source_id, int $t): int {
    $q = $db->prepare("SELECT MAX(fin) FROM (SELECT fin FROM abonnements WHERE abonne_hash = ? AND app_slug = ? AND statut = 'actif'
                       UNION ALL SELECT fin FROM droits WHERE beneficiaire_hash = ? AND app_slug = ?)");
    $q->execute(array($benef_hash, $app, $benef_hash, $app));
    $debut = max($t, (int) $q->fetchColumn());
    $fin = $debut + $jours * 86400;
    $db->prepare('INSERT INTO droits (beneficiaire_hash, app_slug, source, source_id, debut, fin, jours, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute(array($benef_hash, $app, $source, $source_id, $debut, $fin, $jours, $t));
    return $fin;
}

/** Accès en cours d'un e-mail à une appli : abonnement, essai, licence, cadeau, jours offerts. */
function c_acces(string $benef_hash, string $app, ?int $compte_id = null): array {
    $db = c_db(); $t = f_maintenant();
    $q = $db->prepare("SELECT MAX(fin) FROM abonnements WHERE abonne_hash = ? AND app_slug = ? AND statut = 'actif' AND debut <= ?"); $q->execute(array($benef_hash, $app, $t));
    $abo = (int) $q->fetchColumn();
    $q = $db->prepare('SELECT source, MAX(fin) AS fin FROM droits WHERE beneficiaire_hash = ? AND app_slug = ? AND debut <= ? AND fin > ? GROUP BY source ORDER BY fin DESC LIMIT 1');
    $q->execute(array($benef_hash, $app, $t, $t));
    $d = $q->fetch() ?: null;
    $q = $db->prepare('SELECT MAX(fin) FROM droits WHERE beneficiaire_hash = ? AND app_slug = ?'); $q->execute(array($benef_hash, $app));
    $finDroits = (int) $q->fetchColumn();
    $essai = 0;
    if ($compte_id) { $q = $db->prepare('SELECT fin FROM essais WHERE compte_id = ? AND app_slug = ?'); $q->execute(array($compte_id, $app)); $essai = (int) $q->fetchColumn(); }
    $fin = max($abo, $finDroits, $essai);
    $source = $abo > $t ? 'abonnement' : ($d ? (string) $d['source'] : ($essai > $t ? 'essai' : null));
    return array('actif' => $fin > $t && $source !== null, 'source' => $source, 'fin' => $fin > $t ? gmdate('c', $fin) : null,
        'payant' => $abo > $t || ($d && in_array($d['source'], array('licence', 'cadeau', 'invitation'), true)));
}

/* ───────────────────────────── boosts (4 places, 7 jours) ───────────────────────────── */

/** Première date où une place se libère pour une durée donnée (aucune surréservation). */
function c_prochaine_place(PDO $db, int $duree, int $t): int {
    $q = $db->prepare('SELECT debut, fin FROM boosts WHERE fin > ? ORDER BY fin'); $q->execute(array($t));
    $l = $q->fetchAll();
    $candidats = array_merge(array($t), array_map(function ($b) { return (int) $b['fin']; }, $l));
    sort($candidats);
    foreach ($candidats as $debut) {
        $n = 0;
        foreach ($l as $b) if ((int) $b['debut'] < $debut + $duree && (int) $b['fin'] > $debut) $n++;
        if ($n < BOOST_PLACES) return $debut;
    }
    return end($candidats) ?: $t;
}

/** Boost : immédiat si place libre (achat), sinon mis en file (cadeau). Idempotent par $ref. Renvoie [debut, fin] ou null. */
function c_boost(PDO $db, string $app, int $jours, string $origine, string $ref, int $t, bool $immediat_obligatoire): ?array {
    $q = $db->prepare('SELECT debut, fin FROM boosts WHERE ref = ?'); $q->execute(array($ref));
    if ($b = $q->fetch()) return array((int) $b['debut'], (int) $b['fin']);
    $duree = $jours * 86400;
    $debut = c_prochaine_place($db, $duree, $t);
    if ($immediat_obligatoire && $debut > $t) return null;
    $db->prepare('INSERT INTO boosts (app_slug, debut, fin, origine, ref) VALUES (?, ?, ?, ?, ?)')->execute(array($app, $debut, $debut + $duree, $origine, $ref));
    return array($debut, $debut + $duree);
}

function c_badge(PDO $db, string $app, string $badge, int $t): void {
    $db->prepare('INSERT OR IGNORE INTO badges (app_slug, badge, cree_le) VALUES (?, ?, ?)')->execute(array($app, $badge, $t));
}

/* ───────────────────────────── codes (cadeaux, licences, jours) ───────────────────────────── */

function c_code_lisible(string $prefixe, int $blocs): string {
    $alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I
    $p = array();
    for ($b = 0; $b < $blocs; $b++) { $s = ''; for ($i = 0; $i < 4; $i++) $s .= $alpha[random_int(0, 31)]; $p[] = $s; }
    return $prefixe . '-' . implode('-', $p);
}
function c_hash_code(string $code): string { return f_hmac('code|' . strtoupper(trim($code))); }

/** Code « jours .fr » du Labo : JFR-<jours>-<id>-<signature HMAC-SHA256 tronquée>. Vérifié ici, émis par communaute.php. */
function c_code_jours_signer(int $jours, string $id): string {
    return 'JFR-' . $jours . '-' . $id . '-' . substr(f_hmac("jours-fr|$jours|$id"), 0, 16);
}
function c_code_jours_verifier(string $code): ?array {
    if (!preg_match('/^JFR-(\d{1,3})-([a-f0-9]{16})-([a-f0-9]{16})$/', trim($code), $m)) return null;
    $jours = (int) $m[1];
    if ($jours < 1 || $jours > 365) return null;
    return hash_equals(substr(f_hmac("jours-fr|$jours|{$m[2]}"), 0, 16), $m[3]) ? array('jours' => $jours, 'id' => $m[2]) : null;
}

/** Catalogue public des liens de paiement (data/boutique.json → eu/api/boutique.json). Un lien vide = paiement par carte pas encore ouvert. */
function c_liens(): array {
    $f = __DIR__ . '/boutique.json';
    $d = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
    return is_array($d['liens'] ?? null) ? $d['liens'] : array();
}
function c_lien_paiement(string $produit, string $commande): ?string {
    $l = (string) (c_liens()[$produit] ?? '');
    if (!preg_match('#^https://buy\.stripe\.com/[A-Za-z0-9_]+$#', $l)) return null;
    return $l . '?client_reference_id=' . rawurlencode($commande);
}

/* ───────────────────────────── boutique : effets d'une commande payée (carte ou solde) ───────────────────────────── */

/** Prix attendu d'une commande, calculé côté serveur uniquement. */
function c_prix(string $type, array $p): ?int {
    switch ($type) {
        case 'boost': return PRIX_BOOST;
        case 'pack': return PRIX_PACKS[(int) ($p['nb'] ?? 0)] ?? null;
        case 'domaine': return PRIX_DOMAINE;
        case 'cadeau': $n = (int) ($p['nb'] ?? 1); return ($n >= 1 && $n <= 50) ? $n * PRIX_CODE_CADEAU : null;
        case 'pourboire': return PRIX_POURBOIRE;
        case 'audit_pro': return PRIX_AUDIT_PRO;
        case 'bounty': $m = (int) ($p['montant'] ?? 0); return ($m >= BOUNTY_MINIMUM && $m <= 500000) ? $m : null;
    }
    return null;
}

/** Part créateur d'un pack : 75 % du prix, mais JAMAIS moins de 10,00 € (1000 c.) par licence vendue. */
function c_part_createur_pack(int $nb): int {
    $prix = PRIX_PACKS[$nb];
    return max(intdiv($prix * PART_CREATEUR_PACK_POURCENT, 100), $nb * PART_CREATEUR_CENTIMES);
}

function c_compte_email(PDO $db, ?int $id): string {
    if (!$id) return '';
    $q = $db->prepare('SELECT email FROM comptes WHERE id = ?'); $q->execute(array($id));
    return (string) $q->fetchColumn();
}

/**
 * Applique une commande payée (DANS une transaction). Idempotent : une commande déjà « payee » ne refait rien.
 * $moyen = 'carte' (webhook Stripe signé) ou 'solde' (débit atomique du solde disponible, fait par l'appelant).
 * Renvoie la liste des e-mails à envoyer APRÈS la transaction.
 */
function c_executer(PDO $db, array $cmd, string $ref, int $t): array {
    $q = $db->prepare('SELECT statut FROM commandes WHERE id = ?'); $q->execute(array($cmd['id']));
    if ($q->fetchColumn() === 'payee') return array();
    $db->prepare("UPDATE commandes SET statut = 'payee', paye_le = ?, provider_event_id = ? WHERE id = ?")->execute(array($t, $ref, $cmd['id']));
    $p = json_decode((string) $cmd['params'], true) ?: array();
    $app = (string) ($cmd['app_slug'] ?? '');
    $prix = (int) $cmd['montant_centimes'];
    $acheteur = $cmd['compte_id'] !== null ? (int) $cmd['compte_id'] : null;
    $dispo = $t + f_delai_disponibilite();
    $mails = array();
    $alpha = function (string $type, int $m, string $lib) use ($db, $app, $ref, $t) { if ($m !== 0) c_ecrire($db, null, 'alphabette', $type, $m, $app ?: null, null, $ref, $t, $t, $lib); };

    switch ($cmd['type']) {
        case 'boost':
            $b = c_boost($db, $app, BOOST_JOURS, 'achat', 'cmd:' . $cmd['id'], $t, false);
            $alpha('boost', $prix, 'Boost 7 jours sur alphabette.fr');
            $mails[] = array(c_compte_email($db, $acheteur), 'Votre boost Alphabette', 'Boost de 7 jours pour « ' . $app . ' » du ' . gmdate('d/m/Y', $b[0]) . ' au ' . gmdate('d/m/Y', $b[1]) . '.');
            break;
        case 'pack':
            $nb = (int) $p['nb'];
            $createur = c_createur_de($db, $app);
            $partC = c_part_createur_pack($nb);
            if ($createur) c_ecrire($db, $createur, 'createur', 'vente_pack', $partC, $app, null, $ref, $dispo, $t, "Pack $nb licences — part créateur");
            else $alpha('vente_pack_sans_createur', $partC, "Pack $nb licences — appli d'Alphabette");
            $alpha('commission_pack', $prix - $partC, "Pack $nb licences — part Alphabette");
            $db->prepare('INSERT INTO packs (commande_id, app_slug, acheteur_compte_id, nb, cree_le) VALUES (?, ?, ?, ?, ?)')->execute(array($cmd['id'], $app, (int) $acheteur, $nb, $t));
            $pack = (int) $db->lastInsertId();
            $codes = array();
            for ($i = 0; $i < $nb; $i++) {
                $code = c_code_lisible('LIC', 3);
                $db->prepare('INSERT INTO licences (pack_id, code_hash, code_chiffre, code_fin, app_slug) VALUES (?, ?, ?, ?, ?)')
                    ->execute(array($pack, c_hash_code($code), f_chiffrer($code, 'licence:' . $pack), substr($code, -4), $app));
                $codes[] = $code;
            }
            $mails[] = array(c_compte_email($db, $acheteur), "Vos $nb licences Alphabette", "Pack de $nb licences d'un an pour « $app ».\n\n" . implode("\n", $codes) . "\n\nGérez-les (attribuer, réattribuer) depuis alphabette.eu/mes-revenus/.");
            break;
        case 'domaine':
            $db->prepare('INSERT INTO domaines (app_slug, domaine, compte_id, debut, fin, shell_conserve, statut, commande_id) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
                ->execute(array($app, (string) $p['domaine'], (int) $acheteur, $t, $t + DUREE_ABONNEMENT_SECONDES, 'a_configurer', $cmd['id']));
            $alpha('domaine', $prix, 'Domaine personnalisé (1 an, double barre conservée)');
            $mails[] = array(f_admin_email(), '[Alphabette] Domaine personnalisé à brancher', 'Domaine ' . $p['domaine'] . ' → ' . $app . ' (double barre @alphabette/shell obligatoire).');
            break;
        case 'cadeau':
            $codes = array();
            for ($i = 0; $i < (int) $p['nb']; $i++) {
                $code = c_code_lisible('ALPHA', 2);
                $db->prepare('INSERT INTO cadeaux (code_hash, code_fin, app_slug, acheteur_compte_id, commande_id, cree_le) VALUES (?, ?, ?, ?, ?, ?)')
                    ->execute(array(c_hash_code($code), substr($code, -4), $app, (int) $acheteur, $cmd['id'], $t));
                $codes[] = $code;
            }
            $alpha('cadeau', $prix, 'Codes cadeaux 1 an (offerts par le créateur)');
            $mails[] = array(c_compte_email($db, $acheteur), 'Vos codes cadeaux Alphabette', "Codes d'un an pour « $app » (à activer sur alphabette.eu/essai/$app/) :\n\n" . implode("\n", $codes));
            break;
        case 'pourboire':
            $createur = c_createur_de($db, $app);
            if ($createur) { c_ecrire($db, $createur, 'createur', 'pourboire', PART_CREATEUR_POURBOIRE, $app, null, $ref, $dispo, $t, 'Un café offert (3 €)'); $alpha('commission_pourboire', PRIX_POURBOIRE - PART_CREATEUR_POURBOIRE, 'Café offert — part Alphabette'); }
            else $alpha('pourboire_sans_createur', PRIX_POURBOIRE, "Café offert — appli d'Alphabette");
            break;
        case 'audit_pro':
            $db->prepare("INSERT INTO audits_pro (compte_id, app_slug, statut, commande_id, cree_le) VALUES (?, ?, 'a_faire', ?, ?)")->execute(array($acheteur, $app, $cmd['id'], $t));
            $alpha('audit_pro', $prix, 'Audit IA Pro');
            $mails[] = array(f_admin_email(), '[Alphabette] Audit IA Pro à faire', "Appli $app — commande " . $cmd['id']);
            break;
        case 'bounty':
            $db->prepare("UPDATE bounties SET statut = 'ouvert' WHERE commande_id = ? AND statut = 'en_attente_paiement'")->execute(array($cmd['id']));
            $alpha('sequestre_bounty', $prix, 'Bounty : somme mise sous séquestre');
            break;
        default:
            throw new RuntimeException('Commande inconnue.');
    }
    return $mails;
}

/** Débit atomique du solde DISPONIBLE (DANS une transaction). Faux si le solde ne suffit pas. */
function c_debiter_solde(PDO $db, int $compte, int $montant, string $ref, string $libelle, int $t): bool {
    $s = f_soldes($compte);
    if ($montant <= 0 || $s['availableBalanceCents'] < $montant) return false;
    c_ecrire($db, $compte, 'createur', 'achat_solde', -$montant, null, null, $ref, $t, $t, $libelle);
    return true;
}

function c_envoyer(array $mails): void { foreach ($mails as $m) if ($m[0] !== '') f_mail($m[0], $m[1], $m[2]); }

/* ───────────────────────────── récompenses de croissance (appelées aussi par le service Créateurs) ───────────────────────────── */

/** Défi Lancement Éclair : éligible à .fr moins de 48 h après l'arrivée sur .eu → badge « eclair » + boost 7 jours (file d'attente). */
function c_defi_eclair(string $app, int $arrive_le, int $eligible_le): bool {
    if ($eligible_le - $arrive_le >= 48 * 3600 || $eligible_le < $arrive_le) return false;
    return (bool) f_transaction(function (PDO $db) use ($app, $eligible_le) {
        c_db();
        c_badge($db, $app, 'eclair', $eligible_le);
        c_boost($db, $app, 7, 'eclair', 'eclair:' . $app, f_maintenant(), false);
        return true;
    });
}

/** Concours de recrutement du mois : le n° 1 gagne un boost de 15 jours sur .fr pour son appli (une seule fois par mois). */
function c_concours_attribuer(string $mois, string $email_gagnant, string $app): ?array {
    if (!preg_match('/^\d{4}-\d{2}$/', $mois) || c_slug($app) === '') return null;
    return f_transaction(function (PDO $db) use ($mois, $email_gagnant, $app) {
        c_db();
        $b = c_boost($db, $app, 15, 'concours', 'concours:' . $mois, f_maintenant(), false);
        f_compte_par_email($email_gagnant, true);
        return array('app' => $app, 'debut' => gmdate('c', $b[0]), 'fin' => gmdate('c', $b[1]));
    });
}

/** Parrainage créateur : 12 mois à partir de maintenant ; un seul parrain par filleul, jamais soi-même. */
function c_enregistrer_parrainage(string $email_filleul, string $code_parrain): bool {
    $parrain = c_compte_par_code($code_parrain);
    if (!$parrain || !f_email_valide($email_filleul)) return false;
    $filleul = f_compte_par_email($email_filleul, true);
    if (!$filleul || (int) $filleul['id'] === $parrain) return false;
    $t = f_maintenant();
    $q = c_db()->prepare('INSERT OR IGNORE INTO parrainages_createurs (filleul_compte_id, parrain_compte_id, debut, fin) VALUES (?, ?, ?, ?)');
    $q->execute(array((int) $filleul['id'], $parrain, $t, $t + DUREE_PARRAINAGE_SECONDES));
    return $q->rowCount() === 1;
}

/** Rattache une appli publiée sur .fr à son créateur (appelé par l'admin Créateurs lors du passage .fr). */
function c_lier_app(string $slug, string $email): void {
    if (c_slug($slug) === '' || !f_email_valide($email)) return;
    $c = f_compte_par_email($email, true);
    f_db()->prepare('INSERT INTO applis (slug, createur_id, maj) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET createur_id = excluded.createur_id, maj = excluded.maj')
        ->execute(array($slug, (int) $c['id'], f_maintenant()));
}
