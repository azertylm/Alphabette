# Démarrer un nouveau projet — 2 minutes

> À refaire tel quel à chaque nouvelle application des 100.

## 1. Générer l'application

Ouvrir un terminal dans le dossier de la vitrine :

```powershell
cd "C:\Users\azert\Documents\Projet par défaut"
bun run new:app <slug> "Nom de l'app" "Le sous-titre en une phrase" --accent "#2563eb"
```

→ crée un dossier **juste à côté** (`..\<slug>`) : projet autonome, dépôt git
initialisé, et le **bandeau (`<AppShell>`) déjà câblé**.

## 2. La lancer

```powershell
cd "..\<slug>"
bun install
bun run dev
```

## 3. Lui donner son adresse (au dernier moment)

1. Créer le dépôt GitHub `<slug>.alphabette.fr` et y pousser le dossier.
2. Enregistrer l'application dans la vitrine : `bun run dev` dans le dossier de la
   vitrine, puis <http://localhost:3000/admin> → nom, slug, icône,
   URL `https://<sub>.alphabette.fr`, sous-domaine, statut **actif**.
3. Elle apparaît aussitôt dans « Nos Applications » sur alphabette.fr.

Aucun réglage DNS à refaire : le `*` (wildcard) et le certificat wildcard couvrent
toutes les applications, présentes et futures.

---

## 4. Le brief à coller au début de chaque nouvelle session IA

```text
Nouveau projet : <NOM DE L'APPLICATION> (slug : <slug>)

Règles de l'écosystème ALPHABETTE — à respecter sans exception :
1. Un projet = un dépôt GitHub = un sous-domaine : <sub>.alphabette.fr
2. L'application part de la base commune @alphabette/shell, générée par
   `bun run new:app`. Ne jamais recoder les barres du haut à la main.
3. Toute couleur d'interface dérive de `accent` dans src/alphabette.app.ts.
4. Tarifs : 15 € / application / an · 40 € / écosystème / an · 7 jours d'essai.
   Source de vérité : /api/config.json du hub.
5. IA souveraine : Mistral AI (France), BYOK ou clé managée, repli local.
   Aucune donnée utilisateur ne sert à l'entraînement.
6. La vitrine alphabette.fr ne contient AUCUNE application : elle liste et pointe.

Ce que doit faire l'application :
<3 à 5 lignes décrivant l'idée, pour qui, et ce qui la rend utile>

Documentation de référence : docs/recapitulatif-projet.md (dépôt de la vitrine)
```
