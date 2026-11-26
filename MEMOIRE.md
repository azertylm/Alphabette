# MEMOIRE — état de la mission

## Objectif
Faire connaître Alphabette à toute la France et aux francophones, gratuitement (référencement, publicité sans budget, mise en avant sur Internet).

## Fait
- Skill `orchestrateur-alphabette` créé et testé (3 sous-agents Sonnet en parallèle, 26/11/2026).
- Correctif SEO .fr écrit (robots.txt, sitemap vitrine, noscript, JSON-LD, og:image = covers/Alphabette Hub.jpg 3,7 Mo ; build complet non testé, fonction testée à part).
- Skill `kit-lancement-gratuit` créé et comparé avec/sans sur Senior Bon Plan : avec = cibles sourcées, mentions « non vérifié », règle de confidentialité respectée (le test sans a cité La Grande-Motte). Premier kit : `docs/lancement/bonplansenior.md` (brouillon).
- Constat SEO .fr (avant correctif) : ni robots.txt ni sitemap.xml, accueil vide sans JS, pas de JSON-LD ni og:image (n'écrire le sitemap que pour les applis `actif`).
- Applis à pousser d'abord : Senior Bon Plan, Service France, Frigo-Placard (chiffres officiels à recontrôler avant communication).
- Canaux gratuits : 1) relais seniors (France Services, médiathèques, associations), 2) Product Hunt / Show HN / AlternativeTo, prudence Reddit et Facebook.

- Kits Service France et Frigo-Placard écrits (`docs/lancement/`) ; agents retirés : chef-de-projet, createur-app, migrateur-statique, inventeur-idees, documentaliste (27 restent : Laboratoire d'amélioration des applis intégralement conservé).

## Décisions
- Chef : Opus 5.5. Exécutants : Sonnet 5.5.
- Gmail et Google Agenda écartés (inutiles pour cette mission).
- Les 33 agents existants sont conservés tels quels ; 6 sont retenus pour la mission.

## Reste à faire
- Lancer `bun run build:static` en vrai pour valider le correctif SEO, puis déployer.
- Fournir une vraie image 1200x630 (og.png).
- Relire les kits avec `verificateur-honnetete`, vérifier les adresses, puis envoyer.
- Valentin à trancher : Frigo-Placard gratuite ou 15 €/an ? Gratuité de Service France à confirmer.
- Vérifier les adresses des 3 kits avant envoi ; produire les captures (`graphiste`).
