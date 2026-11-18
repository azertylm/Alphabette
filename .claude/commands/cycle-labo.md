---
description: Lance un cycle complet du Laboratoire alphabette.eu (5 agents en relais strict)
---

Cycle du Laboratoire alphabette.eu. Aucun code n'est modifié sans passer par toute la chaîne.

1. Lis `RULES_AND_MEMORY.md` en entier, puis lance `bun run labo:cycle` (avis → `/tmp/feedbacks.json`, rapport de l'Agent Chaos → `/tmp/chaos.json`, tableau de bord, maturité).
   « 0 avis à trier » et aucune autorisation nouvelle dans `data/labo/autorisations.json` : termine en une ligne.
2. Agent `triage-analyst` : rejette, classe Niveau 1 / Niveau 2, écrit `data/labo/decisions.json`, rédige les demandes de Niveau 2.
3. Agent `agent-correcteur` : `node scripts/labo/correcteur.mjs candidats /tmp/feedbacks.json` ; bugs critiques ou soutenus →
   localisation + branche + Pull Request ; prompts mal notés → variante en bêta A/B (2 bugs et 1 prompt au plus).
   Chaque diff passe par `qa-verifier`.
4. Pour chaque autre Niveau 1 retenu (3 au plus) et chaque Niveau 2 autorisé : agent `code-builder` (diff sur une branche locale),
   puis agent `qa-verifier` sur ce diff. Veto → retour à `code-builder` (2 fois au plus, ensuite `needs_human_review`).
   Seul un « OK pour publier » de `qa-verifier` autorise le push sur `main` du dépôt de l'appli (= alphabette.eu).
5. Agent `maturity-curator` : statuts `implemented`, badge « Dernière évolution IA », score de maturité, alerte à 85/100.
6. Agent `agent-graduation` : `node scripts/labo/graduation.mjs eligibles /tmp/feedbacks.json /tmp/chaos.json` ; pour chaque appli
   éligible, demande à Valentin s'il veut la transférer (rien d'autre sans son « oui »). Lors d'un transfert : `redacteur-notes`.
7. Agent `meta-improver` : règles apprises dans `RULES_AND_MEMORY.md` (section 8).
8. Commit du hub (« Labo : cycle du <date> ») et push sur `main` : alphabette.eu se met à jour ; alphabette.fr ne change pas.
9. Rendu à Valentin, court : ce qui a été corrigé, ce qui a été rejeté (combien), et chaque demande de Niveau 2 ou transfert
   sous la forme « Résumé · Mon avis critique · Solution · Je le fais ? oui / non » (Priorité haute en premier).
   Écris aussi ces demandes dans `docs/labo/DEMANDES.md`.

Jamais : toucher à `vitrine`, `vitrine.ref`, `vitrine/` ; saisir une clé ou un mot de passe ; inventer un avis, un vote ou un score.
