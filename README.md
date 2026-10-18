# ALPHABETTE — écosystème d'applications

Regroupe les applications d'**alphabette.fr**, dont **Goat Chèvre The King**.

> Elisez votre goat votre chèvre ou votre Roi.

## 🐐 Goat Chèvre The King

Le classement GOAT le plus sérieux (et le moins sérieux) du web : constituez votre
pyramide de légendes du **football international** ou de la **NBA**, faites des
**duels express**, découvrez votre **score de non-conformisme**, et partagez votre
pyramide en image prête pour Instagram (Story 9:16 ou carré) avec QR code.

- Adresse : **https://goatchevretheking.alphabette.fr** (également `/goat`)
- 400 joueurs (200 football / 200 NBA) issus de Wikidata, photos libres
- Pyramide 1 / 2 / 4 / 8 (+ étage 5 de 16 en mode expert), mode chaos, Hot Take
- Galerie communautaire : comptes, publication, votes — `/goat/communaute`

## Applications

Le registre central fait foi : **`data/apps-registry.json`**.
Chaque application se pilote en 1 clic depuis la console `/admin`
(activer, masquer, badge « Nouveau » / « Populaire »).

Pour ajouter une application, voir **`docs/ecosysteme-alphabette.md`**.

## Démarrer en local

```powershell
bun install

$env:ADMIN_PASSWORD='mot-de-passe-admin'
$env:COMMUNITY_SESSION_SECRET='secret-de-session-communaute'
bun run dev
```

→ <http://localhost:3000>

Aperçu d'un sous-domaine sans toucher au DNS : <http://localhost:3000/?app=goat>

## Architecture

Un seul serveur sert toutes les applications, chacune sur son **sous-domaine**
(`app.alphabette.fr`) **et** par son chemin (`alphabette.fr/app`). Un certificat
TLS wildcard couvre l'ensemble des applications, présentes et futures.

- `src/appRoutes.ts` — carte des applications (sous-domaines et chemins)
- `src/main.tsx` — routage + chargement à la demande (code splitting)
- `server.ts` — serveur Express/Vite (API + pages)
- `data/apps-registry.json` — registre des applications
- `docs/ecosysteme-alphabette.md` — domaines, DNS, certificat, ajout d'une app

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | accès à la console `/admin` (obligatoire en production) |
| `ADMIN_SESSION_SECRET` | signature des sessions admin (recommandé) |
| `COMMUNITY_SESSION_SECRET` | signature des sessions communauté (obligatoire pour que les comptes survivent à un redémarrage) |

Voir `.env.example`.

## Dépôts

- **`goatchevretheking.alphabette.fr`** — dépôt principal : tout le code de l'écosystème
- **`Alphabette`** — miroir tenu à jour automatiquement (même historique)

Le hub **alphabette.fr** et toutes les applications vivent dans le **même code** :
un seul serveur sert chaque application sur son sous-domaine. Un nouveau projet
n'a donc pas besoin d'un nouveau dépôt — seulement d'un dossier et d'une entrée
dans la carte des applications (`src/appRoutes.ts`).

## Licence

Apache License 2.0 — voir [LICENSE](LICENSE).
