/**
 * @file messages.ts
 * Dictionnaire des messages d'Octet (contenu séparé du rendu). Règles d'écriture : docs/octet-voice.md.
 * Chaque message est du texte brut : jamais de HTML, jamais de contenu venu de la communauté.
 * Pour ajouter un usage : ajouter une entrée ici, puis l'afficher avec <OctetMessage message={MESSAGES.xxx} />.
 */

export type VarianteOctet = 'welcome' | 'tip' | 'empty' | 'success' | 'help';
export type PoseOctet = 'arrosoir' | 'loupe' | 'sablier' | 'fiole' | 'cle';

export interface MessageOctet {
  variante: VarianteOctet;
  /** Titre court facultatif. */
  titre?: string;
  texte: string;
  /** Illustration facultative (poses existantes uniquement). Sans elle, le message fonctionne tel quel. */
  pose?: PoseOctet;
}

export const CONTACT_EQUIPE = 'contact@alphabette.fr';

export const MESSAGES = {
  accueil: { variante: 'welcome', pose: 'arrosoir', titre: 'Faisons pousser la prochaine application utile.', texte: 'Proposez une idée, améliorez celles des autres, soutenez les projets à faire avancer et testez les prototypes de la communauté.' },
  conseilFormulaire: { variante: 'tip', texte: 'Décrivez le problème que vous aimeriez résoudre. Votre idée n’a pas besoin d’être parfaite pour commencer.' },
  conseilIdee: { variante: 'tip', texte: 'Une idée peut commencer par un petit problème du quotidien. Qu’aimeriez-vous simplifier ?' },
  conseilDiscussion: { variante: 'tip', texte: 'Qu’est-ce qui rendrait cette idée plus utile ou plus simple à utiliser ?' },
  conseilPrototype: { variante: 'tip', texte: 'Essayez le prototype, puis dites-nous ce qui vous a paru utile ou difficile.' },
  succesPublie: { variante: 'success', texte: 'Merci, votre idée a bien été enregistrée. La communauté peut maintenant en discuter.' },
  succesEnAttente: { variante: 'success', texte: 'Merci, votre proposition est reçue. Elle sera visible après la vérification prévue par le Laboratoire.' },
  videAucune: { variante: 'empty', pose: 'fiole', texte: 'Il n’y a pas encore d’idée. Vous pouvez ouvrir la voie.' },
  videFiltre: { variante: 'empty', pose: 'loupe', texte: 'Aucune idée ne correspond à ce filtre. Essayez une autre étape ou d’autres mots.' },
  chargement: { variante: 'tip', pose: 'sablier', texte: 'Chargement des idées…' },
  progression: { variante: 'tip', texte: 'Les soutiens aident à choisir quoi examiner en premier ; ils ne garantissent pas un développement. Une application peut être examinée en vue d’une publication sur alphabette.fr, ce qui demande un examen et l’accord explicite de son créateur.' },
} satisfies Record<string, MessageOctet>;

export interface EntreeAide { cle: string; question: string; reponse: string }

/** Aide de la page des idées. Chaque réponse décrit un comportement réellement implémenté (voir tests/octet). */
export const AIDE_LABORATOIRE: EntreeAide[] = [
  { cle: 'proposer', question: 'Comment proposer une idée ?', reponse: 'Choisissez « Proposer une idée », puis décrivez le problème et la solution imaginée. Il n’y a ni compte ni e-mail à fournir. Votre idée est visible de tous : évitez les liens et toute information personnelle.' },
  { cle: 'voter', question: 'Comment voter ?', reponse: 'Choisissez « Soutenir cette idée » sur la carte de l’idée. Le soutien est limité par appareil ; vous pouvez le retirer quand vous voulez.' },
  { cle: 'vote-note', question: 'Quelle différence entre un vote et une note ?', reponse: 'Un soutien dit « j’en ai besoin » et concerne une idée. Une note de 1 à 5 étoiles dit « j’ai essayé » et concerne seulement un prototype que vous avez réellement testé.' },
  { cle: 'statut', question: 'Que signifie le statut d’un prototype ?', reponse: 'Le statut indique l’étape atteinte : idée, discussion, prototype, essais, puis décision de publication éventuelle. Une idée peut aussi être mise en pause, refusée ou archivée, avec une explication.' },
  { cle: 'developpee', question: 'Une idée très votée sera-t-elle forcément développée ?', reponse: 'Non. Les soutiens aident l’équipe à choisir les pistes à étudier, sans engagement de développement.' },
  { cle: 'fr', question: 'Une application peut-elle rejoindre alphabette.fr ?', reponse: 'Cela peut être envisagé après contrôle, avec l’accord explicite de son créateur et une fois les conditions applicables définies. Un nombre de soutiens ne suffit jamais.' },
  { cle: 'contact', question: 'Une autre question ?', reponse: `Je n’ai pas de réponse prête : vous pouvez écrire à l’équipe à ${CONTACT_EQUIPE}.` },
];

export const LIBELLE_AIDE = 'Besoin d’un coup de patte ?';
