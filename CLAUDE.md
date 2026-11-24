# ALPHABETTE — STANDARDS & RÈGLES ABSOLUES

## Architecture & Souveraineté
- **Double domaine** : `alphabette.eu` (labo communautaire 100 % gratuit) et `alphabette.fr` (production monétisée).
- **Séparation stricte** :
  - Les **applications hébergées** (dans les iframes sandboxées) sont 100 % côté client, Zero-Knowledge, IA BYOK (Mistral prioritaire, clés chiffrées en local), zéro tracker tiers.
  - Le **Hub plateforme** gère uniquement le backend minimal : comptes, votes, abonnements, ledger financier, modération et reversements.
- **Langue** : français clair et humain partout (UI, erreurs, commentaires utiles).
- **Accessibilité** : mobile-first Android, WCAG AAA (contraste texte ≥ 4.5:1, icônes ≥ 3:1, cibles ≥ 44×44 px, focus clavier visible, `prefers-reduced-motion`, dictée/lecture vocale Web Speech API).

## Règles Métier Non Négociables
- **Modèle économique unique** : abonnement **15,00 €/an** (`1500` c.) par application sur `.fr` = **10,00 €** (`1000` c.) créateur + **5,00 €** (`500` c.) Alphabette. **Zéro bouquet 40 €, zéro prorata.**
- **Calculs financiers** : 100 % entiers en centimes, jamais de flottants, écritures atomiques et idempotentes dans `LedgerEntry`.
- **Seuil virement créateur** : **20,00 €** (`2000` c.) minimum.
- **Seuil `.eu` -> `.fr`** : **10 avis positifs** avec ratio positif **≥ 75 %** (hors `flag_security_review`).
- **Validation des dépôts** : manuelle par défaut (`/admin/validations`, `requireManualValidation = true`), aucune bascule auto par date.
- **Double Barre permanente** (dans le parent, isolée des iframes) : `alphabette.fr`, `alphabette.eu`, `Toutes les applis`, `New`, `Mode nuit`, `Lecture à haute voix`, `Menu 3 points`, `Abonnement 15 €/an`.

## Règles d'exécution Claude Code (Économie de tokens)
- Exécute TOUT le lot demandé d'une seule traite **sans jamais demander de confirmation intermédiaire**.
- Ne lis jamais `node_modules/`, `dist/`, `.git/` ni le code interne complet des apps déjà importées sauf fichier précis nécessaire.
- Privilégie des scripts Node/Bash pour les tâches répétitives multi-fichiers.
- Ne fais **aucun `git commit`, aucun `git push`, aucun déploiement**.
- Termine chaque lot par : exécution des tests/build + un résumé concis de **15 lignes maximum** (fichiers modifiés, statut tests, points d'attention).
