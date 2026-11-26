# L'équipe d'agents d'Alphabette

15 agents spécialisés, rangés dans `.claude/agents/`. Ils servent à **créer** :
ils travaillent seulement quand on les appelle pendant une session sur ce dépôt
(aucun coût quand ils ne servent pas). Les agents planifiés (prospection,
relances, réseaux sociaux, Orbit, tri des mails) restent à part.

**Comment s'en servir** : il suffit de demander, par exemple « fais tester
bonplan au testeur-mobile » ou « on crée une appli de covoiturage ». Le
Le skill `orchestrateur-alphabette` (`.claude/skills/`) répartit le travail entre les autres.

| # | Agent | Rôle |
|---|---|---|
| 1 | `developpeur` | Code les fonctions (React + Vite + TypeScript) |
| 2 | `integrateur-ia` | Branche l'IA (Mistral, clé du visiteur) |
| 3 | `designer-ui` | Interface mobile, palette, jour/nuit, BIG |
| 4 | `graphiste` | Icônes, favicon, image de partage, captures |
| 5 | `redacteur` | Tous les textes visibles |
| 6 | `testeur-mobile` | Teste à 390 px, liste les bugs |
| 7 | `debogueur` | Répare bugs, pages blanches, publication en échec |
| 8 | `verificateur-honnetete` | Faux contenus, chiffres, conseils, urgences |
| 9 | `gardien-securite` | Clés, failles, données personnelles |
| 10 | `accessibilite` | Seniors, malvoyants, contrastes, clavier |
| 11 | `performance` | Vitesse et poids |
| 12 | `referenceur-seo` | Google et partage sur les réseaux |
| 13 | `juriste-rgpd` | Mentions légales, confidentialité, CGV du Pass |
| 14 | `publieur` | Mise en ligne sur OVH et contrôle |
| 15 | `strategie-revenus` | Gagner de l'argent, priorités, coûts |

Circuit type d'une appli : `developpeur` / `designer-ui` / `redacteur` → `testeur-mobile`
→ `verificateur-honnetete` → `publieur`.

Ajouter un agent : créer `.claude/agents/<nom>.md` avec un en-tête `name`,
`description` (quand l'utiliser) et `model`, puis ses consignes en dessous.

## Le Laboratoire alphabette.eu (agents d'amélioration des applis, à conserver)

Ils améliorent les applis à partir des avis des visiteurs, en relais strict, selon `RULES_AND_MEMORY.md` :

| Agent | Rôle |
|---|---|
| `triage-analyst` | Trie les avis : rejet, Niveau 1 (autonome) ou Niveau 2 (accord de Valentin) |
| `code-builder` | Corrige (Niveau 1) ou crée la bêta (Niveau 2 autorisé) |
| `qa-verifier` | Audit avant mise en ligne, droit de veto, note qualité sur 30 |
| `maturity-curator` | Statuts, badge « Dernière évolution IA », score de maturité, alerte à 85/100 |
| `meta-improver` | Ajoute les leçons apprises à `RULES_AND_MEMORY.md` |

Mode d'emploi : `docs/LABO-EU.md`.


## L'Atelier qualité (20/11/2026)

Un agent de plus, `le-plume` (relecture des textes du premier écran, test des 5 secondes), et des robots sans IA
qui tournent tout seuls sur GitHub : l'Atelier qualité (Douanier, Pouce, Opticien, Poids Plume, Phare, Parapluie,
Témoin, Jury, Parrain), le Veilleur, le Concierge et l'Économe. Carte complète des 15 agents et de leurs fichiers :
`docs/labo/ATELIER-QUALITE.md`.
