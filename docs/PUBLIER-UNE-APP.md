# Publier une application sur alphabette.fr (hébergement OVH Perso)

L'hébergement n'autorise qu'un site relié à GitHub : c'est le hub qui publie tout.
À chaque push sur `main`, GitHub construit le hub **et** les applications, puis
OVH récupère la branche `ovh-deploy`.

## Ajouter une application en 3 étapes

1. **Déclarer la source** dans `data/apps-sources.json` :
   `"monapp": { "repo": "azertylm/monapp-alphabette.fr" }`
   → l'application est publiée sur `https://alphabette.fr/apps/monapp/`.
2. **Créer le sous-domaine chez OVH** (une seule fois) : enregistrements DNS
   `A`/`AAAA` `monapp` vers l'hébergement, puis multisite
   `monapp.alphabette.fr` → dossier `alphabette/apps/monapp`, SSL activé.
3. **Passer l'application en `actif`** dans `data/apps-registry.json`
   (avec son `url`), seulement quand l'adresse répond.

Notes : une appli Vite/React est construite automatiquement (`vite build --base=./`) ;
une appli HTML simple est copiée telle quelle. Dépôt privé : ajouter le secret
GitHub `APPS_TOKEN` (jeton en lecture) au dépôt du hub.
