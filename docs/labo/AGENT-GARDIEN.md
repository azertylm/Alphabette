# Agent « Gardien Ergonomie & Sobriété »

Passe obligatoire avant tout transfert d'alphabette.eu vers alphabette.fr. Script : `scripts/labo/gardien.mjs`
(Node.js + Playwright), plugin Vite `scripts/labo/vite-plugin-sobriete.mjs`, outils `scripts/labo/sobriete.mjs`.

```
NODE_PATH=/tmp/pw/node_modules node scripts/labo/gardien.mjs audit <app_id> [--dist <build>] [--enregistrer]
```

## Grille Senior-Friendly (note /100) — page rendue sur téléphone, thème sombre « Onyx »
| Critère | Points | Règle |
|---|---|---|
| Zones interactives | 35 | ≥ 48×48 px (liens au fil d'une phrase tolérés, comptés à part) |
| Contraste | 35 | WCAG AAA : 7:1, ou 4,5:1 pour le grand texte |
| Zoom 200 % | 15 | 1280 px zoomés (= 640 px) et texte à 200 % sur téléphone : ni défilement horizontal ni texte coupé |
| Langage | 15 | −1,5 par anglicisme / jargon (« login », « prompt », « API »…), −5 par fuite technique (« undefined », « [object Object] ») |

## Sobriété → `eco-score.json`
- EcoIndex (méthode GreenIT.fr : nœuds DOM, requêtes, poids transféré), 1920×1080, premier chargement ;
  gaz à effet de serre et eau par page vue. **Note de Sobriété A–E** (F et G de l'EcoIndex comptent comme E).
- Code JavaScript chargé mais jamais exécuté (couverture Chromium) : signalé, jamais supprimé automatiquement.
- SVG allégés sans perte (`--dist`, et à la publication sur .fr des applis transférées) ; le plugin Vite fait de même au build
  et signale les imports presque inutilisés (`dist/eco-bundle.json`).
- Hors ligne : service worker installé, réseau coupé, page rechargée → doit rester utilisable.

## Verrou anti-régression
Référence : dernier audit enregistré au transfert (`data/labo/gardien/<app_id>.json`), sinon la version actuellement sur alphabette.fr.
Bloquant : note seniors −2 pts, contraste AAA −5 %, zoom qui casse, nouvelle fuite technique, EcoIndex −3 pts,
note de sobriété moins bonne, hors ligne perdu. Branché sur :
- `graduation.mjs preparer` (aucun contournement) ; au succès : référence et `data/labo/eco_scores.json` mis à jour
  (note « 🌱 Sobriété X » affichée sur la tuile de l'appli certifiée sur alphabette.fr) ;
- `.github/workflows/gardien-transfert.yml` sur chaque Pull Request qui touche la vitrine : vérification rouge = pas de fusion.
