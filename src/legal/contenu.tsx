import React from 'react';
import { MODE_LABO } from '../labo/labo';

/**
 * Texte des pages légales d'alphabette.fr et alphabette.eu.
 * Version du 19 novembre 2026 fournie par Valentin Richaud (Alphabette SASU),
 * complétée par ce que fait réellement le code (relais IA Débat, dictée vocale,
 * Google Fonts, GitHub, Firebase, inscription par code, dons par virement).
 * Ce n'est pas un avis juridique : à faire relire avant l'ouverture du paiement.
 * Les ajouts du 20 novembre 2026 (Tableau d'Honneur, boîte à idées) ne s'affichent que sur alphabette.eu
 * (MODE_LABO), seul site où ces fonctions existent : les pages d'alphabette.fr ne changent pas.
 */

const AC: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <mark className="legal__completer">[{children}]</mark>
);

const MAJ = `Dernière mise à jour : ${MODE_LABO ? '20' : '19'} novembre 2026`;
const MAIL = 'azertylm@gmail.com';
const Mail = () => <a href={`mailto:${MAIL}`}>{MAIL}</a>;

const Lien: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

/* ------------------------------------------------------------------ */
export const MentionsLegales: React.FC = () => (
  <>
    <p className="legal__maj">{MAJ}</p>
    <p>
      Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), voici
      l'identité des intervenants des sites <strong>alphabette.fr</strong> et <strong>alphabette.eu</strong>.
    </p>

    <h2>Éditeur des sites</h2>
    <p>
      Les sites <strong>alphabette.fr</strong> (vitrine des applications validées) et <strong>alphabette.eu</strong>{' '}
      (laboratoire de test et d'amélioration continue) sont édités par :
    </p>
    <ul>
      <li><strong>Dénomination :</strong> Alphabette SASU</li>
      <li><strong>Forme juridique :</strong> Société par actions simplifiée unipersonnelle (SASU)</li>
      <li><strong>Adresse :</strong> La Grande-Motte (34280), France <AC>adresse complète du siège à ajouter</AC></li>
      <li><strong>Capital social :</strong> <AC>à compléter</AC></li>
      <li><strong>SIRET :</strong> en cours d'attribution</li>
      <li><strong>Immatriculation :</strong> en cours</li>
      <li><strong>TVA intracommunautaire :</strong> en cours d'attribution</li>
      <li><strong>Directeur de la publication :</strong> Valentin Richaud</li>
      <li><strong>Contact :</strong> <Mail /></li>
    </ul>

    <h2>Hébergement</h2>
    <ul>
      <li><strong>OVH SAS</strong> (OVHcloud)</li>
      <li><strong>Adresse :</strong> 2 rue Kellermann, 59100 Roubaix, France</li>
      <li><strong>RCS :</strong> Lille Métropole 424 761 419 00045</li>
      <li><strong>Téléphone :</strong> 1007 (depuis la France)</li>
      <li><strong>Site :</strong> <Lien href="https://www.ovhcloud.com">www.ovhcloud.com</Lien></li>
    </ul>

    <h2>Propriété intellectuelle</h2>
    <p>
      L'ensemble des contenus des sites alphabette.fr et alphabette.eu (textes, interfaces, graphismes, logos, sons,
      logiciels, codes sources et architecture) est la propriété exclusive d'Alphabette SASU ou fait l'objet d'une
      autorisation d'utilisation. Toute reproduction, représentation, modification ou exploitation, totale ou partielle,
      sans autorisation écrite préalable est interdite.
    </p>

    <h2>Responsabilité et statut des applications</h2>
    <ul>
      <li><strong>alphabette.fr</strong> propose des applications validées en version de production.</li>
      <li><strong>alphabette.eu</strong> est un espace expérimental de démonstration et de test. Les outils qui y figurent peuvent évoluer automatiquement et comporter des anomalies temporaires.</li>
    </ul>
    <p className="legal__encart">
      Les résultats, analyses ou contenus produits par les outils d'intelligence artificielle (notamment{' '}
      <em>IA Débat</em>) sont fournis à titre indicatif et d'aide à la réflexion. Ils ne constituent ni un conseil
      juridique, financier ou médical, ni une vérité absolue, et relèvent toujours de l'appréciation de l'utilisateur.
    </p>

    <h2>Autres pages</h2>
    <ul>
      <li><a href="/conditions-de-vente">Conditions générales de vente</a></li>
      <li><a href="/confidentialite">Politique de confidentialité</a></li>
      <li><a href="/cookies">Cookies et stockage local</a></li>
    </ul>
    <p>Pour signaler un contenu illicite : <Mail />.</p>
  </>
);

/* ------------------------------------------------------------------ */
export const ConditionsVente: React.FC = () => (
  <>
    <p className="legal__brouillon" role="note">
      Le paiement en ligne n'est pas encore ouvert : aucune vente n'est possible sur le site pour l'instant. Ces
      conditions s'appliqueront dès son ouverture.
    </p>
    <p className="legal__maj">{MAJ}</p>

    <h2>Article 1 — Objet et champ d'application</h2>
    <p>
      Les présentes conditions générales de vente (CGV) régissent les ventes de services numériques, d'abonnements, de
      crédits d'utilisation et de prestations web proposés par <strong>Alphabette SASU</strong> (en cours
      d'immatriculation, La Grande-Motte, France, ci-après « le Vendeur ») à tout client consommateur ou professionnel
      (ci-après « le Client ») via les sites alphabette.fr et alphabette.eu.
    </p>
    <p>Toute commande implique l'acceptation pleine et entière des présentes CGV.</p>

    <h2>Article 2 — Offres et services</h2>
    <p>Selon les offres affichées au moment de la commande :</p>
    <ul>
      <li><strong>Pass Application (annuel) — 15 € / an :</strong> accès complet pendant 12 mois à une application de l'écosystème Alphabette, sans publicité.</li>
      <li><strong>Pass Écosystème complet (annuel) — 40 € / an :</strong> accès complet pendant 12 mois à l'ensemble des applications de l'écosystème, sans publicité.</li>
      <li><strong>Essai :</strong> 7 jours d'essai offerts.</li>
      {MODE_LABO ? (
        <>
        <li><strong>Offre de lancement :</strong> toutes les applications de l'écosystème sont gratuites <strong>au moins jusqu'au 7 mai 2027 inclus</strong>. Aucun Pass ni pack de crédits n'est vendu avant cette date ; les dons restent possibles. Le Vendeur peut prolonger cette période, jamais la raccourcir.</li>
        <li><strong>Pass Découverte — gratuit, 48 heures :</strong> sur alphabette.eu, accès découverte aux fonctions Premium (notamment quelques débats Premium par jour sur <em>IA Débat</em>) pendant exactement 48 heures sur l'appareil où il est ouvert, sans carte bancaire. Il s'arrête seul et ne devient jamais payant.</li>
        <li><strong>Pass Cadeau (15 € ou 40 €) :</strong> le même Pass annuel, payé par le Client pour un tiers. Le Client reçoit un code et une carte cadeau à imprimer. Le code s'active dans les 12 mois suivant l'achat ; les 12 mois du Pass commencent le jour de l'activation.</li>
        <li><strong>Packs de crédits IA Débat :</strong> achat ponctuel, sans abonnement, de crédits pour des débats en mode Premium sur <em>IA Débat</em>, au-delà du quota gratuit quotidien (par exemple 5 € pour 50 débats Premium ; 1 crédit est décompté par débat Premium lancé). Les crédits n'expirent pas tant que le service est exploité.</li>
        <li><strong>Soutien « Mécène du Labo » :</strong> don ponctuel par carte (montant au choix), sans contrepartie ni abonnement.</li>
        </>
      ) : (
        <li><strong>Packs de crédits IA Débat :</strong> achat ponctuel de crédits pour des débats avancés ou en mode Premium sur <em>IA Débat</em>, au-delà du quota gratuit quotidien.</li>
      )}
      <li><strong>Prestation Site Vitrine — 390 € :</strong> création d'un site web vitrine clé en main selon le cahier des charges validé au préalable par devis ou échange écrit (hors coûts tiers de nom de domaine ou d'hébergement, sauf mention contraire).</li>
      <li><strong>Offres pour les professionnels et structures</strong> (par exemple structures seniors pour ProxiLien / Senior Bon Plan) : tarifs et modalités sur devis.</li>
      <li>Les applications déclarées gratuites le restent.</li>
    </ul>
    <p>
      Certaines applications permettent d'utiliser l'intelligence artificielle avec une clé API personnelle fournie par
      le Client (<em>Bring Your Own Key</em> / OpenRouter). Les frais éventuellement facturés par ce fournisseur tiers
      restent à la charge exclusive du Client.
    </p>

    <h2>Article 3 — Prix et paiement</h2>
    <p>
      Les prix sont indiqués en euros. Le régime de TVA applicable sera précisé dès l'attribution des identifiants
      fiscaux de la société.
    </p>
    <p>
      Le paiement se fera en ligne par carte bancaire via le prestataire sécurisé <strong>Stripe</strong> (Stripe
      Payments Europe, Ltd.). Alphabette SASU ne conserve aucune donnée bancaire.
    </p>
    <p>
      La commande est définitive dès validation du paiement. Pour la prestation Site Vitrine à 390 €, le règlement peut
      se faire en une fois ou selon l'échéancier convenu sur le devis.
    </p>

    <h2>Article 4 — Accès aux services et livraison</h2>
    <ul>
      {MODE_LABO ? (
        <>
          <li><strong>Pass annuels et packs de crédits :</strong> activés immédiatement après confirmation du paiement par Stripe, sur l'appareil de l'achat ; un code envoyé par e-mail permet d'utiliser le Pass sur 3 appareils au plus, ou de retrouver ses crédits.</li>
          <li><strong>Pass Cadeau :</strong> code et carte cadeau remis immédiatement après le paiement (page de confirmation et e-mail).</li>
        </>
      ) : (
        <li><strong>Pass annuels et packs de crédits :</strong> activés immédiatement après confirmation du paiement par Stripe.</li>
      )}
      <li><strong>Prestation Site Vitrine :</strong> délais de réalisation et de livraison précisés lors de la validation du projet.</li>
    </ul>

    <h2>Article 5 — Durée, sans renouvellement automatique</h2>
    <p className="legal__encart">
      Les Pass annuels (15 € et 40 €) durent <strong>12 mois</strong>. <strong>Il n'y a aucun renouvellement
      automatique</strong> : le Pass expire à l'issue des 12 mois, sans prélèvement. Le Client reste libre de le
      renouveler lui-même.
    </p>

    <h2>Article 6 — Arrêt du service et rétractation</h2>
    <p>Le Client peut arrêter d'utiliser les services à tout moment, sans engagement.</p>
    <p>
      Conformément à l'article L221-18 du Code de la consommation, le Client consommateur dispose de{' '}
      <strong>14 jours</strong> à compter de la commande pour exercer son droit de rétractation et demander un
      remboursement, sans avoir à se justifier, par simple e-mail à <Mail />.
    </p>

    <h2>Article 7 — Garanties légales et disponibilité</h2>
    <p>
      Le Client consommateur bénéficie de la garantie légale de conformité des contenus et services numériques (articles
      L224-25-12 et suivants du Code de la consommation).
    </p>
    <p>
      Alphabette SASU met en œuvre tous les moyens raisonnables pour assurer la continuité de ses services. Des
      interruptions ponctuelles liées à la maintenance, à l'hébergeur ou à des fournisseurs tiers (notamment les API
      d'intelligence artificielle) ne sauraient engager sa responsabilité.
    </p>

    <h2>Article 8 — Responsabilité</h2>
    <p>
      Alphabette SASU ne pourra être tenue responsable des dommages indirects ou résultant d'une mauvaise utilisation des
      outils, d'une coupure des fournisseurs d'API tiers, ou de décisions prises par le Client sur la base de textes ou
      analyses produits par une intelligence artificielle.
    </p>

    <h2>Article 9 — Réclamations, médiation et droit applicable</h2>
    <p>
      Les présentes CGV sont soumises au <strong>droit français</strong>. En cas de litige ou de réclamation, le Client
      est invité à contacter d'abord Alphabette SASU pour trouver une solution amiable :
    </p>
    <ul>
      <li><strong>Service réclamations :</strong> Valentin Richaud — Alphabette SASU</li>
      <li><strong>E-mail :</strong> <Mail /></li>
      <li><strong>Adresse :</strong> La Grande-Motte (34280), France</li>
    </ul>
    <p>
      À défaut d'accord amiable, le Client consommateur peut recourir gratuitement à un médiateur de la consommation
      (articles L611-1 et suivants du Code de la consommation). <strong>Médiateur :</strong>{' '}
      <AC>en cours de désignation — coordonnées indiquées ici avant toute vente à un consommateur</AC>
    </p>

    {MODE_LABO && (
      <>
        <h2>Article 10 — Contributions gratuites des visiteurs (alphabette.eu)</h2>
        <p>
          Sur alphabette.eu, chacun peut, gratuitement et sans compte, donner un avis, y ajouter un pseudo facultatif,
          proposer une idée d'application et voter. Ces contributions ne sont ni une vente ni une prestation : elles ne
          donnent lieu à aucun paiement, dans un sens comme dans l'autre.
        </p>
        <ul>
          <li>
            <strong>Tableau d'Honneur :</strong> le pseudo d'un avis qui a conduit à une amélioration mise en ligne peut
            être affiché au Tableau d'Honneur du mois, avec un titre honorifique (« Œil de lynx », « Voix du labo »,
            « Dompteur de bugs ») sans valeur marchande ni avantage associé. Un pseudo n'est pas réservé : un autre
            visiteur peut choisir le même. N'utilisez ni votre nom complet ni votre adresse e-mail.
          </li>
          <li>
            <strong>Idées :</strong> une idée publiée est visible de tous. En la publiant, vous acceptez qu'Alphabette ou
            un créateur du Collectif puisse s'en inspirer ou la réaliser librement, sans rémunération ni exclusivité. Une
            idée est une suggestion, pas une commande : Alphabette ne s'engage pas à la réaliser.
          </li>
          <li>
            <strong>Votes :</strong> un vote par idée et par appareil. Les votes automatisés ou en masse sont annulés.
          </li>
          <li>
            <strong>Modération :</strong> Alphabette peut masquer sans préavis une contribution illicite, blessante,
            publicitaire, hors sujet ou contenant des données personnelles.
          </li>
          <li>
            <strong>Retrait :</strong> pour faire retirer un pseudo, un avis ou une idée, écrivez à <Mail />.
          </li>
        </ul>
      </>
    )}

    <h2>Dons et statut « Membre fondateur »</h2>
    <p>
      {MODE_LABO
        ? "Les dons se font par virement bancaire, ou par carte via Stripe avec le bouton « Mécène du Labo » (paiement unique, jamais renouvelé). Un don est volontaire et n'est pas une vente. Le Mécène peut choisir d'afficher un pseudo dans le Tableau d'Honneur (jamais le montant) et peut demander à tout moment qu'il soit retiré."
        : "Les dons se font par virement bancaire, sans paiement en ligne. Un don est volontaire et n'est pas une vente."}{' '}Le
      statut « Membre fondateur » (places limitées) et ses contreparties sont décrits dans l'espace ♥ DON ; elles valent
      pour la durée d'exploitation du service. Aucun reçu fiscal n'est délivré.
    </p>
  </>
);

/* ------------------------------------------------------------------ */
const TRAITEMENTS: Array<[string, string, string, string]> = [
  ['Achat d\'un Pass, crédit ou prestation', 'Nom, e-mail, informations de facturation (traitées par Stripe)', 'Exécution de la commande, facturation et comptabilité', 'Exécution du contrat / Obligation légale'],
  ['Don par virement', 'Nom du donateur, IBAN, montant et motif transmis par la banque', 'Enregistrer et remercier le don, comptabilité', 'Intérêt légitime / Obligation légale'],
  ['Inscription par code d\'invitation', 'Prénom ou pseudo, statut, date, identifiant du code (cookie de 400 jours + copie locale ; le code est vérifié dans votre navigateur)', 'Vous reconnaître sur tous les sites Alphabette', 'Exécution du service'],
  ['Avis sur alphabette.eu', 'Texte de l\'avis soumis volontairement (y compris par dictée vocale)', 'Amélioration continue des applications (analyse par agents IA et correction de bugs)', 'Consentement / Intérêt légitime'],
  ['IA Débat sans clé (Mode Gratuit / Découverte)', 'Sujet et répliques du débat, transmis au serveur d\'Alphabette (OVHcloud) puis à OpenRouter ; empreinte anonyme du jour calculée à partir de l\'adresse IP (l\'IP elle-même n\'est pas conservée)', 'Faire répondre les IA sans clé personnelle et limiter le nombre de débats gratuits par jour', 'Exécution du service / Intérêt légitime'],
  ['IA avec votre propre clé (BYOK / OpenRouter)', 'Clé API stockée sur votre appareil ; requêtes envoyées directement au fournisseur choisi', 'Exécution des fonctions IA demandées', 'Exécution du service'],
  ['Applications avec compte (Info Perso, IA Débat, Révolution)', 'Selon l\'application : e-mail, nom affiché, photo Google, préférences, articles lus, ou identifiant anonyme et réponses. Les articles et commentaires proposés dans Info Perso sont publics', 'Fournir le service demandé', 'Exécution du service / Consentement (connexion Google)'],
  ['Contact par e-mail', 'Adresse e-mail et contenu du message', 'Répondre aux demandes d\'assistance ou de devis', 'Intérêt légitime / Mesures précontractuelles'],
  ['Sécurité et journaux techniques', 'Adresse IP et journaux du serveur (OVHcloud)', 'Sécurité, prévention des abus, bon fonctionnement', 'Intérêt légitime'],
];

/** Traitements propres au Laboratoire (alphabette.eu), ajoutés le 20 novembre 2026. */
const TRAITEMENTS_LABO: Array<[string, string, string, string]> = [
  ['Pass, Pass Découverte, Pass Cadeau et crédits IA Débat', 'Sur votre appareil : le Pass signé et sa date de fin, le code de votre porte-monnaie de crédits. Chez Alphabette (hors du site web) : le produit acheté, la date, l\'empreinte des codes et le solde de crédits, une empreinte anonyme du jour de l\'adresse IP (limite d\'un Pass Découverte par jour). L\'e-mail transmis par Stripe sert seulement à vous envoyer votre code ; il n\'est pas enregistré par Alphabette', 'Délivrer et vérifier le Pass, décompter les crédits, éviter les abus', 'Exécution du contrat / Intérêt légitime'],
  ['Mécène du Labo (soutien par carte)', 'Montant (traité par Stripe) ; pseudo publié dans le Tableau d\'Honneur seulement si vous cochez la case', 'Remercier, comptabilité, Tableau d\'Honneur', 'Consentement (pseudo) / Obligation légale'],
  ['Proposition d\'application (Salle d\'embarquement)', 'Nom de l\'application, adresse ou dépôt, description, pseudo, contact facultatif (jamais affiché) ; empreinte anonyme du jour de l\'adresse IP', 'Examiner la proposition, répondre au créateur, limiter les abus', 'Mesures précontractuelles / Intérêt légitime'],
  ['Tableau d\'Honneur (alphabette.eu)', 'Pseudo facultatif saisi avec un avis (les e-mails, adresses et numéros sont refusés) ; affiché seulement si l\'avis a conduit à une amélioration mise en ligne', 'Remercier publiquement les contributeurs du mois', 'Consentement (champ facultatif)'],
  ['Boîte à idées et votes (alphabette.eu)', 'Titre et phrase de l\'idée (publics) ; empreinte anonyme du jour calculée à partir de l\'adresse IP pour limiter les abus (l\'IP elle-même n\'est pas conservée) ; liste des idées votées gardée sur votre appareil', 'Choisir les prochaines applications, empêcher le spam et les votes multiples', 'Intérêt légitime'],
];

export const Confidentialite: React.FC = () => (
  <>
    <p className="legal__maj">{MAJ}</p>
    <p className="legal__encart">
      Alphabette suit un principe strict de <strong>sobriété des données</strong> : aucune publicité ciblée, aucun
      traceur publicitaire, aucune mesure d'audience par un tiers et aucune revente de données personnelles. Aucune
      donnée d'utilisateur ne sert à entraîner un modèle d'IA.
    </p>

    <h2>1. Responsable du traitement</h2>
    <p>
      Alphabette SASU (La Grande-Motte, France), représentée par Valentin Richaud. Contact RGPD : <Mail />.
    </p>

    <h2>2. Données traitées et finalités</h2>
    <p>
      La plupart des applications s'utilisent sans compte et gardent vos informations <strong>sur votre
      appareil</strong> (stockage du navigateur) : nous n'y avons pas accès. Les données ne sont traitées que dans les
      cas suivants :
    </p>
    <div className="legal__tableau" role="region" aria-label="Données traitées" tabIndex={0}>
      <table>
        <thead>
          <tr><th>Situation</th><th>Données</th><th>Finalité</th><th>Base légale</th></tr>
        </thead>
        <tbody>
          {(MODE_LABO ? [...TRAITEMENTS, ...TRAITEMENTS_LABO] : TRAITEMENTS).map(([cas, donnees, but, base]) => (
            <tr key={cas}>
              <td><strong>{cas}</strong></td><td>{donnees}</td><td>{but}</td><td>{base}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p>
      <strong>Dictée vocale et avis (alphabette.eu) :</strong> la dictée est transcrite par le service de reconnaissance
      vocale de votre navigateur (par exemple Google pour Chrome, Apple pour Safari) ; si ce service n'est pas
      disponible, la transcription se fait directement sur votre appareil, sans envoi de votre voix. N'écrivez{' '}
      <strong>aucune donnée personnelle sensible</strong> (nom complet, téléphone, santé, banque) dans un avis ou une
      demande à une IA. Les avis peuvent être traités par des agents IA automatisés, dans le seul but d'améliorer les
      applications.
    </p>

    <h2>3. Destinataires et sous-traitants</h2>
    <p>Vos données ne sont jamais vendues ni louées. Seuls les prestataires nécessaires au service y ont accès :</p>
    <ul>
      <li><strong>OVHcloud</strong> (OVH SAS, France) : hébergement des sites.</li>
      <li><strong>Stripe</strong> (Stripe Payments Europe, Ltd.) : paiements, dès leur ouverture.</li>
      <li><strong>Google Firebase</strong> : comptes et données d'Info Perso, IA Débat et Révolution.</li>
      <li><strong>Google Fonts</strong> : affichage des polices ; votre adresse IP est transmise à Google au chargement des pages, tant que les polices ne sont pas hébergées sur nos serveurs.</li>
      <li><strong>Google Traduction</strong> : seulement si vous cliquez sur « Open in English ».</li>
      <li><strong>GitHub, Inc.</strong> : hébergement du code et sauvegarde des avis laissés sur alphabette.eu.</li>
      <li><strong>Fournisseurs d'IA</strong> (OpenRouter et les modèles qu'il sollicite, Mistral AI, Google Gemini, Anthropic selon les applications) : uniquement pour les demandes IA que vous lancez vous-même.</li>
    </ul>
    <p>
      Quand un prestataire (Stripe, Google, GitHub, OpenRouter, Anthropic…) traite des données hors de l'Union
      européenne, ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou le
      cadre <em>EU-US Data Privacy Framework</em>.
    </p>

    <h2>4. Durée de conservation</h2>
    <ul>
      <li><strong>Commandes, factures et dons :</strong> 10 ans (obligation comptable).</li>
      <li><strong>Échanges par e-mail :</strong> 3 ans après le dernier contact.</li>
      <li><strong>Avis sur alphabette.eu :</strong> le temps nécessaire à l'amélioration des applications, ou supprimés sur simple demande.</li>
      {MODE_LABO && <li><strong>Tableau d'Honneur :</strong> le mois en cours et le précédent (2 mois au plus), ou retiré sur simple demande.</li>}
      {MODE_LABO && <li><strong>Idées et votes :</strong> tant que l'idée reste utile au choix des prochaines applications, ou supprimés sur simple demande ; empreintes anonymes du jour : 2 jours.</li>}
      <li><strong>Comptes des applications :</strong> tant que le compte existe.</li>
      <li><strong>Clés API (BYOK) :</strong> uniquement dans votre navigateur, supprimables à tout moment.</li>
      <li><strong>Journaux techniques du serveur :</strong> 12 mois maximum.</li>
    </ul>

    <h2>5. Cookies et stockage local</h2>
    <p>
      Aucun cookie publicitaire ni de suivi entre sites. Seuls des cookies et un stockage local strictement nécessaires
      sont utilisés (réglages d'affichage, inscription, clé API, session de connexion). Ils sont dispensés de
      consentement selon la CNIL. Détail : <a href="/cookies">Cookies et stockage local</a>.
    </p>

    <h2>6. Vos droits</h2>
    <p>
      Accès, rectification, effacement, limitation, opposition, portabilité et retrait du consentement à tout moment.
      Écrivez à <Mail /> ; réponse sous un mois maximum. Les données gardées sur votre appareil s'effacent depuis les
      réglages de votre navigateur. En cas de désaccord, vous pouvez saisir la CNIL :{' '}
      <Lien href="https://www.cnil.fr/fr/plaintes">cnil.fr/fr/plaintes</Lien>.
    </p>
  </>
);

/* ------------------------------------------------------------------ */
const COOKIES: Array<[string, string, string, string]> = [
  ['ab_membre (cookie + copie locale alphabette.membre)', 'Prénom, statut et identifiant du code d\'invitation, pour vous reconnaître sur tous les sites Alphabette', '400 jours', 'Nécessaire au service demandé (inscription)'],
  ['ab_prefs (cookie + copie locale alphabette.prefs)', 'Thème, taille d\'affichage BIG, langue, applications épinglées, nouveautés vues', '1 an', 'Préférence d\'interface'],
  ['alphabette.shell.theme / .density', 'Thème jour/nuit et taille d\'affichage dans les applications', 'Jusqu\'à effacement', 'Préférence d\'interface'],
  ['alphabette_apps_v4, alphabette_user_v4', 'Copie locale du catalogue et profil « visiteur » anonyme de la vitrine', 'Jusqu\'à effacement', 'Fonctionnement de la vitrine'],
  ['wikicom_*, ouCest_*, quizFamille_*, quizMusique_*, ab_podcasts_*, alphabette_promo_*, alphabette_routine', 'Favoris, notes, scores, joueurs, sélection de podcasts de chaque page', 'Jusqu\'à effacement', 'Fonction demandée'],
  ['iadebat_openrouter_key, iadebat_mode_acces', 'Votre clé OpenRouter si vous vous connectez en 1 clic, et le mode choisi dans IA Débat', 'Jusqu\'à effacement', 'Fonction demandée'],
  ['alphabette-info:cle-claude', 'Votre clé Claude, si vous en saisissez une dans Alphabette Info', 'Jusqu\'à effacement', 'Fonction demandée'],
  ['Stockage Firebase (IndexedDB / localStorage)', 'Session de connexion d\'Info Perso, IA Débat et Révolution', 'Jusqu\'à déconnexion', 'Authentification'],
    ['alphabette_admin (cookie)', 'Session de la console d\'administration, réservée à l\'éditeur', 'Session', 'Sécurité, jamais déposé aux visiteurs'],
];

/** Stockage local du Laboratoire (alphabette.eu seulement). */
const COOKIES_LABO: Array<[string, string, string, string]> = [
  ['alphabette_decouverte, alphabette_pass, alphabette_credits_iadebat (alphabette.eu)', 'Pass Découverte 48 h (gardé après la fin pour ne pas le rouvrir par erreur), Pass 12 mois signé et code de votre porte-monnaie de crédits IA Débat', 'Jusqu\'à effacement (le Pass s\'arrête seul à sa date de fin)', 'Fonction demandée'],
  ['alphabette_session_paiement (alphabette.eu, session)', 'Numéro du paiement Stripe pendant l\'affichage de la page « merci »', 'Fermeture de l\'onglet', 'Fonction demandée'],
  ['labo_limites_v1, alphabette_soutiens, alphabette_idees_votees, labo_pseudo (alphabette.eu)', 'Avis déjà donnés aujourd\'hui, soutiens, idées pour lesquelles vous avez voté, et le pseudo que vous avez choisi pour le Tableau d\'Honneur (pour ne pas le retaper)', 'Jusqu\'à effacement', 'Fonction demandée'],
];

export const Cookies: React.FC = () => (
  <>
    <p className="legal__maj">{MAJ}</p>
    <p>
      <strong>Aucun traceur publicitaire ni de mesure d'audience</strong> n'est déposé. Les éléments ci-dessous sont
      tous nécessaires au service que vous demandez ou mémorisent vos choix d'affichage : selon la{' '}
      <Lien href="https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi">CNIL</Lien>, ils ne
      demandent pas de consentement préalable, c'est pourquoi le site n'affiche pas de bandeau de cookies.
    </p>
    <div className="legal__tableau" role="region" aria-label="Liste des cookies et du stockage local" tabIndex={0}>
      <table>
        <thead>
          <tr><th>Nom</th><th>À quoi ça sert</th><th>Durée</th><th>Catégorie</th></tr>
        </thead>
        <tbody>
          {(MODE_LABO ? [...COOKIES, ...COOKIES_LABO] : COOKIES).map(([nom, role, duree, cat]) => (
            <tr key={nom}>
              <td>{nom}</td><td>{role}</td><td>{duree}</td><td>{cat}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <h2>Le gérer ou l'effacer</h2>
    <p>
      Réglages de votre navigateur → données de site → alphabette.fr (ou alphabette.eu). Effacer ces données vous
      désinscrit de l'appareil et remet les réglages à zéro.
    </p>
    <h2>Ce qui peut changer</h2>
    <p>
      Si une mesure d'audience, une vidéo intégrée ou un autre service tiers est ajouté, cette page sera mise à jour et un
      bandeau de consentement ajouté si nécessaire.
    </p>
  </>
);

/* ------------------------------------------------------------------ */
/*
 * Charte des créateurs du Collectif Alphabette (alphabette.eu), version du 20 novembre 2026.
 * Écrite d'après ce que fait réellement le code : Atelier qualité (scripts/labo/atelier.mjs), bac à sable des
 * applis hébergées (scripts/labo/bac-a-sable.mjs), bouton Signaler (labo/serveur/collectif.php).
 * Ce n'est pas un avis juridique : à faire relire avec les autres pages.
 */
export const CharteCreateurs: React.FC = () => (
  <>
    <p className="legal__maj">Dernière mise à jour : 20 novembre 2026</p>
    <p>
      Le <strong>Collectif Alphabette</strong> présente sur <strong>alphabette.eu</strong> des applications créées par des
      créateurs indépendants. Cette charte dit ce que chacun s'engage à faire. En proposant une application dans la{' '}
      <a href="/embarquement/">Salle d'embarquement</a>, vous l'acceptez (dernière case du formulaire).
    </p>
    <p className="legal__encart">
      <strong>alphabette.eu seulement.</strong> Les applications des créateurs sont hébergées, testées et présentées
      uniquement sur alphabette.eu (le Laboratoire). Elles ne sont jamais transférées sur alphabette.fr, réservé aux
      applications d'Alphabette. <strong>Zéro publicité, zéro revente de données.</strong>
    </p>

    <h2>Deux façons de publier</h2>
    <ul>
      <li><strong>Avec votre adresse</strong> : votre application est en ligne chez vous ; le collectif affiche un lien et l'ouvre dans un nouvel onglet. Vous en êtes l'éditeur et l'hébergeur.</li>
      <li>
        <strong>Hébergée par Alphabette</strong> : vous donnez un dépôt GitHub public qui contient les fichiers déjà
        construits (HTML, CSS, JavaScript, images, sons…). Alphabette publie une version précise (un commit), sans
        jamais lancer votre code sur ses serveurs, et l'affiche dans un <strong>cadre isolé</strong> : votre application ne
        peut lire ni les données d'Alphabette ni celles des autres applications, et ne peut joindre que les services
        que vous avez déclarés. Seuls les fichiers statiques sont acceptés (pas de PHP ni de script serveur), 25 Mo au plus.
        Chaque mise à jour est contrôlée de nouveau avant d'être publiée. Vous restez l'éditeur ; Alphabette est l'hébergeur.
      </li>
    </ul>

    <h2>Vos engagements</h2>
    <ol>
      <li><strong>Utile et en état de marche</strong> : l'application fait ce qu'elle annonce et s'ouvre sur téléphone, sans inscription obligatoire pour l'essayer.</li>
      <li><strong>Zéro publicité, zéro revente de données</strong> : ni publicité dans l'application, ni revente ou cession des données de vos visiteurs.</li>
      <li><strong>Vie privée</strong> : aucun traceur publicitaire ni outil de mesure d'audience tiers, aucun cookie tiers sans accord du visiteur, et seulement les données vraiment nécessaires. Si vous en recueillez, dites lesquelles, pourquoi et où elles vont.</li>
      <li><strong>Honnêteté</strong> : pas de faux avis, faux chiffres, faux témoignages, fausses urgences ni paiement trompeur. Les réponses d'une intelligence artificielle sont présentées comme telles, avec un avertissement : elles peuvent contenir des erreurs.</li>
      <li><strong>Contenu légal</strong> : rien d'illicite, de haineux, de dangereux, de trompeur (arnaque, hameçonnage) ni d'atteinte aux droits d'autrui (droit d'auteur, image, marque, vie privée).</li>
      <li><strong>Vos droits</strong> : vous détenez les droits sur le code, les textes, les images et les sons de l'application, ou l'autorisation de les utiliser.</li>
      <li><strong>Aucun secret dans le code</strong> : jamais de clé d'API, de mot de passe ni de jeton dans les fichiers publiés.</li>
      <li><strong>Informations légales</strong> : avec votre propre adresse, votre application affiche ses mentions légales et sa politique de confidentialité. Hébergée par Alphabette, le cadre affiche celles du site et un lien de signalement.</li>
      <li><strong>Visibilité partagée</strong> : vous ajoutez le badge du collectif en bas de votre application (<a href="/rejoindre/">une ligne à copier</a>).</li>
    </ol>

    <h2>Ce que fait Alphabette</h2>
    <ul>
      <li>
        <strong>Contrôles automatiques</strong> (l'Atelier qualité) avant la publication puis chaque nuit : sécurité
        (traceurs, secrets, appels non déclarés), usage sur téléphone, lisibilité, vitesse, référencement et cadre
        légal. Les contrôles ouvrent l'application comme un visiteur, sans rien cliquer ni saisir.
      </li>
      <li>
        <strong>Un rapport pour vous</strong>, publié sur <a href="/atelier/">alphabette.eu/atelier</a> (non indexé par
        les moteurs de recherche) : chaque point relevé, comment le corriger et un texte prêt à coller dans votre outil d'IA.
      </li>
      <li>
        <strong>Le badge « Testé au Labo »</strong> signale qu'à la date indiquée les contrôles automatiques n'ont rien
        relevé de bloquant pendant au moins trois jours sur sept. Ce n'est ni une certification, ni une garantie de
        sécurité ou d'exactitude : c'est le résultat de contrôles automatiques à une date donnée.
      </li>
      <li>
        <strong>Le badge « Passé au Crash-Test • Alphabette.eu »</strong> est proposé aux applications validées, avec
        un code HTML (sans script) et un code Markdown pour GitHub, sur <a href="/badge/">alphabette.eu/badge</a>. Il renvoie
        vers une page qui vérifie, à tout moment, que l'application est toujours validée.
      </li>
      <li>Votre contact n'est jamais affiché ni transmis : il sert seulement à vous répondre.</li>
      <li>La publication de chaque application est validée par Alphabette.</li>
    </ul>

    <h2>Droits accordés à Alphabette</h2>
    <p>
      Vous gardez tous vos droits. Vous autorisez seulement Alphabette, gratuitement et sans exclusivité, pendant la
      durée de la publication, à héberger l'application (version hébergée), à l'afficher, à la présenter (nom,
      description, captures d'écran faites par l'Atelier qualité) et à publier le rapport de ses contrôles.
    </p>

    <h2>Signalements, suspension et retrait</h2>
    <ul>
      <li>Chaque application a un bouton <strong>« Signaler »</strong>. Le signalement arrive aussitôt chez Alphabette, qui l'examine sans délai. Vous pouvez aussi écrire à <Mail />.</li>
      <li>Alphabette peut suspendre ou retirer une application tout de suite en cas de contenu manifestement illicite, de risque pour les visiteurs ou de manquement grave à cette charte, et dans les autres cas après vous avoir demandé de corriger. Le motif vous est communiqué si vous avez laissé un contact ; vous pouvez y répondre pour contester.</li>
      <li>Vous pouvez demander le retrait de votre application à tout moment par e-mail : il est fait sous 7 jours au plus.</li>
    </ul>

    <h2>Contact</h2>
    <p>Alphabette SASU — <Mail />. Voir aussi les <a href="/mentions-legales">mentions légales</a> et la <a href="/confidentialite">politique de confidentialité</a>.</p>
  </>
);
