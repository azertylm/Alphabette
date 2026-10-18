# Écosystème alphabette.fr — adresses et architecture

Document de référence : comment sont adressées les applications de l'écosystème,
et comment en ajouter une nouvelle.

---

## 1. Le principe

```
alphabette.fr                      → la vitrine : elle présente et renvoie vers les applications
goatchevretheking.alphabette.fr    → une application, dans son propre dépôt GitHub
lidarsol.fr                        → une application, sur son propre domaine
```

> **1 projet = 1 dépôt GitHub = 1 sous-domaine.**
> Chaque application est développée séparément, puis branchée sur son adresse
> au dernier moment.

### Pourquoi des sous-domaines ?

- chaque application a « son adresse », identifiable et mémorisable ;
- **un seul certificat TLS wildcard** couvre toutes les applications, présentes
  et futures : plus jamais à refaire à chaque nouveau projet ;
- la vitrine n'a qu'un rôle : présenter et pointer (elle ne contient pas le code
  des applications).

> ⚠️ Une adresse web ne peut pas s'écrire `www.alphabette/goatchevretheking.fr` :
> le nom de domaine vient toujours **avant** le chemin. Les trois formes valides
> sont le **sous-domaine**, le **chemin**, ou un **domaine dédié**.
> Ici, on utilise le **sous-domaine**.

---

## 2. Les domaines du groupe

| Site | Statut | Domaines |
|---|---|---|
| **Lidarsol** | ✅ actif | `lidarsol.fr` + `lidarsol.eu` |
| **Osolar** | ⏸️ en sommeil (intégration ultérieure) | `osolar.fr` + `osolar.eu` |
| **Proxilien** | ⏸️ en sommeil (intégration ultérieure) | `proxilien.fr` + `proxilien.eu` |
| **Alphabette** | ✅ la vitrine — accueille tous les nouveaux projets | `alphabette.fr` + `alphabette.eu` |

Dans le registre (`data/apps-registry.json`) : **Osolar** et **Proxilien** sont en
`brouillon` (masqués, réactivables en 1 clic depuis `/admin`), et **Lidarsol**
pointe vers son domaine dédié `https://lidarsol.fr`.

---

## 3. Mise en place DNS (à faire une seule fois)

### a. Domaine principal

| Type | Nom | Valeur |
|---|---|---|
| `A` | `@` | IP du serveur |
| `A` | `www` | IP du serveur |
| `A` | `*` | IP du serveur |

La ligne `*` (wildcard) est **la clé** : elle fait répondre
`nimportequoi.alphabette.fr` sur le serveur sans rien ajouter ensuite. Chaque
application peut donc être publiée instantanément sur son sous-domaine.

### b. Certificat TLS wildcard

Un certificat Let's Encrypt classique ne couvre **pas** les sous-domaines
arbitraires. Il faut un certificat **wildcard**, qui exige une validation
**DNS-01** (un enregistrement TXT `_acme-challenge`). Selon l'hébergeur :

- **cPanel / Plesk / OVH mutualisé** : case « wildcard `*.domaine` » dans l'outil
  SSL/TLS — un clic.
- **VPS avec Certbot** :
  `certbot certonly --manual --preferred-challenges dns -d alphabette.fr -d '*.alphabette.fr'`
- **Cloudflare devant le serveur** : un *Origin Certificate*
  `alphabette.fr + *.alphabette.fr`, ou un certificat *Edge* wildcard.

### c. Domaine `.eu`

`alphabette.eu` (et les `.eu` de Lidarsol / Osolar / Proxilien) doivent être
configurés en **redirection 301** vers les `.fr` correspondants : mêmes contenus,
aucun référencement dupliqué.

---

## 4. Ajouter une nouvelle application

### a. Créer le projet (son dépôt)

Un dépôt GitHub par application, contenant une application autonome : son
interface, son serveur, son API et son build de production.

Exemple, le projet **Goat Chèvre The King** :

```
https://github.com/azertylm/goatchevretheking.alphabette.fr

src/goat/          l'application (pyramide, duels, controverse, partage, photos)
src/community/     comptes, publication et galerie communautaire
server/            API des joueurs, proxy photos, comptes et galerie
data/players.json  base des 400 joueurs
server.ts          serveur Express (API + application)
```

### b. L'enregistrer dans la vitrine

Depuis `/admin` : nom, slug, icône, **URL** (`https://monapp.alphabette.fr`),
**sous-domaine** (`monapp`) et statut. L'application apparaît immédiatement dans
la section « Nos Applications » de la vitrine.

### c. La brancher sur son adresse

Grâce au DNS wildcard (section 3), il ne reste qu'à faire pointer le sous-domaine
vers le déploiement de l'application. Aucun autre réglage DNS à refaire pour les
prochaines applications.

---

## 5. Tester en local

Chaque projet se lance indépendamment :

```powershell
# La vitrine — http://localhost:3000
cd "Projet par défaut"; bun run dev

# Le Goat — http://localhost:3001
cd "goatchevretheking.alphabette.fr"; $env:PORT='3001'; bun run dev
```

---

## 6. Variables d'environnement

### Vitrine (`alphabette.fr`)

| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | mot de passe de la console `/admin` (obligatoire, sinon console fermée) |
| `ADMIN_SESSION_SECRET` | secret de signature des sessions admin (recommandé) |

### Chaque application

Chaque projet déclare ses propres variables (ex. `COMMUNITY_SESSION_SECRET` pour
Goat Chèvre The King) dans son `.env`, non versionné — voir son `.env.example`.
