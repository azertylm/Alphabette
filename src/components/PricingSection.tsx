import React, { useState } from 'react';
import { Check, Gift } from 'lucide-react';
import { AppItem, PlanType, UserProfile } from '../types';
import { PRICES } from '../plans';

/**
 * Tarifs (section d'administration ?admin uniquement).
 * Modèle unique (CLAUDE.md) : 15,00 €/an par application = 10,00 € pour le créateur + 5,00 € pour Alphabette.
 * Aucun bouquet, aucun prorata, aucune promotion simulée.
 */
interface PricingSectionProps {
  user: UserProfile;
  apps: AppItem[];
  onSelectPlan: (plan: PlanType, unlockedAppIds?: string[]) => void;
  onOpenVipModal?: (tab?: 'activate' | 'generator') => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ user, apps, onSelectPlan, onOpenVipModal }) => {
  const achetables = apps.filter((a) => !a.isB2B);
  const [appId, setAppId] = useState<string>(user.unlockedAppIds[0] ?? achetables[0]?.id ?? '');
  return (
    <section id="tarifs" className="py-12 sm:py-16 bg-white border-t border-slate-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">Un seul prix : {PRICES.perApp} € par an et par application</h2>
        <p className="mt-2 text-slate-600">
          Dont <strong>10 €</strong> pour le créateur de l'application et <strong>5 €</strong> pour Alphabette.
          {' '}{PRICES.trialDays} jours d'essai sans carte bancaire, 12 mois, aucun renouvellement automatique.
        </p>
        <ul className="mt-4 space-y-2 text-slate-700">
          {['Sans publicité, sans revente de données', 'Paiement unique, sans engagement', 'Gratuit pendant l\'offre de lancement'].map((t) => (
            <li key={t} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />{t}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-800">
            Application
            <select className="block mt-1 min-h-11 rounded-lg border border-slate-300 px-3" value={appId} onChange={(e) => setAppId(e.target.value)}>
              {achetables.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <button type="button" className="min-h-11 px-4 rounded-lg bg-blue-700 text-white font-bold" onClick={() => appId && onSelectPlan('app', [appId])}>
            Choisir ({PRICES.perApp} € / an)
          </button>
          {onOpenVipModal && (
            <button type="button" className="min-h-11 px-4 rounded-lg border border-slate-300 font-semibold inline-flex items-center gap-2" onClick={() => onOpenVipModal('activate')}>
              <Gift className="w-4 h-4" aria-hidden="true" /> J'ai un code
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
