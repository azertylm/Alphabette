import React from 'react';

/**
 * Texte des pages légales d'alphabette.fr et alphabette.eu.
 * Version du 19 novembre 2026 fournie par Valentin Richaud (Alphabette SASU),
 * complétée par ce que fait réellement le code (relais IA Débat, dictée vocale,
 * Google Fonts, GitHub, Firebase, inscription par code, dons par virement).
 * Ce n'est pas un avis juridique : à faire relire avant l'ouverture du paiement.
 */

const AC: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <mark className="legal__completer">[{children}]</mark>
);

const MAJ = 'Dernière mise à jour : 19 novembre 2026';
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
      <li><strong>Packs de crédits IA Débat :</strong> achat ponctuel de crédits pour des débats avancés ou en mode Premium sur <em>IA Débat</em>, au-delà du quota gratuit quotidien.</li>
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
      <li><strong>Pass annuels et packs de crédits :</strong> activés immédiatement après confirmation du paiement par Stripe.</li>
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

    <h2>Dons et statut « Membre fondateur »</h2>
    <p>
      Les dons se font par virement bancaire, sans paiement en ligne. Un don est volontaire et n'est pas une vente. Le
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
          {TRAITEMENTS.map(([cas, donnees, but, base]) => (
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
          {COOKIES.map(([nom, role, duree, cat]) => (
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
