# Agent Chaos (« Avocat du Diable ») et Agent de Graduation

## Agent Chaos — chaque nuit à 2 h 37 (heure de Paris en hiver), `.github/workflows/labo-chaos.yml`
Script : `scripts/labo/chaos.mjs` (Node.js + Playwright, Chromium). Pour chaque appli de `alphabette.eu/api/apps.json`,
sur 320×568 et 280×653 (mobile tactile) :
- **écoute** : exceptions non gérées (`pageerror`), promesses rejetées, `console.error`, débordement horizontal (éléments fautifs) ;
- **rage clicking** : 12 clics en rafale sur 4 boutons sans risque (jamais payer, envoyer, supprimer, publier, se déconnecter) ;
- **clés BYOK** : champ de clé vide puis clé invalide `sk-chaos-invalide-0000`, validation au clavier ; la page ne doit pas devenir blanche ;
- **hors-ligne brutal** : coupure réseau et rechargement ; une appli installable (service worker) doit rester utilisable.

Rapport (`RapportChaos`) rangé sur la branche `labo-donnees` : `chaos/dernier.json` et `chaos/<date>.json` (14 nuits) :
```json
{
  "genere_le": "2026-11-19T01:52:10Z",
  "agent": "Agent Chaos",
  "total": 1,
  "apps": [{
    "app_id": "bonplan", "nom": "BON PLAN", "url": "https://alphabette.eu/apps/bonplan/",
    "anomalies": [{
      "type": "exception", "etape": "rage-click", "ecran": "320x568",
      "detail": "TypeError: Cannot read properties of null (reading 'style')",
      "pile": "at HTMLButtonElement.<anonymous> (index-abc123.js:1:5032)",
      "ticket": "[Agent Chaos] BON PLAN — exception (rage-click, 320x568) : TypeError: …"
    }]
  }]
}
```
Types : `exception`, `promesse_rejetee`, `console_error`, `debordement`, `ecran_blanc`, `pwa_hors_ligne`, `chargement`, `audit_interrompu`.
Les anomalies deviennent des tickets « [Agent Chaos] » pour les agents : `scripts/labo/correcteur.mjs candidats` les ajoute aux bugs à
corriger (critiques : exception, promesse rejetée, écran blanc, PWA hors ligne), et elles bloquent la graduation tant qu'elles existent.
**Elles ne sont pas publiées dans la base d'avis publique** : cette écriture automatique a été refusée par le contrôle de sécurité
le 18/11/2026 ; à reconsidérer seulement sur décision de Valentin (avec une signature du robot que personne ne puisse imiter).

## Agent de Graduation — `.claude/agents/agent-graduation.md`, `scripts/labo/graduation.mjs`
- `eligibles` : note ≥ 4,5/5, ≥ 20 avis vérifiés (humains, non rejetés), 0 bug critique ouvert ni ouvert depuis 7 jours (Agent Chaos compris).
  Message pour Valentin : « 🚀 <Appli> a atteint X/5 sur N avis vérifiés… Veux-tu que je la transfère sur alphabette.fr ? »
- `preparer <app_id>` (sur son ordre seulement, sur une branche) : `vitrine` + `certifie` dans le registre, version figée, `data/labo/graduation.json`.
- À la publication de la vitrine, `scripts/labo/seo.mjs` pré-rend la page de chaque appli certifiée : `<title>`, description, canonique,
  Open Graph + Twitter, JSON-LD `SoftwareApplication` avec `aggregateRating` (vraie note et vrai nombre d'avis), contenu lisible dans `#root`,
  badge « Certifié par la communauté » (aussi sur la tuile de alphabette.fr).

## Notes de version bilingues — `.claude/agents/redacteur-notes.md`, `scripts/labo/notes-version.mjs`
Commits + tickets fermés → `data/labo/notes_version.json` : « technique » (sous la carte de .eu, menu « Notes techniques »)
et « citoyenne » (ligne « Nouveau : … » sous la tuile de .fr).
