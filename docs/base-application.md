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

Depuis n'importe quel composant, la base expose son état :

```tsx
import { useShell } from '@alphabette/shell';
const { theme, toggleTheme, density, cycleDensity, isFullscreen, toggleFullscreen, openPayment } = useShell();
```

---

## 5. Faire évoluer la base

La base vit dans `packages/shell/` du dépôt du hub. Toute amélioration (nouvelle
pastille, correctif, changement de tarif) bénéficie ensuite à **toutes** les
applications lors de la mise à jour du paquet `@alphabette/shell`.

Deux canaux de distribution :

1. **Paquet privé** publié (registre privé / GitHub Packages) : les applications
   font `bun update` pour recevoir la nouvelle version.
2. **En local** pendant la transition : `bun link` depuis `packages/shell`.

**Application de référence** : *Goat Chèvre The King*
(`goatchevretheking.alphabette.fr`) est la première application branchée sur la
base — elle sert d'exemple (identité dans `src/alphabette.app.ts`, enveloppe dans
`src/main.tsx`).

Aperçu vivant de la base : <http://localhost:3000/base>
