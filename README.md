# Alphabette — Écosystème d'applications web souveraines

**Alphabette** réunit un écosystème d'applications pratiques, ludiques et accessibles réparties sur deux espaces complémentaires :

- **`alphabette.eu` (Le Laboratoire)** : espace communautaire **100 % gratuit** pour tester les nouveautés, voter, signaler des bugs et co-construire les évolutions.
- **`alphabette.fr` (La Vitrine)** : applications stabilisées validées par la communauté (≥ 10 avis positifs avec ratio ≥ 75 %), proposées en abonnement unitaire transparent à **15,00 €/an** (**10 €** pour le créateur, **5 €** pour Alphabette — aucun bouquet imposé).

## Principes fondamentaux
- **Zero-Knowledge côté applications** : les données personnelles créées dans les apps restent stockées localement sur l'appareil de l'utilisateur (`localStorage` / `IndexedDB`) avec export/import `.json` chiffré.
- **IA BYOK (Bring Your Own Key)** : priorité à Mistral AI (compatible OpenAI/Gemini), clés stockées et chiffrées côté navigateur.
- **Accessibilité WCAG AAA & Mobile-First** : contrastes élevés, cibles tactiles ≥ 44×44 px, mode nuit, mode calme, lecture et dictée vocale (Web Speech API).
- **Zéro pistage** : aucun cookie publicitaire ni script d'analyse tiers intrusif.

## Structure du dépôt
- `src/` & `public/` : application Vite / TypeScript et ressources statiques (dont pages légales).
- `labo/` & `vitrine/` / `pages-fr/` : interfaces dédiées aux univers `.eu` et `.fr`.
- `server/` : API backend minimale (comptes, votes, abonnements 15 €, reversements).
- `data/` : catalogues et données structurées (dont `apps-catalog.json`).
- `scripts/` : outils d'automatisation et d'import des applications.
- `tests/` : tests unitaires, d'intégration et de recette E2E.
- `prompts/` : prompts système versionnés pour les fonctionnalités IA.

## Démarrage local

```bash
bun install
cp .env.example .env
bun run dev
