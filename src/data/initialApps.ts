import { AppItem, FranceServiceModule } from '../types';

export const FRANCE_SERVICE_MODULES: FranceServiceModule[] = [
  {
    id: 'claircontrat',
    name: 'ClairContrat',
    tagline: 'Analyse & décryptage juridique des contrats du quotidien',
    description: 'Vérification instantanée de baux, devis, CGV et détection automatique des clauses abusives ou déséquilibrées.',
    iconName: 'FileCheck',
    zeroKnowledgeNote: '100% exécuté sur votre appareil (Zero-Knowledge), aucun contrat n\'est envoyé sur nos serveurs.'
  },
  {
    id: 'memosante',
    name: 'MémoSanté',
    tagline: 'Carnet de santé familial souverain & vulgarisation médicale',
    description: 'Suivi bienveillant de la famille et vulgarisation claire du vocabulaire des comptes-rendus médicaux (sans diagnostic médical).',
    iconName: 'HeartPulse',
    zeroKnowledgeNote: 'Données de santé stockées localement de manière chiffrée, zéro revente, zéro assurance.'
  },
  {
    id: 'plumecitoyenne',
    name: 'PlumeCitoyenne',
    tagline: 'Écrivain public pour vos courriers administratifs officiels',
    description: 'Rédaction sur mesure de lettres et recours pour la CAF, la CPAM, les litiges de consommation et contestations.',
    iconName: 'PenTool',
    zeroKnowledgeNote: 'Vos pièces et identifiants administratifs restent strictement sur votre terminal.'
  },
  {
    id: 'patrimoine-en-poche',
    name: 'Patrimoine en Poche',
    tagline: 'Guide culturel & architectural interactif sans traçage',
    description: 'Découverte libre du bâti, de l\'histoire locale et des monuments historiques sans aucun profilage publicitaire.',
    iconName: 'Landmark',
    zeroKnowledgeNote: 'Zéro géolocalisation enregistrée, navigation et cartes souveraines déconnectées.'
  },
  {
    id: 'resil-express',
    name: 'Résil-Express',
    tagline: 'Générateur de résiliation selon la loi française',
    description: 'Création guidée de démarches et lettres recommandées conformes aux lois Châtel, Hamon et aux délais légaux.',
    iconName: 'FileX',
    zeroKnowledgeNote: 'Modèles juridiques générés hors-ligne en toute confidentialité.'
  },
  {
    id: 'etatdeslieux-protect',
    name: 'ÉtatDesLieux Protect',
    tagline: 'Photos horodatées & arbitrage usure vs dégradation',
    description: 'Aide à la prise de vue certifiée et distinguo juridique rigoureux entre vétusté normale et retenue abusive de caution.',
    iconName: 'Camera',
    zeroKnowledgeNote: 'Les clichés et horodatages sont conservés dans votre coffre-fort local.'
  },
  {
    id: 'vigilance-succession',
    name: 'Vigilance Succession',
    tagline: 'Parcours administratif post-décès & information organismes',
    description: 'Accompagnement pas-à-pas pour les proches : calendrier des formalités, modèles de déclaration aux banques et caisses.',
    iconName: 'ShieldAlert',
    zeroKnowledgeNote: 'Respect absolu du deuil : aucune trace, aucun démarchage commercial.'
  }
];

export const INITIAL_APPS: AppItem[] = [
  // 1. PÔLE PROFESSIONNEL ÉNERGIE & CARTOGRAPHIE (B2B Solaire)
  {
    id: 'lidarsol',
    slotNumber: 1,
    name: 'LIDARSOL',
    pole: 'b2b_solaire',
    category: 'Professionnel B2B',
    tagline: 'Analyse 3D du potentiel solaire des toitures par LiDAR HD IGN',
    description: 'Plateforme SaaS d\'analyse 3D du potentiel solaire des toitures basée sur les données topographiques LiDAR HD de l\'IGN (inclinaison, ombrages, surface utile).',
    url: 'https://lidarsol.alphabette.fr',
    isConfigured: false,
    tags: ['IGN LiDAR HD', 'Potentiel Solaire', 'Cartographie 3D', 'B2B Pro'],
    iconName: 'SunMedium',
    pricingNote: '49 € HT / mois (Abonnement pro récurrent)',
    isPopular: true,
    isB2B: true,
  },
  {
    id: 'osolar',
    slotNumber: 2,
    name: 'OSOLAR',
    pole: 'b2b_solaire',
    category: 'Professionnel B2B',
    tagline: 'Dimensionnement technico-financier & chiffrage photovoltaïque pro',
    description: 'Outil de dimensionnement technico-financier et de chiffrage commercial d\'installations photovoltaïques pour les professionnels du secteur.',
    url: 'https://osolar.alphabette.fr',
    isConfigured: false,
    tags: ['Chiffrage Commercial', 'Photovoltaïque', 'Rentabilité', 'Installateurs'],
    iconName: 'Zap',
    pricingNote: '49 € HT / mois (Abonnement pro récurrent)',
    isPopular: true,
    isB2B: true,
  },

  // 2. PÔLE CITOYEN & PROXIMITÉ
  {
    id: 'proxilien',
    slotNumber: 3,
    name: 'PROXILIEN',
    pole: 'citoyen_proximite',
    category: 'Citoyen & Proximité',
    tagline: 'Entraide locale, communication de proximité & lien civique',
    description: 'Plateforme d\'entraide locale, de communication de proximité et de lien civique. Phase pilote 100 % gratuite la 1ère année à La Grande-Motte avant déploiement auprès d\'autres mairies et usagers.',
    url: 'https://proxilien.alphabette.fr',
    isConfigured: false,
    tags: ['La Grande-Motte', 'Pilote Gratuit 1 an', 'Entraide', 'Lien Civique'],
    iconName: 'HeartHandshake',
    pricingNote: '100 % Gratuit la 1ère année (Pilote La Grande-Motte)',
    isPopular: true,
    isPiloteFree: true,
  },
  {
    id: 'iadebat',
    slotNumber: 4,
    name: 'IADÉBAT',
    pole: 'citoyen_proximite',
    category: 'Citoyen & Proximité',
    tagline: 'Outil citoyen de décryptage & argumentation contradictoire',
    description: 'Outil citoyen de décryptage et d\'argumentation contradictoire pour enrichir le débat public de manière rigoureuse et neutre.',
    url: 'https://iadebat.alphabette.fr',
    isConfigured: false,
    tags: ['Débat Public', 'Esprit Critique', 'Argumentation', '15 € / an'],
    iconName: 'Scale',
    pricingNote: '15 € TTC / an (Abonnement annuel sans prélèvement mensuel)',
    isPopular: true,
  },
  {
    id: 'infos-perso',
    slotNumber: 5,
    name: 'INFOS PERSO',
    pole: 'citoyen_proximite',
    category: 'Citoyen & Proximité',
    tagline: 'Gestionnaire personnel sécurisé pour vos démarches & renseignements',
    description: 'Gestionnaire personnel sécurisé facilitant l\'accès aux démarches administratives et renseignements essentiels de la vie courante.',
    url: 'https://infosperso.alphabette.fr',
    isConfigured: false,
    tags: ['Démarches', 'Gestionnaire Sécurisé', 'Vie Courante', '15 € / an'],
    iconName: 'Newspaper',
    pricingNote: '15 € TTC / an (Abonnement annuel sans prélèvement mensuel)',
    isPopular: true,
  },
  {
    id: 'oeil-atelier',
    slotNumber: 6,
    name: "L'ŒIL DE L'ATELIER",
    pole: 'citoyen_proximite',
    category: 'Citoyen & Proximité',
    tagline: 'Suivi, documentation & gestion simplifiée des chantiers pour artisans',
    description: 'Solution dédiée aux artisans pour le suivi, la documentation visuelle et la gestion simplifiée de leurs chantiers au quotidien.',
    url: 'https://atelier.alphabette.fr',
    isConfigured: false,
    tags: ['Artisans', 'Chantiers', 'Documentation', '15 € / an'],
    iconName: 'Hammer',
    pricingNote: '15 € TTC / an (Abonnement annuel sans prélèvement mensuel)',
    isPopular: true,
  },

  // 3. L'APPLICATION GLOBALE « FRANCE SERVICE » (Zero-Knowledge)
  {
    id: 'france-service',
    slotNumber: 7,
    name: 'FRANCE SERVICE (Suite Globale)',
    pole: 'france_service',
    category: 'France Service (Zero-Knowledge)',
    tagline: 'Suite pratique d\'utilité publique familiale 100 % locale (Zero-Knowledge)',
    description: 'Suite complète intégrant une architecture 100 % locale (Zero-Knowledge) où aucune donnée personnelle ne transite ni n\'est stockée sur les serveurs d\'ALPHABETTE. Regroupe les 7 modules du quotidien.',
    url: 'https://franceservice.alphabette.fr',
    isConfigured: false,
    tags: ['Zero-Knowledge', '7 Modules Inclus', '15 € / an seul', 'Inclus Pass 40 €'],
    iconName: 'ShieldCheck',
    pricingNote: '15 € TTC / an à l\'unité (ou inclus dans le Pass 40 € TTC / an)',
    isPopular: true,
    isFranceServiceSuite: true,
    franceServiceModules: FRANCE_SERVICE_MODULES
  }
];

export const CATEGORIES = [
  'Toutes',
  'Professionnel B2B',
  'Citoyen & Proximité',
  'France Service (Zero-Knowledge)',
] as const;
