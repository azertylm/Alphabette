import React from 'react';

/**
 * @file CommentCaMarche.tsx
 * Trois encadrés courts : comment fonctionnent alphabette.eu (atelier) et
 * alphabette.fr (vitrine). Même texte sur les deux accueils.
 */
const ETAPES: { titre: string; texte: string }[] = [
  {
    titre: 'Testez et améliorez sur alphabette.eu',
    texte: 'Tout le monde peut essayer les applications, les noter et donner son avis. Chaque retour est lu et des agents IA interviennent pour corriger et faire progresser les applis.',
  },
  {
    titre: 'Proposez une idée ou votre propre appli',
    texte: "Chacun peut soumettre une idée ou déposer directement sa création sur alphabette.eu. Chaque application est relue avant d'être mise en ligne.",
  },
  {
    titre: 'Décidez ce qui passe sur alphabette.fr',
    texte: 'alphabette.fr regroupe les applications abouties et reconnues. Vous et nos équipes gardez la main, et c\'est surtout le vote des contributeurs qui valide l\'accès à alphabette.fr.',
  },
];

export const CommentCaMarche: React.FC = () => (
  <section id="comment-ca-marche" className="accueil__bloc comment" aria-label="Comment fonctionnent alphabette.eu et alphabette.fr">
    {ETAPES.map((e) => (
      <div key={e.titre} className="accueil__carte comment__carte">
        <strong>{e.titre}</strong>
        <span>{e.texte}</span>
      </div>
    ))}
  </section>
);
