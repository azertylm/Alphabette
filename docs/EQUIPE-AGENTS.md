# L'équipe d'agents d'Alphabette

20 agents spécialisés, rangés dans `.claude/agents/`. Ils servent à **créer** :
ils travaillent seulement quand on les appelle pendant une session sur ce dépôt
(aucun coût quand ils ne servent pas). Les agents planifiés (prospection,
relances, réseaux sociaux, Orbit, tri des mails) restent à part.

**Comment s'en servir** : il suffit de demander, par exemple « fais tester
bonplan au testeur-mobile » ou « on crée une appli de covoiturage ». Le
`chef-de-projet` répartit le travail entre les autres.

| # | Agent | Rôle |
|---|---|---|
| 1 | `chef-de-projet` | Découpe une demande, répartit, tient l'état du projet |
| 2 | `createur-app` | Nouvelle appli : dépôt, base commune, registre |
| 3 | `developpeur` | Code les fonctions (React + Vite + TypeScript) |
| 4 | `migrateur-statique` | Fait tourner sans serveur une appli Node |
| 5 | `integrateur-ia` | Branche l'IA (Mistral, clé du visiteur) |
| 6 | `designer-ui` | Interface mobile, palette, jour/nuit, BIG |
| 7 | `graphiste` | Icônes, favicon, image de partage, captures |
| 8 | `redacteur` | Tous les textes visibles |
| 9 | `testeur-mobile` | Teste à 390 px, liste les bugs |
| 10 | `debogueur` | Répare bugs, pages blanches, publication en échec |
| 11 | `verificateur-honnetete` | Faux contenus, chiffres, conseils, urgences |
| 12 | `gardien-securite` | Clés, failles, données personnelles |
| 13 | `accessibilite` | Seniors, malvoyants, contrastes, clavier |
| 14 | `performance` | Vitesse et poids |
| 15 | `referenceur-seo` | Google et partage sur les réseaux |
| 16 | `juriste-rgpd` | Mentions légales, confidentialité, CGV du Pass |
| 17 | `publieur` | Mise en ligne sur OVH et contrôle |
| 18 | `strategie-revenus` | Gagner de l'argent, priorités, coûts |
| 19 | `inventeur-idees` | Nouvelles idées d'applis, fiches projet |
| 20 | `documentaliste` | Documentation et résumé de fin de session |

Circuit type d'une nouvelle appli : `inventeur-idees` → `chef-de-projet` →
`createur-app` → `developpeur` / `designer-ui` / `redacteur` → `testeur-mobile`
→ `verificateur-honnetete` → `publieur` → `documentaliste`.

Ajouter un agent : créer `.claude/agents/<nom>.md` avec un en-tête `name`,
`description` (quand l'utiliser) et `model`, puis ses consignes en dessous.
