<?php
/**
 * transfert.php — passage .eu → .fr, à l'initiative du créateur (lien reçu par e-mail : /creations/valider-transfert?token=…).
 *   GET  ?token=…            → petite page (noindex) qui explique et propose le bouton ; RIEN n'est modifié par un simple GET
 *                              (un antivirus ou un aperçu de courrier peut ouvrir le lien sans déclencher le transfert).
 *   POST { token }           → { ok, deja, montant_centimes:1500, app }   IDEMPOTENT : refaire l'appel renvoie la même demande.
 * Ne touche qu'aux tables du service : jamais aux applis protégées (Lidarsol, Osolar, ProxiLien, Orbit, Info Perso) ni à vitrine/.
 */
require __DIR__ . '/_lib.php';

const MONTANT_CENTIMES = 1500;   // 15,00 € / an et par application (dont 10,00 € pour le créateur)

function trouver(string $jeton): ?array {
    if (!preg_match('/^[a-f0-9]{64}$/', $jeton)) return null;
    $s = db()->prepare('SELECT t.*, s.name, s.status AS app_status, s.userId AS owner FROM transfer_tokens t JOIN submissions s ON s.id = t.appId WHERE t.hash = ?');
    $s->execute(array(sha256_jeton($jeton)));
    $r = $s->fetch();
    return $r ?: null;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    header('Content-Type: text/html; charset=utf-8');
    $t = trouver((string) ($_GET['token'] ?? ''));
    $nom = $t ? htmlspecialchars($t['name'], ENT_QUOTES, 'UTF-8') : '';
    $ok = $t && (int) $t['expiresAt'] >= time() && str_starts_with($t['appId'], 'c-');
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Passer sur alphabette.fr</title>'
       . '<style>body{font:18px/1.5 system-ui,sans-serif;max-width:560px;margin:8vh auto;padding:0 16px;color:#1b1b1f}button{min-height:48px;padding:0 20px;font:inherit;border-radius:10px;border:0;background:#5b3df5;color:#fff;cursor:pointer}p#r{margin-top:16px}</style></head><body>';
    if (!$ok) { echo '<h1>Lien invalide ou expiré</h1><p>Ce lien de transfert n\'est plus valable. Écrivez-nous depuis votre espace créateur pour en recevoir un nouveau.</p></body></html>'; exit; }
    echo "<h1>« $nom » sur alphabette.fr</h1><p>Votre application a convaincu la communauté. Passer sur alphabette.fr coûte <strong>15 € par an</strong> et par application (dont 10 € pour vous). Rien n'est prélevé ici : le bouton enregistre votre demande, nous vous écrivons pour la suite.</p>"
       . '<button id="b" type="button">Lancer le transfert</button><p id="r" role="status"></p>'
       . '<script>var t=' . json_encode((string) $_GET['token']) . ';document.getElementById("b").onclick=function(){fetch("/api/createurs/transfert.php",{method:"POST",headers:{"Content-Type":"application/json","X-Alphabette":"1"},body:JSON.stringify({token:t})}).then(function(r){return r.json()}).then(function(d){document.getElementById("r").textContent=d.ok?(d.deja?"Votre demande était déjà enregistrée. Merci !":"Demande enregistrée. Merci !"):(d.erreur||"Erreur.")}).catch(function(){document.getElementById("r").textContent="Réseau indisponible, réessayez."})}</script></body></html>';
    exit;
}

exiger_post();
$e = corps_json();
$jeton = (string) ($e['token'] ?? '');
if (!limite('transfert:' . empreinte_ip(), 20, 3600)) erreur(429, 'Trop d\'essais.');
$r = transaction(function (PDO $p) use ($jeton) {
    $t = trouver($jeton);
    if (!$t || !str_starts_with($t['appId'], 'c-')) erreur(404, 'Lien invalide.');
    $d = $p->prepare('SELECT status FROM transfers WHERE appId = ?'); $d->execute(array($t['appId']));
    if ($d->fetchColumn() !== false) return array('ok' => true, 'deja' => true, 'montant_centimes' => MONTANT_CENTIMES, 'app' => $t['name']);   // idempotent
    if ((int) $t['expiresAt'] < time()) erreur(410, 'Ce lien a expiré.');
    if ($t['app_status'] !== 'eligible_fr') erreur(409, "Cette application n'est plus éligible pour le moment.");
    if ((int) $t['owner'] !== (int) $t['userId']) erreur(403, 'Lien refusé.');
    $p->prepare('UPDATE transfer_tokens SET usedAt = ? WHERE hash = ?')->execute(array(time(), sha256_jeton($jeton)));
    $p->prepare('INSERT OR IGNORE INTO transfers(appId, userId, amountCents, status, createdAt) VALUES (?, ?, ?, ?, ?)')
      ->execute(array($t['appId'], (int) $t['userId'], MONTANT_CENTIMES, 'demande', time()));
    envoyer_mail(destinataire_admin(), '[Alphabette] Transfert .fr demandé : ' . $t['name'], "Le créateur de « " . $t['name'] . " » (" . $t['appId'] . ") a lancé le transfert vers alphabette.fr (15 €/an).\n");
    return array('ok' => true, 'deja' => false, 'montant_centimes' => MONTANT_CENTIMES, 'app' => $t['name']);
});
repondre(200, $r);
