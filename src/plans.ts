import type { PlanType } from './types';

/**
 * Tarification officielle de l'écosystème alphabette.fr.
 *
 * Source de vérité côté hub : `/api/config.json` (voir `server.ts`). Ces valeurs
 * en sont le reflet côté vitrine, pour les libellés et les simulations.
 */
export const PRICES = {
  /** 15 € / application / an. */
  perApp: 15,
  /** 40 € / écosystème complet / an. */
  ecosystem: 40,
  /** 7 jours d'essai offerts. */
  trialDays: 7,
  currency: 'EUR',
} as const;

export type PlanTier = 'trial' | 'app' | 'ecosystem' | 'pro' | 'free';

/**
 * Palier commercial d'un plan. Les identifiants historiques (single_byok,
 * single_managed, bouquet_byok, bouquet_integral, alphabette_pass, single_app)
 * sont traduits vers les paliers actuels : un profil enregistré avant la bascule
 * tarifaire continue de fonctionner sans migration de données.
 */
export function planTier(plan: PlanType): PlanTier {
  switch (plan) {
    case 'ecosystem':
    case 'alphabette_pass':
    case 'bouquet_integral':
    case 'bouquet_byok':
      return 'ecosystem';
    case 'app':
    case 'single_app':
    case 'single_byok':
    case 'single_managed':
      return 'app';
    case 'pro_b2b':
      return 'pro';
    case 'pilot_free':
      return 'free';
    case 'trial_7d':
    default:
      return 'trial';
  }
}

/** Vrai si le plan débloque tout l'écosystème. */
export function isEcosystemPlan(plan: PlanType): boolean {
  return planTier(plan) === 'ecosystem';
}

/** Vrai si le plan débloque une seule application. */
export function isAppPlan(plan: PlanType): boolean {
  return planTier(plan) === 'app';
}

/** Vrai si le plan couvre la période d'essai (tout est ouvert pendant 7 jours). */
export function isTrialPlan(plan: PlanType): boolean {
  return planTier(plan) === 'trial';
}

/** Vrai si le plan est la licence professionnelle solaire. */
export function isProPlan(plan: PlanType): boolean {
  return planTier(plan) === 'pro';
}

/** Pastille affichée dans l'en-tête pour le plan courant. */
export function planBadge(
  plan: PlanType,
  totalApps?: number,
): { label: string; classes: string; dot: string } {
  const apps = totalApps ? ` · ${totalApps} apps` : '';
  switch (planTier(plan)) {
    case 'ecosystem':
      return {
        label: `Écosystème complet (${PRICES.ecosystem} €/an${apps})`,
        classes: 'bg-emerald-500/15 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/20',
        dot: 'bg-emerald-500',
      };
    case 'app':
      return {
        label: `Application au choix (${PRICES.perApp} €/an)`,
        classes: 'bg-blue-500/15 text-blue-800 border-blue-300 ring-1 ring-blue-400/20',
        dot: 'bg-blue-500',
      };
    case 'pro':
      return {
        label: 'Licence B2B Solaire (49 € HT/mois)',
        classes: 'bg-amber-500/15 text-amber-900 border-amber-300 ring-1 ring-amber-400/20',
        dot: 'bg-amber-500',
      };
    case 'free':
      return {
        label: 'Pilote La Grande-Motte (100 % gratuit)',
        classes: 'bg-teal-500/15 text-teal-800 border-teal-300 ring-1 ring-teal-400/20',
        dot: 'bg-teal-500',
      };
    case 'trial':
    default:
      return {
        label: `Essai ${PRICES.trialDays} jours offerts (Mistral inclus)`,
        classes: 'bg-emerald-500/15 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/20',
        dot: 'bg-emerald-500',
      };
  }
}

/** Message affiché après un changement de plan. */
export function planToast(plan: PlanType): string {
  switch (planTier(plan)) {
    case 'ecosystem':
      return `🎉 Écosystème complet activé (${PRICES.ecosystem} € / an) ! Toutes les applications et les clés Mistral sont incluses.`;
    case 'app':
      return `Application activée (${PRICES.perApp} € / an).`;
    case 'pro':
      return 'Licence Pro B2B Solaire activée (49 € HT / mois).';
    case 'free':
      return 'Phase pilote La Grande-Motte activée (100 % gratuit).';
    case 'trial':
    default:
      return `🎁 Période d'essai de ${PRICES.trialDays} jours activée avec la clé Mistral Alphabette incluse !`;
  }
}
