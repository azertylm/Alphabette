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

## Ajouté le 10/11 (nuit) : trois pages HTML publiées par le hub (`public/`)
- **Alphabette Info** : `alphabette.fr/info.html` (ex « infoperso-1.html »). Stockage dans le navigateur, IA Claude avec la clé du visiteur, articles d'exemple marqués « Exemple inventé » et masqués dès qu'un vrai flux est lu, trois flux suggérés.
- **Kurate** : `alphabette.fr/kurate/`. Faux articles (signés de vrais médias) et faux « envoi d'e-mail » retirés : vrais liens de recherche Google Actualités / YouTube, vraies vidéos avec une clé YouTube, résumé à copier ou à s'envoyer.
- **StudioInfo** : `alphabette.fr/studioinfo/`. Modèle Gemini à jour, recherche web avec sources pour les modules d'actualité, utilisable sur téléphone.
- Les trois sont en `actif` dans le registre (badge Nouveau). **Elles n'ont pas la double barre Alphabette ni le bouton BIG** (pages HTML simples) : à convertir avec la base commune si elles restent.

## Double barre des pages HTML simples (10/11, nuit)
- `public/assets/alphabette-barre.js` : une ligne `<script src="/assets/alphabette-barre.js" data-cle data-nom data-sous-titre data-accent>` juste après `<body>` pose les deux barres (ALPHABETTE · DON · applis · Pass, puis nom · BIG · Plein écran). BIG agrandit toute la page (×1, ×1,25, ×1,5) et le choix est gardé. Applis, tarif et RIB viennent de `/api/apps` et `/api/config.json`.
- Posée sur Alphabette Info, Kurate, StudioInfo et Promo Hub.
- **Wikicom** (reçu le 10/11) : non publié. L'annuaire renvoie vers des sites de piratage (jeux crackés, streaming et téléchargements illégaux, torrents). À republier seulement en version légale si Valentin le souhaite.
- **Accueil refait (11/11), maquette A « Kiosque clair » choisie par Valentin** : `src/components/Accueil.tsx` + styles `.accueil` dans `src/index.css`. Double barre de la base (AppShell), phrase simple, recherche, tuiles tirées du registre (une par ligne sur téléphone). L'ancien en-tête (`Header.tsx`), `Hero.tsx` et `AppsRegistrySection.tsx` ne sont plus utilisés. Les sections du bas (atelier IA, tarifs, codes VIP, engagements) sont inchangées : à simplifier.
- **BIG dans la base commune (`packages/shell`)** : désormais visible sur téléphone (il y était masqué), en couleur, et « Grand » passe de +12 % à +31 %. **Les applications gardent leur copie de la base : lancer `bun run sync:shell` puis republier chacune pour qu'elles en profitent.**
- Valentin teste les applications et va en retirer / améliorer : passer une appli en `brouillon` dans `data/apps-registry.json` suffit à la retirer de l'accueil.

## 11/11 : retraits demandés par Valentin et Wikicom légal
- **Retirées d'alphabette.fr** : Écho, Santé Citoyenne, Kurate, StudioInfo. Registre → `brouillon` ; Écho et Santé Citoyenne retirées de `data/apps-sources.json` (plus publiées, leurs dépôts GitHub sont intacts) ; pages `public/kurate/` et `public/studioinfo/` supprimées (récupérables dans l'historique Git). Les sous-domaines `echo.` et `santecitoyenne.alphabette.fr` restent déclarés chez OVH : à supprimer dans l'espace client si le retrait est définitif.
- **Wikicom** publié en version légale : `alphabette.fr/wikicom/` (46 liens gardés, 33 retirés : streaming et jeux piratés, ROMs, bibliothèques pirates, torrents, tous les index FMHY ; ajout de Gallica, Wikisource et F-Droid). Avec la double barre et BIG.

## 11/11 : BIG diffusé dans les applications (base commune 0.3.3)
- Synchronisées (`bun run sync:shell`), construites, vérifiées en 390 px (BIG visible, « Grand » = 21 px de base) et poussées : Goat, Révolution, Prompt Magic, ÉcoBâtiSol, Accord, Frigo-Placard, Senior Bon Plan. Frigo-Placard : grille des « restes » corrigée (débordait en grande taille). ÉcoBâtiSol : débordement de 8 px déjà présent avant, non corrigé.
- Ont leur propre bouton BIG (non modifié) : Info Perso, IA Débat, ProxiLien, BON PLAN.
- **N'ont ni double barre commune ni BIG : Service France et L'Œil de l'Atelier.** À équiper avec la base commune (AppShell).

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
