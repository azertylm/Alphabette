# La base commune des applications ALPHABETTE

Toutes les applications de l'écosystème partagent la **même base**, intégrée au
démarrage de chaque projet. Ce document décrit cette base, son rôle et la façon
de créer une application.

---

## 1. Pourquoi une base commune

Chaque application possède **son propre dépôt** et **son propre sous-domaine**
(`<app>.alphabette.fr`). Sans base commune, il faudrait recoder à l'identique, à
chaque fois :

- la barre écosystème (logo, dons, les 5 sites, compteur, bouton Pass) ;
- l'en-tête d'application (nom, sous-titre, dons, compte, densité, clés, plein
  écran, jour/nuit) ;
- le thème, la densité, le plein écran et la synchronisation des tarifs.

La base supprime cette répétition : **un seul code**, corrigé et amélioré une
fois, disponible partout.

---

## 2. Ce que montre la base

```
[Barre 1 — écosystème]
◉ ALPHABETTE   ♥ DON   📍 Proxilien   🖥 Info Perso ●   …   [3/16 (7 essai)]   [⭐ Pass 40 €/an]

[Barre 2 — application]
≡   Info Perso                              ♥ DON  👤 Mon Compte  BIG ▮▮▯  🔑 Clé API : Prêt ●  ⛶ Plein Écran  ☀ Jour ●
    VOTRE CURATION INTELLIGENTE HAUTEMENT PERSONNALISÉE
```

| Élément | Comportement |
|---|---|
| **ALPHABETTE** | Lien vers le hub `alphabette.fr` |
| **♥ DON** | Lien de collecte de dons de l'application |
| **Les 5 sites** | Raccourcis vers les autres applications (liste modifiable dans `sites.ts`) |
| **3/16 (7 essai)** | Compteur : dons/accès débloqués + jours d'essai restants |
| **⭐ Pass 40 €/an** | Résumé de l'offre → envoi vers le paiement |
| **Mon Compte** | Espace compte (SSO alphabette) |
| **BIG** | 3 crans de densité : Compact → Normal → Grand |
| **Clé API : Prêt** | État de la clé Mistral (BYOK ou managée) |
| **Plein Écran** | Plein écran total du navigateur |
| **Jour / Nuit** | Bascule de thème, mémorisée |

---

## 3. Créer une application

```powershell
bun run new:app infos-perso "Info Perso" "Votre curation intelligente" --accent "#2563eb"
```

Options :

| Option | Effet |
|---|---|
| `--accent <hex>` | Couleur d'identité du site (toute la palette s'y adapte) |
| `--dir <chemin>` | Dossier de destination (défaut : dossier frère `../<slug>`) |
| `--no-git` | Ne pas initialiser de dépôt git |

Le générateur produit un dépôt autonome :

```
<slug>/
  src/
    main.tsx            point d'entrée
    App.tsx             application enveloppée par <AppShell>
    alphabette.app.ts   identité du site
  index.html  vite.config.ts  tsconfig.json  package.json
```

Puis : `bun install && bun run dev`.

---

## 4. Personnaliser

Tout se règle dans `src/alphabette.app.ts` :

```ts
export const APP: AlphaAppConfig = {
  key: 'infos-perso',
  name: 'Info Perso',
  tagline: 'Votre curation intelligente hautement personnalisée',
  accent: '#2563eb',
  subdomain: 'infosperso',
  homePath: '/infos-perso',
  donUrl: 'https://alphabette.fr/don',
  counter: { unlocked: 3, total: 16, trialDaysLeft: 7 },
  apiKeyState: 'ok',
};
```

**Application gratuite.** Une application peut se déclarer gratuite,
définitivement :

```ts
gratuit: true,
```

La base n'affiche alors, pour elle, ni prix, ni essai, ni bouton de paiement :
la barre écosystème écrit « gratuit (N applications) », le bouton « Pass » devient
« 🧭 L'écosystème » et le panneau correspondant explique la gratuité. **Les liens
vers le hub restent en place** (alphabette.fr, les applications, les dons) : c'est
l'écosystème qui finance une application gratuite. Côté hub, la même marque se
pose dans la console `/admin` (case « Gratuit ») et dans
`data/apps-registry.json` (`"gratuit": true`) : la vitrine et la base des
applications l'affichent alors comme un badge « Gratuit ».

Depuis n'importe quel composant, la base expose son état :

```tsx
import { useShell } from '@alphabette/shell';
const { theme, toggleTheme, density, cycleDensity, isFullscreen, toggleFullscreen, openPayment } = useShell();
```

### Espace dons & soutien financier

Le bouton **♥ DON** (barre écosystème et en-tête d'application) ouvre l'espace
dons. Dès que le hub publie ses coordonnées bancaires, la base affiche l'espace
complet : **RIB copiable** (banque, titulaire, code banque/guichet/compte/clé,
IBAN, BIC), la marche à suivre pour un virement SEPA instantané, l'offre
**Membre fondateur** (places limitées, montants suggérés, contreparties à vie,
pseudo) et un récapitulatif copiable. Aucun paiement en ligne, aucune donnée
bancaire saisie dans l'application : le virement se fait depuis la banque de
l'utilisateur, puis un courriel prévient le hub. Le titre du panneau reprend le
nom de l'application (« Soutenir le développement de Révolution… »).

La **source de vérité** est le fichier `data/donation.json` du hub, relayé par
`GET /api/config.json` dans le bloc `donation` :

```json
{
  "banque": "Crédit Agricole Toulouse 31",
  "titulaire": "ALPHABETTE SASU",
  "iban": "FR76 …",
  "bic": "CRCAMRPXXX",
  "contact": "direction@alphabette.fr",
  "objetVirement": "DON ALPHABETTE",
  "placeMax": 500,
  "placesAttribuees": 84,
  "montantMinimum": 30,
  "montants": [30, 50, 100],
  "exemple": true
}
```

Modifier ce fichier met à jour **toutes** les applications sans redéploiement.
Tant que `"exemple": true` est présent, la base signale en clair que les
coordonnées sont des exemples : à retirer dès que le vrai RIB est en place. Si le
hub est injoignable ou ne publie rien, le panneau retombe sur la version simple
(un lien de dons et une explication).

---

## 5. Faire évoluer la base

La base vit dans `packages/shell/` du dépôt du hub. Toute amélioration (nouvelle
pastille, correctif, changement de tarif) bénéficie ensuite à **toutes** les
applications lors de la mise à jour du paquet `@alphabette/shell`.

Deux canaux de distribution :

1. **Embarquée** (le canal actuel) : `bun run new:app` copie la dernière version
   de la base dans `src/shell/` de l'application — autonome, sans liaison locale.
   Pour actualiser une application existante : `bun run sync:shell <chemin-app>`
   depuis le dépôt du hub. `src/shell/.shell-version` mémorise la version.
2. **Paquet publié** (quand l'écosystème grandit) : paquet `@alphabette/shell`
   publié sur npm ou GitHub Packages, les font `bun update` pour recevoir la
   nouvelle version.

**Application de référence** : *Goat Chèvre The King*
(`goatchevretheking.alphabette.fr`) est la première application branchée sur la
base — elle sert d'exemple (identité dans `src/alphabette.app.ts`, enveloppe dans
`src/main.tsx`).

Aperçu vivant de la base : <http://localhost:3000/base>
