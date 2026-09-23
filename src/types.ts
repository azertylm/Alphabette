export type AppCategory = 
  | 'Écologie' 
  | 'Social & Entraide' 
  | 'Outils IA' 
  | 'Vie quotidienne';

export type PlanType = 'free' | 'single_app' | 'alphabette_pass';

export interface AppItem {
  id: string;
  slotNumber: number;
  name: string;
  category: AppCategory;
  tagline: string;
  description: string;
  url: string; // e.g. "https://lidarsol.alphabette.fr" or custom link
  isConfigured: boolean; // whether link is set or still placeholder
  tags: string[];
  iconName: string;
  isPopular?: boolean;
  statusNotes?: string;
  requiresPassOnly?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'tenant_admin' | 'citizen_member';
  tenantId: string;
  tenantName: string;
  subscriptionPlan: PlanType;
  unlockedAppIds: string[]; // for single_app tier (1€ / month each)
  ssoSessionId: string;
  memberSince: string;
}

export interface SubscriptionPlanDetail {
  id: PlanType;
  name: string;
  tagline: string;
  pricePerMonth: number;
  badge?: string;
  highlight?: boolean;
  features: string[];
  limitations?: string[];
  ctaLabel: string;
}
