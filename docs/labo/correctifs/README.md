# ✅ Correctifs appliqués et poussés le 19/11/2026 (sur ordre de Valentin)

| Dépôt | Commit sur `main` |
|---|---|
| hub `azertylm/alphabette` (base commune 0.4.2) | [5588689](https://github.com/azertylm/alphabette/commit/5588689) |
| `azertylm/frigoplacard-alphabette.fr` | [03f3e5f](https://github.com/azertylm/frigoplacard-alphabette.fr/commit/03f3e5f) |
| `azertylm/goatchevretheking.alphabette.fr` | [065189e](https://github.com/azertylm/goatchevretheking.alphabette.fr/commit/065189e) |
| `azertylm/revolution.alphabette.fr` | [6d280ed](https://github.com/azertylm/revolution.alphabette.fr/commit/6d280ed) |
| `azertylm/promptmagic.alphabette.fr` | [fe84be5](https://github.com/azertylm/promptmagic.alphabette.fr/commit/fe84be5) |
| `azertylm/bonplan-alphabette.fr` | [04f614a](https://github.com/azertylm/bonplan-alphabette.fr/commit/04f614a) |

Vérifié avant envoi : `tsc` et `build` sans erreur ; aucun défilement de côté à 280, 320 et 390 px ; Frigo-Placard,
Goat Chèvre the King et Révolution restent utilisables hors ligne (service worker prêt, page rechargée sans réseau).
Les fichiers `.patch` ci-dessous sont gardés pour l'historique : **ne pas les réappliquer**.

---

# (Historique) Correctifs prêts, en attente d'accès aux dépôts (19/11/2026)

Trouvés par l'Agent Chaos (nuit du 18/11), corrigés et testés à 320 et 280 px, mais pas encore poussés :
la session qui les a préparés n'avait le droit d'écrire que dans `azertylm/alphabette`.

| Appli | Dépôt | Ce qui est corrigé |
|---|---|---|
| Frigo-Placard | `azertylm/frigoplacard-alphabette.fr` | erreur « unsupported MIME type » (service worker en `/…` au lieu de `./…`) ; page blanche hors ligne ; barres qui débordent à 280 px |
| Goat Chèvre the King | `azertylm/goatchevretheking.alphabette.fr` | même erreur de service worker ; page blanche hors ligne |
| Révolution | `azertylm/revolution.alphabette.fr` | même erreur de service worker ; hors ligne ; « Comment ça marche ? » qui dépasse à 280 px |
| PromptMagic | `azertylm/promptmagic.alphabette.fr` | cartes d'idées de 250 px minimum qui dépassent à 280 px |
| Bon Plan | `azertylm/bonplan-alphabette.fr` | grille des catégories qui dépasse à 320 px (3 pastilles par ligne sous 360 px) |
| Base commune | hub, `packages/shell` (0.4.2) | barres 1 et 2 qui tiennent à 320 et 280 px (règle `max-width: 340px`) |

## Appliquer (session avec accès en écriture aux 5 dépôts)
1. Hub : `git apply docs/labo/correctifs/hub-base-commune-barres-etroites.patch` (change aussi les barres de la page
   d'accueil d'alphabette.fr, sous 340 px de large seulement), commit, push.
2. Pour chaque appli : cloner le dépôt, `bun run sync:shell <dossier>` depuis le hub (sauf Bon Plan), puis
   `git apply <hub>/docs/labo/correctifs/<dépôt>.patch`, `bun install && bunx tsc --noEmit && bun run build`, commit, push sur `main`.
3. Relancer l'Agent Chaos (`labo-chaos.yml`) et vérifier 0 anomalie avant d'annoncer l'évolution sur le badge.
