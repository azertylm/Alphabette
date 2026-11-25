# Checklist « prête pour alphabette.fr ? »

Une application passe de **alphabette.eu** (Laboratoire) à **alphabette.fr** (Vitrine) seulement si **toutes** les cases
sont cochées. La mise en ligne sur .fr reste **l'ordre explicite de Valentin** (`CLAUDE.md`, `RULES_AND_MEMORY.md` §1).
Cette liste sert à décider sur des faits, pas à l'impression.

> Ordre officiel d'un transfert : éligibilité → « oui » de Valentin → Conseil des Agents GO → Gardien → PR →
> fusion sur son ordre → Sentinelle → audit réseau (`RULES_AND_MEMORY.md` §2).

## 1. Seuils mesurés (bloquants)
- [ ] **≥ 10 avis positifs vérifiés** et **ratio positif ≥ 75 %** (hors avis `flag_security_review`) — règle de `CLAUDE.md`.
  *Le script `scripts/labo/graduation.mjs` est plus strict (note ≥ 4,5 / 5, ≥ 20 avis, 0 bug critique depuis 7 jours) : s'il
  propose le transfert, c'est que les deux règles sont tenues.*
- [ ] **0 point « bloquant »** dans le dernier rapport de l'Atelier (`alphabette.eu/atelier/`).
- [ ] **Contrôle technique ≥ 85 / 100**, avec Pouce, Opticien et Poids Plume ≥ 75 (badge « Testé au Labo »).
- [ ] **0 erreur JavaScript** à l'ouverture (rapport de l'Agent Chaos : `anomalies: []` sur 3 nuits d'affilée).
- [ ] Au moins **3 appareils réels différents** testés (voir `docs/ONBOARDING_BTS.md`, protocole mobile).

## 2. Démarrage sans friction
- [ ] L'appli s'ouvre **directement sur l'essentiel** : aucune fenêtre, visite guidée ni choix imposé (Règle d'or 1).
- [ ] Le sujet ou l'action principale est visible **sans défiler** à 360 px.
- [ ] Une action utile est possible **en moins de 30 secondes**, sans compte ni clé si l'appli peut s'en passer.
- [ ] Si une clé d'IA est nécessaire : l'encart « IA non configurée » explique en 3 étapes (Mistral, clé gratuite, copier-coller),
  et l'appli dit clairement **où reste la clé** (dans l'appareil, jamais envoyée à Alphabette).
- [ ] Sans clé, aucun faux contenu ni message technique : un texte clair propose quoi faire.

## 3. Mobile et accessibilité
- [ ] **Aucun débordement horizontal** à 280, 320, 360 et 390 px, en jour, en nuit et en mode **BIG** (très grande taille).
- [ ] La double barre **se masque en descendant et revient en remontant** (`data-masquer="defilement"`).
- [ ] Zones à toucher **≥ 44 px**, textes **≥ 14 px** pour le courant (jamais sous 12 px), contraste AA.
- [ ] Chaque bouton-icône a un `aria-label` ; chaque champ a une étiquette.
- [ ] Lecture à voix haute par `alphabetteAudio` uniquement (jamais `speechSynthesis` en direct).
- [ ] Fonctionne hors ligne si l'appli est installable (service worker en chemins `./`, voir `RULES_AND_MEMORY.md` §8).

## 4. Clarté du parcours
- [ ] Un inconnu comprend **ce que fait l'outil en 5 secondes** (titre + une phrase, sans jargon).
- [ ] Une personne de 70 ans, sans explication, réussit la tâche principale (test d'observation, voir fiche de test).
- [ ] Le bouton « Donner mon avis » fonctionne (3 touches) et le contact `contact@alphabette.fr` est visible.
- [ ] Prix cohérent : **15 €/an par application** (10 € créateur + 5 € Alphabette) ou « gratuite pour toujours ». **Aucun bouquet,
  aucun Pass à 40 €, aucun prorata**, nulle part (texte, modale, code).

## 5. Conformité et sécurité de base
- [ ] Liens **Mentions légales**, **Confidentialité** et **CGV** présents et sans `[À COMPLÉTER]`.
- [ ] Mention « réponses générées par une IA, vérifiez les informations importantes » près de toute réponse d'IA.
- [ ] **Aucune clé ni secret** dans le code publié ; clés utilisateur seulement en `localStorage`, jamais exportées.
- [ ] Audit réseau « Zéro fuite » **conforme** (services tiers déclarés ; polices hébergées en local de préférence).
- [ ] Avis du Conseil des Agents : **GO** (Produit / Sécurité / Simplicité) sur la version exacte ; veto Sécurité = blocage.
- [ ] Passe du Gardien Ergonomie & Sobriété sans régression.
- [ ] Un commit de repli (N-1) est enregistré dans `data/labo/releases.json` pour la Sentinelle.

## 6. Décision
- Toutes les cases cochées → préparer le paquet de transfert et le soumettre à Valentin (un « oui / non »).
- Une case bloquante ouverte → l'appli reste sur .eu, le bloquant devient un ticket (gabarit :
  `docs/modeles/FICHE_TEST_BUG.md`).
- Après la mise en ligne : surveiller 48 h (Sentinelle : retour automatique à N-1 si > 2 % de sessions en erreur fatale).
