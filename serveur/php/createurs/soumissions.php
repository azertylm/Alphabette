<?php
/**
 * soumissions.php — dépôt d'une appli de créateur (parcours « /soumettre », 60 secondes).
 *   GET  ?mes                      → { soumissions:[…] }     (celles du compte connecté ; motif de refus inclus)
 *   POST multipart action=analyser (fichier .html/.zip) → { nom, description }  (lit <title> et README.md ; ne garde rien)
 *   POST multipart action=deposer  champs : nom, description, categorie, type (html|zip|github), fichier | depot,
 *                                  collab=1 (obligatoire : évolution collaborative + encapsulation @alphabette/shell),
 *                                  resoumettre=<id> (après un refus)   → { ok, id, statut }
 * La version_originale est archivée telle quelle (SHA-256) ; la version_communautaire n'existe qu'après validation.
 */
require __DIR__ . '/_lib.php';

function ligne_publique(array $s, bool $prive): array {
    $r = array('id' => $s['id'], 'nom' => $s['name'], 'description' => $s['description'], 'categorie' => $s['category'], 'statut' => $s['status'],
        'pionnier' => (int) $s['isPioneer'] === 1, 'positifs' => (int) $s['positiveCount'], 'negatifs' => (int) $s['negativeCount'],
        'depuis' => (int) $s['createdAt']);
    if ($prive) $r += array('motifRefus' => $s['rejectionReason'], 'type' => $s['sourceType'], 'source' => $s['sourceRef'], 'hashOriginal' => $s['originalHash'],
        'hashCommunautaire' => $s['communityHash'], 'depotRecupere' => (int) $s['sourceFetched'] === 1);
    return $r;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    if (!isset($_GET['mes'])) erreur(400, 'Action inconnue.');
    $u = exiger_utilisateur(false);
    $s = db()->prepare('SELECT * FROM submissions WHERE userId = ? ORDER BY createdAt DESC LIMIT 100');
    $s->execute(array((int) $u['id']));
    repondre(200, array('soumissions' => array_map(function ($x) { return ligne_publique($x, true); }, $s->fetchAll())));
}

exiger_post();
$action = (string) ($_POST['action'] ?? '');

/** Dépose le contenu envoyé (fichier ou dépôt GitHub) dans $cible ; retourne array(type, ref, hash, fetched, erreur). */
function recevoir_contenu(string $type, string $cible): array {
    if ($type === 'github') {
        $g = url_github_valide((string) ($_POST['depot'] ?? ''));
        if (!$g) return array('erreur' => "Adresse GitHub attendue : https://github.com/pseudo/depot (dépôt public).");
        $ref = 'https://github.com/' . $g['owner'] . '/' . $g['repo'];
        $zip = telecharger_github($g['owner'], $g['repo']);
        if (!$zip) return array('type' => 'github', 'ref' => $ref, 'hash' => hash('sha256', $ref), 'fetched' => 0, 'erreur' => null);  // GitHub indisponible : récupéré plus tard
        $hash = hash_file('sha256', $zip);
        $r = extraire_zip($zip, $cible);
        @unlink($zip);
        return $r['ok'] ? array('type' => 'github', 'ref' => $ref, 'hash' => $hash, 'fetched' => 1, 'erreur' => null) : array('erreur' => $r['erreur']);
    }
    $f = $_FILES['fichier'] ?? null;
    if (!$f || ($f['error'] ?? 4) !== UPLOAD_ERR_OK) return array('erreur' => "Aucun fichier reçu (15 Mo au maximum).");
    if ((int) $f['size'] > TAILLE_MAX_DEPOT) return array('erreur' => 'Fichier trop lourd (15 Mo au maximum).');
    $nom = (string) $f['name'];
    $ext = extension_de($nom);
    $hash = hash_file('sha256', $f['tmp_name']);
    if ($ext === 'html' || $ext === 'htm') {
        if (!is_dir($cible)) @mkdir($cible, 0700, true);
        $contenu = (string) file_get_contents($f['tmp_name']);
        if (stripos($contenu, '<html') === false && stripos($contenu, '<!doctype') === false && stripos($contenu, '<body') === false) return array('erreur' => "Ce fichier ne ressemble pas à une page HTML.");
        file_put_contents($cible . '/index.html', $contenu);
        @chmod($cible . '/index.html', 0600);
        return array('type' => 'html', 'ref' => texte($nom, 120), 'hash' => $hash, 'fetched' => 1, 'erreur' => null);
    }
    if ($ext === 'zip') {
        $r = extraire_zip($f['tmp_name'], $cible);
        return $r['ok'] ? array('type' => 'zip', 'ref' => texte($nom, 120), 'hash' => $hash, 'fetched' => 1, 'erreur' => null) : array('erreur' => $r['erreur']);
    }
    return array('erreur' => 'Déposez un fichier .html ou une archive .zip.');
}

if ($action === 'analyser') {
    exiger_utilisateur(false);
    if (!limite('analyse:' . empreinte_ip(), 30, 3600)) erreur(429, 'Trop d\'analyses : réessayez plus tard.');
    $tmp = sys_get_temp_dir() . '/abana-' . bin2hex(random_bytes(6));
    $r = recevoir_contenu((string) ($_POST['type'] ?? 'html') === 'zip' ? 'zip' : 'html', $tmp);
    if ($r['erreur']) { supprimer_dossier($tmp); erreur(400, $r['erreur']); }
    $a = analyser_dossier($tmp);
    supprimer_dossier($tmp);
    repondre(200, array('nom' => $a['nom'], 'description' => $a['description']));
}

if ($action === 'deposer') {
    $u = exiger_utilisateur();
    if ((string) ($_POST['collab'] ?? '') !== '1') erreur(400, "Cochez la case : l'évolution collaborative et l'encapsulation par @alphabette/shell sont obligatoires.");
    if (!limite('depot:' . (int) $u['id'], 10, 86400) || !limite('depot-ip:' . empreinte_ip(), 20, 86400)) erreur(429, "Beaucoup de dépôts aujourd'hui : réessayez demain.");
    $type = (string) ($_POST['type'] ?? '');
    if (!in_array($type, array('html', 'zip', 'github'), true)) erreur(400, 'Choisissez un fichier .html, une archive .zip ou un dépôt GitHub.');
    $nom = texte((string) ($_POST['nom'] ?? ''), 80);
    $desc = texte((string) ($_POST['description'] ?? ''), 300);
    $cat = (string) ($_POST['categorie'] ?? 'Autre');
    if (!in_array($cat, CATEGORIES, true)) $cat = 'Autre';
    $reprise = (string) ($_POST['resoumettre'] ?? '');
    $id = '';
    if ($reprise !== '') {
        if (!id_app_valide($reprise)) erreur(400, 'Soumission inconnue.');
        $s = db()->prepare('SELECT * FROM submissions WHERE id = ? AND userId = ?');
        $s->execute(array($reprise, (int) $u['id']));
        $ancienne = $s->fetch();
        if (!$ancienne) erreur(404, 'Soumission introuvable.');
        if ($ancienne['status'] !== 'rejected') erreur(409, 'Seule une soumission refusée peut être corrigée et renvoyée.');
        $id = $reprise;
    }
    $racine = null;
    $nouveau = $id === '';
    if ($nouveau) $id = nouvel_identifiant_app();
    $racine = dossier_depot($id);
    $dest = $racine . '/original.tmp';
    supprimer_dossier($dest);
    $c = recevoir_contenu($type, $dest);
    if ($c['erreur']) { supprimer_dossier($dest); if ($nouveau) supprimer_dossier($racine); erreur(400, $c['erreur']); }
    // Analyse automatique : ce que le créateur n'a pas rempli est complété depuis <title> / README.md.
    if (is_dir($dest)) { $a = analyser_dossier($dest); if ($nom === '') $nom = $a['nom']; if ($desc === '') $desc = $a['description']; }
    if ($nom === '') { supprimer_dossier($dest); if ($nouveau) supprimer_dossier($racine); erreur(400, "Donnez un nom à votre appli (je n'ai pas pu le lire dans le fichier)."); }
    // version_originale : archivée une fois pour toutes (la correction après refus la remplace tant qu'elle n'est pas validée).
    supprimer_dossier($racine . '/original');
    if (is_dir($dest)) rename($dest, $racine . '/original'); else @mkdir($racine . '/original', 0700, true);
    $statut = 'pending_admin_review';
    try {
        transaction(function (PDO $p) use ($nouveau, $id, $u, $nom, $desc, $cat, $c, $statut) {
            if ($nouveau) {
                $p->prepare('INSERT INTO submissions(id, userId, name, description, category, sourceType, sourceRef, sourceFetched, status, originalHash, communityHash, collabAccepted, creatorIpHash, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)')
                  ->execute(array($id, (int) $u['id'], $nom, $desc, $cat, $c['type'], $c['ref'], $c['fetched'], $statut, $c['hash'], '', empreinte_ip(), time(), time()));
            } else {
                $p->prepare("UPDATE submissions SET name = ?, description = ?, category = ?, sourceType = ?, sourceRef = ?, sourceFetched = ?, status = ?, originalHash = ?, rejectionReason = '', collabAccepted = 1, updatedAt = ? WHERE id = ?")
                  ->execute(array($nom, $desc, $cat, $c['type'], $c['ref'], $c['fetched'], $statut, $c['hash'], time(), $id));
            }
        });
    } catch (Throwable $x) { erreur(503, "Dépôt impossible pour le moment : réessayez dans un instant."); }
    // Validation manuelle désactivée par l'administrateur : passage direct dans le Laboratoire (si les fichiers sont là).
    if (!validation_manuelle() && $c['fetched'] === 1) {
        $statut = transaction(function (PDO $p) use ($id) {
            $s = $p->prepare('SELECT * FROM submissions WHERE id = ?'); $s->execute(array($id));
            valider_soumission($p, $s->fetch());
            return 'lab_eu';
        });
    } else {
        envoyer_mail(destinataire_admin(), '[Alphabette] Nouvelle appli à valider : ' . $nom, "Nouvelle soumission « $nom » ($id).\nÀ valider : " . origine_publique() . "/admin/validations\n");
    }
    repondre(200, array('ok' => true, 'id' => $id, 'statut' => $statut));
}
erreur(400, 'Action inconnue.');
