# Octet — voix éditoriale et règles d'usage

Octet est la petite souris exploratrice d'Alphabette. Elle aide à comprendre, découvrir et utiliser le projet ; elle ne cherche pas l'attention.

## Où elle apparaît (première livraison)
Uniquement dans le Laboratoire d'Octet (alphabette.eu, `src/labo/BoiteIdees.tsx`) : accueil, bouton d'aide « Besoin d'un coup de patte ? », conseils près des champs, retour après envoi, listes vides, encart « À découvrir » (seulement s'il existe un vrai prototype testable), icône dans la barre commune.
Pas encore : pages de alphabette.fr, cartes d'applications, pages légales. Pour étendre : ajouter une entrée dans `src/octet/messages.ts` et afficher `<OctetMessage message={MESSAGES.xxx} />` à un seul endroit de la page.

## Ton
- Phrases courtes, concrètes, utiles. Même politesse que le site (vouvoiement).
- Chaleureuse sans flatterie, un peu malicieuse rarement, jamais enfantine.
- Distinguer proposition, décision d'Alphabette, résultat automatique et information incertaine.
- Ne pas dire qu'Octet a lu, vérifié, choisi ou transmis quelque chose si le logiciel ne l'a pas fait.
- Confirmer un enregistrement seulement si le serveur l'a confirmé.
- Jamais : « Bravo, génie ! », « votre idée sera développée », « tout est parfaitement sécurisé », « Octet se souvient de vous / vous surveille ».
- Ne promettre ni développement, ni publication, ni location : un soutien aide à prioriser, une publication sur alphabette.fr demande examen et accord explicite du créateur.

## Illustration
- Illustrations d'origine dans `public/assets/octet/` (arrosoir, loupe, sablier, fiole, clé, icône). Ne pas redessiner, déformer, recadrer ni remplacer par un émoji.
- Image fixe, `alt=""` (décorative : le sens est dans le texte voisin), ratio conservé, `loading="lazy"`. Si elle ne charge pas, le message reste complet.
- Une seule illustration par bloc ; pas dans chaque carte d'une liste.

## Composants
- `OctetMessage` (variantes `welcome`, `tip`, `empty`, `success`, `help`) : texte explicite, illustration facultative, bouton « Masquer ce message » facultatif. `live` seulement pour un résultat d'action.
- `OctetHelp` : bouton + dialogue modal (Échap, focus piégé et rendu au bouton, questions repliables). Réponses statiques, pas de chatbot ; hors réponse connue, renvoi vers `contact@alphabette.fr`.
- Textes dans `src/octet/messages.ts` (texte brut, jamais de contenu communautaire injecté comme HTML).

## Confort, rythme, confidentialité
- Aucune animation (images fixes ; `prefers-reduced-motion` et Mode calme respectés ; transitions nulles).
- Aucun message automatique bloquant, aucun focus volé, aucun son ni lecture automatique.
- Tailles en `rem` : BIG agrandit sans couper le texte (pas de hauteur fixe). Couleurs via les variables du thème jour/nuit.
- Aucun stockage, cookie, traqueur ni appel tiers pour Octet. Le masquage de « À découvrir » est un simple état de page (revient au rechargement).
- Si le service est indisponible, le message d'erreur reste factuel : Octet ne maquille jamais une erreur.
