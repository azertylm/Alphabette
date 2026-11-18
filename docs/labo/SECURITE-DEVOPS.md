# Sécurité, réseau et maintenance transversale

## 1. Routeur BYOK résilient — `packages/shell/src/ia/routeurByok.ts`
`appelerIA(requete, { chaine: [principal, secours…], onBascule })` : Gemini, Mistral, Claude, OpenAI, DeepSeek, Grok.
- Bascule sur le maillon suivant (configuré par l'utilisateur, `lireChaineIA` / `enregistrerChaineIA`) en cas de 429 (quota),
  401/403 (clé), 404 (modèle inconnu), 5xx/529 (panne), délai ou réseau. Message pédagogique en français (`Bascule.message`).
- Une 400 ne bascule pas (`ErreurRequeteIA`) : c'est un vrai bug de l'appli.
- Chaque bascule = **Incident API Tiers** : événement `alphabette:incident-api`, trace de session. Le capteur d'erreurs l'ignore,
  le module d'avis prévient le visiteur et envoie `incident_api` ; le serveur classe l'avis `incident_api_tiers` (jamais « Bug ») ;
  l'Agent Correcteur et la graduation l'excluent.
- Modèles par défaut modifiables (`MODELES_PAR_DEFAUT`) ; clés jamais stockées par le routeur, envoyées seulement à leur fournisseur.

## 2. Certificat d'Audit Réseau (zéro connaissance) — `scripts/labo/audit-reseau.mjs`, `.github/workflows/audit-reseau.yml`
Chromium neuf ; localStorage prérempli de canaris (dont une fausse clé), chaque champ rempli d'un canari, boutons sans risque
activés ; écoute fetch, XHR, sendBeacon, ressources, WebSocket, service workers. Fuite = canari ou valeur du localStorage
(brute, encodée URL ou Base64, même au milieu d'un texte) vers un domaine tiers non autorisé ; ces requêtes sont bloquées.
Autorisés : alphabette.fr/.eu, les 6 fournisseurs d'IA, `reseau_autorise` du registre.
Sortie `certificats/<app>.json` + badge `certificats/<app>.svg`, **signés par GitHub (attestation Sigstore)** :
`gh attestation verify <app>.json --repo azertylm/Alphabette`. Publiés sur `alphabette.fr/certificats/` ; pastille
« 🔒 Zéro fuite vérifiée » sur la tuile si conforme. Limite : une donnée chiffrée ou hachée avant envoi n'est pas reconnaissable.

## 3. Pollinisation croisée — `scripts/labo/pollinisation.mjs`, agent `pollinisateur`
`signatures <repo> <sha>` (code fautif retiré + familles) ; `scanner --depuis <repo>@<sha> | --famille stockage|theme|export|pwa`
(clone superficiel de chaque appli). L'agent relit chaque trouvaille, puis PR préventive minimale par appli sœur (5 max),
build vérifié, qa-verifier ; jamais .fr.

## 4. Sentinelle post-transfert & retour arrière — `labo/serveur/sentinelle.{js,php}`, `scripts/labo/sentinelle.mjs`, `.github/workflows/sentinelle.yml`
Sonde anonyme (~1,5 Ko) injectée dans les applis de .fr : une mesure par session (erreur fatale oui/non, premier rendu),
aucun cookie ni identifiant, se tait après 100 sessions. Toutes les 20 min : > 2 % de sessions en erreur fatale (dès la 3e)
ou premier rendu médian ×2 par rapport à la version précédente → `vitrine.ref` ← N-1 (`data/labo/releases.json`), publication,
tickets livrés rouverts sur .eu avec la trace (`data/labo/decisions.json`, `data/labo/incidents.json`), ticket GitHub.

## 5. Conseil des Agents — `scripts/labo/conseil/` (TypeScript), agent `conseiller`
Produit / Sécurité & Zéro Connaissance / Simplicité, prompts antagonistes (`prompts.ts`), diff Git (version .fr → candidate) +
avis, 2 tours au plus. Verdict GO / NO_GO, note de consensus /100, synthèse de 5 lignes → `data/labo/conseil/<app>.json`
et `data/labo/conseil.json` (affiché par `node scripts/labo/etat.mjs`). Moteur `api` (clés en variables d'environnement /
secrets) ou `relais` (session Claude, sans clé). GO obligatoire pour `graduation.mjs preparer`.

## Ordre d'un transfert .eu → .fr
Graduation (éligibilité) → « oui » de Valentin → Conseil des Agents (GO) → Agent Gardien (pas de régression) → PR →
fusion sur ordre de Valentin → publication → Sentinelle (100 sessions) → audit réseau signé.
