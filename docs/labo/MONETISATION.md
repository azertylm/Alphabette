# Lot 3 — Monétisation 15 €/an, virements, pare-feu d'upload, RGPD (PHP, OVH Perso)

**Modèle unique** : 15,00 €/an (`1500` c.) = **10,00 €** créateur (`1000` c.) + **5,00 €** Alphabette (`500` c.).
Zéro Pass 40 €, zéro prorata. Tous les montants sont des **entiers en centimes** (colonne SQLite `INTEGER`, contrôle `CHECK`).
Rien n'est vendu avant le 7 mai 2027 (offre de lancement) : le moteur ne compte que des paiements réels reçus par webhook signé.

| Fichier (`serveur/php/` → `eu/api/`) | Rôle |
|---|---|
| `finance-commun.php` | base SQLite, comptes, codes 6 chiffres, IBAN AES-256-GCM, soldes (jamais appelé seul : 404) |
| `billing.php` | connexion par code e-mail (sans mot de passe, sans cookie), tableau de bord, historique filtrable, simulation |
| `webhooks.php` | Stripe `checkout.session.completed` (1500 c., `metadata.app`) et `charge.refunded` ; signature HMAC ±5 min ; idempotence par `providerEventId` |
| `payouts.php` | virement dès 2000 c. disponibles + IBAN valide, confirmé par code e-mail (15 min, 5 essais), un seul virement en cours |
| `upload-guard.php` | pare-feu ZIP (10 Mo réels, 200 fichiers, extensions, symlinks, `../`), scanner statique, doublons SHA-256 / structure, signalements (3 distincts → `paused_abuse`) |
| `gdpr.php` | politique zéro traceur, compteur de visites sans identifiant, export JSON, suppression (anonymisation, écritures comptables gardées 10 ans) |

Page : `labo/pages/mes-revenus.html` → `alphabette.eu/mes-revenus/` (double barre commune, simulation visible sur .eu seulement).

**Gains en attente** : 14 jours (rétractation), puis **solde disponible**. Un remboursement inverse exactement les écritures.

## Réglages (hors du dépôt)
Dossier privé `~/alphabette-finance/` : `finance.sqlite`, `secret.key` et `cle-iban.key` (créés tout seuls, 0600),
`config.json` `{ "webhook_secret": "whsec_…", "admin_password": "…12 caractères min." }`.
Les variables `ALPHABETTE_IBAN_KEY`, `ALPHABETTE_WEBHOOK_SECRET`, `ADMIN_PASSWORD` (nom unique ; l'ancien `ALPHABETTE_ADMIN_PASSWORD` reste lu en secours) passent avant ces fichiers.
**Sauvegarder `cle-iban.key`** : sans elle, les IBAN enregistrés ne sont plus lisibles.

Stripe : lien de paiement 15 € avec métadonnée `app=<slug>`, webhook vers `https://alphabette.eu/api/webhooks.php`
(événements `checkout.session.completed`, `charge.refunded`). Rattacher une appli à son créateur :
`POST /api/billing.php {action:"lier_app", slug, email}` avec `X-Admin-Password`. Virements à faire : `GET /api/payouts.php?admin`.

Bac à sable / CI : `php serveur/php/upload-guard.php archive.zip` → verdict JSON, code de sortie 0 (conforme) ou 1.

Lot 5 (affiliation, boutique, Labo communautaire) : `docs/labo/LOT5-CROISSANCE.md`.

Tests : `python3 tests/finance/test_finance.py` (php -S local, e-mails dans un dossier temporaire).
