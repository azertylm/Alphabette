# Demandes du Laboratoire à Valentin

Écrites par le cycle du laboratoire (`/cycle-labo`) : demandes de Niveau 2 et propositions de transfert vers
alphabette.fr. Réponse dans n'importe quelle conversation : « oui pour fb_… » ou « non pour fb_… (raison) ».

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
