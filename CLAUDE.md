# ALPHABETTE — STANDARDS & RÈGLES ABSOLUES (HARMONISÉ)

## Architecture réelle du dépôt & Hébergement OVH Perso
- **Modèle multi-dépôts (`AGENTS.md` Règle 2)** : chaque application vit dans son propre dépôt GitHub (`azertylm/<repo>`). Le Hub référence les apps dans `data/apps-sources.json` et `data/apps-registry.json` (ne jamais copier le code source des 18 apps dans le dépôt du Hub).
- **Hébergement OVH Perso (statique + PHP)** : la production tourne sur OVH Perso sans serveur Node.js permanent. Tout backend dynamique (comptes, votes, abonnements, ledger, virements, modération) doit être écrit en **PHP léger autonome** (`api/*.php` ou `labo/serveur/*.php` avec stockage SQLite/JSON verrouillé dans `data/private/` protégé par `.htaccess`).
- **Briques existantes à étendre (NE JAMAIS RECODER DE ZÉRO)** :
  - **Double Barre & Shell** : `@alphabette/shell` (`packages/shell/`). Préserver impérativement `data-masquer="defilement"`, le mode zoom **BIG** (`var(--ab-zoom, 1)`), la compatibilité mobile 280px/360px et l'absence totale de pop-up/visite guidée au démarrage (`RULES_AND_MEMORY.md` Règle d'or 1).
  - **Voix unique** : `alphabetteAudio` (`packages/shell/src/audio/` — Piper « Siwis » / Gemini « Kore »). **Interdiction** d'utiliser `speechSynthesis` en direct.
- **Sanctuaires protégés (NE PAS TOUCHER)** :
  - Applis en pause : `Lidarsol`, `Osolar`, `ProxiLien`, `Info Perso`. (Orbit n'est plus en pause depuis le 27/11/2026 : ses défauts sur alphabette.eu se corrigent comme ceux des autres applis, décision de Valentin.)
  - Vitrine `.fr` figée (`vitrine.ref` dans `data/apps-sources.json` et `vitrine/`) : ne jamais modifier sans ordre explicite de Valentin.

## Règles Métier Non Négociables
- **Tarification unique** : **15,00 € / an** (`1500` centimes) par application sur `alphabette.fr` = **10,00 €** (`1000` c.) créateur + **5,00 €** (`500` c.) Alphabette. **Zéro Pass/bouquet à 40 €, zéro prorata.**
- **Calculs financiers** : 100 % en entiers (centimes), écritures atomiques et idempotentes.
- **Seuil virement créateur** : **20,00 €** (`2000` centimes) minimum.
- **Seuil `.eu` -> `.fr`** : **10 avis positifs vérifiés** avec ratio positif **≥ 75 %** (hors `flag_security_review`).
- **Validation des dépôts** : manuelle par défaut (`/admin/validations`, `requireManualValidation = true`).

## Règles d'exécution Claude Code (Économie de tokens)
- Exécute TOUT le lot demandé d'une seule traite **sans jamais demander de confirmation intermédiaire**.
- Ne lis jamais `node_modules/`, `dist/`, `.git/` ni `bun.lock`.
- Privilégie des scripts automatisés pour les opérations répétitives.
- Fais un commit Git propre à la fin du lot (sans toucher à `vitrine/` ni aux applis protégées).
- Termine chaque lot par : vérification build/tests (`bun run lint`, `bun run build`, tests) + résumé de **15 lignes maximum**.
