# Design Pop / Néon unifié (Lot 4)

Source unique : `packages/shell/src/pop/` (`pop.css`, `effets.ts`, `illustrations.ts`, `composants.tsx`).
Les pages HTML simples le reçoivent via `alphabette-barre.js`, qui charge `public/assets/alphabette-pop.css`
et `public/assets/alphabette-effets.js` (construits par `bun run build:pop`, inclus dans `bun run build`).

- **Univers** (`html[data-univers]`) : `labo` sur alphabette.eu (cyan / violet / magenta, micro-grille), `vitrine` sinon
  (corail / or / indigo). Thème jour « Pop Éditorial » / nuit « Néon Doux » via `data-ab-theme`.
- **Liseré de la barre** : couleur de `data-ab-categorie` (7 signatures : vie-pratique, education, jeux, creation,
  productivite, communaute, labo). Barre HTML : `data-categorie="Jeux"` sur la balise script ; React : `app.categorie`.
- **Cartes** : `.pop-carte` + `data-ab-3d` (tilt ±6° souris), `data-ab-vt="slug"` (View Transitions vers le titre de
  la barre), `data-ab-prefetch` (préchargement au survol). Squelettes : `<CarteSquelette />`.
- **Fiole X/10** : `positifs` de `api/feedback.php` (notes ≥ 4, hors `flag_security_review`).
- **Badges** `pionnier` / `eclair` / `projecteur` : champ `badges` posé à la main dans le registre ou
  `data/apps-communaute.json`. Jamais calculés ni inventés.
- **Confettis** (`celebrer`, `celebrerSiNouveau`, événement `alphabette:celebrer`) : seulement sur de vrais événements,
  une fois par appareil (éligibilité .fr, transfert, 1er abonné, trophées 10/50/100/500, paiement confirmé).
- **Écrans vides** : `aucun-resultat`, `zero-euro`, `404` (`public/404.html` + `ErrorDocument`), `erreur-reseau`.
- **Mode Calme** : `localStorage alphabette.calme = oui` → `html[data-calme]` + `body.calm-mode` (bouton en pied
  d'accueil). Avec le Mode simple et `prefers-reduced-motion`, il coupe toutes les animations, sans toucher aux
  couleurs, aux contrastes, au BIG ni à `data-masquer="defilement"`.
- Pages : `/soumettre/` (= Salle d'embarquement + Scanner Magique), `/createur/<pseudo>/` (Carte Collector).
