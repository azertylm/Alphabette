# Combinaisons secrètes d'Octet — changer de saison en 5 minutes

Les combinaisons qui offrent 1, 2 ou 3 mois d'accès vivent **uniquement sur le serveur** (alphabette.eu).
Le site ne les connaît pas : il envoie les derniers gestes du visiteur, le serveur répond oui ou non.

## Changer de saison (sans toucher au code)

1. Ouvrez **https://alphabette.eu/admin-secrets.html** et tapez le mot de passe administrateur
   (le même que `ADMIN_PASSWORD` sur OVH, 12 caractères minimum).
2. Décochez « actif » sur les combinaisons de la saison passée (elles restent dans l'historique du compteur).
3. Ajoutez une ligne par nouvelle combinaison : nom, durée (1, 2 ou 3 mois), saison, dates de début et de fin,
   indice (visible dans le carnet), et les gestes.
   Gestes : `U` ↑, `D` ↓, `L` ←, `R` →, `O` = toucher Octet. Exemple : `URDLURDLO`.
   Règles vérifiées par le serveur : 6 à 16 gestes, au moins 4 flèches, se termine par `O`,
   et une combinaison ne doit pas être la fin d'une autre.
4. Cliquez sur « Enregistrer ». C'est en ligne immédiatement.
5. Si une chasse au trésor accompagne la saison, modifiez `public/shared/chasse.json` (voir plus bas) et publiez le hub.

## Voir le compteur

Même page : nombre d'activations par combinaison et par mois. Aucune adresse IP, aucun identifiant d'appareil lisible.

## Où sont les fichiers (sur OVH)

Dossier privé du serveur (protégé par `.htaccess`), sous-dossier `secrets/` :

| Fichier | Rôle |
|---|---|
| `combinaisons.json` | la table (modifiable à la main en secours, même format que la page) |
| `activations.json` | appareils déjà servis (empreinte non réversible) + compteur `{combinaison: {"AAAA-MM": n}}` |
| `limites.json` | frein anti-essais en rafale, effacé au bout de 10 minutes |
| `sel.txt` | clé secrète du serveur — ne jamais supprimer (sinon chaque appareil pourrait reprendre une combinaison) |

## Chasse au trésor : `public/shared/chasse.json`

Un seul fichier décrit la chasse en cours : `saison`, `titre`, `debut`, `fin`, `indices[]`
(`id`, `app`, `adresse` de la page sans `https://`, `exacte: true` pour cette page seulement, `ou`, `fragment`),
`recompense`. Les applis n'ont rien à modifier : la double barre charge `octet-chasse.js`, qui affiche le
fragment sur la bonne page. Les indices trouvés restent dans le navigateur (stockage commun via
`/shared/octet-pont.html` pour les sous-domaines `*.alphabette.fr`).
Nouvelle saison = nouveaux `id` (ex. `printemps-2027-1`), sinon les anciens indices resteraient « trouvés ».

## Choix faits (consignes ambiguës)

- **Serveur unique sur alphabette.eu** (`api/secrets.php`) : PHP déjà en place là-bas ; alphabette.fr l'appelle.
- **Stockage JSON verrouillé**, pas de SQLite : plus simple à relire et corriger à la main.
- **Identifiant d'appareil** : nombre au hasard dans le stockage local, jamais lié à une personne ; le serveur n'en garde qu'une empreinte.
- **Les 3 combinaisons d'origine** sont rangées en empreinte SHA-256 (pas en clair dans le dépôt). Elles ont été visibles
  dans l'ancien code : elles expirent le 31/12/2026 — à remplacer par celles de l'hiver.
- **Réseau coupé** : rien n'est validé dans le navigateur ; Octet ouvre son parapluie, la saisie est gardée 7 jours
  et vérifiée au retour du réseau.
- **Accès offert** : la date de fin renvoyée est rangée dans l'inscription locale (`ab_membre.jusquau`), déjà lue par les applis.
- **Transparence** : le carnet affiche le nombre de combinaisons en jeu et précise « cadeau du créateur, sans achat ni tirage au sort ».
  À faire valider par un juriste (distinction cadeau / jeu-concours).
