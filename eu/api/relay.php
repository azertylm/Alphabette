<?php
/**
 * relay.php — « Passeport QR chiffré » (Lot 6) : relais Zero-Knowledge entre deux appareils.
 *
 * Le navigateur chiffre ses préférences (AES-GCM, Web Crypto) avec une clé éphémère qui reste dans le #hash du lien :
 * elle n'est JAMAIS envoyée ici. Ce service ne voit qu'un bloc illisible, le garde 120 secondes au plus et le détruit
 * à la première lecture (ou à l'expiration). Le code court (6 caractères) sert d'adresse ; le QR code est dessiné
 * dans le navigateur (aucun service extérieur).
 *
 *   POST { action:"deposer", bloc:"<base64url>" }  → 201 { code, expire_dans }
 *   POST { action:"lire",    code:"ABC234" }       → 200 { bloc }  (le bloc est détruit) · 404 introuvable/expiré · 429 trop d'essais
 *
 * Stockage : un fichier par bloc (nom = SHA-256 du code) dans <privé>/relais/, jamais servi par le web.
 */
declare(strict_types=1);

require_once __DIR__ . '/lot6-commun.php';

const RELAIS_DUREE_SECONDES = 120;
const RELAIS_TAILLE_MAX = 24576;      // 24 Ko de texte chiffré : largement assez pour des préférences
const RELAIS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I
const RELAIS_DEPOTS_MAX = 6;          // par visiteur et par 10 minutes
const RELAIS_LECTURES_MAX = 30;       // par visiteur et par 10 minutes (essais ratés compris)
const RELAIS_RATES_MAX = 8;           // codes inconnus par visiteur et par 10 minutes

l6_entetes();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') l6_erreur(405, 'Utilisez POST.');

$prive = l6_dossier_prive();
if ($prive === null) l6_erreur(503, "Le service n'est pas disponible pour le moment.");
$dossier = $prive . '/relais';
if (!is_dir($dossier)) @mkdir($dossier, 0700, true);
if (!is_dir($dossier) || !is_writable($dossier)) l6_erreur(503, "Le service n'est pas disponible pour le moment.");

/** Détruit tous les blocs expirés (appelé à chaque requête : aucune tâche planifiée nécessaire). */
function relais_purger(string $dossier): void {
    foreach (glob($dossier . '/*.bloc') ?: array() as $f) {
        $enveloppe = json_decode((string) @file_get_contents($f), true);
        if (!is_array($enveloppe) || (int) ($enveloppe['expire'] ?? 0) <= time()) @unlink($f);
    }
}
relais_purger($dossier);

$e = l6_corps_json(RELAIS_TAILLE_MAX + 512);
$action = (string) ($e['action'] ?? '');
$fichier = function (string $code) use ($dossier): string { return $dossier . '/' . hash('sha256', $code) . '.bloc'; };

if ($action === 'deposer') {
    $bloc = (string) ($e['bloc'] ?? '');
    if ($bloc === '' || strlen($bloc) > RELAIS_TAILLE_MAX || !preg_match('/^[A-Za-z0-9_-]+$/', $bloc)) l6_erreur(400, 'Bloc chiffré invalide.');
    if (!l6_limite($prive, 'relais-depot', RELAIS_DEPOTS_MAX, 600)) l6_erreur(429, 'Trop de transferts à la suite : patientez quelques minutes.');
    for ($essai = 0; $essai < 20; $essai++) {
        $code = '';
        for ($i = 0; $i < 6; $i++) $code .= RELAIS_ALPHABET[random_int(0, strlen(RELAIS_ALPHABET) - 1)];
        $f = $fichier($code);
        $h = @fopen($f, 'x'); // création exclusive : jamais d'écrasement d'un code déjà pris
        if ($h === false) continue;
        fwrite($h, json_encode(array('bloc' => $bloc, 'expire' => time() + RELAIS_DUREE_SECONDES)));
        fclose($h);
        @chmod($f, 0600);
        l6_repondre(201, array('code' => $code, 'expire_dans' => RELAIS_DUREE_SECONDES));
    }
    l6_erreur(503, 'Service occupé, réessayez dans un instant.');
}

if ($action === 'lire') {
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($e['code'] ?? '')) ?? '');
    if (!preg_match('/^[A-HJ-NP-Z2-9]{6}$/', $code)) l6_erreur(400, 'Le code comporte 6 caractères (lettres et chiffres).');
    if (!l6_limite($prive, 'relais-lecture', RELAIS_LECTURES_MAX, 600)) l6_erreur(429, "Trop d'essais : patientez quelques minutes.");
    $f = $fichier($code);
    // Lecture + destruction sous verrou : deux lectures simultanées ne peuvent pas toutes deux réussir.
    $h = @fopen($f, 'r+');
    $bloc = null;
    if ($h !== false) {
        if (flock($h, LOCK_EX)) {
            $enveloppe = json_decode((string) stream_get_contents($h), true);
            if (is_array($enveloppe) && (int) ($enveloppe['expire'] ?? 0) > time()) $bloc = (string) $enveloppe['bloc'];
            @unlink($f);
            flock($h, LOCK_UN);
        }
        fclose($h);
    }
    if ($bloc === null) {
        if (!l6_limite($prive, 'relais-rate', RELAIS_RATES_MAX, 600)) l6_erreur(429, "Trop d'essais : patientez quelques minutes.");
        l6_erreur(404, 'Code inconnu, déjà utilisé ou expiré (il ne vit que 2 minutes).');
    }
    l6_repondre(200, array('bloc' => $bloc));
}

l6_erreur(400, 'Action inconnue.');
