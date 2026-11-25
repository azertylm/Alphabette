# Feuille de route — 15 jours (26 novembre → 10 décembre 2026)

Pour un fondateur seul, en phase de création. Basée sur l'état réel du dépôt et des rapports de l'Atelier du 25/11.
Aucun code d'application n'est modifié par ce document.

## Diagnostic
**Constat clé** : aucune appli n'a le badge « Testé au Labo » (0 jour apte sur 7 pour toutes), et la cause est commune : la
**barre commune** (zones tactiles de 32 px, textes de 11 px). Aucune appli n'a non plus assez d'avis réels pour la règle
`.eu → .fr` (≥ 10 avis positifs, ≥ 75 %). Corriger la barre et récolter des avis réels débloque tout le reste.

### Déjà sur .fr (figées, on ne touche pas sans ordre)
France Service, IA Débat, Info Perso, Wikicom. À surveiller seulement (Sentinelle, audit réseau).

### À stabiliser en priorité sur .eu (candidates les mieux notées par l'Atelier, 1 point « important » chacune)
Mémo-Méninges (89), Petits Jeux (89), Où c'est ? / Où c'est en France ? (88), Le Juste Chiffre (88), Le Dico Loufoque (88),
Quiz en famille (88), Senior Bon Plan (87), Quiz musique (87), Femmes extraordinaires (87), L'Œil de l'Atelier (87).
Plus utiles pour un premier public : **Senior Bon Plan, Bon Plan, Frigo-Placard, Mémo-Méninges**.

### En pause temporaire
Lidarsol, Osolar, ProxiLien (serveur), Orbit et Info Perso (domaines) — décision de Valentin — et les **brouillons** :
Radar, Lecture Magique, MémoVoix, MatchSoirée, Parent SOS, Révis'Clash, NégoCoach, DissTrack Express, Tribunal des Potes,
Balade, Tribunal des Choix, Alphabette Hub, Une de l'Absurde, Curioz, Copro Transparence, Éco-Diag, Bailleur Serein,
Facture Propre, Asso Pilote, Cyber Vigie, Agri-Météo, Mémoire Commune, Écho, Devine, Accord, LSF Atelier, Sillage, Kurate,
StudioInfo, Santé Citoyenne, Test Barre.

### Résidus du « bouquet »
Aucune logique active : prix unique 15 €/an partout (texte, modales, PHP). Il reste seulement des **identifiants
historiques** acceptés pour lire d'anciens profils (`src/plans.ts`, `src/types.ts`, champ `bouquet?` de
`packages/shell/src/pricing.ts`). Inoffensifs ; nettoyage à faire plus tard (gelé, voir ci-dessous).

## Les 3 priorités non négociables
### 1. Débloquer la barre commune (mobile)
- **Objectif** : zones à toucher 44 px, textes ≥ 12 px, barre masquée au défilement sur toutes les pages du hub.
- **Semaine 1** : fusionner la PR « audit / barre » après essai sur 2 téléphones réels ; relancer l'Atelier (nuit suivante).
- **Semaine 2** : répercuter dans les applis par `bun run sync:shell` (Senior Bon Plan, Bon Plan, Frigo-Placard en premier).
- **Réussite** : Pouce ≥ 75 sur ≥ 15 applis ; ≥ 5 applis avec le badge « Testé au Labo » au jour 15.

### 2. Terrain : de vrais retours (plan `docs/labo/PLAN-TERRAIN-15-JOURS.md`)
- **Objectif** : transformer les démonstrations locales en signaux chiffrés.
- **Semaine 1** : La Grande-Motte (entourage, CCAS / résidence senior), 4 applis seulement.
- **Semaine 2** : Montpellier et le Nord ; bilan au jour 15.
- **Réussite** : ≥ 30 retours via « Donner mon avis », ≥ 3 applis avec ≥ 10 avis, 0 retour P1 laissé sans réponse 24 h.

### 3. Préparer l'arrivée du BTS sans te disperser
- **Objectif** : l'étudiant tient les tests mobiles et le tri des retours dès sa première semaine.
- **Semaine 1** : fusionner les documents (`CONTRIBUTING`, `ONBOARDING_BTS`, fiche de test), faire un test à deux.
- **Semaine 2** : l'étudiant mène seul 3 protocoles ; point de 15 minutes par semaine.
- **Réussite** : 3 fiches de test complètes par lui seul ; ta charge de suivi < 15 min/jour.

## Décision `.fr` à J15
Une appli n'est promue que si elle coche `docs/CHECKLIST_EU_VERS_FR.md`. Il est **probable qu'aucune** ne le soit en 15 jours :
ce n'est pas un échec, c'est le but de la règle.

## On n'y touche pas pendant 15 jours
- Lidarsol, Osolar, ProxiLien, Orbit, Info Perso ; `vitrine/` et `vitrine.ref`.
- **Toute nouvelle application** et les 30 brouillons du registre ; nouvelles idées de la boîte à idées (on les note seulement).
- Monétisation : boutique, bounties, affiliation, revenus créateurs, Pack de crédits IA Débat ; changement de prix.
- IA Débat Gratuit / Premium (en attente : crédit OpenRouter) ; Mode Découverte ; tout nouveau fournisseur d'IA.
- Refontes secondaires : nettoyage des identifiants « bouquet », polices hébergées en local, `MicroTuto` / `ABTestToggle`,
  podcasts du Labo, nouveaux agents, règles Firebase.
- Toute modification de la tarification (15 €/an) ou du partage 10 € / 5 €.
