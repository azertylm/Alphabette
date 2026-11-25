# Accueil du renfort BTS (début décembre 2026)

Objectif : que l'étudiant soit **utile en une semaine sur les tests et le suivi**, sans alourdir la charge du fondateur et
sans accès à ce qui engage l'écosystème. Lire d'abord `docs/CONTRIBUTING.md`.

## Matrice des rôles
| Sujet | Fondateur | Renfort BTS | Agents automatiques |
|---|---|---|---|
| Vision produit, direction artistique | **Décide** | Ne propose pas de refonte ; peut noter une idée | — |
| Nouvelles briques, architecture, prix | **Décide** | — | — |
| Promotion `.eu` → `.fr` | **Décide seul** | Prépare les preuves (fiches, comptes d'avis) | Graduation, Conseil, Gardien préparent le dossier |
| Tests sur mobile réel | Reçoit la synthèse | **Fait** (protocole ci-dessous) | Atelier de nuit (360 px, 44 px, WCAG, poids) |
| Qualification des bugs et retours | Tranche les P1 | **Trie** (gabarit `docs/modeles/FICHE_TEST_BUG.md`) | Triage des avis, Agent Chaos |
| Correction de petits défauts d'affichage (Niveau 1) | Informé | Peut proposer ; ne publie pas sans relecture | Agent Correcteur / `code-builder` |
| Accessibilité et lisibilité | Reçoit la synthèse | **Vérifie** à la main (grille ci-dessous) | Opticien, Pouce |
| Supports, démos, suivi des retours terrain | Choisit les cibles | **Prépare et tient** (cartes, grille, tableau) | — |
| Pages légales, prix, paiements, clés, DNS, OVH | **Seul** | Aucun accès | Veilleur, Concierge (surveillance) |
| Protégés : Lidarsol, Osolar, ProxiLien, Orbit, Info Perso, `vitrine/` | **Seul** | Ne touche pas | Ne touchent pas |

## Protocole de test mobile (30 min par appli)
1. Ouvrir l'appli **sur un vrai téléphone** (pas seulement un émulateur) : adresse `https://alphabette.eu/…`.
2. Noter l'appareil, le système, le navigateur, la largeur d'écran.
3. **Premier contact** : l'appli s'ouvre-t-elle directement sur l'essentiel ? Combien de secondes avant une action utile ?
4. **Double barre** : descendre (elle se cache), remonter (elle revient). Aucun bouton coupé.
5. **Modes** : nuit, puis **BIG** en grand et très grand : rien de coupé, menus lisibles.
6. **Tâche principale** : la mener à bout sans aide. Noter chaque hésitation.
7. **Voix** (🔊) : démarre, s'arrête. **Installation** sur l'écran d'accueil.
8. **Avis** : ⋯ → 💬 Donner mon avis → envoyer un vrai retour (message « Merci ! »).
9. Si l'appli utilise une IA : parcours de la clé (encart, collage, message si clé refusée).
10. Remplir **une fiche par problème** et une ligne dans le tableau de suivi.

## Grille d'accessibilité et de lisibilité
- Texte courant ≥ 16 px ; rien sous 12 px ; contraste lisible en plein soleil.
- Zones à toucher ≥ 44 px, espacées d'au moins 8 px.
- Chaque bouton-icône a un nom (lecteur d'écran) ; chaque champ a une étiquette.
- Pas de texte qui disparaît à la taille « très grande » ; pas de défilement horizontal.
- Aucun jargon (« BYOK », « token », « API ») sans phrase simple à côté.

## Qualifier un retour utilisateur
Pour chaque retour : appli · appareil · catégorie (Bug / Idée / Design / Autre) · priorité P1–P4 · « bloque / gêne / confort ».
Un retour qui demande une **nouveauté** est noté puis transmis au fondateur (c'est un Niveau 2). Une erreur d'un
fournisseur d'IA est un « Incident API Tiers » : ce n'est pas un bug de l'appli.

## Première semaine
| Jour | Contenu | Résultat attendu |
|---|---|---|
| 1 | Lire `CONTRIBUTING.md` et cette page ; ouvrir 3 applis sur son téléphone | Comprend la carte `.eu` / `.fr` |
| 2 | Faire le protocole sur **une** appli avec le fondateur | Première fiche remplie |
| 3 | Protocole seul sur 2 applis ; lire `alphabette.eu/atelier/` | 3 fiches triées P1–P4 |
| 4 | Vérification d'accessibilité (grille) ; essai du bouton « Donner mon avis » | Liste des écarts |
| 5 | Démo tenue seul auprès de 2 personnes ; tableau des retours à jour | Premier bilan d'une demi-page |

Ensuite : un point de 15 minutes par semaine avec le fondateur, **uniquement sur les P1/P2 et les décisions à prendre**.

## Accès conseillés
Lecture : dépôt du hub, rapports de l'Atelier, base d'avis. Écriture : branches de **documentation** et fiches de test.
Pas d'accès aux clés, à OVH, au DNS, aux paiements, ni à la branche de déploiement.
