import React from 'react';
import { useShell } from '@alphabette/shell';

/**
 * @file BasAccueil.tsx
 * Bas de la page d'accueil : tarifs, engagements, soutien et pied de page.
 *
 * Volontairement court et sans rien de simulé : pas de faux paiement, pas de
 * code promotionnel, pas de compte de démonstration. Les montants viennent de
 * la configuration du hub (via la base commune) ; le don ouvre le panneau de
 * la barre (virement, RIB publié par le hub).
 */

interface BasAccueilProps {
  /** Nombre d'applications gratuites en ligne (registre). */
  gratuites: number;
}

export const BasAccueil: React.FC<BasAccueilProps> = ({ gratuites }) => {
  const { config, openPanel } = useShell();

  return (
    <div className="accueil accueil--bas">
      <section id="tarifs" className="accueil__bloc" aria-labelledby="titre-tarifs">
        <h2 id="titre-tarifs" className="accueil__sous-titre">Combien ça coûte ?</h2>
        <div className="accueil__prix">
          {gratuites > 0 && (
            <div className="accueil__carte">
              <strong>Gratuit</strong>
              <span>
                {gratuites} application{gratuites > 1 ? 's sont gratuites' : ' est gratuite'}, définitivement.
              </span>
            </div>
          )}
          <div className="accueil__carte">
            <strong>{config.perAppPerYear} € par an</strong>
            <span>Une application de votre choix.</span>
          </div>
          <div className="accueil__carte accueil__carte--vedette">
            <strong>{config.ecosystemPerYear} € par an</strong>
            <span>Toutes les applications, d'aujourd'hui et de demain.</span>
          </div>
        </div>
        <p className="accueil__note">
          Prix TTC, avec {config.trialDays} jours d'essai. Le paiement en ligne n'est pas encore ouvert :
          aujourd'hui, les applications s'utilisent librement.
        </p>
      </section>

      <section className="accueil__bloc" aria-labelledby="titre-engagements">
        <h2 id="titre-engagements" className="accueil__sous-titre">Ce à quoi nous tenons</h2>
        <ul className="accueil__liste">
          <li>
            <strong>Pas de publicité.</strong> Ni sur ce site, ni dans les applications.
          </li>
          <li>
            <strong>Vos informations restent chez vous.</strong> La plupart des applications les gardent sur votre
            appareil, sans compte obligatoire.
          </li>
          <li>
            <strong>L'intelligence artificielle, seulement si vous le voulez.</strong> Beaucoup d'applications
            fonctionnent sans.
          </li>
          <li>
            <strong>Fait par un développeur indépendant</strong>.
          </li>
        </ul>
      </section>

      <section className="accueil__bloc accueil__soutien" aria-labelledby="titre-soutien">
        <h2 id="titre-soutien" className="accueil__sous-titre">Soutenir Alphabette</h2>
        <p className="accueil__phrase">Le projet vit grâce à celles et ceux qui l'utilisent.</p>
        <button type="button" className="accueil__bouton-don" onClick={() => openPanel('dons')}>
          ♥ Faire un don
        </button>
      </section>

      <footer className="accueil__pied">
        <p>
          © {new Date().getFullYear()} Alphabette ·{' '}
          <a href="mailto:contact@alphabette.fr">contact@alphabette.fr</a>
        </p>
        <p>
          <a href="/50-idees-logiciels-decouverte.html">50 idées d'applications</a>
          <a href="/admin" className="accueil__discret">
            Administration
          </a>
        </p>
      </footer>
    </div>
  );
};
