<?php
/**
 * votes.php — avis X/10 : un clic, connecté, un seul avis par (compte, appli), mise à jour possible.
 *   GET  ?ouvrir=<appId>                 → { ticket }        (ticket signé qui date le début d'usage ; exigé pour voter)
 *   GET  ?etat=<appId>                   → { positifs, negatifs, ratio, statut, mon_avis? }
 *   POST { action:"voter", app_id, ticket, positif:true|false, tags:[…], commentaire:"≤280" }
 *        → { ok, positifs, negatifs, ratio, statut }
 * Anti-fraude : pas d'auto-vote (compte, e-mail normalisé, empreinte IP du dépôt), session ≥ 30 s contrôlée ICI (pas côté navigateur),
 * alerte flag_security_review au-delà de 5 avis positifs en 10 min venant de comptes < 24 h ou d'un même sous-réseau.
 */
require __DIR__ . '/_lib.php';

function charger_publique(string $id): array {
    if (!id_app_valide($id)) erreur(400, 'Application inconnue.');
    $s = db()->prepare('SELECT * FROM submissions WHERE id = ?');
    $s->execute(array($id));
    $a = $s->fetch();
    if (!$a || !in_array($a['status'], array_merge(STATUTS_PUBLICS, array('flag_security_review')), true)) erreur(404, 'Application introuvable.');
    return $a;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    if (isset($_GET['ouvrir'])) {
        $a = charger_publique((string) $_GET['ouvrir']);
        $t = time();
        repondre(200, array('ticket' => $t . '.' . substr(hmac('ticket|' . $a['id'] . '|' . $t . '|' . empreinte_ip()), 0, 32)));
    }
    if (isset($_GET['etat'])) {
        $a = charger_publique((string) $_GET['etat']);
        $pos = (int) $a['positiveCount']; $neg = (int) $a['negativeCount'];
        $r = array('positifs' => $pos, 'negatifs' => $neg, 'ratio' => $pos + $neg > 0 ? round($pos / ($pos + $neg), 4) : 0, 'statut' => $a['status'],
            'seuil' => SEUIL_AVIS_POSITIFS);
        $u = utilisateur_courant();
        if ($u) {
            $s = db()->prepare('SELECT positive, tags, comment FROM votes WHERE appId = ? AND userId = ? AND valid = 1');
            $s->execute(array($a['id'], (int) $u['id']));
            $v = $s->fetch();
            if ($v) $r['mon_avis'] = array('positif' => (int) $v['positive'] === 1, 'tags' => $v['tags'] === '' ? array() : explode(',', $v['tags']), 'commentaire' => $v['comment']);
        }
        repondre(200, $r);
    }
    erreur(400, 'Action inconnue.');
}

exiger_post();
$e = corps_json();
if ((string) ($e['action'] ?? '') !== 'voter') erreur(400, 'Action inconnue.');
$u = exiger_utilisateur(true);                                  // connecté ET e-mail confirmé
$a = charger_publique((string) ($e['app_id'] ?? ''));
if (!in_array($a['status'], STATUTS_PUBLICS, true)) erreur(409, "Les avis sont suspendus pour cette application.");
if (!is_bool($e['positif'] ?? null)) erreur(400, 'Choisissez Positif ou Négatif.');
$positif = $e['positif'] === true;

// Session : le ticket prouve le début d'usage ; au moins 30 s doivent s'être écoulées.
$ticket = (string) ($e['ticket'] ?? '');
if (!preg_match('/^(\d{9,11})\.([a-f0-9]{32})$/', $ticket, $m) || !hash_equals(substr(hmac('ticket|' . $a['id'] . '|' . $m[1] . '|' . empreinte_ip()), 0, 32), $m[2])) erreur(400, 'Session invalide : rouvrez l\'application.');
$duree = time() - (int) $m[1];
if ($duree < SESSION_MIN_SECONDES) erreur(429, "Utilisez l'application encore un peu avant de donner votre avis.", array('code' => 'session_trop_courte', 'attendre' => SESSION_MIN_SECONDES - $duree));
if ($duree > 86400) erreur(400, 'Session expirée : rouvrez l\'application.');

// Auto-vote : même compte, même adresse e-mail normalisée, ou même empreinte IP que celle du dépôt.
$cree = db()->prepare('SELECT u.emailNorm FROM users u WHERE u.id = ?');
$cree->execute(array((int) $a['userId']));
$emailCreateur = (string) $cree->fetchColumn();
if ((int) $a['userId'] === (int) $u['id'] || ($emailCreateur !== '' && $emailCreateur === $u['emailNorm']) || ($a['creatorIpHash'] !== '' && hash_equals($a['creatorIpHash'], empreinte_ip()))) {
    erreur(403, "Vous ne pouvez pas noter votre propre application.", array('code' => 'auto_vote'));
}

$tags = array();
foreach ((array) ($e['tags'] ?? array()) as $t) if (is_string($t) && in_array($t, TAGS_AVIS, true) && !in_array($t, $tags, true)) $tags[] = $t;
$tags = array_slice($tags, 0, 4);
$commentaire = texte((string) ($e['commentaire'] ?? ''), 280);
if (!limite('vote:' . (int) $u['id'], 40, 86400)) erreur(429, "Beaucoup d'avis aujourd'hui : revenez demain.");

$resultat = transaction(function (PDO $p) use ($a, $u, $positif, $tags, $commentaire, $duree) {
    $s = $p->prepare('SELECT id FROM votes WHERE appId = ? AND userId = ?');
    $s->execute(array($a['id'], (int) $u['id']));
    $existant = $s->fetchColumn();
    if ($existant !== false) {      // un seul avis par (compte, appli) : on met à jour, on n'en ajoute pas
        $p->prepare('UPDATE votes SET positive = ?, tags = ?, comment = ?, valid = 1, invalidReason = ?, sessionSeconds = ?, ipHash = ?, subnetHash = ?, updatedAt = ? WHERE id = ?')
          ->execute(array($positif ? 1 : 0, implode(',', $tags), $commentaire, '', $duree, empreinte_ip(), empreinte_sous_reseau(), time(), (int) $existant));
    } else {
        $p->prepare('INSERT INTO votes(appId, userId, positive, tags, comment, sessionSeconds, ipHash, subnetHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          ->execute(array($a['id'], (int) $u['id'], $positif ? 1 : 0, implode(',', $tags), $commentaire, $duree, empreinte_ip(), empreinte_sous_reseau(), time(), time()));
    }
    $alerte = $positif ? surveiller_fraude($p, $a['id']) : null;
    $r = recalculer($p, $a['id']);
    $r['alerte'] = $alerte !== null;
    return $r;
});
repondre(200, array('ok' => true) + $resultat);
