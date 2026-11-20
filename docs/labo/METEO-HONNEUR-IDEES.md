# Météo du Labo, Avant / Après, Tableau d'Honneur, boîte à idées (alphabette.eu)

Ajoutés le 20 novembre 2026 à la demande de Valentin. **alphabette.eu seulement** : tout est derrière `MODE_LABO`,
alphabette.fr ne change pas. Aucun compte, aucune dépendance, aucune police distante, aucun traceur.

## Ce que voit le visiteur
| Élément | Où | Données |
|---|---|---|
| **La Météo du Labo** (bandeau du haut) | `src/labo/MeteoLabo.tsx` | compte à rebours jusqu'à 21 h 13 (heure de Paris, été/hiver gérés : `prochainPassage()` de `labo.ts`) · avis en file d'attente (`api/feedback.php`, champ `file_attente`, en direct) · Sentinelle (`api/labo/status-labo.json`) |
| **↔ Avant / Après** (carte d'une appli) | `src/labo/AvantApres.tsx` | `api/labo/changelog-labo.json` ; bouton absent si l'appli n'a pas d'entrée |
| **Pseudo** (formulaire d'avis, facultatif) | `src/labo/LaboAvis.tsx` | envoyé avec l'avis (`pseudo`), validé par `feedback.php` (2-24 caractères, ni e-mail, ni adresse, ni 5 chiffres d'affilée) |
| **🏆 Tableau d'Honneur** (`#tableau-honneur`) | `src/labo/TableauHonneur.tsx` | `api/labo/tableau-honneur.json`, mois en cours seulement |
| **💡 Quelle prochaine appli ?** (`#idees`) | `src/labo/BoiteIdees.tsx` | `api/collectif.php` (`?idees=1`, actions `idee` et `voter_idee`), modération `api/labo/idees-statuts.json` |

Le « ciel » de la Météo vient des vraies données : ⛈️ Orage = retour arrière de la Sentinelle ces 24 h ;
⛅ Nuageux = plus de 10 avis en attente ; ☀️ Ciel dégagé sinon. Donnée absente = « — », jamais un chiffre inventé.

## Fichiers tenus par les agents de 21 h 13 (dans `data/labo/`, publiés dans `eu/api/labo/`)
### `status-labo.json`
```json
{ "passage_quotidien": { "heure": "21:13", "fuseau": "Europe/Paris" },
  "dernier_passage": { "date": "2026-11-20T20:13:00Z", "avis_lus": 12, "corrections": 3, "rejets": 4 },
  "sentinelle": { "retours_arriere_total": 0, "interventions": [ { "date": "…", "app_id": "iadebat", "retour_arriere": true } ] } }
```
- Fin de passage : `node scripts/labo/meteo.mjs passage --avis-lus N --corrections N --rejets N` (chiffres réels du passage ; un chiffre omis = `null`, non affiché).
- `sentinelle` : jamais à la main. Recalculé depuis `data/labo/incidents.json` par ce script **et** à chaque publication (`build-static.mjs`).

### `changelog-labo.json`
```json
{ "apps": { "<id du registre>": { "passage": "<ISO>", "changements": [
  { "probleme": "Ce qui gênait, en mots simples.", "amelioration": "Ce qui a été fait.", "origine": "avis|controle|atelier|chaos", "avis": ["fb_…"] } ] } } }
```
Dernier passage seulement (le suivant remplace l'entrée), 5 changements au plus, seulement ce qui est **réellement en ligne**.

### `tableau-honneur.json`
```json
{ "contributions": [ { "pseudo": "Mouette34", "app_id": "iadebat", "avis_id": "fb_…", "date": "<ISO>" } ], "retraits": [] }
```
- Rempli par `node scripts/labo/tableau-honneur.mjs /tmp/feedbacks.json` : avis `implemented` (decisions.json) qui portent un pseudo.
  Jamais de ligne à la main. Garde le mois en cours et le précédent.
- Titres calculés par le site : 1-2 retours « Œil de lynx », 3-4 « Voix du labo », 5 et plus « Dompteur de bugs ».
- Retrait demandé : supprimer ses lignes et ajouter le pseudo à `retraits` (il ne sera plus jamais ajouté).

### `idees-statuts.json`
```json
{ "statuts": { "idee_1763…_ab12": "masquee" } }
```
`masquee` (spam, hors sujet, blessant, donnée personnelle) · `retenue` (« Retenue par le Labo ») · `realisee` (« ✓ Réalisée »).
Lire les nouvelles idées : `curl -s https://alphabette.eu/api/collectif.php?idees=1`.

## Boîte à idées : garde-fous
- Titre 3-60 caractères, phrase 10-160 ; refusés : liens, e-mails, numéros, caractères répétés, tout en majuscules, quelques mots grossiers ou publicitaires ; doublon de titre → « votez pour elle ».
- 1 vote par idée et par appareil (`localStorage` `alphabette_idees_votees`). Côté serveur, par empreinte salée du jour (IP jamais écrite) : 3 idées, 60 votes, et 5 votes au plus pour une même idée (une box ou un réseau mobile partagé peut servir à plusieurs personnes) ; 1 000 idées au plus.
- Données hors du site : `~/alphabette-labo-donnees/collectif/idees.json`.

## Pages légales (alphabette.eu seulement)
CGV article 10 « Contributions gratuites des visiteurs », deux lignes du tableau de confidentialité, durées de conservation, stockage local : `src/legal/contenu.tsx` (blocs `MODE_LABO`).
