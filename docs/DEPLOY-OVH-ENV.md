# Renseigner `ADMIN_PASSWORD` et `ALPHABETTE_ADMIN_EMAIL` sur OVH Perso

Deux réglages, rien d'autre à coder :

| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | Mot de passe unique de l'administration : modération (`/admin/validations`, `/admin/avis-suspects`) et actions admin PHP (en-tête `X-Admin-Password`). Sans lui, tout reste fermé. 16 caractères ou plus. |
| `ALPHABETTE_ADMIN_EMAIL` | Adresse qui reçoit les notifications (appli à valider, avis suspect, virement à faire, paiement à vérifier). Sans elle, aucun mail admin n'est envoyé. |

L'ancien nom `ALPHABETTE_ADMIN_PASSWORD` fonctionne encore en secours : remplacez-le par `ADMIN_PASSWORD`.

## 1. Les poser sur OVH Perso

OVH Perso n'a pas de panneau « variables d'environnement » : on utilise `SetEnv` dans le `.htaccess` de la racine de l'hébergement **déposé hors dépôt Git** (jamais commité).

1. Espace client OVH → Hébergements → **FTP-SSH** : ouvrez le FTP (FileZilla) ou le gestionnaire de fichiers.
2. À la racine de `www/` (là où se trouve déjà `.htaccess`), ajoutez ces deux lignes **sans toucher au reste** :
   ```apache
   SetEnv ADMIN_PASSWORD "votre-mot-de-passe-long-et-unique"
   SetEnv ALPHABETTE_ADMIN_EMAIL "vous@exemple.fr"
   ```
3. Alternative plus sûre (hors site web) : créez `~/alphabette-labo-donnees/createurs-prive/admin-password.txt` contenant uniquement le mot de passe. Ce dossier n'est pas servi, et `data/private/` est de toute façon fermé par `.htaccess`.
4. Attention : si le déploiement automatique (`deploy-ovh.yml`) remplace le `.htaccess`, remettez les deux lignes (ou utilisez l'alternative 3 pour le mot de passe).

## 2. Vérifier que c'est pris en compte

Ouvrez `https://alphabette.eu/api/health.php` : vous devez voir

```json
"ADMIN_PASSWORD": { "configured": true },
"ALPHABETTE_ADMIN_EMAIL": { "configured": true }
```

Seul l'état `true/false` est publié, jamais la valeur. Si `false` : variable mal orthographiée, ou `.htaccess` écrasé.

## 3. Vérifier que l'espace admin et les notifications marchent

- Admin : ouvrez `https://alphabette.eu/admin/validations`, connectez-vous avec le mot de passe. Une mauvaise saisie donne « Mot de passe incorrect », et 5 essais ratés bloquent 15 minutes.
- Notifications : déposez une appli test depuis l'espace créateurs (ou signalez-en une) : un mail « [Alphabette] Nouvelle appli à valider » doit arriver à l'adresse choisie (pensez aux courriers indésirables la première fois).

## 4. Vérifier que l'accès non authentifié est rejeté

```bash
# Console de modération sans session → 401
curl -i "https://alphabette.eu/api/createurs/admin.php?validations=1"

# Mauvais mot de passe → 401 (puis 429 après 5 essais)
curl -i -X POST https://alphabette.eu/api/createurs/admin.php \
  -H "Content-Type: application/json" -d '{"action":"connexion","mot_de_passe":"faux"}'

# Action admin PHP sans en-tête → 401 ; avec un faux → 403 ; non configuré → 503
curl -i -X POST https://alphabette.eu/api/payouts.php -d '{"action":"rejeter","id":1}'
curl -i -X POST https://alphabette.eu/api/payouts.php -H "X-Admin-Password: faux" -d '{"action":"rejeter","id":1}'

# Fichiers privés : doivent répondre 403 ou 404, jamais un contenu
curl -i https://alphabette.eu/data/private/alphabette.sqlite
curl -i https://alphabette.eu/api/createurs/_lib.php
```

Tout contenu renvoyé par les deux dernières commandes est une anomalie : fermez le dossier et prévenez Claude.

## À retenir

- Ne mettez jamais le mot de passe ni l'e-mail dans le code, une issue ou un message public.
- Changer le mot de passe suffit à couper toutes les anciennes sessions admin après 8 h maximum.
