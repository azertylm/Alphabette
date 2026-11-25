# Lot 5 — Croissance, monétisation complémentaire, Labo communautaire (25 nov. 2026)

**Règle absolue** : un abonnement 15 €/an vendu = **1000 c. créateur, toujours**. Toute commission d'affiliation est
prise sur les **500 c. d'Alphabette** (cumul maximal 250 c. → Alphabette garde au moins 250 c.). Tout est en centimes entiers.

## 1. Acquisition sans friction (`serveur/php/affiliation.php`, socle `croissance-commun.php`)
| Quoi | Adresse | Règle |
|---|---|---|
| Parrainage créateurs | `/rejoindre-createurs/?sponsor=<code>` | +100 c. au parrain par abonnement vendu par son filleul, 12 mois (enregistré à la 1re confirmation d'e-mail, `auth.php`) |
| Lien recommandé | `/go/<slug>?ref=<code>` | +150 c. à l'apporteur si l'abonnement suit dans les 7 jours ; clic dédoublonné 30 min (empreinte HMAC du jour, aucun cookie, aucune IP gardée) ; jamais pour soi-même ni pour sa propre appli |
| Vitrine « Mes 3 applis préférées » | `&src=favorites` | +100 c. au recommandeur (au lieu de 150) |
| Concours du mois | `api/createurs/recrutement.php` | Top 10 des parrains (filleuls à e-mail confirmé) ; le n° 1 gagne un boost de 15 jours (clôture admin le mois suivant) |
| Défi Lancement Éclair | automatique | éligible `.fr` < 48 h après l'arrivée sur `.eu` → badge `eclair` + boost 7 jours |
| Crédits visibilité | automatique | +10 points tous les 50 clics uniques |
| Essai 7 jours sans carte | `/essai/<slug>?ref=<code>` | 1 à vie par (compte, appli) |
| Invitation d'un ami | `/invite/<code>` | +90 jours au parrain par ami abonné payant, plafond 365 jours par année civile, retirés si remboursement |

Le code de recommandation (`r` + 10 caractères) ne révèle rien de la personne. L'abonnement passe par
`affiliation.php {action:"preparer"}` → commande `cmd_…` → lien Stripe `?client_reference_id=cmd_…` → `webhooks.php`.

## 2. Boutique (`serveur/php/boutique.php`, page `/creations/boutique/`)
Carte (lien Stripe de `data/boutique.json` + commande) ou **solde créateur** (débit et effet dans la même transaction).
| Produit | Prix | Répartition |
|---|---|---|
| Boost 7 j (4 places max, vendu seulement si une place est libre) | 1000 c. | Alphabette |
| Pack 5 / 10 / 25 licences d'1 an (codes `LIC-…` chiffrés, attribuer / réattribuer) | 6500 / 12000 / 27500 c. | 75 % créateur, **jamais moins de 1000 c. par licence** → 5000/1500, 10000/2000, 25000/2500 |
| Domaine personnalisé (double barre obligatoire) | 2000 c./an | Alphabette |
| Codes cadeaux 1 an `ALPHA-XXXX-XXXX` (achetés par le créateur, qui offre sa part) | 500 c./code | Alphabette |
| Café « Offrir un café » (bouton ☕ des applis `/c/<id>/`) | 300 c. | 200 créateur / 100 Alphabette |
| Audit IA Pro | 500 c. | Alphabette |
| Bounty `/bounties/` (séquestre ≥ 1000 c.) | libre | 90 % contributeur / 10 % Alphabette ; annulation (admin) → rendu au solde de l'auteur |
| Transparence des revenus | gratuit | interrupteur du créateur |
| Lettre d'information `/admin/newsletter` (`newsletter.php`) | — | double confirmation, 1 envoi / 24 h, désinscription en 1 clic |

> Écart volontaire : 75 % d'un pack de 5 = 48,75 € < 50 €. La règle « jamais moins de 10 € par licence » l'emporte.

## 3. Studio Trophées, embed, SDK
- `/creations/studio-partage/` : paliers 1/10/25/50/100/500 abonnés, `.fr`, Pionnier — **seuls les paliers atteints s'exportent** ;
  aperçu 3D (suit le doigt, coupé en Mode Calme), PNG HD à plat, 5 formats, 4 thèmes, montant facultatif, QR code, légendes par réseau.
- Badge SVG `/api/badge.php?slug=<slug>` (vrais statut et avis) + `<iframe>` prêt à copier.
- SDK `public/assets/alphabette-export.js` : signature « Créé avec <Appli> sur Alphabette.fr » + `?ref=&src=export` sur PNG/TXT/PDF/impression,
  retirée pour les abonnés payants (question posée à la page hôte par `postMessage`, sans transmettre de jeton).

## 4. Labo communautaire (`serveur/php/createurs/communaute.php`, page `/contribuer/`)
Avis +1 pt +1 j · bug confirmé +5 pts +5 j · idée déployée +15 pts +30 j · Mission Flash +7 j · 5 duels/semaine +1 j ·
série 4 semaines +10 j + badge Pilier (+1 joker / 2 mois) · jauge collective 100 → +7 j aux actifs des 30 derniers jours.
Statuts Explorateur ×1, Bêta-Testeur (5 pts) ×1,5, Testeur Or (20) ×2, Architecte (50) ×3 (multiplicateur sur les points et le poids des votes).
Juge IA à réponse **JSON stricte** (`{"verdict","raison"}` exactement, sinon décision humaine) ; anti-doublon Jaccard > 80 %.
Jours convertis en code `JFR-<jours>-<id>-<HMAC-SHA256>` (usage unique, vérifié par `boutique.php`).
Feuille de route `/roadmap/` (3 votes pondérés), Assistant Bug Pro (10 erreurs du capteur, cochées par le testeur, capture
annotée + floutée dans le navigateur, prompt IA pour l'admin), Hall of Fame `/credits/` (pseudos seulement, retrait possible).

## 5. Recette
- `python3 tests/lot5/test_lot5.py` — parcours complet (≈ 145 vérifications, faux Stripe signé).
- `node scripts/audit-lot5.mjs` — audit statique (tarif unique, applis protégées, argent, sécurité, replis).
- Aussi : `tests/finance`, `tests/paiement`, `tests/createurs`, `tests/labo`, `tests/atelier`.

## À brancher (Valentin, une fois)
Liens Stripe de `data/boutique.json` (un lien par produit, et un lien 15 € par appli dans `abonnement`) ; tant qu'ils sont vides,
le paiement par carte affiche « bientôt » et le solde créateur reste utilisable. L'abonnement 15 €/an reste gratuit jusqu'au 7 mai 2027 (offre de lancement) ; les services de la boutique ouvrent dès que leurs liens sont posés.
