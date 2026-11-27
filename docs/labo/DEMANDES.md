# Demandes du Laboratoire à Valentin

Écrites par le cycle du laboratoire (`/cycle-labo`) : demandes de Niveau 2 et propositions de transfert vers
alphabette.fr. Réponse dans n'importe quelle conversation : « oui pour fb_… » ou « non pour fb_… (raison) ».

## 27/11/2026 (soir) — Passage quotidien : Orbit réparé en ligne, 2 corrections de l'Atelier qualité, rien n'attend ton ordre

### ✅ Fait — Orbit : les 2 anomalies de l'Agent Chaos ont disparu en ligne
- **Résumé** : le rapport de nuit montrait encore l'erreur « unsupported MIME type » et le bouton « Publier » qui sort de
  l'écran à 320 px sur [alphabette.eu/orbit/](https://alphabette.eu/orbit/).
- **Mon avis critique** : le correctif du 26/11 était juste, il n'était simplement pas encore en ligne : OVH bloquait la
  publication. Le blocage est levé (publication confirmée à 19 h 22). Refaire le correctif aurait été inutile.
- **Ce que j'ai fait** : relancé l'Agent Chaos sur le vrai site à 20 h 21 : **0 anomalie sur 29 applis**
  ([journal](https://github.com/azertylm/Alphabette/actions/workflows/labo-chaos.yml)). Nouvelle règle dans
  RULES_AND_MEMORY.md pour ne plus confondre « correctif raté » et « publication bloquée ».

### ✅ Fait — Atelier qualité : 2 corrections (Niveau 1, « OK pour publier » de qa-verifier)
- **Résumé** : Orbit empêchait de zoomer avec deux doigts ; dans Wikicom, la recherche et les champs du formulaire
  d'ajout n'étaient pas annoncés par les lecteurs d'écran.
- **Mon avis critique** : deux vrais freins pour les personnes qui voient mal, réglés sans rien changer à l'affichage.
  Wikicom n'est corrigé que sur alphabette.eu : sa copie figée d'alphabette.fr n'est pas touchée.
- **Ce que j'ai fait** : zoom autorisé sur [Orbit](https://alphabette.eu/orbit/) ; 12 champs nommés dans
  [Wikicom](https://alphabette.eu/wikicom/). Contrôlé à 280 et 320 px : aucun défilement de côté.

### Pour information
- 0 avis nouveau à trier, 0 rejeté, 0 Niveau 2. Aucune appli éligible au passage vers .fr.
- Les autres points « important » de l'Atelier viennent surtout de la barre commune (petits boutons « Faire un don »,
  « BIG »…), qui sert aussi alphabette.fr : pas de retouche sans ton ordre. Info Perso (en pause) n'est pas touchée.
- Toujours en attente de ton côté, sans urgence : crédit OpenRouter épuisé (le Mode Gratuit continue,
  [ajouter du crédit](https://openrouter.ai/settings/credits)) ; certificat de proxilien.eu (ProxiLien en pause).
- Signalements, propositions et boîte à idées : non relus ce passage (adresses illisibles depuis la tâche planifiée).

## 27/11/2026 — Sur ta demande : de vraies actualités dans ALPHABETTE INFO ; Orbit n'est plus en pause

### ✅ Fait — ALPHABETTE INFO montre les actualités du jour (avis fb_1795683657_7422, ta demande du 27/11)
- **Résumé** : « les articles sont inventés, je veux vraiment de l'actualité, inspire-toi d'Info Perso […] surtout pour
  les mécanismes ».
- **Mon avis critique** : tu avais raison, retirer les fausses dates ne suffisait pas : la page restait vide de vraie
  information. J'ai repris le mécanisme d'Info Perso, le plus sûr : les flux des médias sont lus au moment de la
  publication du site (toutes les 3 heures), pas par le téléphone du visiteur. Rien n'est envoyé à un site tiers à
  l'ouverture, et la page reste rapide. Limite : les nouvelles ont au plus 3 heures de retard. On ne montre que le
  titre et le court résumé publiés par le média, avec le lien vers l'article complet chez lui.
- **Ce que j'ai fait** : 15 flux de grands médias (franceinfo, Le Monde, Le Figaro, BFM TV, France 24, Futura,
  Numerama), en 7 rubriques (Actualité, International, Économie, Science, Technologie, Culture,
  Sport). Doublons retirés (le même sujet chez deux médias n'apparaît qu'une fois) et médias variés en tête. Les 16
  articles inventés sont supprimés. Chaque article a son heure (« il y a 25 min ») ; un article enregistré reste lisible
  quand il sort du fil ; tes propres flux restent dans « Mes flux ». « OK pour publier » de qa-verifier, 9 tests
  automatiques. [Commit f91c1b8](https://github.com/azertylm/alphabette/commit/f91c1b853a1f693f2ee5e15b8e6fd7efecc64773).
  Première lecture sur GitHub le 27/11 à 11 h 37 : 120 actualités, 14 flux sur 16 ; Les Échos (refus d'accès) et Le Parisien
  (rien de lisible) remplacés par Le Monde Économie.

### ✅ Fait — Orbit n'est plus en pause (ta décision du 27/11)
- Ses défauts sur alphabette.eu se corrigeront désormais comme ceux des autres applis, sans attendre ton ordre
  (CLAUDE.md, RULES_AND_MEMORY.md et les agents sont à jour).

### ⚠️ À savoir — mise en ligne bloquée chez OVH depuis le 26/11 à 21 h 27
- Les corrections d'Orbit et les vraies actualités sont prêtes sur GitHub, mais elles n'arriveront sur alphabette.eu
  qu'après le déblocage d'OVH (ticket CS17244990, ouvert le 27/11 à 9 h 59). Rien à faire de ton côté en dehors du ticket.

## 26/11/2026 — Passage quotidien : 1 avis corrigé, Orbit attend ton ordre

### ✅ Fait — ALPHABETTE INFO : plus de fausse date de septembre (avis fb_1795683657_7422, +1)
- **Résumé** : « Les infos date de septembre il faut corriger ça ».
- **Mon avis critique** : avis juste. Sans flux d'actualités choisi, la page montre des articles d'exemple inventés, datés
  de septembre, sous la date du jour : on croit à des nouvelles périmées. Le bandeau « exemples inventés » ne suffisait pas.
  Je n'ai pas chargé de vraies actualités d'office : il faudrait appeler un service extérieur à chaque ouverture, sans
  que le visiteur l'ait demandé. Pour avoir de vraies nouvelles, il suffit d'appuyer sur « Ajouter mes sources d'actualités ».
- **Ce que j'ai fait** : les exemples n'affichent plus aucune date (liste, lecture, copie, impression). Les vrais flux
  gardent la leur. « OK pour publier » de qa-verifier ; en ligne sur [alphabette.eu/info.html](https://alphabette.eu/info.html)
  avec ce passage. alphabette.fr n'est pas touché : son adresse renvoie vers .eu.

### ✅ FAIT le 26/11 sur ton ordre — Orbit corrigé (« Je t'autorise fais-le »)
- **Résumé** : correctif ci-dessous appliqué, plus deux compléments : 1) le manifeste vise `/orbit/` : l'appli installée
  ouvre Orbit (et plus l'accueil du Labo), ses icônes sont trouvées, le partage vers Orbit arrive dans Orbit ;
  2) veto de qa-verifier, justifié : une fois son service worker actif, Orbit aurait vidé les fichiers hors ligne de
  TOUTES les applis d'alphabette.eu (même adresse pour toutes) ; il ne vide plus que les siens.
- **Mon avis critique** : le code principal d'Orbit vide encore tous les caches à 2 endroits ; je l'ai neutralisé depuis la
  page sans toucher ce gros fichier. Si Orbit est reconstruit un jour, corriger ces 2 endroits à la source. Ce fichier
  contient aussi des adresses e-mail en clair, dont la tienne (azertylm@…) : visibles par tout le monde.
- **Ce que j'ai fait** : testé (aucun défilement de côté de 280 à 1280 px, plus d'erreur, appli installable sans erreur,
  cache des autres applis conservé), « OK pour publier » de qa-verifier, publié sur [alphabette.eu/orbit/](https://alphabette.eu/orbit/).

### (Préparé ce soir, appliqué ensuite) — Orbit : 2 anomalies de l'Agent Chaos (nuit du 26/11)
- **Résumé** : sur [alphabette.eu/orbit/](https://alphabette.eu/orbit/), une erreur « unsupported MIME type » à chaque
  ouverture, et le bouton « Publier » qui sort de l'écran sur petit téléphone (320 px et moins).
- **Mon avis critique** : même erreur que le 19/11 sur 3 applis. Orbit v4, restauré hier, a été construit pour la racine
  d'un site, alors qu'il vit dans `/orbit/`. Son manifeste vise aussi la racine : installé depuis .eu, il ouvrirait la page
  d'accueil du Labo au lieu d'Orbit. Le correctif ne règle pas ce point. Orbit est en pause, donc je n'y ai pas touché.
- **Ce que j'ai fait** : correctif prêt et testé (plus d'erreur, aucun défilement de côté à 280, 320, 360, 390 et 1280 px),
  « OK pour publier » de qa-verifier : [orbit-service-worker-et-barre-etroite.patch](https://github.com/azertylm/alphabette/blob/main/docs/labo/correctifs/orbit-service-worker-et-barre-etroite.patch).
  Phrase à me dire : « Applique le correctif orbit-service-worker-et-barre-etroite du Laboratoire et publie-le. »

### Pour information
- 0 avis rejeté, 0 Niveau 2. Aucune appli éligible au passage vers .fr.
- Alerte « sauvegarde des avis arrêtée depuis 49 h » du Concierge : fausse alerte, le relevé a tourné avec succès
  aujourd'hui à 4 h 45 et 18 h 17 ([journal](https://github.com/azertylm/Alphabette/actions/workflows/labo-avis.yml)).
- Concierge : certificat HTTPS illisible pour proxilien.eu (ProxiLien est en pause). Pour le réparer : dans l'espace OVH,
  Hébergement → Multisite, vérifier que proxilien.eu est rattaché avec le SSL activé.
- Crédit OpenRouter toujours épuisé (Économe) : le Mode Gratuit continue. Pour relancer les débats Premium :
  [ajouter du crédit](https://openrouter.ai/settings/credits).
- Atelier qualité : pas de nouvelle correction ce passage (petits boutons et petits textes relevés surtout dans la barre
  commune, qui touche aussi alphabette.fr). Signalements, propositions et boîte à idées : non relus ce passage
  (adresses illisibles depuis la tâche planifiée).
- Nouvelles applis de `data/apps-sources.json` (Radar, Curioz, Omnistat…) : cette session n'a pas eu l'accès en écriture
  à leurs dépôts. Omnistat, la seule contrôlée cette nuit par l'Agent Chaos, n'avait pas d'anomalie ; les autres ne sont
  pas encore dans sa ronde.

## 25/11/2026 — Passage quotidien : 2 avis, 4 corrections, correctif Sentinelle appliqué sur ton ordre

### ✅ FAIT le 25/11 sur ton ordre — Sentinelle : faux retrait d'Info Perso sur alphabette.fr
- **Résumé** : à 19 h 25, la Sentinelle a marqué « retirée » la version d'Info Perso sur alphabette.fr, pour 3 « erreurs
  fatales » sur 77 visites. Les 3 étaient le message « ResizeObserver loop completed… », un simple avertissement du
  navigateur : l'appli ne plantait pas. Rien n'a changé pour les visiteurs (il n'y avait pas de version précédente).
- **Mon avis critique** : c'est une fausse alerte, et elle se répétera : à chaque passage de la Sentinelle (jusqu'à toutes
  les 20 min), nouvel incident, nouveau commit, nouvelle publication et nouveau ticket GitHub. Pire, sur IA Débat (qui a une
  version précédente), le même avertissement suffirait à remettre l'ancienne version sur alphabette.fr.
- **Ce que j'ai fait** : correctif prêt et testé (4 cas : avertissement seul → ignoré ; vraie erreur → toujours détectée ;
  version déjà signalée → plus de répétition ; l'ancien script, lui, retirait à tort) :
  [sentinelle-faux-positif-resizeobserver.patch](https://github.com/azertylm/alphabette/blob/main/docs/labo/correctifs/sentinelle-faux-positif-resizeobserver.patch).
  Il remet aussi Info Perso « en ligne » dans l'historique des versions. Je ne l'ai pas appliqué, car il touche alphabette.fr.
  Phrase à me dire : « Applique le correctif sentinelle-faux-positif-resizeobserver du Laboratoire et publie-le. »

### ✅ Fait — France Service : les petits textes grandissent avec BIG (avis fb_1795199847_24b2, +1)
- **Résumé** : « Même en mode Big 3 quand c'est écrit en tout petit ça reste écrit en tout petit. »
- **Mon avis critique** : avis juste. 436 petits textes étaient écrits en taille fixe : le bouton BIG ne pouvait pas les agrandir.
- **Ce que j'ai fait** : tailles converties (rendu identique en taille normale, +50 % en très grande taille). Premier passage
  refusé par qa-verifier (3 boutons sortaient de l'écran dans les sous-pages) ; corrigé, puis « OK pour publier » sur les
  15 services à 280 et 360 px : [424a1c0](https://github.com/azertylm/service-france/commit/424a1c0) +
  [702a71d](https://github.com/azertylm/service-france/commit/702a71de31927c4770a3484385bb992f6ff152bc),
  sur [alphabette.eu/apps/franceservice/](https://alphabette.eu/apps/franceservice/). alphabette.fr inchangé (version figée).

### ✅ Fait — Atelier qualité (3 corrections, « OK pour publier » de qa-verifier)
- Frigo-Placard : les 4 champs d'ajout ont une étiquette pour les lecteurs d'écran —
  [6d21f0b](https://github.com/azertylm/frigoplacard-alphabette.fr/commit/6d21f0b77ae3de7c77f84d684c9f55b9e47a0600),
  [alphabette.eu/apps/frigoplacard/](https://alphabette.eu/apps/frigoplacard/).
- Bon Plan : 8 champs de saisie étiquetés —
  [4257786](https://github.com/azertylm/bonplan-alphabette.fr/commit/4257786c927ec2c42eeaee8905afba12bf468775),
  [alphabette.eu/apps/bonplan/](https://alphabette.eu/apps/bonplan/).
- IA Débat : « Réponses générées par une IA : elles peuvent contenir des erreurs, vérifiez les informations importantes. »
  sous les réponses — [c5d0596](https://github.com/azertylm/Il-y-a-des-bas-/commit/c5d05964f2a6014d1f04beff22ab13c71e712cd7),
  [alphabette.eu/apps/iadebat/](https://alphabette.eu/apps/iadebat/).

### Pour information
- **Orbit (avis fb_1795459873_8825, Idée)** : « il faut que orbit soit exactement comme ça » avec un lien masqué par le
  filtre de confidentialité. Orbit est en pause : je n'y touche pas. Tu as restauré Orbit v4 aujourd'hui (PR #31), ce qui y
  répond peut-être. Statut « à revoir par Valentin » ; si tu veux autre chose, redonne-moi le lien en clair.
- 0 avis rejeté. 0 anomalie de l'Agent Chaos (rapport du 25/11 à 10 h 24). Aucune appli éligible au passage vers .fr.
- Alerte « sauvegarde des avis arrêtée » du Concierge : fausse alerte (le relevé tourne, il n'y avait simplement pas de nouvel avis).
- Crédit OpenRouter épuisé (Économe) : débats Premium et Crash-Testeur Premium arrêtés, le Mode Gratuit continue. Si tu
  veux les relancer : [ajouter du crédit](https://openrouter.ai/settings/credits) (10 $ suffisent).
- Signalements, propositions et boîte à idées du collectif : non relus ce passage (adresses illisibles depuis la tâche planifiée).

## 20/11/2026 — Passage quotidien : 0 avis, 1 correction (Agent Chaos), rien n'attend Valentin
- **Résumé** : aucun avis de visiteur. La ronde de nuit de l'Agent Chaos avait échoué (délai dépassé vers le serveur OVH
  à 10 h) ; je l'ai relancée à 21 h 15 : 1 anomalie, IA Débat déborde de 16 px à 280 px.
- **Mon avis critique** : le fautif était le bouton « Intervenir » de la barre de participation ; en mode BIG il
  débordait même sur un téléphone normal (390 px). Le champ de saisie était réduit à zéro : on ne pouvait pas écrire.
- **Ce que j'ai fait** : sur petit écran et en BIG, le bouton ne montre plus que la flèche d'envoi (le mot reste lu par
  les lecteurs d'écran). Vérifié à 280, 320, 360, 390 px et en BIG ; « OK pour publier » de qa-verifier ;
  [commit 6cc09b9](https://github.com/azertylm/il-y-a-des-bas-/commit/6cc09b9bbe42fb094b80660f27fdff3b51df3f58),
  en ligne sur [alphabette.eu/apps/iadebat/](https://alphabette.eu/apps/iadebat/). alphabette.fr inchangé (version figée).
- 0 avis rejeté, 0 Niveau 2, rien en attente de ton ordre.

## ✅ 19/11/2026 — FAIT : accès en écriture aux 12 dépôts, tâche planifiée recréée, correctifs appliqués (base commune incluse)
Voir `docs/labo/correctifs/README.md`. Désormais le Laboratoire agit sans demander et informe seulement.

## (Historique) 19/11/2026 — Accès aux dépôts des applis (à faire une fois)
- **Résumé** : 5 applis ont des correctifs prêts et testés (Frigo-Placard, Goat, Révolution, PromptMagic, Bon Plan,
  voir `docs/labo/correctifs/`), mais la tâche planifiée n'a le droit d'écrire que dans le hub.
- **Mon avis critique** : sans cet accès, le Laboratoire ne peut corriger aucune appli, seulement les pages du hub.
- **Solution** : ouvrir une nouvelle conversation Claude, y coller la phrase ci-dessous ; Claude ajoute les dépôts et
  recrée la tâche planifiée avec ces accès, puis applique les correctifs.
  > Recrée la tâche planifiée « Laboratoire alphabette.eu — passage quotidien des agents » avec le même texte et
  > l'accès en écriture à tous les dépôts de data/apps-sources.json du hub azertylm/alphabette, puis applique
  > docs/labo/correctifs/ de ce hub.
- **Je le fais ?** Oui dès que l'accès est donné (rien d'autre à décider). Seule question : la retouche des barres de
  la base commune change aussi la page d'accueil d'alphabette.fr, uniquement sur les écrans de moins de 340 px.
  Je l'inclus ? oui / non
