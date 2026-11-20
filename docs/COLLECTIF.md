# Le Collectif Alphabette (alphabette.eu)

alphabette.eu est l'atelier collectif : les applications d'Alphabette **et** celles de créateurs
indépendants, testées et améliorées ensemble. alphabette.fr (la vitrine) n'affiche rien de tout ça.

## Ce qui est en place
- **Accueil** (mode Labo de `src/components/Accueil.tsx`) : accroche du collectif, filtres
  Toutes / Officiel / Communauté / Nouveautés / En test, fiches (créateur, statut « Validée » si
  `vitrine: true`, sinon « En test », « Tester en 1 clic », « Soutenir », « Donner mon avis »).
- **Salle d'embarquement** (`labo/pages/embarquement.html` → `alphabette.eu/embarquement/`, remplace l'ancienne
  fenêtre « Proposer ») : les 4 règles du Labo à cocher (contrôles sécurité / anti-traceurs ; alphabette.eu
  seulement, **jamais transférée sur alphabette.fr** ; zéro pub, zéro revente de données ; charte), puis nom,
  adresse https **ou** dépôt GitHub, description en 2 phrases, pseudo, contact facultatif. Honeypot, temps minimum
  de remplissage, origine vérifiée, un lien au plus. `alphabette.eu/#proposer` y renvoie.
- **Badge « Passé au Crash-Test • Alphabette.eu »** (`alphabette.eu/badge/?app=<id>`) : page de vérification +
  bloc « Intégrer le badge sur ton site ou GitHub » (HTML avec SVG intégré, sans script ; Markdown) pour chaque
  appli de créateur validée (lien « 🏅 Badge Crash-Test » sur sa fiche). SVG : `labo/pages/badge/` (clair, sombre, auto).
- **Service** `labo/serveur/collectif.php` → `eu/api/collectif.php` : soutiens (1 par personne, appli
  et jour) et propositions (3 par jour et par visiteur). Données hors du site :
  `~/alphabette-labo-donnees/collectif/`. Pas d'adresse IP gardée (empreinte du jour).
  Chaque proposition est envoyée par e-mail à azertylm@gmail.com (contact compris).
- **Badge d'entraide** : `alphabette.eu/badge.js` (une ligne), page `alphabette.eu/rejoindre/`,
  tirage au hasard `alphabette.eu/au-hasard/?depuis=…` (jamais l'appli d'origine). Aucun cookie.

## Valider une proposition (jamais automatique)
1. Lire les propositions : `https://alphabette.eu/api/collectif.php?propositions=1` (sans les contacts).
2. Ouvrir l'appli sur téléphone et vérifier la charte : utile et fonctionnelle, sans inscription
   pour tester, pas de traceurs publicitaires (regarder les requêtes réseau), badge du collectif présent
   ou promis. Préparer pour Valentin un résumé : adresse, ce qu'on a vu, respect de la charte.
3. **Sur le « oui » de Valentin seulement** : ajouter l'appli dans `data/apps-communaute.json`
   (branche + PR) :
   ```json
   { "id": "c-recettes-anti-gaspi", "name": "Recettes Anti-Gaspi", "description": "…",
     "url": "https://…", "createur": "Lina", "categorie": "Quotidien", "createdAt": "2026-11-20T00:00:00Z" }
   ```
   L'`id` commence par `c-`. La publication suivante l'affiche sur alphabette.eu, avec « Soutenir »
   et « Donner mon avis » (les avis passent dans le même circuit que ceux des applis d'Alphabette).
4. Répondre au créateur (contact reçu par e-mail).

Retirer une appli : supprimer sa ligne du fichier (branche + PR).
