# L'Atelier qualité d'alphabette.eu

Décidé par Valentin le 20 novembre 2026 (« vas-y, fais tout et rajoute 5 idées »). Il complète les agents
qui existaient déjà (passage de 21 h 13, Agent Chaos, Sentinelle, audit anti-fuite) pour que le Laboratoire
contrôle aussi bien les applis d'Alphabette que celles des créateurs du collectif. alphabette.fr reste réservé
aux applis de Valentin, transférées sur son ordre.

## Les 15 agents et où ils vivent

| Agent | Mission | Où |
|---|---|---|
| **Le Douanier** | Traceurs publicitaires, mineurs, secrets dans le code, appels non déclarés, `http://` ; avant publication d'une appli hébergée : contrôle statique de chaque fichier | `scripts/labo/atelier.mjs` (nuit), `scripts/labo/bac-a-sable.mjs` (avant publication) ; certificat signé « Zéro fuite » pour .fr : `audit-reseau.mjs` (déjà là) |
| **Le Filtre** | Avis nettoyés : données personnelles masquées, doublons « +1 » | déjà en place (Labo v2) : `packages/shell/src/labo/confidentialite.ts`, `similarite.ts`, `masquer()` de `feedback.php` |
| **L'Opticien** | Contraste WCAG AA, textes < 12 px, images sans texte, boutons sans nom, champs sans étiquette, langue, focus clavier visible, mode sombre | `atelier.mjs` (nuit) ; grille seniors AAA avant transfert : Agent Gardien (déjà là) |
| **Le Pouce** | Téléphone de 360 px tenu à une main : débordement, zones < 44 px, boutons serrés, zoom bloqué, balise viewport, bandeaux fixes envahissants | `atelier.mjs` |
| **Le Poids Plume** | Poids, requêtes, EcoIndex, JavaScript, images > 300 Ko, polices externes, compression, durée de chargement | `atelier.mjs` ; EcoIndex avant transfert : Agent Gardien |
| **Le Plume** | Fautes, jargon, test des 5 secondes sur les textes du premier écran | agent `.claude/agents/le-plume.md` (passage de 21 h 13) → `data/labo/plume.json` |
| **Le Phare** | Titre, description, aperçu de partage (Open Graph), h1, noindex, liens morts ; sitemap d'alphabette.eu (applis hébergées comprises) | `atelier.mjs`, `scripts/build-static.mjs` |
| **Le Parapluie** | Cookies tiers, Google Fonts, liens légaux, avertissement sur les réponses d'IA, données sensibles ; **charte des créateurs** (`/charte-createurs`) et **bouton « Signaler »** sous chaque appli (e-mail immédiat à Valentin) | `atelier.mjs`, `src/legal/contenu.tsx`, `src/labo/Signaler.tsx`, `labo/serveur/collectif.php` |
| **Le Greffier** | Journal des améliorations en français simple | déjà en place : `maturity-curator`, `redacteur-notes` ; **Tableau d'Honneur** (pseudo facultatif) et fenêtre « Avant / Après » : en place depuis le 20/11 (`docs/labo/METEO-HONNEUR-IDEES.md`) ; tickets « [Agent Chaos] » publics : toujours en attente de la décision de Valentin |
| **Le Jury** | Badge **« Testé au Labo »** (toutes les applis) ; transfert vers .fr : Agent de Graduation (déjà là) | `atelier.mjs jury` → `atelier/jury.json` |
| **Le Témoin** *(nouveau)* | Capture 390 px de l'écran d'accueil chaque nuit, page blanche, erreurs JavaScript, changement visuel depuis la veille | `atelier.mjs` + `atelier/temoin.mjs` |
| **Le Parrain** *(nouveau)* | Rapport public par appli : chaque point, la correction, un prompt prêt à coller dans l'IA du créateur | `scripts/labo/parrain.mjs` → `alphabette.eu/atelier/` et `/atelier/<id>/` |
| **Le Veilleur** *(nouveau)* | Toutes les heures : chaque adresse répond-elle ? L'isolement des applis hébergées est-il actif ? Ticket au 2e échec, refermé au retour | `scripts/labo/veilleur.mjs`, `.github/workflows/labo-veilleur.yml` |
| **Le Concierge** *(nouveau)* | Certificats HTTPS (21 j), noms de domaine (RDAP, 45 j), http → https, service des avis, sauvegarde des avis (< 12 h) | `scripts/labo/concierge.mjs`, `.github/workflows/labo-concierge.yml` |
| **L'Économe** *(nouveau)* | Crédit OpenRouter (épuisé, bas, plafond de clé, clé refusée), limite des modèles gratuits, plafond Premium, usage sur 30 jours | `concierge.mjs` + `api/iadebat-proxy.php?sante` (chiffres du jour, jamais d'IP ni de clé) |

## Horaires (heure de Paris en hiver)
- 03 h 07 : Atelier qualité (`labo-atelier.yml`) — toutes les applis de alphabette.eu, puis le Jury.
- Toutes les heures à 23 : Le Veilleur.
- 22 h 41 : Le Concierge et l'Économe.
- 21 h 13 : passage quotidien des agents (`/cycle-labo`) : il lit les rapports de l'atelier, fait relire les textes
  par le Plume, traite les signalements et les propositions, et prévient Valentin seulement si c'est utile.
- Aussi : à chaque changement de `data/apps-communaute.json` (contrôle des applis du collectif et des applis hébergées à valider).

## Notes et badge
- Chaque agent note sur 100 (le Témoin ne note pas : il bloque). **Contrôle technique** = moyenne Pouce, Opticien, Poids Plume.
  **Note de l'atelier** = moyenne Douanier, Pouce, Opticien, Poids Plume, Phare, Parapluie.
- Une appli qui ne s'ouvre pas ou reste blanche a 0 en Pouce, Opticien, Poids Plume et Phare.
- **« Testé au Labo »** : dernier contrôle sans point bloquant, rien d'important côté Douanier ou Parapluie, contrôle
  technique ≥ 85 (et Pouce, Opticien, Poids Plume ≥ 75 chacun), aucune erreur JavaScript, et au moins 3 jours de
  contrôle réussi sur les 7 derniers. Ce n'est ni une certification ni une garantie (la charte le dit).
- Données : branche `labo-donnees`, dossier `atelier/` (`index.json`, `jury.json`, `rapports/`, `captures/`,
  `historique/` 14 jours, `prepublication/`, `alertes.json`). Publiées à chaque publication du hub :
  `eu/atelier/` (pages, non indexées) et `eu/api/labo/atelier.json` (cartes du Laboratoire, cadre des applis hébergées).

## Applis du collectif : deux façons de publier
1. **Avec leur adresse** (comme avant) : lien externe, ouvert dans un nouvel onglet. Déjà isolées (autre domaine).
2. **Hébergées par Alphabette** (nouveau, pour les créateurs sans hébergement) : le créateur donne un dépôt GitHub
   public avec ses fichiers déjà construits.

### Sécurité du bac à sable (`scripts/labo/bac-a-sable.mjs`)
- **Jamais de code de créateur exécuté dans une chaîne qui a des accès** : ni `npm install`, ni build. On télécharge
  l'archive d'un **commit figé** (40 caractères) chez GitHub. Le contrôle dans le navigateur se fait dans un job sans
  aucun droit ni secret ; le job qui range les résultats n'exécute rien et refuse tout fichier qui n'est pas JSON, JPEG ou Markdown.
- **Filtre** : liste fermée d'extensions statiques ; pas de PHP ni script serveur, pas de fichier caché (`.htaccess`,
  `.user.ini`…), pas de lien symbolique, pas de SVG avec script, pas de `node_modules` ; 8 Mo par fichier, 25 Mo et 2 000 fichiers au plus.
- **Isolement** : `eu/createurs/<id>/app/.htaccess` (sans RewriteEngine, piège OVH) envoie
  `Content-Security-Policy: sandbox …` → origine opaque : l'appli ne peut lire ni les cookies ni le stockage
  d'alphabette.eu (clés IA des visiteurs dans IA Débat, avis…), ne peut pas toucher la page parente et ne peut
  joindre que les domaines déclarés (`reseau_autorise`). PHP refusé par `FilesMatch` en plus du filtre.
- **Cadre** (`labo/createurs/cadre.html` → `eu/createurs/<id>/index.html`) : barre Alphabette, « Signaler »,
  informations, liens légaux, rapport, effacement des données. L'appli est dans un `<iframe sandbox>`.
- **Coffre** (`labo/createurs/coffre.js`, inséré en tête de chaque page) : rend à l'appli un `localStorage` qui marche
  (gardé par le cadre, clé `ab-coffre:<id>`, 2 Mo). **Garde-fou** : si l'en-tête d'isolement manquait (OVH qui
  l'ignorerait), la page s'arrête et renvoie vers le cadre isolé. Le Veilleur vérifie l'en-tête toutes les heures.
- Limites honnêtes pour le créateur : pas d'IndexedDB, pas de cookies, pas de service worker, pas de caméra / micro / position.
- Tests : `NODE_PATH=/tmp/pw/node_modules CHROME_PATH=/usr/bin/google-chrome node tests/atelier/test_atelier.mjs`
  (49 vérifications : filtre, isolement réel dans Chrome, coffre, garde-fou, atelier, jury).

### Publier une appli hébergée (passage quotidien, après le « oui » de Valentin)
1. Proposition reçue (`api/collectif.php?propositions=1`, mode `heberge`, dépôt `pseudo/depot`).
2. Commit figé : `gh api repos/<depot>/commits/HEAD --jq .sha`.
3. Fiche dans `data/apps-communaute.json` :
   `{ "id": "c-<nom>", "name": "…", "description": "…", "createur": "…", "categorie": "…", "createdAt": "…",
   "heberge": { "depot": "pseudo/depot", "ref": "<sha 40>", "dossier": "dist" }, "reseau_autorise": ["api.exemple.com"] }`
   (`reseau_autorise` : les services que l'appli appelle vraiment — `hotes_references` du verdict aide à les lister).
4. Push sur `main` → `labo-atelier.yml` contrôle CE commit dans son bac à sable → verdict
   `atelier/prepublication/<id>.json` → s'il est conforme, la publication est relancée et l'appli apparaît sur
   `alphabette.eu/createurs/<id>/`. Sinon elle reste invisible et le rapport du Parrain dit quoi corriger.
5. Mise à jour par le créateur : nouveau `ref` dans la fiche → nouveau contrôle → publication si conforme. En attendant,
   ou si la nouvelle version est refusée, la dernière version validée (`dernier_conforme` du verdict) reste en ligne.

## Signalements (Le Parapluie)
- Bouton « Signaler » sous chaque carte du Laboratoire et dans le cadre des applis hébergées → `collectif.php`
  (action `signaler`) : rangé hors du site, **e-mail immédiat** à Valentin (« URGENT » pour illicite, arnaque,
  données, droits). Lecture par les agents : `api/collectif.php?signalements=1` (sans les contacts).
- Retirer une appli du collectif : enlever sa fiche de `data/apps-communaute.json` (push sur `main`) : elle disparaît à
  la publication suivante. Signalement vérifié et manifestement fondé (contenu illicite, arnaque) : le faire tout de suite,
  puis prévenir Valentin. Sinon, rapport à Valentin : jamais de retrait sur la seule foi d'un signalement.

## Fusion automatique (20/11/2026)
Une Pull Request du hub avec l'étiquette **`fusion-auto`** est fusionnée et publiée toute seule si elle ne touche que
des fichiers propres au Laboratoire : `data/labo/` (sauf notes de version, tutos, éco-scores, versions N-1, autorisations,
que .fr lit aussi), `data/apps-communaute.json`, `docs/`, `RULES_AND_MEMORY.md`, `.claude/agents|commands/`, `tests/`,
`labo/collectif|crash-testeur|createurs/`, `labo/serveur/feedback|collectif|capteur`, et les registres sans toucher
à une fiche « vitrine ». Le reste (dont `src/`, `packages/shell/`, `public/`, `serveur/`, `scripts/`, les workflows)
attend le « fusionne » de Valentin. Règle : `scripts/labo/fusion-auto.mjs` (lue dans `main`, jamais dans la PR) ;
workflow : `.github/workflows/fusion-auto.yml` (construction sans droits, fusion sans lancer le code de la PR, puis
relance de la publication).

