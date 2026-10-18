# AGENTS.md — règles de l'écosystème ALPHABETTE

Ce fichier est destiné à **toute IA** (ou tout développeur) qui travaille sur ce
dépôt ou sur une application de l'écosystème. Il décrit les règles à respecter
**avant d'écrire du code**.

## Règle nº 1 — Toute application part de la base commune

> **Toute nouvelle application DOIT partir de `@alphabette/shell` via
> `bun run new:app`. Ne jamais recoder les barres du haut à la main.**

La base fournit, pour chaque application :

```
[Barre 1 — écosystème]  ◉ ALPHABETTE · ♥ DON · 5 sites · 3/16 (7 essai) · ⭐ Pass 40 €/an → paiement
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
- **40 €** pour tout l'écosystème et par an.
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

Aperçu de la base commune : <http://localhost:3000/base>
