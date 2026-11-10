# Configuration DNS — sous-domaines des applications

> État du 2026-10-20. Les déploiements GitHub Pages de **Frigo-Placard** et
> **Senior Bon Plan** sont **verts**, mais les sous-domaines ne résolvent pas
> encore : les enregistrements DNS ci-dessous manquent dans la zone OVH de
> `alphabette.fr`. Tant qu'ils ne sont pas créés, les deux apps restent en
> statut `brouillon` dans `data/apps-registry.json` (la vitrine ne les liste
> que lorsqu'elles passent en `actif`, c'est-à-dire atteignables par leur URL).

## Diagnostic effectué

| URL | Résolution | État |
|---|---|---|
| `alphabette.fr` | A `146.59.209.152` (OVH) | ✅ hub vitrine |
| `www.bonplansenior.alphabette.fr` | **NXDOMAIN** | ❌ à créer |
| `frigoplacard.alphabette.fr` | **NXDOMAIN** | ❌ à créer |
| `azertylm.github.io/bonplan-alphabette.fr/` | — | ✅ en ligne (URL GitHub Pages, pas de CNAME) |

## Enregistrements à créer dans la zone `alphabette.fr`

| Sous-domaine (champ « DNS » OVH) | Type | Cible |
|---|---|---|
| `www.bonplansenior` | CNAME | `azertylm.github.io.` |
| `frigoplacard` | CNAME | `azertylm.github.io.` |

Notes :

- Le dépôt `bonplansenior-alphabette.fr` porte un fichier `public/CNAME`
  valant `www.bonplansenior.alphabette.fr` (Pages l'exige) — d'où le
  sous-champ `www.` dans l'enregistrement.
- `frigoplacard-alphabette.fr` porte `dist/CNAME` valant
  `frigoplacard.alphabette.fr` (apex du sous-domaine).
- Ne pas toucher aux enregistrements `A`/`AAAA` de l'apex
  (`alphabette.fr` → hébergement du hub).
- **Bon Plan** n'a pas de CNAME : il vit directement à
  `https://azertylm.github.io/bonplan-alphabette.fr/` (déjà vérifié en ligne).

## Après création des enregistrements

1. Attendre la propagation (OVH TTL par défaut : souvent 1 h, parfois minutes).
2. Vérifier :
   ```powershell
   Resolve-DnsName www.bonplansenior.alphabette.fr
   Resolve-DnsName frigoplacard.alphabette.fr
   ```
   (cible attendue : réseau GitHub Pages `185.199.108-111.x`)
3. Relancer les déploiements (ré-exécution du workflow, ou redéclenchement)
   pour que GitHub Pages valide le domaine — dans les deux dépôts le `deploy.yml`
   peut être relancé depuis l'onglet Actions (« Re-run ») ou via un push vide.
4. Passer les entrées du registre en statut `actif` (console `/admin` du hub,
   bouton bascule brouillon ↔ actif) : la vitrine `alphabette.fr` les affichera
   alors avec le compteur d'applications de la barre écosystème.

## Vaut-on autre chose ?

- Les dépôts sont déjà corrects : workflow `deploy.yml` + `configure-pages`
  avec `enablement: true` activent Pages automatiquement à chaque push.
- Le registre central (`data/apps-registry.json`) est à jour
  (« Senior Bon Plan », « FRIGO-PLACARD » en brouillon, gratuit pour les deux).

## Audit du 2026-11-10

Vérification de toutes les adresses du registre (résolution DNS publique + test HTTPS) :

- `alphabette.fr` → `146.59.209.152` répond, mais sert une **installation Joomla
  par défaut** (page « Home » + formulaire de connexion), pas le hub de ce dépôt.
- **Tous** les sous-domaines `*.alphabette.fr` du registre sont en **NXDOMAIN**
  (aucun enregistrement DNS créé dans la zone OVH).
- `lidarsol.fr` et `proxilien.fr` → `213.186.33.5` (page d'attente OVH), HTTPS en échec.
- Seule adresse réellement en ligne : `https://azertylm.github.io/bonplan-alphabette.fr/`.

Conséquence : les 15 applications marquées `actif` sans être joignables sont
repassées en `brouillon`. Seul **BON PLAN** reste `actif`. Repasser une
application en `actif` uniquement quand son URL répond.

## État au 2026-11-10 (fin de journée de mise en ligne)

- `alphabette.fr` : hub statique publié depuis la branche `ovh-deploy`
  (hébergement OVH Perso, dossier `alphabette/`, webhook GitHub → OVH actif).
- 11 applications publiées et vérifiées sur `https://alphabette.fr/apps/<clé>/` :
  bonplan, goatchevretheking, revolution, promptmagic, ecobatisol, santecitoyenne,
  accord, frigoplacard, echo, bonplansenior, franceservice.
- Pour ces 11 clés : enregistrements `A`/`AAAA` créés dans la zone et multisite
  `<clé>.alphabette.fr` → `alphabette/apps/<clé>` (certificats Let's Encrypt en
  cours de génération). Le registre pointe sur `/apps/<clé>/` tant que le
  sous-domaine ne répond pas en HTTPS.
- Limite de l'offre : 15 sites (13 utilisés) et 1 seul site relié à Git. Les
  applications suivantes peuvent vivre sans sous-domaine, sur `/apps/<clé>/`.
- L'ancien Joomla est toujours dans le dossier `www/` (plus servi) ; à supprimer
  depuis l'espace client OVH.
- Info Perso, IA Débat, L'Œil de l'Atelier et ProxiLien : publiés sans serveur
  (`build:static` de chaque dépôt, clé IA de l'utilisateur). Reste en attente :
  Lidarsol (dépôt privé, nom de domaine lidarsol.fr).
