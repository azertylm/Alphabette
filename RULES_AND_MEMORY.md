# RULES_AND_MEMORY.md — mémoire permanente du Laboratoire Alphabette

À lire **en entier** par chaque agent du laboratoire avant toute action
(`triage-analyst`, `code-builder`, `qa-verifier`, `maturity-curator`, `meta-improver`).
Seul `meta-improver` ajoute des règles (section 8). Mode d'emploi : `docs/LABO-EU.md`.

## 1. Deux sites, un seul dépôt de publication
- **alphabette.eu — le Laboratoire** : toutes les applications, branche `main` de chaque dépôt,
  avec sous chaque carte le module d'avis. Les agents **peuvent** y modifier le code (règles ci-dessous).
- **alphabette.fr — la Vitrine** : uniquement les applications `"vitrine": true` du registre
  (aujourd'hui Wikicom, Info Perso, France Service, IA Débat), **figées** : `vitrine.ref` (commit exact)
  dans `data/apps-sources.json`, et `vitrine/<page>/` pour les pages du hub.
  **Sanctuarisé : aucun agent ne change `vitrine`, `vitrine.ref`, `vitrine/` ni un statut `vitrine`
  sans l'ordre explicite de Valentin.** Pousser sur `main` d'une appli ne touche donc jamais .fr.
- Les autres adresses .fr d'une appli du laboratoire renvoient (302) vers alphabette.eu : jamais de 404.

## 2. Ce que les agents peuvent faire seuls, et jamais
Seuls (Niveau 1, après accord de `qa-verifier`) :
- corriger dans le dépôt d'une appli (branche `main`) un bug d'affichage, une erreur JS identifiée,
  un petit réglage d'interface (taille, contraste, espacement, libellé, débordement mobile) ;
- modifier une page du hub côté laboratoire (`public/<page>/`), jamais sa copie `vitrine/` ;
- écrire `data/labo/*.json` (décisions, évolutions, maturité, audits).

Jamais sans autorisation écrite de Valentin (`data/labo/autorisations.json`) — **Niveau 2** :
- nouvelle fonctionnalité, refonte, changement de logique métier, de textes de fond, de prix ;
- tout ce qui touche le hub lui-même (`src/`, `server/`, `scripts/`, `packages/shell/`, `labo/serveur/`, workflows) ;
- toute suppression de données, tout changement DNS / OVH / Firebase / clés.
Jamais du tout : saisir un mot de passe ou une clé à la place de Valentin ; inventer un avis, un vote,
une évolution, un score ; transférer une appli vers .fr.

## 3. Le relais strict
1. `triage-analyst` lit les avis (`labo-donnees:feedbacks.json`, via `scripts/labo/etat.mjs`), rejette
   le spam et le hors-sujet, classe Niveau 1 / Niveau 2, écrit `data/labo/decisions.json`.
2. `code-builder` applique les Niveau 1 (au plus **3 corrections par passage**) ou, après autorisation,
   crée la bêta d'un Niveau 2 (branche `labo-beta` du dépôt de l'appli + `"beta"` dans `apps-sources.json`).
3. `qa-verifier` audite le diff : **veto** possible (retour à `code-builder`, 2 allers-retours au plus,
   ensuite `needs_human_review`). Rien n'est poussé sans son « OK ».
4. `maturity-curator` passe l'avis en `implemented`, écrit le message public, met à jour
   `changelog_summary.json`, lance `scripts/labo/maturite.mjs`, alerte Valentin à 85/100.
5. `meta-improver` tire les leçons (vetos, refus de Valentin, bugs récurrents) et complète la section 8.

## 4. Niveau 1 ou Niveau 2 ?
- Niveau 1 : on peut décrire la correction en une phrase, elle tient dans un petit diff, elle ne change
  ni ce que fait l'appli ni ce qu'elle affirme. En cas de doute : Niveau 2.
- Niveau 2 : rapport à Valentin — **Résumé · Mon avis critique · Solution technique · Demande d'autorisation**
  (une phrase oui/non). Les demandes à plus de 5 « +1 » partent en **Priorité Haute**.
- À rejeter (`rejected`, raison courte) : spam, insulte, hors-sujet, doublon, demande qui alourdirait
  l'appli ou la rendrait moins honnête / moins sûre, demande impossible en hébergement statique.

## 5. Où sont les choses
| Quoi | Où |
|---|---|
| Avis bruts (lecture seule) | branche `labo-donnees`, `feedbacks.json` (toutes les 3 h, `labo-avis.yml`) |
| Décisions des agents | `data/labo/decisions.json` (clé = id `fb_…`) |
| Autorisations de Valentin | `data/labo/autorisations.json` |
| Badge « Dernière évolution IA » | `data/labo/changelog_summary.json` (clé = id du registre) |
| Score de maturité | `data/labo/maturity_index.json` (calculé, ne pas écrire à la main) |
| Audits qualité (sur 30) | `data/labo/audits.json` |
| Bêtas publiées | `data/labo/beta.json` + `"beta": {"branch": "labo-beta"}` dans `apps-sources.json` |
| Appli ↔ dépôt | `data/apps-sources.json` ; id d'appli = `id` de `data/apps-registry.json` |
Ces fichiers sont publiés sur alphabette.eu à chaque publication du hub (push sur `main`).

## 6. Règles permanentes d'Alphabette (héritées)
- Honnêteté : aucun faux auteur, faux vote, faux témoignage, fausse alerte, fausse analyse, faux paiement.
- Sécurité : vérifier par une recherche les numéros d'urgence, conseils santé / argent / droit, chiffres officiels.
- Hébergement statique (OVH Perso) : pas de serveur Node ; IA avec la clé du visiteur ; sans clé, message clair.
- Téléphone d'abord : vérifier à 390 px (et < 400 px), BIG, jour / nuit, aucune erreur console.
- Ne jamais modifier `src/shell/` d'une appli à la main (base commune : `bun run sync:shell` depuis le hub).
- Clés et jetons : jamais dans le code publié, jamais dans un avis ou un export.
- Applis en pause (ne pas toucher) : Lidarsol, Osolar, serveur ProxiLien, domaines Orbit et Info Perso.
- Valentin n'est pas développeur : rapports courts, en français simple, une seule question à la fois.

## 7. Préférences connues de Valentin (ergonomie)
- Pas de fenêtres ou d'options imposées au démarrage : on arrive directement sur l'essentiel.
- Libérer l'écran : les barres du haut se masquent quand on fait défiler.
- Mettre en avant l'essentiel (le sujet, le bouton principal), réduire le secondaire (badges discrets).
- Menus lisibles en mode BIG (contraste, taille, rien de coupé).
- Accueil : deux colonnes de tuiles sur téléphone (vitrine).

## 8. Règles apprises (tenues par meta-improver)
Format : `- AAAA-MM-JJ — règle (origine : avis fb_…, veto QA, décision de Valentin)`. Une règle
nouvelle remplace une ancienne contradictoire (barrer l'ancienne). Garder cette section sous 60 lignes.

- 2026-11-18 — Une évolution n'est annoncée sur le badge public qu'une fois en ligne et vérifiée (origine : mise en place du laboratoire).
