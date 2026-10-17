# Écosystème alphabette.fr — adresses et architecture

Document de référence : comment sont adressées les applications, et comment en
ajouter une nouvelle en quelques minutes.

---

## 1. Les domaines du groupe

| Site | Statut | Domaines |
|---|---|---|
| **Lidarsol** | ✅ actif | `lidarsol.fr` + `lidarsol.eu` |
| **Osolar** | ⏸️ en sommeil (intégration ultérieure) | `osolar.fr` + `osolar.eu` |
| **Proxilien** | ⏸️ en sommeil (intégration ultérieure) | `proxilien.fr` + `proxilien.eu` |
| **Alphabette** | ✅ le hub — **héberge tous les nouveaux projets** | `alphabette.fr` + `alphabette.eu` |

Dans le registre (`data/apps-registry.json`) :
- **Osolar** et **Proxilien** sont passés en `brouillon` → ils n'apparaissent
  plus sur la vitrine, mais restent dans le registre et se réactivent en 1 clic
  depuis `/admin` le jour de leur mise en ligne.
- **Lidarsol** pointe désormais vers son domaine dédié `https://lidarsol.fr`.

---

## 2. L'adresse d'une application

Chaque application est servie à **deux adresses** en même temps :

```
https://goatchevretheking.alphabette.fr     ← adresse publique (sous-domaine)
https://alphabette.fr/goat                  ← même application, par son chemin
```

> ⚠️ Une adresse web ne peut pas s'écrire `www.alphabette/goatchevretheking.fr` :
> le nom de domaine vient toujours **avant** le chemin. Les trois seules formes
> valides sont : le **sous-domaine**, le **chemin**, ou un **domaine dédié**
> (`goatchevretheking.fr`, à acheter).

### Pourquoi le sous-domaine ?

- chaque application a « son adresse », identifiable et mémorisable ;
- **un seul certificat TLS wildcard** couvre toutes les applications, présentes
  et futures : plus jamais à refaire à chaque nouveau projet ;
- c'est **le même serveur et le même code** : rien à déployer en plus.

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
arbitraires. Il faut un certificat **wildcard**, qui exige une validation
**DNS-01** (un enregistrement TXT `_acme-challenge`). Selon l'hébergeur :

- **cPanel / Plesk / OVH mutualisé** : case « wildcard`*.domaine` » dans
  l'outil SSL/TLS — un clic.
- **VPS avec Certbot** : `certbot certonly --manual --preferred-challenges dns -d alphabette.fr -d '*.alphabette.fr'`
- **Cloudflare devant le serveur** : un *Origin Certificate* `alphabette.fr + *.alphabette.fr`
  ou un certificat *Edge* wildcard fait l'affaire.

### c. Domaine `.eu`

`alphabette.eu` (et les `.eu` de Lidarsol / Osolar / Proxilien) doivent être
configurés en **redirection 301** vers les `.fr` correspondants : mêmes contenus,
aucun référencement dupliqué.

---

## 4. Ajouter une nouvelle application

Trois étapes, aucune configuration serveur.

### 1. Le dossier de l'application

```
src/apps/mon-app/
    MonApp.tsx          (composant principal)
    ...                 (composants, logique, styles)
```

### 2. Déclarer l'adresse dans `src/appRoutes.ts`

```ts
export const APP_ROUTES: AppRouteDefinition[] = [
  // ...
  {
    key: 'mon-app',
    label: 'Mon App',
    subdomains: ['monapp'],   // → monapp.alphabette.fr
    paths: ['/mon-app'],      // → alphabette.fr/mon-app
  },
];
```

### 3. Charger le composant dans `src/main.tsx`

```ts
const MonApp = lazy(() => import('./apps/mon-app/MonApp').then((m) => ({ default: m.MonApp })));
```

puis une ligne dans `renderRoute()`. Le chargement à la demande (code splitting)
garantit que chaque application reste dans son propre fichier JS : la page
d'accueil ne s'alourdit pas, même avec 100 applications.

### 4. Enregistrer l'application dans le registre

Depuis `/admin` (champ « Sous-domaine dédié ») ou à la main dans
`data/apps-registry.json` :

```json
{
  "id": "mon-app",
  "name": "Mon App",
  "slug": "mon-app",
  "icon": "Sparkles",
  "status": "actif",
  "badge": "Nouveau",
  "url": "/mon-app",
  "subdomain": "monapp"
}
```

L'application apparaît alors automatiquement dans la section « Nos Applications »
de la vitrine.

---

## 5. Tester en local

```powershell
npm run dev            # http://localhost:3000
```

Le DNS n'est pas encore configuré ? Simule le sous-domaine avec le paramètre
d'aperçu :

```
http://localhost:3000/?app=goat                 → équivaut à goatchevretheking.alphabette.fr
http://localhost:3000/?app=goat&pays=fr         → (les autres paramètres sont conservés)
```

---

## 6. Variables d'environnement (production)

| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | mot de passe de la console `/admin` (obligatoire, sinon console fermée) |
| `ADMIN_SESSION_SECRET` | secret de signature des sessions admin (recommandé) |
| `COMMUNITY_SESSION_SECRET` | secret de signature des sessions communauté — **si absent, les comptes sont déconnectés à chaque redémarrage** |

À placer dans un fichier `.env` à la racine du projet (non versionné).
