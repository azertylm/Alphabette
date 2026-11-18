# Agent Correcteur — architecture et données

Agent : `.claude/agents/agent-correcteur.md` · Outils : `scripts/labo/correcteur.mjs` · Lancement : étape 3 de `/cycle-labo`
(tâche planifiée quotidienne de 21 h 13). Contrôle : `qa-verifier` (veto). Publication : alphabette.eu uniquement.

## Logique d'exécution

```
alphabette.eu ──avis──► feedback.php ──export 3 h──► branche labo-donnees/feedbacks.json
                                                          │
                     node scripts/labo/correcteur.mjs candidats
                         │                                   │
              BugAPatcher (Bug + erreurs JS            PromptAAjuster (appli de data/labo/prompts.json,
              ou ≥ 3 « +1 »)                            ≥ 3 notes < 3/5 en 14 jours, ≥ 2 commentaires)
                         │                                   │
        localiser (carte de sources → fichier:ligne)   motifs (≥ 2 avis chacun) → VariantePrompt
                         │                                   │
        branche labo/fb_<id> → PullRequestLabo         branche labo-beta → qa-verifier → beta.json
                         │                                   │            (alphabette.eu/apps/<clé>/beta/)
                 qa-verifier : OK / veto                ≥ 7 jours et ≥ 5 notes par version
                         │                                   │
        Niveau 1 : fusion → .eu ; sinon Valentin        ResultatAB → recommandation à Valentin
                         │                                   │
            maturity-curator : implemented, badge public, score ; meta-improver : leçons
```

Seuils (dans `correcteur.mjs`) : bug « critique » = au moins une erreur JavaScript jointe ; bug soutenu = 3 « +1 » ;
priorité haute = plus de 5 « +1 ». Au plus 2 bugs et 1 prompt par passage.

## Payloads

### Ticket (export de `feedback.php`, branche `labo-donnees`)
```json
{
  "id": "fb_1763287200_9a2c",
  "app_id": "iadebat",
  "version_tested": "main",
  "rating": 2,
  "category": "Bug",
  "comment": "Le bouton Lancer ne répond plus sur mon téléphone",
  "upvotes": 4,
  "timestamp": "2026-11-18T10:00:00Z",
  "source": "formulaire",
  "declencheur": null,
  "telemetry": {
    "viewport": "390x844 (dpr: 3)",
    "platform": "Android / Chrome",
    "console_errors": ["TypeError: Cannot read properties of null (reading 'style') (index-D20SYR5q.js:3080:52582)"],
    "stockage_cles": ["alphabette.prefs", "debate_show_sidebar_v2"]
  },
  "status": "pending",
  "ai_analysis": { "relevance_score": null, "intervention_level": null, "reasoning": null, "proposed_fix": null },
  "changelog_public_message": null
}
```
`source: "sondage"` + `declencheur` = micro-sondage après une action réussie (`useContextualFeedback`). Les textes et erreurs
sont passés au filtre de confidentialité (navigateur ET serveur) : clés, jetons, e-mails, téléphones, IBAN, cartes, IP et
paramètres d'adresse sont masqués ; `stockage_cles` ne contient que des noms de réglages, jamais de valeurs.

### BugAPatcher (`correcteur.mjs candidats` → `bugs[]`)
```json
{
  "type": "bug_a_patcher",
  "ticket_id": "fb_1763287200_9a2c",
  "app_id": "iadebat",
  "cle": "iadebat",
  "depot": "azertylm/Il-y-a-des-bas-",
  "priorite": "critique",
  "upvotes": 4,
  "description": "Le bouton Lancer ne répond plus sur mon téléphone",
  "version_testee": "main",
  "telemetrie": { "viewport": "390x844 (dpr: 3)", "platform": "Android / Chrome", "console_errors": ["…"], "stockage_cles": ["…"] },
  "positions_a_localiser": ["index-D20SYR5q.js:3080:52582"]
}
```

### Localisation (`correcteur.mjs localiser <clé> <position>`)
```json
{
  "cle": "iadebat",
  "position": "index-D20SYR5q.js:3080:52582",
  "fichier_construit": "dist-correcteur/assets/index-D20SYR5q.js",
  "empreinte_identique": true,
  "origine": { "fichier": "src/App.tsx", "ligne": 2686, "colonne": 35, "nom": null },
  "extrait": "2685: …\n2686: <span>Lancer avec ces avis</span>\n…"
}
```

### PullRequestLabo (corps de la Pull Request + `decisions.json` → `correcteur`)
```json
{
  "type": "pull_request_labo",
  "ticket_id": "fb_1763287200_9a2c",
  "depot": "azertylm/Il-y-a-des-bas-",
  "branche": "labo/fb_1763287200_9a2c",
  "niveau": 1,
  "cause": "handleStart lit document.getElementById('arene') avant le rendu sur petit écran",
  "preuve": { "trace": "TypeError … (index-D20SYR5q.js:3080:52582)", "origine": "src/App.tsx:2686", "reproduit": "390x844, Chrome" },
  "correctif": "Lecture de l'élément après le rendu (useEffect) ; aucune autre modification",
  "fichiers": ["src/App.tsx"],
  "verifications": { "tsc": "ok", "build": "ok", "console": "0 erreur", "captures": ["390x844", "360x740"] },
  "risques": "Aucun changement de comportement hors du bouton concerné",
  "message_public": "Le bouton « Lancer » répond à nouveau sur téléphone",
  "pr": "https://github.com/azertylm/Il-y-a-des-bas-/pull/12",
  "qa": "en_attente"
}
```

### PromptAAjuster (`correcteur.mjs candidats` → `prompts[]`)
```json
{
  "type": "prompt_a_ajuster",
  "app_id": "iadebat",
  "cle": "iadebat",
  "depot": "azertylm/Il-y-a-des-bas-",
  "prompt": { "fichier": "server.ts", "repere": "LIBERTÉ TOTALE D'OPINION" },
  "fenetre_jours": 14,
  "moyenne": 2.4,
  "notes_basses": [{ "ticket_id": "fb_…", "rating": 2, "comment": "Les IA font des pavés", "declencheur": "debat_termine", "version_tested": "main" }],
  "beta_en_cours": false
}
```

### VariantePrompt (branche `labo-beta`, `data/labo/beta.json`)
```json
{
  "type": "variante_prompt",
  "app_id": "iadebat",
  "fichier": "server.ts",
  "motifs": [{ "motif": "réponses trop longues", "avis": ["fb_…", "fb_…"] }],
  "avant": "- CONCISION : …",
  "apres": "- CONCISION : 90 mots au plus, une idée par réplique …",
  "hypothese": "La note moyenne de la bêta dépasse celle de la version actuelle d'au moins 0,5 point",
  "regles_conservees": ["honnêteté", "pas d'usurpation d'identité d'IA", "sécurité"],
  "branche": "labo-beta",
  "chemin": "/apps/iadebat/beta/",
  "depuis": "2026-11-19T20:13:00Z"
}
```

### ResultatAB (conclusion, au moins 7 jours et 5 notes par version)
```json
{
  "type": "resultat_ab",
  "app_id": "iadebat",
  "du": "2026-11-19", "au": "2026-11-26",
  "actuelle": { "notes": 9, "moyenne": 2.7 },
  "beta": { "notes": 7, "moyenne": 3.6 },
  "votes": { "actuelle": 4, "beta": 11 },
  "recommandation": "adopter",
  "question_valentin": "La variante « réponses courtes » d'IA Débat fait mieux (3,6 contre 2,7). Je l'adopte sur le Laboratoire ? oui / non"
}
```

## Micro-sondages dans une appli
Après `bun run sync:shell` dans l'appli :
```tsx
import { useContextualFeedback } from '@alphabette/shell';

const { declencher, sondage } = useContextualFeedback('debat_termine');
// …quand l'action a réussi :
declencher();
// …dans le rendu :
{sondage}
```
Rien ne s'affiche hors d'alphabette.eu ; une fois par action tous les 30 jours ; un seul sondage par visite.
