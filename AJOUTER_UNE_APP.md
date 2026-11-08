# Ajouter une application à alphabette.fr

Chaque application vit dans `apps/<slug>/` du hub et s'ouvre à
`https://alphabette.fr/apps/<slug>/`. Aucun code du hub à modifier.

## 1. Importer les fichiers

```bash
bun run import:app <slug> <dossier-de-l-appli>
```

- **Projet Vite** (présence d'un `package.json`) : le script installe, construit
  avec des chemins relatifs (`--base ./`) et copie le résultat dans `apps/<slug>/`.
- **Site HTML simple** : les fichiers sont copiés tels quels (il faut un `index.html`).

Relancer la même commande met l'application à jour.

## 2. Déclarer l'application

Dans `/admin` (ou `data/apps-registry.json`) : nom, slug identique au dossier,
icône, statut `actif`, badge éventuel, et **domaines dédiés** (ex.
`lidarsol.fr, lidarsol.eu`).

## Règles du hub

| Cas | Résultat |
|---|---|
| `actif` + dossier `apps/<slug>/` présent | l'appli est servie à `/apps/<slug>/` |
| `actif` sans dossier, avec URL externe | redirection vers cette URL |
| brouillon / maintenance / inconnue | page « Bientôt disponible » (jamais de 404) |
| requête sur un domaine dédié (`lidarsol.fr`) | l'appli servie à la racine, même code |

Les visites de chaque appli sont comptées dans `data/visits.json` et
affichées dans `/admin`.

## Limite

Une application qui a besoin de son propre serveur (`server.ts` : clés d'API
cachées, base de données…) ne peut pas être servie en statique : elle garde
son adresse externe dans le registre en attendant d'être intégrée au serveur du hub.
