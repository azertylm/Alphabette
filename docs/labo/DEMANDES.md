# Demandes du Laboratoire à Valentin

Écrites par le cycle du laboratoire (`/cycle-labo`) : demandes de Niveau 2 et propositions de transfert vers
alphabette.fr. Réponse dans n'importe quelle conversation : « oui pour fb_… » ou « non pour fb_… (raison) ».

## 25/11/2026 — Passage quotidien : 2 avis, 4 corrections, 1 correctif attend ton ordre (alphabette.fr)

### ⏳ Attend ton ordre — Sentinelle : faux retrait d'Info Perso sur alphabette.fr
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
