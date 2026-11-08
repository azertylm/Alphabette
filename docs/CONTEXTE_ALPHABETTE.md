# Contexte Alphabette — à lire avant toute modification

## Qui / quoi
- **Alphabette** = entreprise et site principal de Valentin Richaud (Tintoon), développeur web indépendant, La Grande-Motte (34).
- Fil conducteur de l'écosystème : **rendre la vie des gens meilleure**.
- Depuis octobre 2026, toutes les applications sont recréées avec Claude et versionnées sur GitHub (compte `azertylm`).

## Rôle de alphabette.fr : le hub
alphabette.fr doit accueillir 5, 10, 50+ applications **sans jamais tout recoder** :
- `/apps/<slug>/` : chaque appli isolée dans son propre dossier.
- **Registre central unique** (`data/apps-registry.json`) : slug, nom, description, icône, statut (actif / brouillon / maintenance), badge (Nouveau / Populaire), date d'ajout, domaines.
- `/apps` liste les applis actives ; `/apps/<slug>` charge l'appli depuis le registre.
- Appli inactive → page « Bientôt disponible », **jamais de 404**.
- `/admin` protégé par la variable d'env `ADMIN_PASSWORD` (session/cookie) : liste, activer/masquer en 1 clic, compteur de visites par appli, ajout d'une appli.
- Accueil : section « Nos Applications » (statut actif) + lien discret vers /admin dans le footer.
- Première appli enregistrée : **Goat Chèvre the King** (`goat-chevre-the-king`).

## Charte commune à toutes les applis
- Page d'accueil commune à l'écosystème (refonte nov. 2026).
- **Double barre supérieure identique** sur toutes les applications.
- Bouton **« BIG »** pour régler la taille d'affichage (accessibilité).

## Applications phares et domaines
Phase 1 : tout est hébergé sur alphabette.fr (`/apps/<slug>`).
Phase 2 (bientôt) : **chaque appli aura son propre .fr et .eu**, qui pointeront vers la même appli.
→ Prévoir dès maintenant un champ `domains` dans le registre et un routage par nom d'hôte (le domaine dédié sert `/apps/<slug>` à la racine), sans dupliquer le code.

| Appli | Slug | Domaines à venir | Description |
|---|---|---|---|
| **Lidarsol** | `lidarsol` | lidarsol.fr (pris), lidarsol.eu | SaaS GreenTech pour développeurs d'énergies renouvelables : traitement de dalles LiDAR .LAZ, modélisation 3D, interface cartographique « Map-First », calcul financier (TRI, VAN, LCOE), agents IA. Logo : médaillon bleu nuit (satellite, rayons du soleil, panneaux solaires, faisceaux LiDAR). |
| **Proxilien** | `proxilien` | proxilien.fr (pris), proxilien.eu | Application de l'écosystème — périmètre à préciser. |
| **InfoPerso** | `infoperso` | infoperso.fr, infoperso.eu | Agrégateur d'actualités personnalisé (React/Vite/TS, dépôt `azertylm/Info-perso`) : flux RSS/OPML, recherche/filtres, Studio d'Approfondissement IA (10 outils : Creuser le sujet, Nuances & Perspectives, Frise chronologique, Avocat du Diable, Fiche exécutive, Citations clés, Quiz…), multi-moteurs (Claude, Gemini, OpenAI, Mistral, DeepSeek, Grok, YouTube), modes Standard / Grand Format / Flex, synthèse vocale, thèmes OLED/clair, export HTML/.txt. |
| **Orbit** | `orbit` | orbit.fr, orbit.eu | Site/app vidéo (React/Vite/TS + `server.ts`) : objectif lire toutes les vidéos possibles et simplifier l'accès aux API et autorisations de chaque plateforme. |

## Règles de travail
- Changements minimaux sur l'existant, pas de dépendance lourde.
- Ajouter une appli = créer `/apps/<slug>/` + une entrée dans le registre (voir `AJOUTER_UNE_APP.md`).
- Un commit clair par étape.
- Réponses directes et précises, sans clarification inutile.
