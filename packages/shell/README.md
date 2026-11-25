# @alphabette/shell

**La base commune de toutes les applications de l'écosystème alphabette.fr.**

Elle fournit les deux barres que l'on retrouve au sommet de chaque application :

```
[Barre 1 — écosystème]  ◉ ALPHABETTE · ♥ DON · 5 sites · 3/16 (7 essai) · ⭐ Abonnement 15 €/an
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

## Voix Alphabette (obligatoire) — Une seule voix Alphabette, partout (gratuite, sans serveur)

Toute lecture à voix haute passe par le **lecteur unique** de la base
(`alphabetteAudio`, `packages/shell/src/audio/`). Jamais de `speechSynthesis` en
direct, jamais un autre lecteur : les anciens appels `speechSynthesis.speak()`
sont de toute façon redirigés vers lui.

D'où vient la voix (tout est gratuit) :
1. **Bibliothèque Alphabette** : les textes fixes sont enregistrés à l'avance en
   voix Gemini **« Kore »** par la tâche GitHub `voix-alphabette.yml`
   (`scripts/voix/generer-bibliotheque.ts`, quota gratuit de Google) et publiés en
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
