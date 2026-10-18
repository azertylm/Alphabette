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
 * - trial_7d  : Essai 7 jours offerts (clé Mistral Alphabette incluse)
 * - app       : 15 € / an — une application au choix
 * - ecosystem : 40 € / an — l'écosystème complet
 * - pro_b2b   : 49 € HT / mois (pôle professionnel solaire)
 * - pilot_free: 100 % gratuit (ex. pilote La Grande-Motte)
 *
 * Les identifiants historiques (single_byok, single_managed, bouquet_byok,
 * bouquet_integral, alphabette_pass, single_app) restent acceptés : les profils
 * déjà enregistrés chez les visiteurs continuent de fonctionner. Ils ne sont
 * plus jamais proposés. Correspondance centralisée dans `planTier()`
 * (`src/plans.ts`).
 */
export type PlanType = 
  | 'trial_7d'
  | 'app'
  | 'ecosystem'
  | 'pilot_free'
  | 'pro_b2b'
  // Alias historiques (acceptés, jamais proposés)
  | 'single_app'
  | 'single_byok'
  | 'single_managed'
  | 'alphabette_pass'
  | 'bouquet_byok'
  | 'bouquet_integral';

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
    perApp: number;    // 15 € / application / an
    ecosystem: number; // 40 € / écosystème complet / an
    trialDays: number; // 7 jours offerts
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
    perApp: string;
    ecosystem: string;
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
  planGranted: 'ecosystem' | 'app';
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
  /** Sous-domaine dédié (ex. « goatchevretheking » → goatchevretheking.alphabette.fr). */
  subdomain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrySnapshot {
  version: number;
  updatedAt: string;
  apps: RegistryApp[];
}
