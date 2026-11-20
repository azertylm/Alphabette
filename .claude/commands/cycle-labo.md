---
description: Lance un cycle complet du Laboratoire alphabette.eu (5 agents en relais strict)
---

Cycle du Laboratoire alphabette.eu. Aucun code n'est modifié sans passer par toute la chaîne.

1. Lis `RULES_AND_MEMORY.md` en entier, puis lance `bun run labo:cycle` (avis → `/tmp/feedbacks.json`, rapport de l'Agent Chaos → `/tmp/chaos.json`, tableau de bord, maturité).
   « 0 avis à trier », aucune anomalie dans `/tmp/chaos.json` et aucune autorisation nouvelle dans `data/labo/autorisations.json` : termine en une ligne.
1 bis. Anomalies de l'Agent Chaos (`/tmp/chaos.json`) : chacune devient un correctif de Niveau 1 (`code-builder` → `qa-verifier`),
   en plus des 3 corrections d'avis, critiques d'abord (exception, promesse rejetée, écran blanc, PWA hors ligne).
1 ter. Atelier qualité (`docs/labo/ATELIER-QUALITE.md`) : `git fetch -q --depth=1 origin labo-donnees` puis
   `git show FETCH_HEAD:atelier/index.json`, `…:atelier/alertes.json`, `…:concierge/dernier.json`, `…:veilleur/etat.json`.
   - Applis d'Alphabette : points « bloquant » puis « important » des rapports (`atelier/rapports/<id>.json`, champs `correction`
     et `prompt`) → correctifs de Niveau 1 comme ceux de l'Agent Chaos (3 au plus par passage, les plus graves d'abord).
   - Applis du collectif : rien à corriger à leur place ; leur rapport public suffit.
   - Agent `le-plume` : relit les textes du premier écran des applis contrôlées cette nuit → `data/labo/plume.json`.
   - Signalements : `curl -s https://alphabette.eu/api/collectif.php?signalements=1` ; urgent (illicite, arnaque, données,
     droits) sur une appli du collectif → ouvrir l'appli et vérifier : manifestement fondé = retirer sa fiche de
     `data/apps-communaute.json` tout de suite et prévenir Valentin ; douteux = rapport à Valentin (jamais de retrait sur
     la seule foi d'un signalement).
   - Propositions (`…/api/collectif.php?propositions=1`) : pour chaque nouvelle, préparer le rendu à Valentin (résumé,
     lien, et pour une appli « heberge » le commit figé : `gh api repos/<depot>/commits/HEAD --jq .sha`). Sur son « oui » :
     fiche dans `data/apps-communaute.json` (format dans ATELIER-QUALITE.md) ; le contrôle avant publication est automatique.
   - Concierge / Économe / Veilleur : un point « bloquant » ou une panne en cours = notification courte à Valentin avec le
     lien où cliquer ; le reste attend le rendu du soir.
2. Agent `triage-analyst` : rejette, classe Niveau 1 / Niveau 2, écrit `data/labo/decisions.json`, rédige les demandes de Niveau 2.
3. Agent `agent-correcteur` : `node scripts/labo/correcteur.mjs candidats /tmp/feedbacks.json` ; bugs critiques ou soutenus →
   localisation + branche + Pull Request ; prompts mal notés → variante en bêta A/B (2 bugs et 1 prompt au plus).
   Chaque diff passe par `qa-verifier`.
4. Pour chaque autre Niveau 1 retenu (3 au plus) et chaque Niveau 2 (bêta d'abord, sans attendre d'autorisation, sauf ce qui touche alphabette.fr) : agent `code-builder` (diff sur une branche locale),
   puis agent `qa-verifier` sur ce diff. Veto → retour à `code-builder` (2 fois au plus, ensuite `needs_human_review`).
   Seul un « OK pour publier » de `qa-verifier` autorise le push sur `main` du dépôt de l'appli (= alphabette.eu).
5. Agent `maturity-curator` : statuts `implemented`, badge « Dernière évolution IA », score de maturité, alerte à 85/100.
4 bis. Agent `pollinisateur` : pour chaque correctif structurel fusionné ce passage (stockage, thème, export, PWA),
   `node scripts/labo/pollinisation.mjs scanner --depuis <repo>@<sha>` puis PR préventives sur les applis sœurs (5 au plus).
5 bis. Difficultés d'usage : `node scripts/labo/tutos.mjs frictions /tmp/feedbacks.json` ; pour chaque friction retenue,
   écris un micro-tuto (3 étapes, sélecteurs vérifiés sur la page .eu) dans `data/labo/tutos.json` (sans `vitrine`).
6. Agent `agent-graduation` : `node scripts/labo/graduation.mjs eligibles /tmp/feedbacks.json /tmp/chaos.json` ; pour chaque appli
   éligible, demande à Valentin s'il veut la transférer (rien d'autre sans son « oui »). Sur son « oui » :
   a. Conseil des Agents : `bun scripts/labo/conseil/conseil.ts preparer <app_id> --feedbacks /tmp/feedbacks.json`, puis pour
      chaque prompt listé un agent `conseiller` (les 3 en parallèle), puis `… poursuivre <app_id>` (2e tour si demandé, puis
      à nouveau `poursuivre`). Avec une clé dans l'environnement : `… evaluer <app_id> --moteur api`. NO_GO = pas de transfert ;
      la synthèse de 5 lignes va dans le rendu à Valentin.
   b. `preparer` (graduation) lance l'Agent Gardien et exige le GO du Conseil sur la même version : sinon, transfert bloqué. Lors d'un transfert : `redacteur-notes`.
7. Agent `meta-improver` : règles apprises dans `RULES_AND_MEMORY.md` (section 8).
8. Commit du hub (« Labo : cycle du <date> ») sur une branche `labo/cycle-<date>`, puis Pull Request avec l'étiquette
   `fusion-auto` (`gh api repos/azertylm/Alphabette/pulls …` puis `gh api repos/azertylm/Alphabette/issues/<n>/labels -f "labels[]=fusion-auto"`) :
   si elle ne change que le Laboratoire (règle : `scripts/labo/fusion-auto.mjs`), GitHub la fusionne et republie tout seul.
   Sinon elle attend le « fusionne » de Valentin (lui donner le lien de la PR).
9. Rendu à Valentin, court, avec des liens cliquables (commits, pages .eu) : ce qui a été corrigé, ce qui a été rejeté (combien),
   et chaque Niveau 2 sous la forme « Résumé · Mon avis critique · Ce que j'ai fait » (Priorité haute en premier).
   Seul ce qui touche alphabette.fr attend son ordre : correctif prêt dans `docs/labo/correctifs/`, et la phrase exacte à me dire.
   Écris aussi ces comptes rendus dans `docs/labo/DEMANDES.md`.

Jamais : toucher à `vitrine`, `vitrine.ref`, `vitrine/` ; saisir une clé ou un mot de passe ; inventer un avis, un vote ou un score.
