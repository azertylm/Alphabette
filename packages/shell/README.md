# @alphabette/shell

**La base commune de toutes les applications de l'écosystème alphabette.fr.**

Elle fournit les deux barres que l'on retrouve au sommet de chaque application :

```
[Barre 1 — écosystème]  ◉ ALPHABETTE · ♥ DON · 5 sites · 3/16 (7 essai) · ⭐ Pass 40 €/an
[Barre 2 — application] ☰ Nom App + sous-titre · ♥ DON · Mon Compte · BIG · Clé API · Plein Écran · ☀ Jour
```

## Ce qu'elle apporte

| Élément | Rôle |
|---|---|
| **Barre écosystème** | Logo `alphabette.fr`, dons, les 5 sites, compteur d'accès, bouton **Pass** → paiement |
| **En-tête d'application** | Nom + sous-titre, `DON`, `Mon Compte`, `BIG` (3 densités), `Clé API`, `Plein Écran`, `Jour/Nuit` |
| **Thème** | Jour/Nuit, mémorisé par l'utilisateur |
| **Densité** | 3 crans (Compact / Normal / Grand), mémorisé |
| **Plein écran** | API Fullscreen du navigateur |
| **Tarifs** | 15 €/app/an · 40 €/écosystème/an, synchronisés avec `/api/config.json` du hub |
| **Couleur** | Toute la palette dérive de `app.accent`, la couleur d'identité du site |

Aucune dépendance d'exécution : ni Tailwind, ni bibliothèque d'icônes. React est
la seule dépendance (en `peerDependency`).

## Utilisation

```tsx
import { AppShell } from '@alphabette/shell';
import '@alphabette/shell/style.css';

export default function MonApp() {
  return (
    <AppShell
      app={{
        key: 'infos-perso',
        name: 'Info Perso',
        tagline: 'Votre curation intelligente hautement personnalisée',
        accent: '#2563eb',                 // la couleur du site
        donUrl: 'https://.../don',
        counter: { unlocked: 3, total: 16, trialDaysLeft: 7 },
        apiKeyState: 'ok',
      }}
    >
      …le contenu de l'application…
    </AppShell>
  );
}
```

## Personnalisation

| Prop | Effet |
|---|---|
| `app.accent` | Couleur d'identité du site ; toute la palette s'y adapte |
| `sites` | Remplace les 5 sites de la barre écosystème |
| `maxSites` | Nombre de sites affichés (défaut : 5) |
| `hubUrl` | Adresse du hub (défaut : `https://alphabette.fr`) |
| `config` | Force les tarifs/liens au lieu de lire le hub |
| `onOpenAccount` / `onOpenApiKeys` / `onOpenPayment` | Remplace le comportement par défaut |
| `initialTheme` / `initialDensity` | État de départ |

## API programmatique

```tsx
import { useShell } from '@alphabette/shell';

const { theme, toggleTheme, density, cycleDensity, isFullscreen, toggleFullscreen, openAccount, openApiKeys, openPayment } = useShell();
```

## Version

`0.1.0` — première base commune. Évolutions : voir `docs/base-application.md`
à la racine du dépôt.
