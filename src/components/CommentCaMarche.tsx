import React from 'react';

/**
 * @file CommentCaMarche.tsx
 * Explication du fonctionnement d'alphabette.eu (atelier) et alphabette.fr
 * (vitrine). Même texte sur les deux accueils.
 */

/** Version courte (encart en haut de page). */
export const EncartAtelierVitrine: React.FC = () => (
  <p className="accueil__carte accueil__carte--vedette accueil__encart" role="note">
    Sur <a className="accueil__lien" href="https://alphabette.eu">alphabette.eu</a>, testez, notez et améliorez les applis
    (chaque avis est lu et corrigé par des agents IA), ou proposez vos idées et vos créations (relues avant affichage).
    Vous et nos équipes gardez la décision, et c'est surtout le vote des contributeurs qui valide l'accès à{' '}
    <a className="accueil__lien" href="https://alphabette.fr">alphabette.fr</a>.
  </p>
);

/** Version fluide + version structurée (section « Comment ça marche ? »). */
export const CommentCaMarche: React.FC = () => (
  <section id="comment-ca-marche" className="accueil__bloc" aria-labelledby="titre-comment">
    <h2 id="titre-comment" className="accueil__sous-titre">Comment fonctionnent alphabette.eu et alphabette.fr ?</h2>
    <p className="accueil__phrase">
      De l'atelier alphabette.eu à la vitrine alphabette.fr. Sur alphabette.eu, chacun peut tester, noter et améliorer les
      applications. Chaque avis est lu et pris en compte : des agents IA corrigent les bugs et font évoluer les applis en
      continu. Vous pouvez aussi proposer une idée ou déposer votre propre application, qui est relue avant d'être affichée.
      Pour la suite, vous et nos équipes gardez la décision — et c'est surtout le vote des contributeurs qui valide
      l'accès des meilleures applications sur alphabette.fr.
    </p>
    <div className="accueil__prix">
      <div className="accueil__carte">
        <strong>1. Testez et améliorez sur alphabette.eu</strong>
        <span>Tout le monde peut essayer les applications, les noter et donner son avis. Chaque retour est lu et des agents IA interviennent pour corriger et faire progresser les applis.</span>
      </div>
      <div className="accueil__carte">
        <strong>2. Proposez une idée ou votre propre appli</strong>
        <span>Chacun peut soumettre une idée ou déposer directement sa création sur alphabette.eu. Chaque application est relue avant d'être mise en ligne.</span>
      </div>
      <div className="accueil__carte">
        <strong>3. Décidez ce qui passe sur alphabette.fr</strong>
        <span>alphabette.fr regroupe les applications abouties et reconnues. Vous et nos équipes gardez la main, et c'est surtout le vote des contributeurs qui valide l'accès à alphabette.fr.</span>
      </div>
    </div>
  </section>
);
