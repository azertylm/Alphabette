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
