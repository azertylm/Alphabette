# Contribuer à Alphabette

Ce dépôt est le **hub** : il publie alphabette.eu (Laboratoire) et alphabette.fr (Vitrine) sur OVH Perso. Il **ne contient
aucune application métier** : chaque application vit dans son propre dépôt `azertylm/<nom>` (`AGENTS.md`, règle n° 2).
Lire d'abord `CLAUDE.md`, `AGENTS.md` et `RULES_AND_MEMORY.md`.

## Carte du dépôt
| Chemin | Rôle |
|---|---|
| `packages/shell/` | Base commune (`@alphabette/shell`) : double barre, voix, clés d'IA. **Partagée avec .fr.** |
| `public/assets/alphabette-barre.js` | Barre autonome des pages HTML. **Partagée avec .fr.** |
| `src/`, `server.ts`, `server/` | Accueil du hub et console `/admin` |
| `public/<page>/`, `labo/pages/` | Pages du hub côté Laboratoire |
| `serveur/php/`, `labo/serveur/` | API en PHP léger (OVH Perso : pas de serveur Node permanent) |
| `data/apps-registry.json`, `data/apps-sources.json` | Registre des applis et leur dépôt |
| `data/labo/` | Données du Laboratoire (décisions, maturité…) |
| `vitrine/` et `vitrine.ref` | **Vitrine .fr figée** : ne jamais toucher sans ordre de Valentin |
| `scripts/labo/`, `.github/workflows/` | Agents et publications automatiques |
| `docs/` | Documentation |

## Flux de publication
1. Corriger l'application dans **son** dépôt, branche `main` → visible seulement sur **alphabette.eu**.
2. Le workflow `deploy-ovh.yml` reconstruit et publie à chaque fusion sur `main` du hub.
3. **alphabette.fr** ne change que si `vitrine.ref` / `vitrine/` change : ordre explicite de Valentin.
4. Toujours **branche + Pull Request** sur le hub. Une PR qui ne touche que le Laboratoire peut porter l'étiquette
   `fusion-auto` (liste fermée : `scripts/labo/fusion-auto.mjs`). Tout le reste attend la fusion de Valentin.

## Règles à ne jamais enfreindre
- **Pas de bouquet, pas de Pass à 40 €, pas de prorata.** Prix unique : **15 €/an par appli** (10 € créateur + 5 € Alphabette).
  Calculs en **centimes entiers**. Seuil de virement créateur : 20 €.
- **Applis et domaines en pause** : Lidarsol, Osolar, ProxiLien (serveur), Orbit, Info Perso. On ne les modifie pas.
- **Voix unique** : jamais `speechSynthesis` en direct ; passer par `alphabetteAudio`.
- **Aucune fenêtre ni visite guidée au démarrage** ; la double barre se masque au défilement (`data-masquer="defilement"`).
- **Mobile d'abord** : tester à 360 px (et 280 px), en BIG, en jour et en nuit. Pas de débordement horizontal.
- **Jamais de clé ni de mot de passe** dans le code, un ticket ou un message. Les clés des visiteurs restent chez eux.
- **Pas de nouvelle dépendance lourde** ; le plus petit changement qui règle le problème.
- **Ne jamais modifier `src/shell/` d'une appli à la main** : la base se met à jour par `bun run sync:shell`.
- **Honnêteté** : aucun faux avis, faux vote, faux témoignage, fausse analyse.

## Avant de proposer un changement
```
bun install
bun run lint     # types
bun run build    # vitrine + serveur
bun run test     # tests de l'Atelier et du lot 6
```
Joindre une **capture à 390 px** pour tout changement visible (`AGENTS.md`, règle n° 7).

## Qui décide quoi
Voir la matrice dans `docs/ONBOARDING_BTS.md`. En résumé : le fondateur décide de la direction artistique, des nouvelles
briques, de l'architecture et de la promotion vers .fr ; le renfort teste, qualifie et documente ; les agents automatiques
contrôlent chaque nuit.

## Commits
Messages courts, au présent, en français : `Barre : zones tactiles à 44 px`. Un sujet par commit.
