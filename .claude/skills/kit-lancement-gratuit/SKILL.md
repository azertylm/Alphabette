---
name: kit-lancement-gratuit
description: Prépare le kit de diffusion gratuite d'une application Alphabette (fiche, texte court, courriel aux relais seniors et associations, soumissions aux annuaires et vitrines) pour la faire connaître en France et chez les francophones. À utiliser quand on veut promouvoir une appli précise.
---

# Kit de lancement gratuit

Entrée : la clé d'une appli (`data/apps-registry.json`). Sortie : `docs/lancement/<clé>.md`, un fichier prêt à copier-coller.

## Avant d'écrire
Lis la fiche du registre et `docs/etat-du-projet.md`. N'affirme que ce qui est vrai aujourd'hui : statut réel de l'appli, gratuite ou non, paiement en ligne et société pas encore ouverts, et ne cite jamais le lieu de vie de Valentin (règle de `docs/etat-du-projet.md`).

## Contenu du fichier
1. **Promesse** : une phrase honnête (qui, quoi, bénéfice) + 3 captures à citer (`graphiste`).
2. **Texte court** (≤ 280 caractères) et **texte long** (≤ 120 mots), français simple, vouvoiement.
3. **Courriel type** aux relais : médiathèques, mairies, France Services, centres sociaux, associations d'inclusion numérique. Une demande claire : présenter l'appli en atelier.
4. **Soumissions** : AlternativeTo, Product Hunt, Show HN, avec le texte adapté à chaque règle. Reddit et Facebook seulement avec l'accord des modérateurs.
5. **Liste de 10 cibles locales** à contacter, avec la source de chaque adresse.
6. **Mesure** : ajoute `?src=<canal>` à chaque lien partagé.

## Interdits
Faux avis, demande d'upvotes, comptes multiples, chiffres sans source, promesse d'une fonction absente.

## Contrôle
`verificateur-honnetete` relit le fichier avant toute diffusion.
