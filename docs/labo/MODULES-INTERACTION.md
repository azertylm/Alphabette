# Modules d'interaction du Laboratoire (base commune `@alphabette/shell`)

Code dans `packages/shell/src/labo/`. Une appli les récupère avec `bun run sync:shell` (ou la copie `src/labo-avis/`).

## 1. Bac à sable A/B en direct — `ABTestToggle.tsx`
```tsx
<ABTestToggle testId="iadebat-accueil-v2" ticketId="fb_1763287200_x9a2"
  variantA={<Accueil />} variantB={<AccueilPropose />} />
```
- Barre flottante en bas d'écran : « Version actuelle » / « Proposition de l'IA », bascule immédiate, « 👍 Je préfère celle-ci ».
- Vote : `POST /api/feedback.php {action:"ab", app_id, test_id, ticket_id, choix:"A"|"B"}` → compteur `ab_tests[test_id]`
  et inscription sur le ticket (`avis.ab = {test_id, A, B}`), visible dans l'export lu par les agents. Un vote par visiteur et par test.
- `?ab=B` ouvre directement la proposition. Hors d'alphabette.eu : seule la variante A, ni barre ni requête.
- `useABTest(testId, {ticketId})` pour un rendu personnalisé.

## 2. Retour vocal mains-libres — `useVoiceFeedback.tsx`, `structurerAvisVocal.ts`, `whisper.worker.ts`
```tsx
const voix = useVoiceFeedback({ onResultat: ({ avis }) => remplir(avis) }); // avis = { type, resume, urgence }
<BoutonMicro voix={voix} />
```
- 15 s au plus. Moteur 1 : Web Speech API (la transcription passe par le service du navigateur : Google pour Chrome,
  Microsoft pour Edge, Apple pour Safari — c'est écrit sous le bouton). Moteur 2 (repli) : Whisper « tiny » en WebGPU
  dans un worker, l'audio ne quitte pas l'appareil ; ~40 Mo téléchargés une fois, seulement après accord du visiteur.
- `structurerAvisVocal(texte)` → `{ type: "bug"|"ux"|"avis", resume, urgence: 1-5 }` par règles de mots-clés
  (pas d'IA, pas de serveur) ; le texte passe par le filtre de confidentialité. Le visiteur relit et corrige
  (catégorie, texte, urgence) avant d'envoyer. Envoi : `source:"voix"`, `urgence`.
- Branché dans le module d'avis du hub (`src/labo/LaboAvis.tsx`).

## 3. Micro-tutos — `InteractiveSpotlight.tsx`
```tsx
<InteractiveSpotlight tutoId="iadebat-lancer" steps={[{ cible: '#sujet', titre: '…', texte: '…' }, …]} />
<MicroTuto appId="iadebat" />   // tuto écrit par les agents dans data/labo/tutos.json
```
- 3 éléments au plus, l'un après l'autre ; éléments absents sautés ; une fois par tuto et par appareil ; Échap, ← →,
  boutons de 48 px, textes de 18 px, sans animation si l'appareil le demande. Prêt pour alphabette.fr.
- Déclenchement : `node scripts/labo/tutos.mjs frictions /tmp/feedbacks.json` repère les difficultés d'usage récurrentes
  (« je ne trouve pas… », « comment on… », ≥ 3 avis, sans erreur JavaScript). L'agent écrit alors le tuto dans
  `data/labo/tutos.json` (publié sur .eu). Sur .fr, seuls les tutos `"vitrine": true` (ordre de Valentin) sont publiés.
