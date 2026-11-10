# État du projet Alphabette — 10 novembre 2026 (soir)

## En ligne
- alphabette.fr sur OVH (hébergement Perso, statique). 15 applications, chacune sur `<clé>.alphabette.fr`, plus proxilien.fr et proxilien.eu.
- Publication : dépôt `azertylm/Alphabette`, workflow `deploy-ovh.yml` (à relancer après chaque correction d'une appli). Dernière publication réussie et vérifiée par le workflow : 10/11/2026 à 19 h 38.
- Firebase : domaines alphabette autorisés (Info Perso, IA Débat).

## Vérifiées et corrigées
Senior Bon Plan, BON PLAN, Santé Citoyenne, ProxiLien (SOS), France Service, ÉcoBâtiSol, Frigo-Placard, Écho, Goat (mobile), et depuis le 10/11 au soir :

- **Accord** — fausse « fiche de réservation » retirée (référence, faux code, « places ») ; météo = vraie prévision du dimanche ; confidentialité dite exactement (reconnaissance vocale du navigateur, Mistral) ; 12 corrections factuelles dans les leçons.
- **Prompt Magic** — fausse « simulation validée 98/100 » remplacée par une simple relecture du prompt ; faux pourcentages d'« impact » retirés ; page réparée sur téléphone (elle débordait).
- **L'Œil de l'Atelier** — faux paiement d'abonnement et faux formulaire de carte pour les dons retirés (tous les modules sont ouverts, don = espace dons du hub) ; faux visiteurs et fausses options d'achat retirés ; le QR code ouvre un vrai e-mail ou WhatsApp ; fiscalité art. 238 bis AB à jour (BNC exclus, plafond annuel, échéance 31/12/2028) ; bandeau « exemple » tant qu'aucune analyse IA n'est faite.
- **Révolution** — bandeau permanent « prototype : votes simulés » ; dictionnaire corrigé (RIP, ordonnance, décret, DGF) ; règle des 500 000 signatures corrigée ; statistique fabriquée et coûts en euros inventés retirés.

## Ajouté le 10/11 (tard)
- **Promo Hub** : `alphabette.fr/promo/` (fichier `public/promo/index.html`, non référencé). Générateur de messages pour les réseaux, branché sur le registre (15 applis réelles, adresses et descriptions à jour). Retirés de la version reçue : applis inexistantes (Studio, ValHub, Omnilocal, « Bien Commun »), « sans inscription / tout pré-rempli », « point technique de 17h », données d'Info Perso mal décrites. Tarif rappelé : 15 € TTC/an par appli, 40 € TTC/an pour toutes.
- **ProxiLien** : page de présentation `proxilien.fr/presentation.html` (dépôt `azertylm/Proxilien`, `public/presentation.html`), version honnête (démonstration annoncée, SOS décrit tel qu'il est, idées et testeurs par e-mail à contact@alphabette.fr).
- Le fichier « index » BonPlan reçu le 10/11 est une **ancienne version** : non publiée, la version en ligne reste celle du dépôt.

## Reste à faire
1. **Info Perso** — essai réel de connexion à un compte sur infosperso.alphabette.fr (à faire avec Valentin : lui seul tape son mot de passe).
2. **Révolution** — décision de Valentin : garder les votes simulés avec le bandeau (état actuel) ou repartir de zéro (aucun faux vote, appli vide au départ).
3. **L'Œil de l'Atelier** — relire les modèles de contrats et de factures avec un professionnel avant de les présenter comme utilisables ; renseigner e-mail et téléphone dans le Profil Artiste pour que le QR code fonctionne.
4. **Accord** — vérifier sur un vrai téléphone que la prévision météo s'affiche (non testable depuis l'atelier de Claude).
5. Applis pas encore relues : IA Débat (hors Firebase), et un passage « téléphone 390 px » systématique sur les 15.

## En pause (ne pas y toucher)
Lidarsol, Osolar, serveur ProxiLien, domaines Orbit et Info Perso.

## Pistes pour la suite
- Vrais votes pour Révolution et vrai livre d'or pour l'Atelier : il faut un petit serveur ou Firebase (déjà utilisé par Info Perso). Sans cela, tout reste sur l'appareil.
- Contrôle automatique mensuel des chiffres officiels (aides, plafonds, numéros utiles) dans Senior Bon Plan, BON PLAN, Santé Citoyenne, France Service.
- Page « Ce que fait vraiment chaque appli » sur le hub (ce qui marche sans clé, ce qui demande une clé IA, ce qui est une démonstration).
- Test automatique « téléphone » dans le workflow, pour bloquer une publication qui déborde de l'écran.
- Paiement réel du Pass (Stripe) côté hub uniquement, jamais dans une appli.

## Façon de travailler
Valentin n'est pas développeur : faire le maximum seul, demander le minimum, réponses courtes. Priorité : contenu honnête, conseils sûrs, chiffres à jour, lisible sur téléphone. Notification téléphone aux étapes importantes.
