# Fiche de test / ticket — modèle

Une fiche par problème. Courte, factuelle, sans jugement. Copier ce modèle dans un ticket GitHub ou un message.

```
Titre (une phrase)  : ______________________________________
Date / testeur      : ____ / ____
Appli concernée     : ______  (adresse : https://alphabette.eu/…)
Appareil            : modèle ______  · système ______ · navigateur ______
Écran               : ____ px de large (ou « petit / moyen / tablette »)
Mode                : ☐ jour  ☐ nuit  ☐ BIG normal  ☐ BIG grand  ☐ BIG très grand

Étapes pour reproduire
 1. ______
 2. ______
 3. ______
Résultat attendu    : ______
Résultat observé    : ______
Capture d'écran     : ☐ jointe  ☐ non

Impact UX            : ☐ bloque la tâche  ☐ gêne  ☐ confort
Impact accessibilité : ☐ aucun  ☐ texte trop petit  ☐ zone trop petite  ☐ contraste  ☐ lecteur d'écran  ☐ voix
Qui est touché       : ☐ tout le monde  ☐ seniors  ☐ un appareil précis  ☐ une seule personne
Fréquence            : ☐ à chaque fois  ☐ parfois  ☐ une fois

Priorité (voir grille)  : ☐ P1  ☐ P2  ☐ P3  ☐ P4
Catégorie               : ☐ Bug  ☐ Idée  ☐ Design  ☐ Autre
Incident d'un fournisseur d'IA (429 / 401 / 5xx) ? ☐ oui → noter « Incident API Tiers », pas un bug
```

## Grille de priorité
| Priorité | Quand | Délai visé |
|---|---|---|
| **P1** | Appli inutilisable, perte de données, fuite d'information, contenu illicite | Le jour même — prévenir le fondateur |
| **P2** | Tâche principale bloquée pour un type d'appareil ou de public (ex. senior en BIG) | 48 h |
| **P3** | Gêne réelle mais contournable (texte coupé, bouton difficile à toucher) | Dans la semaine |
| **P4** | Confort, idée, finition | À trier au prochain bilan |

## Règles de rédaction
- Un fait par ligne ; pas de nom ni de numéro de personne ; jamais de clé d'API collée dans un ticket.
- Un problème qui touche **la barre commune** (`public/assets/alphabette-barre.js`, `packages/shell/`) est
  signalé au fondateur : il touche aussi alphabette.fr.
- Une demande de nouveauté (Niveau 2) n'est jamais « corrigée » seule : elle est notée et transmise.
