# Le Laboratoire alphabette.eu

**alphabette.eu** reçoit toutes les applications d'Alphabette. Sous chaque carte, les visiteurs notent
(1 à 5 étoiles), classent (Bug, Idée, Design, Autre), commentent et soutiennent les demandes des autres (+1).
Cinq agents lisent ces avis et améliorent les applis. **alphabette.fr** ne garde que les applications validées
par Valentin (aujourd'hui : Wikicom, Info Perso, France Service, IA Débat), figées.

Règles des agents : `RULES_AND_MEMORY.md` (racine). Agents : `.claude/agents/triage-analyst.md`,
`code-builder.md`, `qa-verifier.md`, `maturity-curator.md`, `meta-improver.md`.

## Comment c'est construit
- Un seul dossier OVH sert les deux sites : le `.htaccess` envoie `alphabette.eu` vers le dossier `eu/`
  (`scripts/build-static.mjs`). Les applis sont construites deux fois au besoin (`scripts/collect-apps.mjs`) :
  `eu/apps/<clé>/` = branche `main` (le laboratoire), `apps/<clé>/` = commit figé `vitrine.ref` (la vitrine).
- Sur alphabette.fr, une appli du laboratoire renvoie (302) vers `https://alphabette.eu/apps/<clé>/` :
  jamais de 404. Les pages du hub (`/orbit/`, `/quiz-famille/`…) aussi.
- Avis : `eu/api/feedback.php` (PHP de l'hébergement Perso). Données rangées **hors du dossier publié**
  (`~/alphabette-labo-donnees/feedbacks.json`), aucune adresse IP conservée. Santé : `https://alphabette.eu/api/feedback.php?etat=1`.
- Toutes les 3 h, `.github/workflows/labo-avis.yml` copie l'export des avis sur la branche `labo-donnees`
  (`feedbacks.json`) : c'est là que les agents les lisent, et c'est la sauvegarde.
- Capteur d'erreurs : `/labo/capteur.js` est ajouté en tête de chaque appli de .eu ; il garde les 3 dernières
  erreurs JavaScript dans le navigateur du visiteur, jointes à son avis.
- Badge « Dernière évolution IA », score de maturité, bêtas : `data/labo/*.json`, publiés dans `eu/api/labo/`.

## Avis v2 (18/11/2026)
- Filtre « zéro connaissance » commun au navigateur et au serveur : `packages/shell/src/labo/confidentialite.ts` et `masquer()` de `feedback.php`.
- Capteur : 10 dernières erreurs (`window.onerror`, promesses rejetées, `console.error`) avec fichier:ligne:colonne.
- Dédoublonnage en direct dans le formulaire (`packages/shell/src/labo/similarite.ts`, seuil 75 %) : « +1 (J'ai aussi ce problème) ».
- Micro-sondages : `useContextualFeedback(action)` exporté par `@alphabette/shell`.
- Agent Correcteur (bug → Pull Request, prompts mal notés → A/B) : `docs/labo/AGENT-CORRECTEUR.md`.

- Agent Chaos (nuit), Agent de Graduation, notes de version bilingues : `docs/labo/AGENT-CHAOS.md`.
- Bac à sable A/B, dictée d'avis, micro-tutos : `docs/labo/MODULES-INTERACTION.md`. Agent Gardien Ergonomie & Sobriété : `docs/labo/AGENT-GARDIEN.md`.
- Micro-sondages branchés : IA Débat (« débat terminé »), Info Perso (« article lu », après 20 s de lecture).

## Relier le domaine (une seule fois, chez OVH)
1. Zone DNS de `alphabette.eu` : enregistrements `A` / `AAAA` de `@` et `www` identiques à ceux de `alphabette.fr`.
2. Hébergement → Multisite → ajouter `alphabette.eu` et `www.alphabette.eu`, dossier racine **`alphabette`**
   (le même que alphabette.fr), SSL activé.
3. Contrôle : `https://alphabette.eu/` affiche « Le Laboratoire Alphabette », et `?etat=1` ci-dessus répond `"ok": true`.

## La boucle d'amélioration
- **Sur demande** : dans une session Claude sur ce dépôt, la commande `/cycle-labo` (`.claude/commands/cycle-labo.md`)
  enchaîne les 5 agents ; `bun run labo:cycle` seul récupère les avis et affiche le tableau de bord sans rien modifier.
- **À intervalle régulier** : la tâche planifiée quotidienne ci-dessous fait la même chose.

### Tâche planifiée (une fois par jour)
Texte de la tâche :

> Passage quotidien du Laboratoire alphabette.eu. Ajoute à la session le dépôt azertylm/alphabette (accès en
> écriture), clone-le, lis RULES_AND_MEMORY.md et docs/LABO-EU.md. Récupère les avis (branche labo-donnees),
> puis fais travailler en relais strict les agents triage-analyst → code-builder → qa-verifier →
> maturity-curator → meta-improver (3 corrections de Niveau 1 au plus). Pour toute demande de Niveau 2 ou toute
> appli à 85/100 et plus, envoie à Valentin une notification courte et écris le rapport (Résumé · Avis critique ·
> Solution · Demande oui/non) dans docs/labo/DEMANDES.md du hub. Ne touche jamais à alphabette.fr. Rien à trier :
> termine en une ligne.

## Répondre à une demande (Valentin)
Dans n'importe quelle conversation : « oui pour fb_… » ou « non pour fb_… (raison) ». Claude l'inscrit dans
`data/labo/autorisations.json` ; le passage suivant construit la bêta (`alphabette.eu/apps/<clé>/beta/`),
que les visiteurs comparent (« Je préfère l'actuelle / la bêta »).

## Transférer une appli vers alphabette.fr (sur ordre de Valentin uniquement)
1. `data/apps-registry.json` : `"vitrine": true` sur l'appli.
2. Appli à dépôt : dans `data/apps-sources.json`, `"vitrine": { "ref": "<commit testé sur .eu>", "depuis": "<date>" }`.
   Page du hub : copier `public/<page>/` dans `vitrine/<page>/`.
3. Mettre à jour une appli déjà en vitrine : changer `vitrine.ref` (ou recopier `vitrine/<page>/`), sur ordre de Valentin.
4. Push sur `main` du hub : la publication met à jour les deux sites.
Retirer une appli de la vitrine : enlever `"vitrine"` (registre et sources) ; ses adresses .fr renvoient alors vers .eu.
