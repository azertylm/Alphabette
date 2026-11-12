# État du projet Alphabette — 11 novembre 2026

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

## 11/11 : trois jeux créés (choisis par Valentin parmi dix idées)
Pages HTML du hub (`public/<clé>/index.html`), double barre + BIG, sans serveur, scores gardés sur l'appareil. Jouées de bout en bout en 390 px avant publication.
- **Le Dico Loufoque** (`/dico-loufoque/`) : 40 mots rares réels, une vraie définition et trois inventées. Pour ajouter des mots : tableau `MOTS` en haut du script.
- **Le Juste Chiffre** (`/juste-chiffre/`) : 33 questions chiffrées avec source, curseur + boutons de réglage fin. Barème : 100 points pile dessus, 0 au-delà d'un cinquième de l'étendue ; les bornes sont décentrées pour que « valider sans réfléchir » rapporte 0. Tableau `QUESTIONS`. Valeurs datées à revoir de temps en temps (population 2024, hauteur de la tour Eiffel, mont Blanc 2023).
- **Mémo-Méninges** (`/memo-meninges/`) : séance du jour en trois jeux (paires, suite à répéter, calcul), sans chronomètre, série de jours. Mention « pas un test médical ».
- Autres idées proposées, non faites : Vrai ou Faux du jour, Chrono-Frise, Où c'est ?, Trois Kifs, Le Défi du jour, Quiz en famille.

## 11/11 : Orbit 5 (version légale, sans serveur)
- Dépôt créé par Valentin : **`azertylm/orbitvideo-`** (privé). Orbit-v4 reste intact et non publié.
- Orbit 5 = une seule page : ajout par lien (YouTube, Dailymotion, Vimeo, TikTok), lecture par les **lecteurs officiels intégrés**, listes partageables par lien, favoris, thèmes, historique, export/import, recherche YouTube par l'API officielle avec la clé de l'utilisateur. Aucune extraction ni rediffusion.
- **Publication** : le dépôt étant privé et le hub n'ayant pas de secret `APPS_TOKEN`, la publication par `apps-sources.json` a échoué (dossier `apps/orbit/` absent de `ovh-deploy`). Orbit est donc publié par le hub lui-même : **`public/orbit/index.html` → `alphabette.fr/orbit/`**, copie du `index.html` du dépôt (seule différence : le script de la barre en chemin relatif). **Toute modification doit être faite dans le dépôt puis recopiée ici**, tant que le dépôt n'est pas public ou que `APPS_TOKEN` n'existe pas.
- Non testé ici : la lecture réelle dans les lecteurs des plateformes et la récupération des titres (plateformes injoignables depuis l'atelier). Testés : reconnaissance des liens, listes, partage, historique, sauvegarde, affichage téléphone et BIG.
- Fonctions d'Orbit-v4 non reprises : regarder à plusieurs, blind test, suggestions par goûts, analyses IA, export de clips, diffusion VLC / Freebox (ces trois dernières dépendaient de l'extraction).

## 11/11 : Révolution repartie de zéro (demandé par Valentin)
- Plus aucune donnée simulée : l'ancien prototype (assemblée, sections, livre public, votes simulés) est retiré (récupérable : commit `b9a2981` du dépôt). Les anciennes données restées dans les navigateurs sont effacées.
- **À la une** : à chaque publication (toutes les 3 h, de 6 h à 22 h), `scripts/actualite.mjs` lit 37 flux (franceinfo + Google Actualités par thème et par région) et écrit `actu.json` (~70 sujets). Filtres : presse française d'information générale seulement (liste dans `src/revolution/reperes.json`, titres très engagés exclus des deux bords), au moins un thème de vie publique, faits divers / sport / pub / éditos écartés, un sujet régional doit nommer sa région. Question neutre selon le type : « Ce sujet compte-t-il pour vous ? », « Sur cette mesure… : plutôt pour / contre / je ne sais pas », « Soutenez-vous ce mouvement ? ». Échantillon de 40 sujets lisible dans le journal du workflow.
- **Pour toi** : région + sujets choisis, gardés sur l'appareil ; l'ordre change selon la région, les sujets et la fraîcheur.
- **Questions** : syndicats, associations, collectifs, élus, citoyens publient une question (2 à 4 réponses), la partagent (lien, QR code à imprimer), voient les résultats ; nom « déclaré, non vérifié » ; signalement (masquée à 5) ; retrait par l'auteur. Résultats affichés seulement après sa propre réponse ; « consultation ouverte, pas un sondage ».
- **Recueil partagé (Firestore, projet Firebase d'Info Perso, collections `revolution_*`) : PAS ENCORE OUVERT.** Il faut publier les règles `firebase/regles-completes.rules` du dépôt Révolution (console Firebase → Firestore → base d'Info Perso → Règles), vérifier que la connexion anonyme est activée et que `revolution.alphabette.fr` est un domaine autorisé. Règles non testées (émulateur non téléchargeable depuis l'atelier) : à tester en ligne juste après publication. En attendant, réponses gardées sur l'appareil et questions « en attente », l'appli le dit.

## 11/11 : IA Débat relue (hors compte local)
- Chaque réplique dit quelle IA l'a vraiment écrite ; sans clé, c'est Gemini qui écrit pour les six orateurs : affiché « écrit par Gemini, à la manière de ChatGPT » (bulle, mode lecture, exports).
- Vote du public : les votes inventés de départ (18, 24, 15…) sont retirés, « sur cet appareil ».
- Zone de saisie : ne déborde plus en 390 px.
- À revoir : modèles par défaut anciens (`claude-3-5-haiku-20241022`, `grok-2-1212`, `gpt-4o-mini`) ; mention « Données hébergées en UE » (Gemini ne l'est pas forcément) ; « compte Alphabette » local.

## 11/11 (soir) : Orbit — retour à l'application d'origine
- **Valentin a refusé la version réécrite d'Orbit** (« Orbit 5 » en une page) : elle est retirée. Consigne : garder Orbit le plus proche possible de ce qu'il est.
- Le dépôt `azertylm/orbitvideo-` contient maintenant **Orbit-v4 à l'identique**, avec un seul changement regroupé dans `src/utils/lecteursOfficiels.ts` et quelques retouches du lecteur (`UniversalVideoPlayer.tsx`) : une vidéo de plateforme est toujours lue par son lecteur officiel ; plus d'extraction, de relais, de flux VLC ni de vidéo de substitution ; boutons « MP4 direct / Télécharger » visibles seulement pour un fichier importé par l'utilisateur.
- Vérifié en 390 px, sans serveur : YouTube → `youtube-nocookie.com/embed`, TikTok → `tiktok.com/embed/v2`, Facebook → `plugins/video.php`, Instagram → `/embed` ; anciennes données contenant un flux extrait → lecteur officiel aussi ; aucune requête interdite, aucune erreur. La lecture réelle n'a pas pu être vue (plateformes injoignables depuis l'atelier).
- **Publication** : dépôt privé et pas de secret `APPS_TOKEN` → le hub publie le dossier **construit** : `public/orbit/` = contenu de `dist/` après `bun run build:static` dans le dépôt. **À refaire à chaque modification d'Orbit** (ou rendre le dépôt public / ajouter `APPS_TOKEN`, puis déclarer `"orbit": {"repo": "azertylm/orbitvideo-"}` dans `apps-sources.json`).
- Sans son serveur, Orbit n'a pas : propositions par IA, fil communautaire, codes à vie, regarder à plusieurs. Orbit n'a pas la double barre Alphabette (il a son propre bouton « Big ») : à décider avec Valentin.
- À relire plus tard dans Orbit : titre, note, nombre de votes et durée inventés quand le titre réel n'est pas récupéré (« Découverte — IA & Robotique », « 8.4/10 », « 16 min »).

## 12/11 : « Petits Jeux » et accueil sur deux colonnes
- **Petits Jeux** : `alphabette.fr/petits-jeux/` (`public/petits-jeux/index.html`) regroupe Goat Chèvre The King, Le Dico Loufoque, Le Juste Chiffre et Mémo-Méninges. La page lit le registre : toute appli avec `"groupe": "petits-jeux"` y apparaît seule (pictogramme par clé dans `PICTOS`). Les jeux n'ont plus de tuile propre sur l'accueil (ils ressortent quand même dans la recherche) et renvoient vers « Tous les Petits Jeux ».
- **Accueil** : deux colonnes sur tous les écrans (une seule en BIG maximum sur téléphone). Ordre fixé par le champ `"ordre"` du registre : Infos Perso, ProxiLien / Wikicom, IA Débat / L'Œil de l'Atelier, Service France / Bon Plan, Senior Bon Plan / Prompt Magic, Frigo-Placard / Petits Jeux, Orbit. Les applis sans `ordre` (Accord, Alphabette Info, ÉcoBâtiSol, Révolution) suivent par ordre alphabétique : Valentin ne les a pas citées, à lui de dire s'il les garde sur l'accueil.
- **Double barre** : Valentin veut la revoir sur tous les sites. Points fermes : BIG ; bouton Jour/Nuit en émoticônes ☀️/🌙 ; « Alphabette » écrit petit en haut à gauche, lien vers www.alphabette.fr ; bouton « S'abonner » en haut à droite à la place de « L'écosystème » (qui déborde). Vingt idées de boutons lui ont été proposées ; **attendre son choix avant de modifier la base commune**, pour ne resynchroniser les applis qu'une fois.

## Reste à faire
1. **Info Perso** — essai réel de connexion à un compte sur infosperso.alphabette.fr (à faire avec Valentin : lui seul tape son mot de passe).
2. **Révolution** — ouvrir le recueil partagé (règles Firebase à publier avec Valentin, puis test en ligne).
3. **L'Œil de l'Atelier** — relire les modèles de contrats et de factures avec un professionnel avant de les présenter comme utilisables ; renseigner e-mail et téléphone dans le Profil Artiste pour que le QR code fonctionne.
4. **Accord** — vérifier sur un vrai téléphone que la prévision météo s'affiche (non testable depuis l'atelier de Claude).
5. Un passage « téléphone 390 px » systématique sur toutes les applis ; IA Débat : modèles par défaut à mettre à jour.

## En pause (ne pas y toucher)
Lidarsol, Osolar, serveur ProxiLien, domaines Orbit et Info Perso.

## Pistes pour la suite
- Vrai livre d'or pour l'Atelier : même modèle que le recueil partagé de Révolution (Firebase).
- Révolution : badge « organisation vérifiée » pour les syndicats et associations ; résultats par région (si Valentin l'accepte) ; IA Débat qui débat des questions du moment de Révolution.
- Contrôle automatique mensuel des chiffres officiels (aides, plafonds, numéros utiles) dans Senior Bon Plan, BON PLAN, Santé Citoyenne, France Service.
- Page « Ce que fait vraiment chaque appli » sur le hub (ce qui marche sans clé, ce qui demande une clé IA, ce qui est une démonstration).
- Test automatique « téléphone » dans le workflow, pour bloquer une publication qui déborde de l'écran.
- Paiement réel du Pass (Stripe) côté hub uniquement, jamais dans une appli.

## Façon de travailler
Valentin n'est pas développeur : faire le maximum seul, demander le minimum, réponses courtes. Priorité : contenu honnête, conseils sûrs, chiffres à jour, lisible sur téléphone. Notification téléphone aux étapes importantes.

## 12/11 — Nouvelle double barre, préférences partagées, confidentialité
- **Double barre** (shell 0.4.0 + `public/assets/alphabette-barre.js`) : logo « alphabette » petit → www.alphabette.fr, ⭐ S'abonner, ▦ toutes les applis, 🆕 nouveautés, favoris (3 max), BIG (3 tailles), ☀️/🌙, 🔊 lecture à voix haute, menu ⋯ (🧘 mode simple, 📲 installer, 💬 avis, 🖨️ imprimer, 🌍 langue). Chaque pictogramme affiche son nom au survol / focus / toucher.
- **Préférences partagées** : cookie `ab_prefs` (.alphabette.fr, 1 an) + copie localStorage : thème, taille, langue, mode simple, favoris.
- **Limites** : 🌍 traduit la barre (le contenu passe par Google Traduction) ; Service France n'a pas de mode nuit (bouton masqué) ; apps à barre propre non migrées : Info Perso, IA Débat, ProxiLien, Bon Plan, Orbit.
- **Règle de confidentialité** : ne jamais indiquer où habite Valentin ni où les applis sont faites (ni La Grande-Motte, ni autre lieu). Adresse de domiciliation bancaire retirée. ProxiLien garde son contenu « pilote » (fonctionnel). Projet Lidaros (en pause) contient encore des mentions ; l'historique git ne peut pas être réécrit.

## 12/11 (soir) — Podcasts et « Où c'est ? »
- **Podcasts** (`/podcasts/`, inspiré d'AntennaPod) : recherche (annuaire iTunes), abonnement, ajout d'un flux RSS, import/export OPML, lecteur fixe (±10/30 s, vitesse 0,8→2, minuterie de sommeil, reprise automatique, commandes écran verrouillé). Tout reste dans le navigateur (localStorage). Les flux passent par `public/podcasts/flux.php` (relais PHP d'OVH, sans journal, http/https uniquement, adresses publiques uniquement). **À vérifier en ligne** : le relais n'a pu être testé que sur une copie locale (pas d'accès réseau ici).
- **Où c'est ?** (`/ou-cest/`, groupe petits-jeux) : 10 lieux étonnants tirés parmi 25, carte du monde (Natural Earth, domaine public) intégrée, zoom/glisser/clavier, score selon la distance.
- Idée suivante : « Où c'est ? » version France, Vrai ou Faux du jour, Chrono-Frise.

## 12/11 (soir) — Double barre étendue aux 5 applis restantes
- **Bon Plan, IA Débat, Info Perso, ProxiLien, Orbit** utilisent maintenant la même double barre que les autres (via `https://alphabette.fr/assets/alphabette-barre.js`) : BIG, ☀️/🌙, 🔊, favoris, 🌍, 📲, etc. Leurs barres maison et leurs boutons BIG ont été retirés ; ce qui est propre à chaque appli (compte, clés API, réglages, ville, modes) reste dans une petite barre sous la double barre.
- Thème : la barre commande le thème de chaque appli (et l'inverse) — Info Perso (clair/sombre), ProxiLien (Or & Nacre / sombre), Orbit (Alabaster / Onyx). IA Débat est sombre uniquement : le bouton ☀️/🌙 n'y change que la barre.
- Orbit : BIG agrandit la police de la page (`data-big="police"`) pour ne pas casser le lecteur plein écran. Copie construite du hub (`public/orbit/`) mise à jour.
- Le script expose `--ab-hauteur` et `--ab-zoom` pour les applis à hauteur d'écran fixe (Info Perso).

## 12/11 (nuit) — Quiz en famille, sélection de podcasts élargie
- **Quiz en famille** (`/quiz-famille/`, groupe petits-jeux) : 1 à 6 joueurs sur un seul écran, chacun son tour, 34 questions sur le cinéma et la culture à la française (Desproges, Coluche, Fred Testot, Pierre-Emmanuel Barré, « C'est arrivé près de chez vous », « Bernie », Kaamelott, Les Nuls, Le Splendid…), une anecdote par réponse. Questions à relire par Valentin avant de les promouvoir ; « C'est arrivé près de chez vous » est signalé comme réservé aux adultes.
- **Podcasts** : sélection élargie (Culture et ARTE, Sciences, Histoire, Géographie et monde, Humour). Chaque podcast n'est cherché dans l'annuaire que lorsqu'il apparaît à l'écran ; le relais garde les recherches 24 h pour ne pas dépasser les limites de l'annuaire.

## 12/11 (après-midi) — Orbit, IA Débat, ÉcoBâtiSol, vérifications en ligne
- **Orbit** (dépôt `azertylm/orbitvideo-`, commit `7cad851`, recopié dans `public/orbit/`) : le vrai titre, l'auteur et la miniature viennent des services oEmbed publics (YouTube, TikTok, Vimeo, puis noembed) quand le serveur Orbit ne répond pas — plus de titre inventé « Découverte — IA & Robotique » ; sans titre trouvé : « Vidéo (titre non récupéré) ». Vidéo dont le créateur refuse l'intégration : signalée au lieu d'être ajoutée. Faux messages Telegram / Discord / WhatsApp (« @Karim_Beats il y a 3 min ») retirés de la passerelle d'import. Le lien d'une vidéo en lecture et les liens de partage restent sur `/orbit/` (ils renvoyaient vers l'accueil du hub).
- **Vérifié en ligne (navigateur de Valentin)** : Orbit lit bien une vidéo YouTube dans le lecteur officiel ; titre réel récupéré ; lien qui reste sur `/orbit/`. Relais des Podcasts (`flux.php`) : flux RSS et recherche OK, adresses internes refusées. Accord : la prévision Open-Meteo répond depuis le site (la position du téléphone n'a pas été testée).
- **IA Débat** : modèles à jour (Claude 3.5 Haiku était retiré depuis le 19/12/2025) → Claude Haiku 5.5, GPT-6 Luna, Grok 4.3 par défaut ; choix proposés à jour ; paramètres OpenAI adaptés aux modèles récents ; texte de Claude lu même quand il réfléchit d'abord ; anciens choix enregistrés convertis. Non testé avec de vraies clés.
- **ÉcoBâtiSol** : débordement de 8 px corrigé (`.eb-page` en `box-sizing: border-box`).
- **Passage téléphone (375 px)** : accueil + 23 applis et pages contrôlés en ligne, aucun débordement après correction d'ÉcoBâtiSol.
- **Fait avec l'accord de Valentin (15 h 20)** : Orbit déposé sur ChipJourney (vérification automatique en cours) et FreeNoSignup (relecture manuelle sous 3 à 5 jours ouvrés), contact azertylm@gmail.com. Les 5 agents Orbit sont à jour : adresse alphabette.fr/orbit/, seulement les fonctions qui marchent en ligne, aucun lieu cité, ChipJourney et FreeNoSignup notés comme déjà faits. L'agent « Orbit presse et créateurs » repartira seul le 18/11.
- À revoir dans Orbit : note (« ★ 7.8/10 ») et description générique attribuées d'office à une vidéo que personne n'a notée ; bouton « S'enregistrer / Créer un compte » et propositions IA alors que le serveur n'existe pas.
