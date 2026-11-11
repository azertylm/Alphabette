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

## 11/11 (suite) : barres partout, bas de l'accueil, panneau Pass honnête (base 0.3.4)
- **Service France et L'Œil de l'Atelier** enveloppées dans la base commune (`AppShell` dans `src/main.tsx`, alias Vite, copie `src/shell`) : double barre + BIG. Le bouton Jour / Nuit de la barre y est masqué (elles ont leur propre thème). L'Œil : `@types/react` ajoutés, deux erreurs de type corrigées.
- **Bas de l'accueil refait** (`src/components/BasAccueil.tsx`) : tarifs (gratuit · 15 € · 40 € TTC, « paiement en ligne pas encore ouvert »), engagements, don, pied de page court. L'atelier IA, la grille tarifaire simulée, les codes VIP et l'ancien pied de page ne s'affichent plus qu'avec `?admin`.
- **Panneau Pass de la base commune** : plus de bouton vers les faux liens Stripe (`…/alphabette_app_15`). Sans vrai lien publié par le hub (`server.ts` → `stripePaymentLinks`, vides aujourd'hui), il affiche « paiement pas encore ouvert » + don. Promesses retirées : clé IA Mistral incluse, sauvegardes, résiliation en un clic, « le plus choisi ». Promotion « SOUVERAIN15 » désactivée (elle se renouvelait toute seule tous les 14 jours).
- Base 0.3.4 synchronisée, construite et poussée dans les 9 applications qui l'utilisent.
- **Pour ouvrir le paiement** : créer deux liens de paiement Stripe et les mettre dans `stripePaymentLinks` de `server.ts` ; les boutons réapparaissent partout à la publication suivante.

## 11/11 : statut de l'entreprise et dons
- **La société n'est pas encore créée** (Valentin y travaille). La mention « ALPHABETTE SASU » a donc été retirée du hub, de Goat, ProxiLien, Service France, IA Débat et Info Perso (remplacée par « ALPHABETTE »). À remettre, avec le numéro SIREN, quand la société existera. Lidarsol (en pause) la porte encore.
- **Dons** : par virement sur le RIB de `data/donation.json` (compte personnel de Valentin, en attendant la société). Le compteur « places de membre fondateur » était inventé (84) : remis à 0. Le mettre à jour à la main à chaque vrai don.
- **Pas de compte Stripe** pour l'instant : le paiement en ligne reste fermé (voir plus haut).
- **ProxiLien (11/11)** : Valentin confirme qu'il n'y a **aucun accord avec la mairie**. Retirés : partenariat avec la commune, « offerte par Alphabette & la Ville », « Ville pilote officielle », « vérifiable par le CCAS », alertes d'exemple attribuées à la mairie / au port / aux secours avec mention « vérifié », faux « Formule activée avec succès », anciens tarifs 39/59/99/199 € (remplacés par 15 € et 40 €). La 1re année offerte aux habitants de La Grande-Motte reste, comme offre d'Alphabette seule. L'onglet « Offre Mairies » (proposition commerciale aux communes, contact par e-mail) est conservé.

## 11/11 : tarifs relus dans Service France, Info Perso et IA Débat
- Dans les trois, la fenêtre des tarifs est remplacée par une version courte et honnête (15 € / an, 40 € / an pour tout, paiement en ligne pas encore ouvert). Retirés : boutons « Simuler l'activation », « Formule activée avec succès », anciens prix 39 / 59 / 99 / 199 €.
- **Info Perso** : un **faux formulaire de carte bancaire** (numéro, expiration, CVC, « Simuler paiement ») et l'offre « 10 € les 3 mois puis 5 €/mois » sont retirés du tiroir Profil.
- **IA Débat** : les barres du haut passent à la ligne sur téléphone (la page débordait de 554 px en 390 px).
- Non relu : le « compte Alphabette » local d'IA Débat (`AlphabetteAccountModal`, compte créé sur l'appareil) et la bannière d'essai de Service France (`AlphabetteTrialBanner`).

## Orbit-v4 (demandé le 11/11) : pas encore publiable
- Dépôt `azertylm/Orbit-v4` : application vidéo très lourde (App.tsx 15 800 lignes, server.ts 7 700 lignes), entièrement dépendante de son serveur (25 appels `/api/orbit/...`).
- Le serveur **extrait les fichiers vidéo** de TikTok, Facebook, Instagram et YouTube (`yt-dlp`, service tiers « tikwm ») et les **rediffuse** (`/api/orbit/proxy-mp4`, `vlc-stream`). C'est contraire aux conditions des plateformes et risqué juridiquement (même problème que Wikicom), et de toute façon impossible sur l'hébergement OVH statique.
- Piste proposée à Valentin : une version qui lit les vidéos avec les **lecteurs officiels intégrés** des plateformes (légal, sans serveur), avec la double barre et BIG. En attente de sa décision.

## 11/11 : proxilien.eu en simple redirection ; Orbit-v5
- `proxilien.eu` (et `www.`) redirige en 301 vers `https://proxilien.fr` : nouvelle clé `"redirects"` dans `data/apps-sources.json`, règle générée dans le `.htaccess` (`scripts/build-static.mjs`). Valentin ne veut pas que ce domaine occupe un site sur l'hébergement : **à faire par lui chez OVH** → Noms de domaine → proxilien.eu → onglet « Redirection » → vers `https://proxilien.fr` (visible permanente, 301), puis Hébergement → Multisite → supprimer `proxilien.eu` et `www.proxilien.eu`. Ensuite la clé `"redirects"` peut être retirée.
- **Orbit** : Valentin valide la version « lecteurs officiels » (légale, sans serveur) et veut garder Orbit-v4 intact. La nouvelle version ira dans un dépôt **`Orbit-v5`**, que Valentin doit créer vide sur GitHub (la session ne peut pas créer de dépôt). Travail pas encore commencé.
- **Nouvelles applications** : Valentin veut des applis du quotidien, qui occupent et rendent heureux, où l'on s'informe en jouant, et des jeux loufoques. Une liste d'idées lui a été proposée ; choix en attente.

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
