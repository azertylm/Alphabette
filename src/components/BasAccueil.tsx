import React, { useEffect, useState } from 'react';
import { useShell } from '@alphabette/shell';
import { MODE_LABO } from '../labo/labo';
import { dateLongue, decouverteDejaOuverte, decouverteTerminee, etatOffres, lancerDecouverte, passActif, tempsRestant } from '../labo/pass';

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
  // Laboratoire (.eu) : Pass Découverte 48 h, sans carte bancaire.
  const [pass, setPass] = useState(() => (MODE_LABO ? passActif() : null));
  const [finie, setFinie] = useState(() => MODE_LABO && decouverteTerminee());
  const [ouverte, setOuverte] = useState(false);
  const [gratuitJusquAu, setGratuitJusquAu] = useState<string | null>(null);
  const [msgDecouverte, setMsgDecouverte] = useState('');
  useEffect(() => {
    if (!MODE_LABO) return;
    etatOffres().then((e) => { setOuverte(e.decouverte); setGratuitJusquAu(e.gratuitJusquAu); });
    const t = setInterval(() => { setPass(passActif()); setFinie(decouverteTerminee()); }, 60000);
    return () => clearInterval(t);
  }, []);
  const essayer = async () => {
    setMsgDecouverte('Ouverture…');
    const r = await lancerDecouverte();
    setMsgDecouverte(r.ok ? '' : r.message ?? '');
    setPass(passActif());
  };

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
        {MODE_LABO && gratuitJusquAu && (
          <div className="accueil__carte accueil__carte--vedette accueil__decouverte" role="status">
            <p>
              🎉 <strong>Tout est gratuit jusqu'au {dateLongue(gratuitJusquAu)}</strong> : rien à payer, aucun Pass à prendre d'ici là.
            </p>
          </div>
        )}
        {MODE_LABO && (
          <div className="accueil__carte accueil__decouverte">
            {pass ? (
              <p role="status">
                {pass.type === 'decouverte'
                  ? <>⏳ Pass Découverte : <strong>{tempsRestant(pass.fin)}</strong> restantes</>
                  : <>✅ {pass.offre === 'ecosysteme' ? 'Pass Écosystème' : `Pass ${pass.app_nom ?? 'Application'}`} actif</>}
              </p>
            ) : finie && gratuitJusquAu ? (
              <p role="status">Vos 48 h de découverte sont terminées. Le débat Premium offert revient chaque jour, et tout reste gratuit jusqu'au {dateLongue(gratuitJusquAu)}.</p>
            ) : finie ? (
              <p role="status">
                Vos 48 h de découverte sont terminées. Pour continuer : Pass {config.perAppPerYear} € ou {config.ecosystemPerYear} € —{' '}
                <strong>12 mois, aucun renouvellement automatique.</strong>
              </p>
            ) : (
              <>
                <button type="button" className="labo__bouton labo__bouton--envoyer" onClick={essayer} disabled={!ouverte || decouverteDejaOuverte()}>
                  Essayer gratuitement 48 h (sans carte bancaire)
                </button>
                <span>{ouverte ? 'Les débats Premium d\'IA Débat et les fonctions Premium, pendant 48 h.' : 'Le Pass Découverte ouvre très bientôt.'}</span>
                {msgDecouverte && <span role="status">{msgDecouverte}</span>}
              </>
            )}
            <span>
              <a className="accueil__lien" href="/pass/">Les Pass</a> · <a className="accueil__lien" href="/pass/#cadeau">🎁 Offrir en cadeau</a> ·{' '}
              <a className="accueil__lien" href="/pass/#code">J'ai un code cadeau</a>
            </span>
          </div>
        )}
        <p className="accueil__note">
          Prix TTC, avec {config.trialDays} jours d'essai.{' '}
          {MODE_LABO
            ? gratuitJusquAu
              ? `Offre de lancement : gratuit jusqu'au ${dateLongue(gratuitJusquAu)} inclus. Ensuite : 12 mois, aucun renouvellement automatique.`
              : `12 mois, aucun renouvellement automatique.${/^https:\/\/buy\.stripe\.com\//.test(config.paymentLinks.ecosystem) ? '' : ' Le paiement en ligne ouvre bientôt : en attendant, les applications s\'utilisent librement.'}`
            : 'Le paiement en ligne n\'est pas encore ouvert : aujourd\'hui, les applications s\'utilisent librement.'}
        </p>
        <p className="accueil__note">
          🎟️ Vous avez un code d'invitation ?{' '}
          <a className="accueil__lien" href="/inscription/">
            Inscrivez-vous gratuitement
          </a>{' '}
          : toutes les applications vous reconnaîtront.
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
        </p>
        {MODE_LABO && (
          <p>
            ♥ <a href="#soutenir">Soutenir le laboratoire (hébergement OVH &amp; crédits IA)</a> : 5 €, 10 € ou le montant de votre choix,
            sans abonnement · <a href="#tableau-honneur">Tableau d'Honneur</a> · <a href="/embarquement/">Proposer une application</a>
          </p>
        )}
        <p className="accueil__legal">
          <a href="/mentions-legales">Mentions légales</a>
          <a href="/confidentialite">Confidentialité</a>
          <a href="/cookies">Cookies</a>
          <a href="/conditions-de-vente">CGV</a>
        </p>
        <p>
          <a href="/admin" className="accueil__discret">
            Administration
          </a>
        </p>
      </footer>
    </div>
  );
};
