import React from 'react';

/**
 * Texte des pages légales. Rédigé à partir du code réellement présent (hub et
 * dépôts des applications) au 13 novembre 2026. Ce n'est pas un avis juridique :
 * les éléments entre crochets `[À COMPLÉTER]` restent à renseigner, et le tout
 * doit être relu par un professionnel avant la vente du Pass.
 */

const AC: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <mark className="legal__completer">[{children}]</mark>
);

const MAJ = 'Dernière mise à jour : 13 novembre 2026';
const MAIL = 'azertylm@gmail.com';

const Lien: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

/* ------------------------------------------------------------------ */
export const MentionsLegales: React.FC = () => (
  <>
    <p className="legal__maj">{MAJ}</p>

    <h2>Éditeur du site</h2>
    <ul>
      <li>Site : alphabette.fr et ses sous-domaines (alphabette.fr, alphabette.eu, proxilien.fr, lidarsol.fr…).</li>
      <li>Éditeur : <strong>Valentin Richaud</strong>, sous le nom <strong>Alphabette</strong>.</li>
      <li>Forme juridique : <AC>À COMPLÉTER : entreprise individuelle ou société, selon l'état de l'immatriculation</AC></li>
      <li>N° SIRET : <AC>À COMPLÉTER</AC></li>
      <li>Adresse professionnelle : <AC>ADRESSE PROFESSIONNELLE À COMPLÉTER</AC></li>
      <li>E-mail : <a href={`mailto:${MAIL}`}>{MAIL}</a></li>
      <li>Téléphone : <a href="tel:+33619831985">06 19 83 19 85</a></li>
      <li>Directeur de la publication : Valentin Richaud.</li>
    </ul>

    <h2>Hébergeur</h2>
    <ul>
      <li><strong>OVH SAS</strong>, société par actions simplifiée au capital de 50 000 000 €.</li>
      <li>Siège : 2 rue Kellermann, 59100 Roubaix, France.</li>
      <li>RCS Lille Métropole 424 761 419.</li>
      <li>
        Source : <Lien href="https://www.ovhcloud.com/fr/terms-and-conditions/">mentions légales d'OVHcloud</Lien>{' '}
        (consultées le 13 novembre 2026). Le numéro de téléphone de l'hébergeur n'y figure pas : <AC>téléphone OVH à
        ajouter après vérification</AC>.
      </li>
    </ul>
    <p>
      Certaines applications utilisent en outre des services de Google (Firebase) et de fournisseurs d'intelligence
      artificielle : voir la <a href="/confidentialite">politique de confidentialité</a>.
    </p>

    <h2>Propriété intellectuelle</h2>
    <p>
      Les textes, logos, images et logiciels d'Alphabette sont protégés. Toute reproduction sans accord écrit préalable
      est interdite, sauf courte citation avec mention de la source. Les marques et contenus de tiers cités restent la
      propriété de leurs titulaires.
    </p>

    <h2>Responsabilité</h2>
    <p>
      Les applications sont fournies avec le plus grand soin, mais sans garantie d'absence d'erreur ou d'interruption.
      Les réponses produites par une intelligence artificielle peuvent être inexactes : elles ne remplacent pas l'avis
      d'un professionnel (santé, droit, finances, bâtiment). Certaines applications sont des prototypes et l'indiquent.
    </p>

    <h2>Données personnelles, cookies et vente</h2>
    <ul>
      <li><a href="/confidentialite">Politique de confidentialité</a></li>
      <li><a href="/cookies">Cookies et stockage local</a></li>
      <li><a href="/conditions-de-vente">Conditions de vente du Pass</a> (brouillon, paiement pas encore ouvert)</li>
    </ul>

    <h2>Signaler un contenu</h2>
    <p>
      Pour signaler un contenu illicite ou exercer un droit, écrivez à <a href={`mailto:${MAIL}`}>{MAIL}</a>.
    </p>
  </>
);

/* ------------------------------------------------------------------ */
export const Confidentialite: React.FC = () => (
  <>
    <p className="legal__maj">{MAJ}</p>
    <p className="legal__encart">
      Texte établi d'après le code du hub et des applications au 13 novembre 2026, sans avis juridique. Il sera relu
      avant l'ouverture du paiement.
    </p>

    <h2>Qui est responsable ?</h2>
    <p>
      Valentin Richaud, sous le nom Alphabette — <AC>ADRESSE PROFESSIONNELLE À COMPLÉTER</AC> — contact :{' '}
      <a href={`mailto:${MAIL}`}>{MAIL}</a>, 06 19 83 19 85.
    </p>

    <h2>L'essentiel</h2>
    <ul>
      <li>Le site alphabette.fr n'a ni publicité, ni outil de mesure d'audience, ni compte obligatoire.</li>
      <li>La plupart des applications gardent vos informations <strong>sur votre appareil</strong> (stockage du navigateur) : nous n'y avons pas accès.</li>
      <li>Trois applications utilisent un compte ou un identifiant en ligne (Firebase de Google) : Info Perso, IA Débat et Révolution.</li>
      <li>Quand une application appelle une intelligence artificielle, le texte que vous lui soumettez est envoyé au fournisseur concerné.</li>
      <li>Alphabette n'utilise aucune donnée d'utilisateur pour entraîner un modèle d'IA et ne revend aucune donnée.</li>
    </ul>

    <h2>Ce qui est traité, service par service</h2>

    <h3>Le site alphabette.fr (hub)</h3>
    <ul>
      <li><strong>Sur votre appareil</strong> : réglages (thème jour/nuit, taille d'affichage BIG, applications épinglées, nouveautés vues) et une copie locale de la liste des applications. Finalité : retrouver vos réglages. Voir <a href="/cookies">Cookies et stockage local</a>.</li>
      <li><strong>Journaux du serveur</strong> : l'hébergeur OVH enregistre, comme tout serveur web, l'adresse IP, la date et la page demandée, pour la sécurité et le fonctionnement. Base légale : intérêt légitime. Durée : celle fixée par OVH <AC>À VÉRIFIER auprès d'OVH</AC>.</li>
      <li><strong>Polices de caractères</strong> : la page d'accueil charge des polices depuis Google Fonts ; votre adresse IP est alors transmise à Google. <AC>À CORRIGER : héberger les polices sur alphabette.fr</AC></li>
    </ul>

    <h3>Inscription par code d'invitation</h3>
    <p>
      Vous saisissez un prénom (ou pseudo) et un code. Le code est vérifié <strong>dans votre navigateur</strong> par
      empreinte ; rien n'est envoyé à un serveur. Le prénom, votre statut (fondateur, ami, invité), la date et
      l'identifiant du code sont gardés dans un cookie (400 jours) et une copie locale, pour que les sites alphabette.fr
      vous reconnaissent. Vous pouvez tout effacer avec « Me désinscrire de cet appareil ».
    </p>

    <h3>Dons par virement</h3>
    <p>
      Aucun paiement en ligne. Si vous faites un virement, nous recevons de votre banque le nom du donateur, son IBAN, le
      montant et le motif. Finalité : enregistrer le don, le remercier, tenir la comptabilité. Base légale : intérêt
      légitime et obligation légale comptable. Durée : celle des pièces comptables (10 ans) <AC>À VALIDER</AC>. Le statut
      « Membre fondateur » est décrit à la fin de la page{' '}
      <a href="/conditions-de-vente">Conditions de vente du Pass</a>.
    </p>

    <h3>Intelligence artificielle</h3>
    <ul>
      <li><strong>Mistral AI</strong> (France) : fournisseur privilégié ; vous pouvez apporter votre propre clé (BYOK) ou, quand elle est ouverte, utiliser la clé gérée par Alphabette. Le texte de votre demande est envoyé à Mistral AI pour produire la réponse.</li>
      <li><strong>Google (Gemini)</strong> et <strong>Anthropic (Claude)</strong> : utilisés par certaines applications. Exemple vérifié : Alphabette Info (<code>/info.html</code>) garde votre clé Claude dans le stockage de votre navigateur et appelle directement api.anthropic.com ; Anthropic est une société américaine (transfert hors Union européenne).</li>
      <li>Ce qui est envoyé : le texte, l'image ou la consigne que vous soumettez, et votre clé si vous en fournissez une. Rien d'autre n'est transmis volontairement.</li>
      <li>Alphabette ne conserve pas ces échanges sur ses serveurs <AC>À CONFIRMER application par application</AC>. Chaque fournisseur applique ses propres conditions pour les données reçues via son interface : lisez-les avant d'y mettre des informations sensibles. N'écrivez pas de données de santé ou de secrets dans une demande IA.</li>
    </ul>

    <h3>Applications avec compte ou identifiant en ligne (Google Firebase)</h3>
    <p>Un projet Firebase commun (Google) sert trois applications. Données d'après leur code :</p>
    <ul>
      <li>
        <strong>Info Perso</strong> : connexion par e-mail et mot de passe ou par Google. Sont enregistrés : e-mail, nom
        affiché, photo de profil Google, préférences d'affichage, articles lus et enregistrés, centres d'intérêt, date de
        dernière synchronisation. Si vous proposez un article ou un commentaire, il est <strong>public</strong> et peut
        porter votre nom <AC>À VÉRIFIER : la structure prévoit aussi l'e-mail de l'auteur</AC>. Un enregistrement
        d'abonnement (statut gratuit) est créé à votre nom.
      </li>
      <li>
        <strong>IA Débat</strong> : connexion anonyme (identifiant technique sans nom) et compteur de quotas
        quotidiens. Connexion Google facultative, uniquement pour utiliser Google Drive.
      </li>
      <li>
        <strong>Révolution</strong> : connexion anonyme ; vos réponses aux questions sont enregistrées sous cet
        identifiant technique (visibles de vous seul) et alimentent des compteurs publics agrégés. Les questions que
        vous proposez et les signalements sont enregistrés.
      </li>
      <li>Finalité : fournir le service demandé. Base légale : exécution du service (et votre consentement pour la connexion Google). Durée : tant que le compte existe <AC>À DÉFINIR : durée d'inactivité avant suppression</AC>. Destinataire : Google (Firebase). Transfert hors UE possible (États-Unis) <AC>lieu de la base de données à vérifier dans la console Firebase</AC>.</li>
    </ul>

    <h3>Autres applications et pages du hub</h3>
    <p>
      Les jeux et outils publiés par le hub (Dico Loufoque, Juste Chiffre, Mémo-Méninges, quiz, Où c'est ?, Wikicom,
      Promo Hub, Podcasts…) gardent leurs scores, favoris et notes dans le stockage de votre navigateur. Podcasts lit
      les flux publics des émissions par un petit relais sur notre hébergement. Pour les autres applications,{' '}
      <AC>vérification appli par appli à terminer</AC>. En cas de doute, écrivez-nous.
    </p>

    <h3>Lien « Open in English »</h3>
    <p>
      Ce lien ouvre Google Traduction avec l'adresse de la page ; Google n'est contacté que si vous cliquez.
    </p>

    <h2>Destinataires et transferts</h2>
    <ul>
      <li>OVH SAS (hébergement, France).</li>
      <li>Google LLC / Google Ireland (Firebase, Gemini, Polices, Traduction) : transferts possibles hors UE.</li>
      <li>Mistral AI (France), Anthropic (États-Unis) selon les applications.</li>
      <li>Aucune revente, aucune publicité, aucune cession à des tiers.</li>
      <li>Garanties pour les transferts hors UE : clauses contractuelles types ou cadre de protection des données UE–États-Unis, selon le fournisseur <AC>À VÉRIFIER dans les conditions de chacun</AC>.</li>
    </ul>

    <h2>Vos droits</h2>
    <p>
      Accès, rectification, effacement, limitation, opposition, portabilité, et retrait du consentement à tout moment.
      Écrivez à <a href={`mailto:${MAIL}`}>{MAIL}</a> ; réponse sous un mois. Les données gardées sur votre appareil
      s'effacent depuis les réglages de votre navigateur. En cas de désaccord, vous pouvez saisir la CNIL :{' '}
      <Lien href="https://www.cnil.fr/fr/plaintes">cnil.fr/fr/plaintes</Lien>.
    </p>
    <p>
      Pour en savoir plus :{' '}
      <Lien href="https://www.cnil.fr/fr/comprendre-vos-droits">CNIL, comprendre vos droits</Lien>.
    </p>
  </>
);

/* ------------------------------------------------------------------ */
const COOKIES: Array<[string, string, string, string]> = [
  ['ab_membre (cookie + copie locale alphabette.membre)', 'Prénom, statut et identifiant du code d\'invitation, pour vous reconnaître sur tous les sites alphabette.fr', '400 jours', 'Nécessaire au service demandé (inscription)'],
  ['ab_prefs (cookie + copie locale alphabette.prefs)', 'Thème, taille d\'affichage BIG, langue, applications épinglées, nouveautés vues', '1 an', 'Préférence d\'interface'],
  ['alphabette.shell.theme / .density', 'Thème jour/nuit et taille d\'affichage dans les applications', 'Jusqu\'à effacement', 'Préférence d\'interface'],
  ['alphabette_apps_v4, alphabette_user_v4', 'Copie locale du catalogue et profil « visiteur » anonyme de la vitrine', 'Jusqu\'à effacement', 'Fonctionnement de la vitrine'],
  ['wikicom_*, ouCest_*, quizFamille_*, quizMusique_*, ab_podcasts_*, alphabette_promo_*, alphabette_routine', 'Favoris, notes, scores, joueurs, sélection de podcasts de chaque page', 'Jusqu\'à effacement', 'Fonction demandée'],
  ['alphabette-info:cle-claude', 'Votre clé Claude, si vous en saisissez une dans Alphabette Info', 'Jusqu\'à effacement', 'Fonction demandée'],
  ['Stockage Firebase (IndexedDB / localStorage)', 'Session de connexion des applications Info Perso, IA Débat et Révolution', 'Jusqu\'à déconnexion', 'Authentification'],
  ['alphabette_admin (cookie)', 'Session de la console d\'administration, réservée à l\'éditeur', 'Session', 'Sécurité, jamais déposé aux visiteurs'],
];

export const Cookies: React.FC = () => (
  <>
    <p className="legal__maj">{MAJ}</p>
    <p>
      D'après le code du hub et des pages qu'il publie, <strong>aucun traceur publicitaire ni de mesure d'audience</strong> n'est
      déposé. Les éléments ci-dessous sont tous nécessaires au service que vous demandez ou servent à mémoriser vos
      choix d'affichage : selon la{' '}
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
      Réglages de votre navigateur → données de site → alphabette.fr. Effacer ces données vous désinscrit de l'appareil
      et remet les réglages à zéro. Les cookies sont envoyés à tous les sous-domaines alphabette.fr, comme tout cookie de
      domaine.
    </p>
    <h2>Ce qui peut changer</h2>
    <p>
      Si une mesure d'audience, une vidéo intégrée ou un autre service tiers est ajouté, cette page sera mise à jour et un
      bandeau de consentement sera ajouté si nécessaire. Les applications hébergées sur leurs propres sous-domaines
      <AC>vérification des traceurs appli par appli à terminer</AC>.
    </p>
  </>
);

/* ------------------------------------------------------------------ */
export const ConditionsVente: React.FC = () => (
  <>
    <p className="legal__brouillon" role="note">
      BROUILLON — le paiement n'est pas encore ouvert. Aucune vente n'est possible aujourd'hui ; ce texte n'a pas de
      valeur contractuelle et doit être validé avant ouverture.
    </p>
    <p className="legal__maj">{MAJ}</p>

    <h2>1. Vendeur</h2>
    <p>
      Valentin Richaud, sous le nom Alphabette — <AC>ADRESSE PROFESSIONNELLE À COMPLÉTER</AC> — SIRET{' '}
      <AC>À COMPLÉTER</AC> — <a href={`mailto:${MAIL}`}>{MAIL}</a> — 06 19 83 19 85.
    </p>

    <h2>2. Offres et prix (TTC)</h2>
    <ul>
      <li><strong>Pass « une application »</strong> : 15 € TTC par an, pour une application au choix.</li>
      <li><strong>Pass « écosystème »</strong> : 40 € TTC par an, pour toutes les applications payantes, d'aujourd'hui et de demain.</li>
      <li>Les applications déclarées gratuites le restent.</li>
      <li>TVA : <AC>À COMPLÉTER : taux ou mention de franchise en base</AC></li>
    </ul>

    <h2>3. Essai de 7 jours</h2>
    <p>
      Chaque nouveau client dispose de 7 jours d'essai sans frais. <AC>À DÉFINIR : moyen de paiement demandé ou non à
      l'essai, et conséquence à la fin de l'essai.</AC>
    </p>

    <h2>4. Durée et renouvellement</h2>
    <p>
      Abonnement d'un an. <AC>À DÉFINIR : renouvellement automatique ou non. Les contreparties du statut « Membre
      fondateur » prévoient « aucune reconduction tacite » ; le Pass doit rester cohérent, et en cas de renouvellement
      tacite le client doit être prévenu avant l'échéance.</AC>
    </p>

    <h2>5. Paiement</h2>
    <p>
      Prestataire de paiement : <AC>À COMPLÉTER (aucun compte ouvert à ce jour)</AC>. Aucune donnée de carte n'est
      traitée par Alphabette.
    </p>

    <h2>6. Droit de rétractation (14 jours)</h2>
    <p>
      Pour une vente à distance, vous disposez de 14 jours à compter de la souscription pour vous rétracter, sans motif,
      en écrivant à <a href={`mailto:${MAIL}`}>{MAIL}</a>.
    </p>
    <p>
      <strong>Exception</strong> : pour un contenu numérique non fourni sur un support matériel, le droit de
      rétractation ne s'applique plus si l'exécution a commencé avec votre accord préalable exprès et votre renoncement
      à ce droit. Cet accord devra être demandé avec une case dédiée avant l'accès au service, et ne pourra pas être
      présumé. <AC>À FAIRE VALIDER par un professionnel</AC>
    </p>
    <p>
      Références :{' '}
      <Lien href="https://www.economie.gouv.fr/dgccrf/Publications/Vie-pratique/Fiches-pratiques/mediation-de-la-consommation">
        economie.gouv.fr (DGCCRF)
      </Lien>
      ,{' '}
      <Lien href="https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069565/">Code de la consommation, Légifrance</Lien>
      , articles L221-18 et L221-28.
    </p>

    <h2>7. Médiateur de la consommation</h2>
    <p>
      Tout professionnel qui vend à des particuliers doit leur permettre de recourir gratuitement à un médiateur de la
      consommation et communiquer ses coordonnées sur son site. Après une réclamation écrite restée sans réponse
      satisfaisante, vous pouvez saisir : <AC>MÉDIATEUR À CHOISIR ET À COMPLÉTER (nom, adresse, site)</AC>.
    </p>

    <h2>8. Service et responsabilité</h2>
    <p>
      Alphabette s'efforce d'assurer un accès continu, sans garantie d'absence d'interruption. Les réponses d'une IA
      peuvent être inexactes. <AC>Autres clauses (responsabilité, résiliation, loi applicable) à faire rédiger</AC>
    </p>

    <h2>Dons et statut « Membre fondateur »</h2>
    <p>
      Les dons se font par virement bancaire, sans paiement en ligne. Un don est volontaire et n'est pas une vente. Dès
      30 € de don, le statut de « Membre fondateur » (places limitées à 500) donne : accès à toutes les fonctionnalités
      actuelles et futures de l'écosystème pour la durée où Alphabette existe, sans abonnement récurrent, un badge «
      Fondateur Pionnier » et un vote consultatif sur les prochaines fonctionnalités. <AC>À VALIDER : « à vie » doit
      être limité à la durée d'exploitation du service ; reçu fiscal non prévu</AC>
    </p>
  </>
);
