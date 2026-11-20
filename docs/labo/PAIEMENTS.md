# Paiements du Laboratoire (alphabette.eu) — Pass, cadeaux, crédits, mécènes

Tout passe par **des liens de paiement Stripe, sans abonnement** : un paiement = un achat, jamais de prélèvement
suivant (CGV, article 5). Rien n'est vendu tant que la clé Stripe et les liens ne sont pas posés : les boutons
restent cachés et les pages disent « le paiement en ligne ouvre bientôt ».

| Quoi | Où | Comment |
|---|---|---|
| Pass Découverte 48 h | `/pass/`, accueil .eu, IA Débat | gratuit, sans carte ; jeton signé 48 h exactement ; 1 par connexion et par jour ; proposé seulement si le crédit IA du site n'est pas épuisé |
| Pass 15 € / 40 € | `/pass/` (+ ⭐ Pass de la barre) | 12 mois, 3 appareils (code d'activation par e-mail) |
| Pass Cadeau | `/pass/#cadeau` | code `ALPHA-XXXX-XXXX-XXXX` + carte imprimable (`/merci/`, A5 paysage) ; 12 mois à partir de l'activation, à activer dans l'année |
| Crédits IA Débat | `/pass/#credits`, IA Débat | 5 € = 50 débats Premium ; porte-monnaie `PM-…` ; 1 crédit décompté par le relais à chaque débat Premium lancé |
| Mécène du Labo | Tableau d'Honneur de l'accueil (`/#soutenir`), pied de page | 5 €, 10 €, montant libre ; pseudo affiché seulement si la case est cochée (jamais le montant) |

Ordre des débats Premium dans IA Débat : le débat offert du jour → les débats du Pass (5/jour, Découverte 3/jour) →
les crédits. Si le crédit OpenRouter du site est épuisé, aucun crédit n'est décompté (message clair).

## Fichiers

- `serveur/php/paiement.php` → `eu/api/paiement.php` : commandes, vérification Stripe, codes, crédits, Tableau d'Honneur.
- `serveur/php/iadebat-proxy.php` : lit le Pass signé et le porte-monnaie (même dossier privé).
- `data/paiements.json` : liens Stripe **publics**, prix des crédits, réglages (aucune clé). Prix des Pass : `server.ts`.
- `labo/pages/` : `pass.html`, `merci.html`, `embarquement.html`, `badge.html` (+ `badge/*.svg`), `pass.js`, `pages.css`.
- `src/labo/MecenesDuLabo.tsx` (Tableau d'Honneur), `src/labo/pass.ts` (bouton 48 h de l'accueil).
- Données privées, hors du site : `~/alphabette-paiements/` (`config.json` clé Stripe, `secret.json`, `ventes.json`,
  `codes.json` empreintes des codes, `porte-monnaie.json` empreintes + soldes, `honneur.json`, `commandes.json`).
- Tests : `python3 tests/paiement/test_paiement.py` (faux Stripe et faux OpenRouter, 66 vérifications).

## Brancher Stripe (une fois, Claude peut le faire dans le navigateur avec Valentin)

1. Dans Stripe : créer 6 **liens de paiement** (paiement unique) : Pass 15 €, Pass 40 €, Crédits 5 €, Soutien 5 €,
   Soutien 10 €, Soutien « le client choisit le montant ». Pour chacun :
   - « Après le paiement » → rediriger vers `https://alphabette.eu/merci/?session_id={CHECKOUT_SESSION_ID}` ;
   - métadonnée `produit` = `pass_app`, `pass_ecosysteme`, `credits_iadebat`, `mecene_5`, `mecene_10` ou `mecene_libre`.
2. Coller les 6 adresses `https://buy.stripe.com/…` dans `data/paiements.json` (`liens`), puis PR.
3. Créer une **clé restreinte** (droit : Checkout Sessions en lecture) et un **webhook** vers
   `https://alphabette.eu/api/paiement.php?webhook` (événements `checkout.session.completed` et
   `checkout.session.async_payment_succeeded`).
4. Les enregistrer hors du site avec le lien d'installation `https://alphabette.eu/api/paiement.php?installer#jeton=…`
   (le jeton n'est pas dans le dépôt ; seule son empreinte SHA-256 y est).
5. Tester avec une carte de test Stripe, puis passer les liens en mode réel.

Chaque vente envoie un e-mail à l'acheteur (son code) et à Valentin (avec, pour un mécène, un lien de retrait du pseudo).
Remboursement (14 jours) : depuis le tableau de bord Stripe.
