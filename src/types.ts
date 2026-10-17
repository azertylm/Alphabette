export type AppPole = 
  | 'b2b_solaire' 
  | 'citoyen_proximite' 
  | 'france_service';

export type AppCategory = 
  | 'Professionnel B2B' 
  | 'Citoyen & Proximité' 
  | 'France Service (Zero-Knowledge)';

/**
 * Plans officiels ALPHABETTE SASU :
 * - trial_7d : Essai 7 jours offerts (Clé Alphabette Mistral incluse)
 * - single_byok : 39 € / an (Application individuelle avec sa propre clé Mistral)
 * - single_managed : 59 € / an (Application individuelle clé en main avec Mistral inclus)
 * - bouquet_byok : 99 € / an (Bouquet complet 15 apps avec sa propre clé Mistral)
 * - bouquet_integral : 199 € / an (Bouquet complet 15 apps avec clés Mistral incluses)
 * - pro_b2b : 49 € HT / mois (Pôle professionnel solaire)
 * - pilot_free : 100% gratuit (ex: pilote La Grande-Motte)
 * - Compatibilité rétroactive : alphabette_pass (= bouquet), single_app (= single)
 */
export type PlanType = 
  | 'trial_7d'
  | 'single_byok'
  | 'single_managed'
  | 'bouquet_byok'
  | 'bouquet_integral'
  | 'pilot_free'
  | 'pro_b2b'
  // Alias de compatibilité
  | 'single_app'
  | 'alphabette_pass';

export interface FranceServiceModule {
  id: string;
  name: string;
  tagline: string;
  description: string;
  iconName: string;
  zeroKnowledgeNote: string;
}

export interface AppItem {
  id: string;
  slotNumber: number;
  name: string;
  pole: AppPole;
  category: AppCategory;
  tagline: string;
  description: string;
  url: string;
  isConfigured: boolean;
  tags: string[];
  iconName: string;
  pricingNote: string;
  isPopular?: boolean;
  isPiloteFree?: boolean; // e.g. Proxilien à La Grande-Motte
  isB2B?: boolean; // e.g. LIDARSOL / OSOLAR
  isFranceServiceSuite?: boolean; // France Service bundle
  franceServiceModules?: FranceServiceModule[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'tenant_admin' | 'citizen_member';
  tenantId: string;
  tenantName: string;
  subscriptionPlan: PlanType;
  unlockedAppIds: string[]; // e.g. ['iadebat', 'infos-perso']
  ssoSessionId: string;
  memberSince: string;
  city?: string; // e.g. "La Grande-Motte"
  trialDaysLeft?: number;
  trialExpiresAt?: string;
  customMistralApiKey?: string; // Mode BYOK
  vipCodeUsed?: string;
  vipGrantedUntil?: string;
}

/**
 * Configuration commerciale centrale distribuée via /api/config.json
 */
export interface HubCommercialConfig {
  hubUrl: string;
  currency: string;
  pricing: {
    singleApp: {
      byok: number;     // 39 € / an
      managed: number;  // 59 € / an
    };
    bouquet: {
      byok: number;     // 99 € / an
      managed: number;  // 199 € / an (Pass Bouquet Intégral)
    };
  };
  activePromotion?: {
    isActive: boolean;
    badgeLabel: string;
    discountPercent: number; // ex: 20 pour -20%
    expiresAt: string; // ISO date
    description: string;
    couponCode: string;
  };
  stripePaymentLinks: {
    single_byok: string;
    single_managed: string;
    bouquet_byok: string;
    bouquet_integral: string;
  };
  aiPolicy: {
    provider: 'Mistral AI (Exclusif)';
    headquarters: 'Paris, France';
    gdprCompliant: true;
    zeroPublicTraining: true;
    trialDaysIncluded: 7;
  };
}

/**
 * Format des codes VIP / Amis à usage unique
 */
export interface VipAccessCode {
  code: string; // ex: 'VIP-X89K2'
  status: 'active' | 'consumed' | 'revoked';
  durationMonths: number; // ex: 12 (1 an offert)
  planGranted: 'bouquet_integral' | 'bouquet_byok';
  recipientNote?: string; // ex: 'Partenaire Mairie La Grande-Motte'
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  consumedByEmail?: string;
}

/**
 * Registre central des applications (data/apps-registry.json)
 * Source de vérité consommée par la vitrine et la console /admin.
 */
export type RegistryAppStatus = 'actif' | 'brouillon' | 'maintenance';

export type RegistryAppBadge = 'Nouveau' | 'Populaire' | null;

export interface RegistryApp {
  id: string;
  name: string;
  slug: string;
  icon: string;
  status: RegistryAppStatus;
  badge: RegistryAppBadge;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrySnapshot {
  version: number;
  updatedAt: string;
  apps: RegistryApp[];
}
