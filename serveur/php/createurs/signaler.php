<?php
/**
 * signaler.php — « Signaler un problème / abus » depuis le menu ⋯ du shell ou le cadre d'une appli de créateur.
 *   POST { app_id, motif, details, contact? } → { ok }   (e-mail immédiat à l'administrateur ; 10 par jour et par connexion)
 * Un signalement ne retire rien tout seul : l'administrateur le lit dans /admin/avis-suspects, puis met en pause ou écarte.
 */
require __DIR__ . '/_lib.php';
// Les applis d'Alphabette (alphabette.fr, sous-domaines, alphabette.eu) peuvent signaler : réponse CORS limitée à ces origines, sans cookie.
$origine = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if (preg_match('#^https://([a-z0-9-]+\.)?alphabette\.(eu|fr)$#', $origine)) {
    header('Access-Control-Allow-Origin: ' . $origine);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, X-Alphabette');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
exiger_post(true);
$e = corps_json();
$app = (string) ($e['app_id'] ?? '');
if (!preg_match('/^[a-z0-9][a-z0-9._-]{1,60}$/i', $app)) erreur(400, 'Application inconnue.');
$motifs = array('illicite' => 'Contenu illicite ou dangereux', 'arnaque' => 'Arnaque ou hameçonnage', 'donnees' => 'Collecte abusive de données',
    'droits' => 'Atteinte à des droits', 'bug' => 'Ne marche pas', 'autre' => 'Autre');
$motif = (string) ($e['motif'] ?? '');
if (!isset($motifs[$motif])) erreur(400, 'Choisissez un motif.');
$details = texte((string) ($e['details'] ?? ''), 1000);
if (mb_strlen($details) < 5) erreur(400, 'Décrivez le problème en quelques mots.');
$contact = texte((string) ($e['contact'] ?? ''), 120);
if (!limite('signaler:' . empreinte_ip(), 10, 86400)) erreur(429, "Beaucoup de signalements aujourd'hui depuis votre connexion.");
$urgent = in_array($motif, array('illicite', 'arnaque', 'donnees', 'droits'), true);
$texte = $motifs[$motif] . ' — ' . $details . ($contact !== '' ? " (contact : $contact)" : '');
db()->prepare('INSERT INTO flags(appId, reason, details, createdAt) VALUES (?, ?, ?, ?)')->execute(array($app, 'signalement', $texte, time()));
envoyer_mail(destinataire_admin(), '[Alphabette] ' . ($urgent ? 'URGENT — ' : '') . 'Signalement : ' . $app, "Application : $app\n$texte\n\nÀ examiner : " . origine_publique() . "/admin/avis-suspects\n");
repondre(200, array('ok' => true));
