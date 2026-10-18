# ALPHABETTE — la vitrine de l'écosystème

Le site **alphabette.fr** : il présente les applications de l'écosystème et renvoie
vers chacune d'elles, hébergée sur son propre sous-domaine.

> **1 projet = 1 dépôt GitHub = 1 sous-domaine**

## Les applications

Le registre central fait foi : **`data/apps-registry.json`**. Il se pilote en 1 clic
depuis la console `/admin` (activer, masquer, badge « Nouveau » / « Populaire »), et
la section « Nos Applications » de la vitrine s'y synchronise automatiquement.

| Application | Adresse | Dépôt |
|---|---|---|
| Goat Chèvre The King | <https://goatchevretheking.alphabette.fr> | `azertylm/goatchevretheking.alphabette.fr` |
| Lidarsol | <https://lidarsol.fr> | — |
| IADÉBAT, INFOS PERSO, SERVICE FRANCE… | voir `/admin` | — |

Chaque application vit dans **son propre dépôt** : ce dépôt-ci ne contient que la
vitrine, le registre et la console d'administration.

## Démarrer en local

```powershell
bun install

$env:ADMIN_PASSWORD='mot-de-passe-admin'
bun run dev
```

→ <http://localhost:3000>

## Ajouter une application

1. **Créer le projet** avec la base commune :
   `bun run new:app <slug> "Nom" "Sous-titre" --accent "#2563eb"` → dépôt autonome
   où l'en-tête de l'écosystème est déjà câblé — voir
   [`docs/base-application.md`](docs/base-application.md) ;
2. **Enregistrer l'application** depuis `/admin` : nom, slug, icône, URL
   (`https://monapp.alphabette.fr`), sous-domaine et statut ;
3. **Configurer le DNS** une seule fois pour toutes les applications
   (enregistrement `*` + certificat TLS wildcard) — voir
   [`docs/ecosysteme-alphabette.md`](docs/ecosysteme-alphabette.md).

L'application apparaît alors automatiquement dans la section « Nos Applications ».

## Console d'administration

`/admin` (protégée par `ADMIN_PASSWORD`) permet de :

- lister toutes les applications et basculer leur statut en 1 clic
  (actif / brouillon / maintenance) ;
- créer une application et lui attribuer son sous-domaine ;
- modérer les classements publiés par la communauté.

## Structure

```
packages/shell/      LA BASE COMMUNE (@alphabette/shell) : barres, thème, densité
templates/app/       modèle d'application autonome (utilisé par le générateur)
scripts/create-app.ts   générateur « bun run new:app »
src/App.tsx          la vitrine
src/components/      sections de la vitrine (Hero, catalogue, registre, tarifs…)
src/admin/           console d'administration
server/              API du registre, de la console et de la configuration
data/apps-registry.json   registre des applications
docs/                documentation de l'écosystème
```

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | accès à la console `/admin` (obligatoire en production) |
| `ADMIN_SESSION_SECRET` | signature des sessions admin (recommandé) |
| `AI_API_KEY` / `MISTRAL_API_KEY` | moteur IA souverain de l'atelier |

Voir `.env.example`.

## Licence

Apache License 2.0 — voir [LICENSE](LICENSE).
