<?php
/**
 * secrets.php — Validation SERVEUR des combinaisons secrètes d'Octet (accès offert 1, 2 ou 3 mois).
 * Publié dans eu/api/secrets.php par scripts/build-static.mjs ; appelé depuis alphabette.fr et alphabette.eu.
 *
 *   POST {action:"essayer", appareil, gestes}  → le serveur dit oui ou non. Le navigateur n'a JAMAIS la liste des combinaisons :
 *        il envoie les derniers gestes du visiteur (U ↑, D ↓, L ←, R →, O = toucher Octet) et reçoit
 *        {ok:false} ou {ok:true, niveau, nom, jusquau, deja}. Une combinaison ne sert qu'une fois par appareil.
 *   GET  ?infos                                  → public : nombre de combinaisons actives, durée offerte et indice de chacune
 *        (jamais les gestes). Sert au carnet « Mes petits secrets » et à la mention de transparence.
 *   GET  ?admin   (en-tête X-Admin-Password)     → combinaisons + compteur d'activations par mois (page admin-secrets.html).
 *   POST {action:"enregistrer", combinaisons:[…]} (X-Admin-Password) → remplace la table (validée ici).
 *
 * Stockage : fichiers JSON verrouillés dans le dossier privé (lot6-commun.php → l6_dossier_prive()), sous-dossier secrets/ :
 *   combinaisons.json  la table éditable (aussi modifiable à la main, voir LISEZMOI-SECRETS.md)
 *   activations.json   appareils déjà servis (empreinte HMAC de l'identifiant d'appareil, jamais l'identifiant lui-même)
 *                      + compteur {combinaison: {"AAAA-MM": n}}
 *   limites.json       anti-essais en rafale : empreinte HMAC de l'adresse IP, effacée au bout de 10 minutes.
 * Aucune adresse IP en clair, aucun cookie, aucune donnée personnelle (le prénom reste dans le navigateur).
 */
declare(strict_types=1);
require __DIR__ . '/lot6-commun.php';

const S_ESSAIS_MAX = 40;          // essais par visiteur…
const S_FENETRE = 600;            // …sur 10 minutes (au-delà : « réessayez plus tard »)
const S_GESTES_MAX = 16;          // le navigateur envoie au plus les 16 derniers gestes
const S_COMBIS_MAX = 12;

/* Table de départ (première mise en service seulement) : les trois combinaisons d'origine, rangées sous forme
   d'empreinte SHA-256 pour ne pas les réécrire en clair dans le dépôt public. Elles ont déjà été visibles dans
   l'ancien code du site : les remplacer dès la saison d'hiver (admin-secrets.html, 5 minutes). */
const S_TABLE_DEPART = array(
    array('id' => 'automne-2026-1-mois', 'nom' => 'La boussole', 'mois' => 1, 'saison' => 'Automne 2026', 'actif' => true, 'debut' => '', 'fin' => '2026-12-31',
          'indice' => 'Une combinaison qui tourne comme une boussole, puis on touche Octet.', 'longueur' => 9,
          'empreinte' => '23871b833d97ae2c1978677159eb4e609fbc96c81d562a008ac9bb9c367036bf'),
    array('id' => 'automne-2026-2-mois', 'nom' => "L'engrenage", 'mois' => 2, 'saison' => 'Automne 2026', 'actif' => true, 'debut' => '', 'fin' => '2026-12-31',
          'indice' => 'Une combinaison qui va et vient comme un engrenage, puis deux touches sur Octet.', 'longueur' => 10,
          'empreinte' => 'd3a5dd42fec29b9619f8047c8a297258f89d9c3388c41bd4089e10f4c020bfff'),
    array('id' => 'automne-2026-3-mois', 'nom' => 'Le grand atelier', 'mois' => 3, 'saison' => 'Automne 2026', 'actif' => true, 'debut' => '', 'fin' => '2026-12-31',
          'indice' => 'La plus longue : elle commence et finit par Octet.', 'longueur' => 12,
          'empreinte' => '64af1f46a980987a19a87fd38e087f9be2b8b0e9d765056a4527184bf585e761'),
);

/* ───────────────────────────── fichiers ───────────────────────────── */

function s_dossier(): string {
    $d = l6_dossier_prive();
    if ($d === null) l6_erreur(503, 'Service indisponible pour le moment.');
    $s = $d . '/secrets';
    if (!is_dir($s)) @mkdir($s, 0700, true);
    if (!is_dir($s) || !is_writable($s)) l6_erreur(503, 'Service indisponible pour le moment.');
    if (!is_file($s . '/.htaccess')) @file_put_contents($s . '/.htaccess', "Require all denied\n");
    return $s;
}

/** Sel secret propre à ce serveur (créé une fois) : rend les empreintes d'appareil et d'IP non réversibles. */
function s_sel(): string {
    $f = s_dossier() . '/sel.txt';
    if (!is_file($f)) { @file_put_contents($f, bin2hex(random_bytes(32))); @chmod($f, 0600); }
    return trim((string) @file_get_contents($f));
}

function s_empreinte(string $quoi, string $valeur): string { return substr(hash_hmac('sha256', $quoi . '|' . $valeur, s_sel()), 0, 24); }

/** Table des combinaisons (créée au premier appel avec la table de départ). */
function s_table(): array {
    $f = s_dossier() . '/combinaisons.json';
    if (!is_file($f)) l6_modifier($f, function (&$d) { if (!$d) $d = array('combinaisons' => S_TABLE_DEPART); });
    $t = l6_lire_json($f);
    return is_array($t['combinaisons'] ?? null) ? $t['combinaisons'] : array();
}

/** Combinaison en service aujourd'hui (actif + dates de saison respectées). */
function s_en_service(array $c, string $jour): bool {
    if (empty($c['actif'])) return false;
    if (!empty($c['debut']) && $jour < $c['debut']) return false;
    if (!empty($c['fin']) && $jour > $c['fin']) return false;
    return !empty($c['gestes']) || (!empty($c['empreinte']) && (int) ($c['longueur'] ?? 0) > 0);
}

/** Les derniers gestes du visiteur se terminent-ils par cette combinaison ? */
function s_correspond(array $c, string $gestes): bool {
    if (!empty($c['gestes'])) {
        $g = (string) $c['gestes'];
        return strlen($gestes) >= strlen($g) && hash_equals($g, substr($gestes, -strlen($g)));
    }
    $n = (int) $c['longueur'];
    return strlen($gestes) >= $n && hash_equals((string) $c['empreinte'], hash('sha256', 'octet|' . substr($gestes, -$n)));
}

/** Limite glissante sans IP conservée : empreinte HMAC, entrées effacées après la fenêtre. */
function s_limite(string $cle, int $max, int $fenetre): bool {
    $t = time();
    return l6_modifier(s_dossier() . '/limites.json', function (&$d) use ($cle, $max, $fenetre, $t) {
        foreach ($d as $k => $liste) {
            $d[$k] = array_values(array_filter((array) $liste, function ($x) use ($t, $fenetre) { return $x > $t - $fenetre; }));
            if (!$d[$k]) unset($d[$k]);
        }
        if (count($d[$cle] ?? array()) >= $max) return false;
        $d[$cle][] = $t;
        return true;
    });
}

function s_visiteur(): string { return s_empreinte('ip', (string) ($_SERVER['REMOTE_ADDR'] ?? '')); }

/* ───────────────────────────── visiteur ───────────────────────────── */

function s_essayer(array $corps): void {
    $appareil = (string) ($corps['appareil'] ?? '');
    $gestes = strtoupper((string) ($corps['gestes'] ?? ''));
    if (!preg_match('/^[a-f0-9]{32}$/', $appareil) || !preg_match('/^[UDLRO]{1,' . S_GESTES_MAX . '}$/', $gestes)) l6_erreur(400, 'Demande incomplète.');
    if (!s_limite('essai:' . s_visiteur(), S_ESSAIS_MAX, S_FENETRE) || !s_limite('appareil:' . s_empreinte('app', $appareil), S_ESSAIS_MAX, S_FENETRE)) {
        l6_erreur(429, 'Octet reprend son souffle : réessayez dans quelques minutes.');
    }
    $jour = gmdate('Y-m-d');
    $trouvee = null;
    foreach (s_table() as $c) {
        if (!is_array($c) || !s_en_service($c, $jour) || !s_correspond($c, $gestes)) continue;
        $longueur = !empty($c['gestes']) ? strlen($c['gestes']) : (int) $c['longueur'];
        if ($trouvee === null || $longueur > $trouvee[1]) $trouvee = array($c, $longueur); // la plus longue gagne
    }
    if ($trouvee === null) l6_repondre(200, array('ok' => false));
    $c = $trouvee[0];
    $id = (string) $c['id'];
    $cleAppareil = s_empreinte('app', $appareil);
    $mois = max(1, min(3, (int) $c['mois']));
    $fin = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('+' . $mois . ' months')->format('Y-m-d\TH:i:s\Z');
    $deja = l6_modifier(s_dossier() . '/activations.json', function (&$d) use ($id, $cleAppareil) {
        if (isset($d['utilises'][$id][$cleAppareil])) return true;
        $d['utilises'][$id][$cleAppareil] = gmdate('Y-m');
        $m = gmdate('Y-m');
        $d['compteur'][$id][$m] = (int) ($d['compteur'][$id][$m] ?? 0) + 1;
        return false;
    });
    $rep = array('ok' => true, 'deja' => $deja, 'niveau' => $mois, 'nom' => (string) ($c['nom'] ?? 'Combinaison secrète'));
    if (!$deja) $rep['jusquau'] = $fin;
    l6_repondre(200, $rep);
}

function s_infos(): void {
    $jour = gmdate('Y-m-d');
    $liste = array();
    foreach (s_table() as $c) {
        if (is_array($c) && s_en_service($c, $jour)) $liste[] = array('niveau' => (int) $c['mois'], 'indice' => (string) ($c['indice'] ?? ''), 'fin' => (string) ($c['fin'] ?? ''));
    }
    usort($liste, function ($a, $b) { return $a['niveau'] <=> $b['niveau']; });
    header('Cache-Control: public, max-age=600');
    l6_repondre(200, array('nombre' => count($liste), 'combinaisons' => $liste));
}

/* ───────────────────────────── administration ───────────────────────────── */

function s_admin(): void {
    $attendu = l6_env('ADMIN_PASSWORD');
    if ($attendu === '') $attendu = l6_env('ALPHABETTE_ADMIN_PASSWORD');
    if (strlen($attendu) < 12) l6_erreur(503, 'Administration non configurée (ADMIN_PASSWORD).');
    $donne = (string) ($_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '');
    if ($donne === '') l6_erreur(401, 'Mot de passe administrateur requis.');
    if (!s_limite('admin:' . s_visiteur(), 30, 900)) l6_erreur(429, 'Trop d\'essais, patientez un quart d\'heure.');
    if (!hash_equals(hash('sha256', $attendu), hash('sha256', $donne))) { usleep(300000); l6_erreur(403, 'Mot de passe incorrect.'); }
}

function s_vue_admin(): void {
    $act = l6_lire_json(s_dossier() . '/activations.json');
    $table = array_map(function ($c) { unset($c['empreinte']); return $c; }, s_table());
    l6_repondre(200, array('combinaisons' => $table, 'compteur' => $act['compteur'] ?? new stdClass(), 'aujourdhui' => gmdate('Y-m-d')));
}

function s_texte($v, int $max): string { return mb_substr(trim(preg_replace('/[<>\x00-\x1f]/u', '', (string) $v) ?? ''), 0, $max); }
function s_date($v): string { $v = (string) $v; return preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : ''; }

function s_enregistrer(array $corps): void {
    $entree = $corps['combinaisons'] ?? null;
    if (!is_array($entree) || count($entree) > S_COMBIS_MAX) l6_erreur(400, 'Liste de combinaisons invalide (' . S_COMBIS_MAX . ' au plus).');
    $anciennes = array();
    foreach (s_table() as $c) if (is_array($c) && isset($c['id'])) $anciennes[$c['id']] = $c;
    $propre = array();
    $ids = array();
    foreach ($entree as $i => $c) {
        if (!is_array($c)) l6_erreur(400, 'Ligne ' . ($i + 1) . ' invalide.');
        $n = $i + 1;
        $mois = (int) ($c['mois'] ?? 0);
        if ($mois < 1 || $mois > 3) l6_erreur(400, "Ligne $n : durée de 1, 2 ou 3 mois.");
        $saison = s_texte($c['saison'] ?? '', 30);
        $id = strtolower((string) ($c['id'] ?? ''));
        if (!preg_match('/^[a-z0-9-]{3,40}$/', $id)) {
            $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT', $saison ?: 'saison') ?: 'saison')) ?? '', '-');
            $id = substr(($base ?: 'saison') . '-' . $mois . '-mois-' . bin2hex(random_bytes(2)), 0, 40);
        }
        if (isset($ids[$id])) l6_erreur(400, "Ligne $n : identifiant en double.");
        $ids[$id] = true;
        $ligne = array('id' => $id, 'nom' => s_texte($c['nom'] ?? '', 40) ?: 'Combinaison secrète', 'mois' => $mois, 'saison' => $saison,
            'actif' => !empty($c['actif']), 'debut' => s_date($c['debut'] ?? ''), 'fin' => s_date($c['fin'] ?? ''), 'indice' => s_texte($c['indice'] ?? '', 140));
        $gestes = strtoupper((string) ($c['gestes'] ?? ''));
        if ($gestes !== '') {
            if (!preg_match('/^[UDLRO]{6,' . S_GESTES_MAX . '}$/', $gestes)) l6_erreur(400, "Ligne $n : de 6 à " . S_GESTES_MAX . ' gestes.');
            if (substr($gestes, -1) !== 'O') l6_erreur(400, "Ligne $n : la combinaison doit finir en touchant Octet.");
            if (strlen(preg_replace('/O/', '', $gestes)) < 4) l6_erreur(400, "Ligne $n : au moins 4 flèches (sinon trop facile à trouver par hasard).");
            $ligne['gestes'] = $gestes;
        } elseif (isset($anciennes[$id]['empreinte'])) {
            $ligne['empreinte'] = $anciennes[$id]['empreinte'];
            $ligne['longueur'] = (int) $anciennes[$id]['longueur'];
        } elseif (isset($anciennes[$id]['gestes'])) {
            $ligne['gestes'] = $anciennes[$id]['gestes'];
        } else {
            l6_erreur(400, "Ligne $n : choisissez les gestes de la combinaison.");
        }
        $propre[] = $ligne;
    }
    // Deux combinaisons actives ne doivent pas se « recouvrir » (l'une ne doit pas être la fin de l'autre).
    $actives = array_values(array_filter($propre, function ($c) { return $c['actif'] && !empty($c['gestes']); }));
    foreach ($actives as $a) foreach ($actives as $b) {
        if ($a['id'] !== $b['id'] && strlen($a['gestes']) <= strlen($b['gestes']) && substr($b['gestes'], -strlen($a['gestes'])) === $a['gestes']) {
            l6_erreur(400, '« ' . $a['nom'] . ' » est contenue à la fin de « ' . $b['nom'] . ' » : changez l\'une des deux.');
        }
    }
    l6_modifier(s_dossier() . '/combinaisons.json', function (&$d) use ($propre) { $d = array('combinaisons' => $propre, 'modifie_le' => gmdate('c')); });
    s_vue_admin();
}

/* ───────────────────────────── aiguillage ───────────────────────────── */

l6_entetes();
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Password');
$methode = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($methode === 'GET') {
    if (isset($_GET['admin'])) { s_admin(); s_vue_admin(); }
    s_infos();
}
if ($methode !== 'POST') l6_erreur(405, 'Méthode non prise en charge.');
$corps = l6_corps_json(16384);
$action = (string) ($corps['action'] ?? '');
if ($action === 'essayer') s_essayer($corps);
if ($action === 'enregistrer') { s_admin(); s_enregistrer($corps); }
l6_erreur(400, 'Action inconnue.');
