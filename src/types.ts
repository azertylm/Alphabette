export type AppPole = 
  | 'b2b_solaire' 
  | 'citoyen_proximite' 
  | 'france_service';

export type AppCategory = 
  | 'Professionnel B2B' 
  | 'Citoyen & Proximité' 
  | 'France Service (Zero-Knowledge)';

export type PlanType = 'pilot_free' | 'single_app' | 'alphabette_pass' | 'pro_b2b';

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
  isB2B?: boolean; // e.g. LIDARSOL / OSOLAR (49 € HT / mois)
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
}

export interface OfficialPricingModel {
  singleAppPricePerYear: number; // 15 € TTC / an
  bundlePassPricePerYear: number; // 40 € TTC / an
  b2bSolarPricePerMonth: number; // 49 € HT / mois
  proxilienPilotGratuit: boolean; // 100% gratuit phase pilote La Grande-Motte
}
