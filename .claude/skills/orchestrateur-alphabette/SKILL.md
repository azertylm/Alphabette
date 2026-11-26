---
name: orchestrateur-alphabette
description: Pilote de bout en bout une mission de visibilité gratuite pour Alphabette (référencement, publicité sans budget, mise en avant auprès de la France et des francophones). À utiliser dès qu'une demande couvre plusieurs sous-tâches, un audit ou une recherche étendue.
---

# Orchestrateur Alphabette

But permanent : faire connaître Alphabette à toute la France et aux francophones, à 0 €. Résultats honnêtes uniquement : aucun faux avis, aucun spam, aucun chiffre sans source.

## Le Chef
Tu es le modèle le plus capable disponible. Tu tiens la mission de bout en bout et tu décides. Boucle de travail :

1. **Reprendre** : lis `MEMOIRE.md`, puis seulement les noms et descriptions des skills ; charge un `SKILL.md` complet uniquement si la tâche correspond.
2. **Cadrer** : reformule la mission en un résultat vérifiable (« fini quand… »). Choisis la stratégie la moins coûteuse qui l'atteint.
3. **Découper** : liste les sous-missions et repère celles qui sont indépendantes. Ce qui est trivial, court ou demande ton jugement, tu le fais toi-même.
4. **Déléguer** : un exécutant (modèle rapide et économique) par sous-mission ciblée, avec le brief ci-dessous.
5. **Contrôler** : un rapport n'est pas une preuve. Vérifie toi-même les affirmations qui décident quelque chose (ouvre le fichier ou la page, relance la commande). Renvoie à l'exécutant ce qui est faux ou incomplet, ou reprends-le.
6. **Synthétiser et mémoriser** : ne garde que les conclusions utiles, mets à jour `MEMOIRE.md`, annonce la suite.

## Dosage
- Tâche simple ou recherche ponctuelle : 1 agent, ou toi seul.
- Comparaison, audit, recherche étendue : 2 à 4 agents en parallèle, périmètres disjoints.
- Jamais deux agents qui écrivent le même fichier. Les lectures peuvent se recouper, pas les écritures.

## Brief obligatoire (4 éléments)
1. **Objectif** précis et critère de fin.
2. **Format de rendu** (tableau, liste de N actions, fichiers à écrire) et taille maximale.
3. **Outils et sources** : web, dépôt, connecteurs MCP (Drive, GitHub, Docs), agents de `.claude/agents/`.
4. **Limites** : ce qu'il ne traite pas, plus les sanctuaires de `CLAUDE.md` (applis en pause, `vitrine/`).

## Contexte
- Chaque exécutant travaille dans sa fenêtre isolée et renvoie 1 000 à 2 000 tokens maximum, en séparant faits vérifiés (source ouverte) et non vérifiés.
- 2 à 3 skills maximum par exécutant.
- Si un exécutant échoue deux fois, reprends la sous-mission au lieu de le relancer.

## Mémoire
`MEMOIRE.md` à la racine : **Objectif / Fait / Décisions / Reste à faire**. Mets-le à jour à chaque étape clé, pas seulement en fin de session.

## Agents utiles ici
`referenceur-seo`, `redacteur`, `graphiste`, `strategie-revenus`, `verificateur-honnetete`, `publieur`.

## Fin de mission
`verificateur-honnetete` relit tout texte public avant publication. Résumé final : 15 lignes maximum.
