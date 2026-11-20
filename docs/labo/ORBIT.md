# ORBIT « anti-algorithme » (alphabette.eu/orbit/)

Nouveau cœur d'ORBIT, **sur .eu seulement**. Sur .fr, `public/orbit/` (Orbit v4 compilé) n'a pas été modifié.

| Fichier | Rôle |
|---|---|
| `labo/orbit/index.html`, `orbit.css`, `orbit.js` | L'appli : JS natif, aucune dépendance, aucune police distante |
| `labo/orbit/catalogue.json` | 51 vidéos de départ, **adresses seulement** (titres, durées et orbites sont relus) |
| `labo/orbit/orbites.json` | Les 6 Orbites (slug, nom, icône, couleur, mots-clés, active) |
| `labo/orbit/sw.js` | Interrupteur : désinstalle le service worker d'Orbit v4 |
| `serveur/php/orbit.php` → `eu/api/orbit.php` | Relais : fiches (oEmbed + page publique), miniatures servies par Alphabette, empreinte d'image, IA |
| `tests/orbit/test_orbit.py` | 32 vérifications du relais (faux YouTube / TikTok / OpenRouter) |
| `tests/orbit/apercu.mjs` | Parcours Chrome 390 px, 20 vérifications + captures |

## Les 10 fonctions
1. **Curseur Bulle / Découverte** (0 à 100 %) : dosage exact et visible ; les orbites choisies sont gardées dans `localStorage` `orbit_prefs`.
2. **Minuteur doux** (5 min, 15 min, 5 vidéos, Libre) : il ne compte que le temps où la page est visible ; à la fin, la lecture s'arrête et un écran calme s'affiche ; rien ne se relance.
3. **Autre point de vue** (vidéos d'actualité ou de débat) : l'IA choisit dans le catalogue, sinon elle propose une recherche YouTube.
4. **Durée réelle** : Express < 1 min, Pause café 3–10 min, Documentaire > 20 min. Une vidéo de durée inconnue n'est pas classée.
5. **Sans son** : la vidéo est retenue si l'IA dit `sans_son: true` ou si YouTube annonce des sous-titres ; le lecteur démarre alors en muet, sous-titres activés.
6. **Résumé en 1 phrase** : sur les vidéos YouTube de 8 min ou plus. Il est signé « Résumé IA d'après le titre et la description » avec le nom du modèle.
7. **Orbites** : Culture générale, Humour, Tech & IA, Sport, Musique live, Bricolage.
8. **Mettre en orbite** : on colle une adresse, puis le relais lit la fiche et l'IA donne le titre propre, la langue, l'orbite et le ton. Accepte aussi `/orbit/?url=…`.
9. **Doublons** : même titre et même durée à ±2 s, ou miniature identique (dHash 64 bits, ≤ 6 bits d'écart). La version gardée est, dans l'ordre : YouTube, TikTok, Instagram, Facebook.
10. **Plongée** : 5 étapes de plus en plus pointues, prises dans le catalogue ou proposées en recherche YouTube.

## Vie privée
- Aucune vignette ni aucun lecteur tiers n'est chargé avant le clic : les miniatures viennent de `api/orbit.php?miniature=`. Pour YouTube, le lecteur passe par `youtube-nocookie.com`. Un seul lecteur est actif à la fois, et il est retiré dès qu'il quitte l'écran.
- Le relais ne garde que des empreintes HMAC du jour pour les quotas, jamais d'adresse IP. Ses données sont rangées dans `~/alphabette-orbit/`.

## IA
- Le relais utilise la clé OpenRouter du relais d'IA Débat (`~/alphabette-iadebat/config.json`), en **modèles `:free` uniquement** (prix maximum 0).
- Quotas : 40 analyses non encore en cache par appareil et par jour, 300 au total. **Chaque vidéo n'est analysée qu'une fois** (cache partagé).
- Si le relais est saturé et que le visiteur a branché OpenRouter dans IA Débat (même site), l'analyse se fait dans son navigateur, avec sa propre clé.

## Facultatif : clé YouTube
Créer `~/alphabette-orbit/config.json` contenant `{"youtube_cle": "AIza…"}` (API YouTube Data v3, gratuite).
Elle apporte des durées et des sous-titres plus sûrs que la lecture de la page publique, et permet à Plongée et à Autre point de vue de trouver des vidéos hors du catalogue (environ 90 recherches par jour).
Sans cette clé, ces deux fonctions proposent un lien de recherche YouTube.

## Limites connues
- Instagram et Facebook : leur oEmbed exige un jeton Meta. ORBIT n'invente pas de titre et la durée reste inconnue. Le lecteur intégré fonctionne.
- TikTok : oEmbed ne donne pas la durée.
