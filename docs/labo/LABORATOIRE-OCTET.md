# Laboratoire d'Octet (alphabette.eu)

La boîte à idées « Quelle prochaine appli ? » est devenue un parcours : proposer, discuter, soutenir, tester et noter, suivre l'avancement.
Même ancre `#idees`, même service `api/collectif.php` : les anciennes idées et leurs votes sont conservés (ancien format toujours accepté).
Octet (la souris) vit dans `public/assets/octet/`, utilisé en décor (alt vide) : en-tête, chargement, liste vide, recherche vide.

## Où est quoi
| Sujet | Fichier |
|---|---|
| Page (section de l'accueil .eu) | `src/labo/BoiteIdees.tsx`, styles `.octet*` dans `src/index.css` |
| Client | `src/labo/collectif.ts` |
| Service | `labo/serveur/collectif.php` (publié en `api/collectif.php`) |
| Lien dans la barre | `public/assets/alphabette-barre.js` (pages HTML) et `packages/shell/src/EcosystemBar.tsx` (React) : 🐭 « Laboratoire », depuis .fr → `https://alphabette.eu/#idees` |
| Modération | `labo/pages/admin-idees.html` → `alphabette.eu/admin-idees.html` (noindex) |
| Conditions de location | `data/labo/conditions-location.json` (`validees: false` par défaut) |
| Tests | `bun run test:laboratoire` (inclus dans `bun run test`) |

## Routes (POST JSON, GET)
- `GET ?idees=1` liste · `GET ?idee=<id>` détail (commentaires, avis, historique) ou `{fusion_vers}`.
- `idee` (nouveau formulaire : `titre` 5-80, `probleme`, `phrase` = solution, `public_cible?`, `categorie?`, `pseudo?`, `jeton`).
- `voter_idee` / `retirer_vote_idee` (`id`, `jeton`) · `commenter` · `signaler_contenu` · `noter_prototype`.
- `admin_*` : `liste`, `statut`, `accord`, `revue`, `prototype`, `masquer`, `fermer`, `fusionner`, `signalement`.

## Soutiens (votes) et limites
Un jeton aléatoire par appareil (navigateur) ; le serveur ne garde que son empreinte salée (HMAC), jamais l'adresse IP. Un soutien par idée et par appareil, retirable.
Limites : vider le navigateur permet de soutenir à nouveau ; plafonds par connexion et par jour (5 soutiens par idée, 60 au total) ; fusion de doublons : une personne ayant soutenu les deux peut compter deux fois.
Un soutien n'est ni une note ni une promesse. Les notes (1 à 5) n'existent que pour un **prototype rendu testable** par l'équipe, après « J'ai réellement essayé » ; « Pas encore noté » s'affiche tant qu'il n'y a aucun avis.

## Étapes et garde-fous alphabette.fr
Nouvelle idée → En discussion → À explorer → Prototype en cours → En test sur .eu → Candidate pour .fr → Disponible sur .fr (+ En pause, Refusée, Archivée).
Seule l'administration (secret serveur) change une étape. « Candidate » exige un prototype associé (application du registre, jamais une adresse libre).
**« Disponible sur .fr » est refusé** tant que manquent : l'accord explicite du créateur, la revue éditoriale et technique, **et** les conditions de location validées (`conditions-location.json`). Aucun vote ne déclenche quoi que ce soit.
Hors périmètre : prix, paiements, abonnements, partage des revenus (inchangés). Les conditions juridiques et commerciales (licence, rémunération, durée, maintenance, retrait) restent **à définir par Valentin** ; rien n'est inventé ici.

## Mise en service (étapes manuelles)
1. Définir le secret d'administration : variable `ALPHABETTE_LABO_ADMIN_TOKEN` (≥ 24 caractères) **ou**, sur OVH Perso, un fichier `admin-token.txt` (même contenu) dans `~/alphabette-labo-donnees/collectif/`.
2. Aucune migration : les nouveaux fichiers (`lab-*.json`) se créent seuls, à côté de `idees.json`. Anciennes idées sans étape = « Nouvelle idée ».
3. Déployer par le `build:static` habituel (publie `admin-idees.html`, `api/labo/conditions-location.json`, les images d'Octet).

## Octet dans toutes les applications (présentes et futures)
L'icône d'Octet (`public/assets/octet/octet-icone.webp`) est dans la barre commune : `alphabette-barre.js` (pages HTML, se met à jour toute seule au prochain déploiement du hub), `@alphabette/shell` (applications React : `bun run sync:shell <dépôt>` pour propager la nouvelle version, et toute nouvelle appli créée par `bun run new:app` l'a d'office) et `labo/createurs/cadre.html` (applications de la communauté). Ne jamais recoder cette icône dans une application : elle vient de la base commune.
