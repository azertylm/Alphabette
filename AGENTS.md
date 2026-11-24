# AGENTS.md — règles de l'écosystème ALPHABETTE

Ce fichier est destiné à **toute IA** (ou tout développeur) qui travaille sur ce
dépôt ou sur une application de l'écosystème. Il décrit les règles à respecter
**avant d'écrire du code**.

## Règle nº 1 — Toute application part de la base commune

> **Toute nouvelle application DOIT partir de `@alphabette/shell` via
> `bun run new:app`. Ne jamais recoder les barres du haut à la main.**

La base fournit, pour chaque application :

```
[Barre 1 — écosystème]  ◉ ALPHABETTE · ♥ DON · 5 sites · 3/16 (7 essai) ·⭐ Abonnement 15 €/an → paiement
[Barre 2 — application] ☰ Nom App + sous-titre · ♥ DON · Mon Compte · BIG · Clé API · Plein Écran · ☀ Jour
```

Créer une application :

```powershell
bun run new:app <slug> "Nom" "Sous-titre" [--accent "#hex"] [--dir <chemin>]
```

Le générateur produit un dépôt autonome où le `<AppShell>` est **déjà câblé**.

## Règle nº 2 — Une application = un dépôt, un sous-domaine

- Chaque application vit dans **son propre dépôt GitHub** et sur **son propre
  sous-domaine** (`<subdomain>.alphabette.fr`).
- Ce dépôt-ci est uniquement **le hub / la vitrine** (`alphabette.fr`) : il ne
  contient aucune application métier.
- L'identité se règle **uniquement** dans `src/alphabette.app.ts` de
  l'application. Ne pas dupliquer la logique des barres.

## Règle nº 3 — La palette s'adapte à la couleur du site

Toute couleur d'interface dérive de `app.accent` (la couleur d'identité du site)
via les variables CSS `--ab-*` de la base. Ne pas coder de couleurs en dur dans
une application.

## Règle nº 4 — Tarification officielle

- **15 €** par application et par an.
-- 10 € pour le créateur et 5 € pour Alphabette (aucun bouquet 40 €, aucun prorata).
- **7 jours** d'essai offerts.

Ces montants remplacent les anciennes formules. La source de vérité est le hub
(`/api/config.json`) ; la base les récupère automatiquement.

Une application peut être déclarée **gratuite, définitivement** (`gratuit: true`
dans son `alphabette.app.ts`, case « Gratuit » dans la console `/admin`, champ
`gratuit` du registre). La base n'affiche alors pour elle ni prix, ni essai, ni
paiement — mais **les liens vers le hub restent en place** : c'est l'écosystème
qui finance les applications gratuites.

## Règle nº 5 — IA souveraine

L'IA des applications est **Mistral AI (hébergée en France)**, en BYOK (clé
utilisateur) ou en clé managée Alphabette, avec repli local. Aucune donnée
utilisateur n'est utilisée pour l'entraînement.

## Règle nº 6 — L'espace dons est publié par le hub

Le bouton **♥ DON** ouvre, dans chaque application, l'espace dons de la base
commune : RIB copiable, marche à suivre d'un virement SEPA instantané et offre
« Membre fondateur » (places limitées, contreparties à vie). La **source de
vérité est `data/donation.json`** du hub, relayée par `/api/config.json` ; on ne
code jamais un IBAN en dur dans une application. Aucun paiement en ligne : le
virement se fait depuis la banque de l'utilisateur. Tant que `"exemple": true`
figure dans ce fichier, les coordonnées sont des exemples et la base l'affiche.

---

## Plan du dépôt

| Chemin | Rôle |
|---|---|
| `packages/shell/` | **La base commune** (`@alphabette/shell`) |
| `templates/app/` | Modèle d'application autonome (utilisé par le générateur) |
| `scripts/create-app.ts` | Générateur `bun run new:app` |
| `src/` | La vitrine `alphabette.fr` (hub) uniquement |
| `server.ts` + `server/` | API du hub (registre, config, IA, console `/admin`) |
| `data/apps-registry.json` | Registre central des applications |
| `docs/` | Documentation (écosystème, base des applications) |

## Vérifier avant de rendre

```powershell
bun run lint    # types
bun run build   # build vitrine + serveur
```

## Règle nº 7 — Toujours joindre un aperçu

À **chaque** livraison (nouvelle fonctionnalité, correctif visible, changement de
style), joindre un **aperçu visuel** de ce qui vient d'être fait : capture
d'écran de l'application ou de la page concernée, déposée avec l'outil
`browser.preview` (volet de revue) — et non une simple description. Un rendu
qu'on ne voit pas n'est pas un rendu terminé.

Aperçu de la base commune : <http://localhost:3000/base>

## Règle nº 8 — Synchro GitHub systématique

À chaque fin de tâche (et a fortiori de session), committer puis pousser
automatiquement chaque projet modifié dans son dépôt GitHub dédié
(règle nº 2) — au fur et à mesure du travail, sans attendre un ordre.
Le hub et les applications vivent dans des dépôts distincts : toujours
pousser chaque dossier dans LE bon dépôt. Ne jamais considérer une
livraison terminée tant qu'elle n'est pas sur GitHub.

## Règle nº 9 — Deux sites : le Laboratoire et la Vitrine

- **alphabette.eu** (Laboratoire) : toutes les applications, branche `main`, avis des visiteurs.
- **alphabette.fr** (Vitrine) : seulement les applications `"vitrine"`, figées sur un commit
  (`data/apps-sources.json`) ou dans `vitrine/`. On n'y touche que sur ordre de Valentin.
- Avant toute amélioration issue des avis : lire `RULES_AND_MEMORY.md`. Détails : `docs/LABO-EU.md`.
- Atelier qualité (contrôles de nuit, badge « Testé au Labo », rapports, Veilleur, Concierge, Économe, applis de
  créateurs hébergées dans un bac à sable, bouton Signaler) : `docs/labo/ATELIER-QUALITE.md`.

## Règle nº 10 — Une seule voix Alphabette, partout (gratuite, sans serveur)

Toute lecture à voix haute passe par le **lecteur unique** de la base
(`alphabetteAudio`, `packages/shell/src/audio/`). Jamais de `speechSynthesis` en
direct, jamais un autre lecteur : les anciens appels `speechSynthesis.speak()`
sont de toute façon redirigés vers lui.

D'où vient la voix (tout est gratuit) :
1. **Bibliothèque Alphabette** : les textes fixes sont enregistrés à l'avance par la
   tâche GitHub `voix-alphabette.yml` (`scripts/voix/generer-bibliotheque.ts`) — voix
   libre Piper « Siwis » tout de suite, remplacée par Gemini **« Kore »** dès qu'une clé
   Gemini gratuite (secret `GEMINI_API_KEY`) et son quota le permettent — et publiés en
   MP3 sur `https://alphabette.fr/voix/`. Lecture immédiate, même voix pour tous.
2. Route serveur `/api/alphabette/tts` (si un serveur existe un jour : `server/alphabetteAudio.ts`).
3. Clé Gemini du visiteur (réglages IA), gardée en cache sur son appareil.
4. Sinon la **plus belle voix de l'appareil** (voix naturelles Microsoft, Apple, Google en priorité), fr-FR, 0,94.

Ce que fait une application :
- Bouton : `<BoutonEcouter texte={…} id="fiche-12" />` ou `<BoutonEcouter cible="#resultat" />`
  — sans React : `<button data-ab-ecouter="Texte">` / `data-ab-ecouter-cible="#bloc"`.
  Trois états : « Écouter » → « Préparation... » (annulable) → « Arrêter » (vert).
- Textes fixes cachés derrière un clic (fiches, chapitres, questions) : les lister dans
  `public/voix-textes.json` (`["texte 1", "texte 2"]`) pour qu'ils soient enregistrés en « Kore ».
- Le haut-parleur de la barre arrête toute lecture en cours, où qu'elle soit.
- Micro : `demarrerDictee()` (SpeechRecognition fr-FR → MediaRecorder + transcription Gemini).
- Mettre une application existante à jour : `bun run sync:shell <dossier-app>`.

## Équipe d'agents

25 agents spécialisés vivent dans `.claude/agents/` (dont les 5 du Laboratoire) (chef de projet,
développeur, testeur mobile, vérificateur d'honnêteté, publieur…).
Liste et mode d'emploi : `docs/EQUIPE-AGENTS.md`. Pour une demande large,
commencer par `chef-de-projet`.

server.ts + server/ :api/ + labo/serveur/ | Endpoints PHP légers compatibles hébergement OVH Perso
