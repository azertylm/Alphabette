# Plan terrain — 15 jours (26 novembre → 10 décembre 2026)

But : mettre quelques applis entre les mains de vraies personnes **autour de toi**, noter ce qui bloque, corriger vite sur
alphabette.eu. **Pas de communication nationale** et pas de promotion vers .fr avant les seuils de
`docs/CHECKLIST_EU_VERS_FR.md`. Tout ce qui suit est un **conseil**, à prendre ou à laisser.

## Applis à montrer (peu, bien choisies)
| Public | Appli conseillée | Pourquoi |
|---|---|---|
| Seniors, résidences, CCAS | Senior Bon Plan, Mémo-Méninges | Gratuites, simples, grand texte (BIG) |
| Quotidien, familles | Bon Plan, Frigo-Placard, Quiz en famille | Utiles tout de suite, sans clé |
| Créatifs, associations | L'Œil de l'Atelier, Prompt Magic, IA Débat | Montrent l'IA avec « votre clé, chez vous » |
| Curieux | Gens extraordinaires, Où c'est en France ? | Se comprennent en 5 secondes |

Ne pas présenter en démo : Lidarsol, Osolar, ProxiLien (en pause), Orbit et Info Perso (domaines en pause).

## Calendrier
| Jours | Lieu | Relais | Angle d'approche |
|---|---|---|---|
| J1–J3 (26–28/11) | La Grande-Motte | Entourage proche, voisins, commerçants | « Essayez 2 minutes, dites-moi ce qui coince » |
| J4–J6 (29/11–01/12) | La Grande-Motte | CCAS / résidence senior / médiathèque | Démo sur tablette, **grand texte (BIG)** ; kit seniors (`pages-fr/kit-seniors.html`) |
| J7–J9 (02–04/12) | Montpellier | Tiers-lieux, associations, école d'art | Créatifs : IA française, clé personnelle, vie privée |
| J10–J12 (05–07/12) | Le Nord (Roncq et alentours) | Famille, anciens contacts, associations locales | Bouche à oreille ; envoi du lien par message |
| J13–J15 (08–10/12) | Tous | Bilan | Compter, trier, corriger, décider `.eu` / `.fr` |

À partir de début décembre, l'étudiant BTS peut tenir les démos et la grille de retours (`docs/ONBOARDING_BTS.md`).

## Comment recueillir les retours (le moins lourd possible)
1. **Sur téléphone** : barre du haut → **⋯ → 💬 Donner mon avis**. Trois touches (*Ça m'a bloqué / Ça m'a été utile / J'ai une
   idée*), pas de compte, pas d'e-mail. Les retours arrivent dans la base d'avis d'alphabette.eu.
2. **En démonstration** : laisser la personne faire seule ; noter sur la fiche `docs/modeles/FICHE_TEST_BUG.md` (appareil,
   appli, là où elle hésite). Ne pas aider avant 20 secondes d'hésitation.
3. **Cartes à QR code** : `alphabette.eu/labo/pages/kit-terrain.html` (cartes et flyers à imprimer, QR généré sur place).
4. **Contact** : `contact@alphabette.fr` pour qui préfère écrire.

## Critères d'ajustement rapide
- **≥ 3 personnes bloquées au même endroit** → correction sur .eu sous 48 h (Niveau 1), sans attendre la nuit.
- **Une personne ne comprend pas ce que fait l'appli en 10 s** → reformuler le titre / la phrase d'accueil.
- **Une clé d'IA fait abandonner** → revoir l'encart « IA non configurée » avant d'ajouter une explication.
- **Erreur d'un fournisseur d'IA (429, 401…)** → c'est un « Incident API Tiers », pas un bug de l'appli.
- **Retour de sécurité ou de vie privée** → traité en premier, quelle que soit l'appli.

## Décision `.eu` → `.fr` (jour 15)
Une appli devient candidate seulement si elle a **≥ 10 avis positifs vérifiés, ratio ≥ 75 %**, 0 bloquant à l'Atelier et
coche tout `docs/CHECKLIST_EU_VERS_FR.md`. Sinon : elle reste sur .eu, on corrige, on recommence. Rien n'est promu
sans ton « oui ».

## À tester en priorité sur mobile réel lors des démos
1. Ouverture directe, sans fenêtre d'accueil.
2. Double barre : elle se cache en descendant, revient en remontant ; aucun bouton coupé à 360 px.
3. Mode **BIG** et mode nuit : menus lisibles, rien hors de l'écran.
4. **⋯ → Donner mon avis** : l'envoi aboutit (message « Merci ! »).
5. Lecture à voix haute (🔊) : démarre et s'arrête.
6. Parcours clé d'IA : encart clair, clé collée, message d'erreur lisible si la clé est refusée.
7. Installation sur l'écran d'accueil (iPhone et Android).
