# ALPHABETTE — récapitulatif du projet

> Document de passation. À utiliser tel quel comme **instructions** pour
> poursuivre le travail sur un autre poste, une autre session ou une autre IA.

---

## 1. L'objectif

Construire l'écosystème **alphabette.fr** : un site vitrine qui rassemble et met en
avant **~100 applications** publiées progressivement (objectif : 3 mois).

```
alphabette.fr                    → la vitrine : elle présente et renvoie vers les applications
goatchevretheking.alphabette.fr  → une application (son propre dépôt GitHub)
lidarsol.fr                      → une application (domaine dédié)
```

**Lois du projet :**

1. **1 projet = 1 dépôt GitHub = 1 sous-domaine.**
2. Le dépôt du hub (`alphabette.fr`) ne contient **aucune** application métier :
   uniquement la vitrine, le registre central et la console d'administration.
3. Une application se développe séparément, puis se branche sur son adresse « au
   dernier moment ».
4. Toute nouvelle application **part de la base commune** (`@alphabette/shell`) via
   `bun run new:app` — on ne recode jamais les barres du haut à la main.
5. Toute couleur d'interface dérive de `app.accent` (la couleur d'identité du site).
6. L'IA est **souveraine** : Mistral AI (hébergée en France), en BYOK (clé
   utilisateur) ou clé managée Alphabette, avec repli local. Aucune donnée
   utilisateur ne sert à l'entraînement.

---

## 2. Les dépôts et les dossiers locaux

| | **Vitrine / hub** | **Goat Chèvre The King** |
|---|---|---|
| Dépôt GitHub | `azertylm/Alphabette` | `azertylm/goatchevretheking.alphabette.fr` |
| Dossier local | `C:\Users\azert\Documents\Projet par défaut` | `C:\Users\azert\Documents\goatchevretheking.alphabette.fr` |
| Dernier commit | `3f80285` — *la vitrine ne contient plus que la vitrine* | `2a042d6` — *console de modération* |
| Adresse cible | `alphabette.fr` | `goatchevretheking.alphabette.fr` |
| Lancement local | port **3000** | port **3001** |

- Identité git : `Tintoon` / `6010991+azertylm@users.noreply.github.com`.
- Les deux dépôts sont **propres** (tout est committé) — **sauf** la base commune
  (voir § 4) qui est en cours d'ajout dans le hub.
- Installation : `bun install`. Runtime et scripts : `bun` / `npm`.

---

## 3. La vitrine `alphabette.fr` (dépôt `Alphabette`)

- `src/App.tsx` + `src/components/` : la vitrine (Hero, catalogue des applications,
  section « Nos Applications » pilotée par le registre, tarifs, footer).
- `src/admin/` : console `/admin`, protégée par mot de passe.
- `server.ts` + `server/` : API du hub (registre public, console admin,
  `/api/config.json`, atelier IA).
- `data/apps-registry.json` : **le registre central** des applications.
- `docs/` : documentation de l'écosystème.

### Le registre central

`data/apps-registry.json` fait foi. Chaque application y est décrite par : `id`,
`nom`, `slug`, `icône`, `statut` (**actif** / **brouillon** / **maintenance**),
`badge` (Nouveau / Populaire), `url` et `sous-domaine`.

La section « Nos Applications » de la vitrine charge automatiquement les
applications au statut **actif**. État actuel : **16 applications** enregistrées,
dont 14 actives.

### La console `/admin`

- Accès par mot de passe (`ADMIN_PASSWORD`) — cookie de session signé HMAC-SHA256,
  httpOnly, 5 tentatives / 15 min, fermée par défaut si le mot de passe est absent.
- Activer / masquer une application en **1 clic**, changer son statut et son badge,
  créer une application et lui attribuer son **sous-domaine**.
- Elle ne gère **que** le registre (la modération communautaire vit dans
  l'application concernée).

---

## 4. La base commune `@alphabette/shell` *(en cours d'ajout)*

C'est **le bandeau que l'on retrouve au sommet de chaque application** :

```
[Barre 1 — écosystème] ◉ ALPHABETTE · ♥ DON · [les 5 sites] · 3/16 (7 essai) · ⭐ Pass 40 €/an
[Barre 2 — application] ☰ Nom App + SOUS-TITRE · ♥ DON · Mon Compte · BIG ● · Clé API : Prêt ● · Plein Écran · ☀ Jour
```

| Élément | Comportement |
|---|---|
| ALPHABETTE | retour au hub `alphabette.fr` |
| ♥ DON | lien de dons de l'application |
| Les sites | raccourcis vers les autres applications (pastilles) |
| `3/16 (7 essai)` | compteur : applis débloquées / total + jours d'essai |
| ⭐ Pass 40 €/an | résumé de l'offre → envoi vers le paiement |
| Mon Compte | espace compte (SSO alphabette) |
| BIG | 3 densités d'affichage : Compact → Normal → Grand |
| Clé API : Prêt | état de la clé Mistral (BYOK ou managée) |
| Plein Écran | plein écran du navigateur |
| Jour / Nuit | bascule de thème, mémorisée |

Emplacement dans le dépôt du hub (le hub développe la base, les applications la
consomment) :

| Chemin | Rôle |
|---|---|
| `packages/shell/` | **la base commune** : `AppShell`, `EcosystemBar`, `AppHeader`, thème/densité/plein écran, tarifs, sites, config |
| `templates/app/` | le modèle d'application autonome |
| `scripts/create-app.ts` | le générateur `bun run new:app` |
| `src/BasePreview.tsx` | aperçu vivant de la base → `/base` |
| `AGENTS.md` | les règles du projet (résumées au § 1) |
| `docs/base-application.md` | documentation de la base |

Créer une application :

```powershell
bun run new:app infos-perso "Info Perso" "Votre curation intelligente" --accent "#2563eb"
```

Le générateur produit un dépôt autonome où `<AppShell>` est **déjà câblé** :
`src/alphabette.app.ts` (l'identité du site), `src/App.tsx`, `src/main.tsx`,
`index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`. Ensuite :
`bun install && bun run dev`.

**Aperçu :** <http://localhost:3000/base> — vérifié, les deux barres s'affichent
correctement et la palette suit la couleur choisie.

---

## 5. Tarification officielle

| Offre | Prix |
|---|---|
| Une application | **15 € / an** |
| Tout l'écosystème | **40 € / an** |
| Essai | **7 jours offerts** |

La **source de vérité est le hub** : `/api/config.json`. La base commune récupère
ces tarifs au chargement (avec une configuration de secours si le hub est
injoignable), donc un changement de prix se fait au **seul** endroit du hub.

---

## 6. L'application Goat Chèvre The King

Classement GOAT : l'utilisateur compose sa pyramide de légendes du sport.
Badge « Un service gratuit propulsé par alphabette.fr ».

**Contenu et jeu :**
- **400 joueurs** (200 Football International, 200 NBA), issus de **Wikidata**, avec
  photos libres et années de carrière au format `[début] - [fin]` / `Présent`.
- **Pyramide** 1 / 2 / 4 / 8 places, plus un étage 5 de 16 places en **Mode Expert**.
- **Réserve** : recherche par nom + filtre par époque.
- Placement **par glisser-déposer** ou **clic sur le joueur puis sur l'emplacement**.
- **Mode Chaos 🎲**, un **Hot Take 🔥** mis en avant.
- **10 duels rapides** → **% de non-conformisme** (0-35 % Consensuel / 36-70 %
  Connaisseur tranché / 71-100 % Audacieux), affiché à côté de la mascotte.
- **Sauvegarde automatique** dans le navigateur (localStorage).
- **Photos** : l'image entière doit rester visible ; nom, prénom et années affichés
  **sous** la photo ; recadrage par joueur possible (zoom + position).

**Partage :**
- « Partager ma Pyramide » → image HD **Story 9:16** ou **carré 1:1** contenant :
  le titre « Mon classement GOAT - Goat Chèvre The King », la pyramide avec photos,
  noms et années, le badge **Hot Take 🔥**, le **% de controverse**, un **QR code**
  vers l'application et la mention « Fais ton classement gratuitement sur
  goatchevretheking.alphabette.fr ».
- Génération par **Canvas API** (pas de capture DOM) ; QR via `qrcode`.

**Communauté :**
- Comptes **pseudo + mot de passe** (pas d'email), mot de passe haché, session
  30 jours, 8 tentatives / 15 min.
- Publication d'un classement, galerie publique, votes (compte ou visiteur anonyme),
  déduplication des publications identiques.
- **Console de modération** : `goatchevretheking.alphabette.fr/moderation`, protégée
  par `MODERATION_PASSWORD` → masquer/réafficher, supprimer une pyramide, suspendre
  un compte. Sans mot de passe, la console reste fermée et la galerie publique
  continue de fonctionner.

**Bas de page :** passerelle « Découvrez les autres outils et projets créés par
alphabette.fr » vers `https://alphabette.fr`.

**Bandeau de l'écosystème :** l'application est enveloppée par `<AppShell>` de la base
commune — identité dans `src/alphabette.app.ts` (accent ambre `#f59e0b`, compteur
`0/16`, `trialDaysLeft: 7`, thème initial « nuit »). C'est la **première application
équipée** ; son ancien bandeau « propulsé par alphabette.fr » a été retiré, la barre
écosystème le remplace.

**Architecture technique :** application autonome (React + Vite + serveur Express
dans le même dépôt) : `/` = la pyramide, `/communaute` = la galerie,
`/moderation` = la console. API : `/api/goat/players` (base des 400 joueurs),
`/api/goat/photo` (proxy des photos Wikimedia — indispensable pour que le canvas de
partage reste exploitable), `/api/community/*`, `/api/moderation/*`.

---

## 7. Adressage et hébergement

| Domaine | Statut |
|---|---|
| `alphabette.fr` + `alphabette.eu` | la vitrine — accueille tous les nouveaux projets |
| `lidarsol.fr` + `lidarsol.eu` | application active |
| `osolar.fr` + `osolar.eu` | en sommeil (masquée dans le registre, réactivable en 1 clic) |
| `proxilien.fr` + `proxilien.eu` | en sommeil (idem) |

**DNS, à faire une seule fois :** un enregistrement `A` pour `@`, un pour `www` et
surtout un **`*` (wildcard)** — ainsi `nimportequoi.alphabette.fr` répond sans rien
ajouter ensuite. **TLS :** un certificat **wildcard** (validation DNS-01) couvre
toutes les applications futures. Les `.eu` redirigent en **301** vers les `.fr`.

**Variables d'environnement** (voir les `.env.example` de chaque dépôt) :

| Dépôt | Variable | Rôle |
|---|---|---|
| Hub | `ADMIN_PASSWORD` | accès à `/admin` (obligatoire en production) |
| Hub | `ADMIN_SESSION_SECRET` | signature des sessions admin |
| Goat | `COMMUNITY_SESSION_SECRET` | signature des sessions communauté — **sinon les comptes sautent à chaque redémarrage** |
| Goat | `MODERATION_PASSWORD` | accès à `/moderation` |
| Goat | `MODERATION_SESSION_SECRET` | signature des sessions de modération (optionnel) |

---

## 8. Commandes utiles

| Commande | Où | Rôle |
|---|---|---|
| `bun install` | chaque dépôt | installer les dépendances |
| `bun run dev` | chaque dépôt | serveur de développement (port 3000 pour le hub, 3001 pour le Goat) |
| `bun run build` | chaque dépôt | build de production |
| `bun run start` | chaque dépôt | lancer le build de production |
| `bun run lint` | chaque dépôt | vérification TypeScript |
| `bun run new:app <slug> "Nom" "Sous-titre"` | hub | générer une nouvelle application depuis le gabarit |
| `bun run fetch:players` | Goat | régénérer la base des 400 joueurs depuis Wikidata |

---

## 9. Où on en est / ce qui reste

**Fait :** vitrine + registre + console admin · application Goat complète (pyramide,
duels, controverse, partage, photos, communauté, modération) · découpage en deux
dépôts indépendants · base commune + gabarit + générateur (rendu vérifié) · **le Goat
équipé du bandeau** (`<AppShell>`, accent ambre).

**En cours — deux lots non commités :**

- la **base commune** dans le dépôt du hub : `packages/shell/`, `templates/app/`,
  `scripts/create-app.ts`, `src/BasePreview.tsx`, `AGENTS.md`,
  `docs/base-application.md` ;
- **l'intégration du bandeau au Goat** : `src/alphabette.app.ts`, `src/main.tsx`,
  `src/goat/GoatHeader.tsx`, `vite.config.ts`, `package.json`.

**À faire ensuite, dans l'ordre :**

1. **Committer les deux lots** : la base commune dans le hub, le bandeau dans le Goat.
2. **Distribuer `@alphabette/shell`** : le Goat le consomme en
   `link:@alphabette/shell`, donc un dépôt fraîchement cloné ne s'installe pas sans le
   lien. Trancher : paquet privé publié (GitHub Packages) ou base embarquée dans le
   gabarit.
3. **Supprimer le doublon de la page d'accueil** : le catalogue historique et la
   section « Nos Applications » issue du registre affichent les applications deux fois.
4. Retirer `OSOLAR` / `PROXILIEN` des presets de démonstration de l'atelier IA.
5. Cosmétique : les cases photo des étages 4 et 5 de la pyramide sont larges et
   basses — les portraits y sont rendus petits.
