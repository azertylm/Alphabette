# Écosystème alphabette.fr — adresses et architecture

Document de référence : comment sont adressées les applications, comment en
créer une nouvelle, et où vit chaque chose.

> **Changement d'architecture.** Chaque application vit désormais dans **son
> propre dépôt GitHub** et sur **son propre sous-domaine**. Ce dépôt-ci n'est
> plus que **le hub** (`alphabette.fr`) : sa vitrine, son registre et ses API.
> Les applications partagent une **base commune** : voir
> [`base-application.md`](./base-application.md).

---

## 1. Les domaines du groupe

| Site | Statut | Domaines |
|---|---|---|
| **Lidarsol** | ✅ actif | `lidarsol.fr` + `lidarsol.eu` |
| **Osolar** | ⏸️ en sommeil | `osolar.fr` + `osolar.eu` |
| **Proxilien** | ⏸️ en sommeil | `proxilien.fr` + `proxilien.eu` |
| **Alphabette** | ✅ le hub — **héberge tous les nouveaux projets** | `alphabette.fr` + `alphabette.eu` |

Dans le registre (`data/apps-registry.json`) :
- **Osolar** et **Proxilien** sont en `brouillon` : absents de la vitrine, mais
  réactivables en 1 clic depuis `/admin`.
- **Lidarsol** pointe vers son domaine dédié `https://lidarsol.fr`.

---

## 2. L'adresse d'une application

Chaque application est joignable par son **sous-domaine dédié** :

```
https://goatchevretheking.alphabette.fr
```

Le hub `alphabette.fr` la présente et y renvoie depuis la vitrine. Un ancien
chemin (`alphabette.fr/goat`) qui aurait été partagé est redirigé (301) vers le
sous-domaine — voir `APP_REDIRECTS` dans `server.ts`.

> ⚠️ Une adresse web ne peut pas s'écrire `www.alphabette/goatchevretheking.fr` :
> le nom de domaine vient toujours **avant** le chemin.

### Pourquoi le sous-domaine ?

- chaque application a « son adresse », identifiable et mémorisable ;
- **un seul certificat TLS wildcard** couvre toutes les applications, présentes
  et futures ;
- chaque application a **son propre dépôt** : elle évolue et se déploie seule.

---

## 3. Mise en place DNS (à faire une seule fois)

### a. Domaine principal

| Type | Nom | Valeur |
|---|---|---|
| `A` | `@` | IP du serveur |
| `A` | `www` | IP du serveur |
| `A` | `*` | IP du serveur |

La ligne `*` (wildcard) est **la clé** : elle fait répondre
`nimportequoi.alphabette.fr` sur le serveur sans rien ajouter ensuite.

### b. Certificat TLS wildcard

Un certificat Let's Encrypt classique ne couvre **pas** les sous-domaines
arbitraires. Il faut un certificat **wildcard**, validé en **DNS-01** (un
enregistrement TXT `_acme-challenge`) :

- **cPanel / Plesk / OVH mutualisé** : case « wildcard `*.domaine` ».
- **VPS avec Certbot** : `certbot certonly --manual --preferred-challenges dns -d alphabette.fr -d '*.alphabette.fr'`
- **Cloudflare devant le serveur** : un *Origin Certificate* `alphabette.fr + *.alphabette.fr`.

### c. Domaine `.eu`

`alphabette.eu` (et les `.eu` de Lidarsol / Osolar / Proxilien) en redirection
**301** vers les `.fr` : mêmes contenus, aucun référencement dupliqué.

---

## 4. Créer une nouvelle application

Chaque application est **son propre dépôt**, créé à partir de la base commune.

```powershell
bun run new:app infos-perso "Info Perso" "Votre curation intelligente" --accent "#2563eb"
```

Le générateur produit un dépôt autonome où la base (`@alphabette/shell`) est
déjà câblée. Détails complets : [`base-application.md`](./base-application.md).

Puis :

1. `bun install && bun run dev` dans le nouveau dossier ;
2. renseigner l'identité dans `src/alphabette.app.ts` ;
3. créer le dépôt GitHub de l'application ;
4. déclarer l'application dans `data/apps-registry.json` de **ce** dépôt (hub) :

```json
{
  "id": "infos-perso",
  "name": "Info Perso",
  "slug": "infos-perso",
  "icon": "Newspaper",
  "status": "actif",
  "badge": "Nouveau",
  "url": "https://infosperso.alphabette.fr",
  "subdomain": "infosperso"
}
```

L'application apparaît alors dans la section « Nos Applications » de la vitrine.

---

## 5. Tester en local

```powershell
bun run dev            # http://localhost:3000 — la vitrine (hub)
```

Chaque application se lance **dans son propre dépôt** (`bun run dev`) et lit son
identité dans `src/alphabette.app.ts`. Aperçu de la base commune :
<http://localhost:3000/base>

---

## 6. Variables d'environnement

### Hub (ce dépôt)

| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | mot de passe de la console `/admin` (obligatoire, sinon console fermée) |
| `ADMIN_SESSION_SECRET` | secret de signature des sessions admin (recommandé) |
| `COMMUNITY_SESSION_SECRET` | secret de signature des sessions communauté |
| `HUB_CENTRAL_URL` | adresse publique du hub |

### applications

| Variable | Rôle |
|---|---|
| `VITE_HUB_URL` | adresse du hub pour la synchronisation des tarifs (défaut : `https://alphabette.fr`) |

À placer dans un fichier `.env` à la racine du projet concerné (non versionné).
