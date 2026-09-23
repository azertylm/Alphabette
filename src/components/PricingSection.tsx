import React, { useState } from 'react';
import { 
  Check, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  HeartHandshake,
  Layers,
  Info
} from 'lucide-react';
import { AppItem, PlanType, UserProfile } from '../types';

interface PricingSectionProps {
  user: UserProfile;
  apps: AppItem[];
  onSelectPlan: (plan: PlanType, unlockedAppIds?: string[]) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  user,
  apps,
  onSelectPlan
}) => {
  // For single app selection preview
  const [selectedSingleApps, setSelectedSingleApps] = useState<string[]>(
    user.unlockedAppIds.length > 0 ? user.unlockedAppIds : ['lidarsol']
  );

  const toggleSingleApp = (appId: string) => {
    setSelectedSingleApps(prev => 
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
  };

  const calculatedSinglePrice = selectedSingleApps.length * 1;

  return (
    <section id="tarifs" className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tarification Sobre, Éthique & Sans Surprise</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Un modèle équitable pour soutenir des logiciels libres de publicité
          </h2>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            Zéro investisseur toxique, zéro algorithme de rétention publicitaire. Nos applications sont financées uniquement par vous, pour garantir notre indépendance absolue et la souveraineté de vos données.
          </p>
        </div>

        {/* 3 Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          
          {/* Plan 1: Gratuit / Découverte */}
          <div className={`rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all ${
            user.subscriptionPlan === 'free' 
              ? 'bg-white border-2 border-slate-400 shadow-md ring-2 ring-slate-300/40' 
              : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  Découverte
                </span>
                {user.subscriptionPlan === 'free' && (
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                    <Check className="w-3.5 h-3.5" /> Formule actuelle
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-slate-900">Gratuit / Découverte</h3>
              <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                Pour tester l’écosystème, consulter les données ouvertes et tester les démos.
              </p>

              {/* Price */}
              <div className="my-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">0 €</span>
                  <span className="text-sm font-semibold text-slate-500">/ mois</span>
                </div>
                <span className="text-xs text-slate-400 block mt-1">Sans engagement, sans carte bancaire</span>
              </div>

              {/* Feature List */}
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 mb-8 border-t border-slate-100 pt-6">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Accès aux simulateurs publics en mode démo</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Consultation des actualités dépolluées (extraits)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Compte SSO Citoyen unique créé</span>
                </li>
                <li className="flex items-start gap-2.5 text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">✕</span>
                  <span>Pas de sauvegarde de vos projets et historiques</span>
                </li>
                <li className="flex items-start gap-2.5 text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">✕</span>
                  <span>Limité à 3 simulations par mois</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onSelectPlan('free', [])}
              disabled={user.subscriptionPlan === 'free'}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
                user.subscriptionPlan === 'free'
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              {user.subscriptionPlan === 'free' ? 'Formule active' : 'Basculer en mode Gratuit'}
            </button>
          </div>

          {/* Plan 2: À la carte (1 € / mois par app) */}
          <div className={`rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all ${
            user.subscriptionPlan === 'single_app' 
              ? 'bg-white border-2 border-blue-500 shadow-md ring-2 ring-blue-300/40' 
              : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                  À la carte
                </span>
                {user.subscriptionPlan === 'single_app' && (
                  <span className="text-xs font-semibold text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md">
                    <Check className="w-3.5 h-3.5" /> Formule actuelle
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-slate-900">Application Isolée</h3>
              <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                Vous avez un besoin précis ? Ne payez que l’application que vous utilisez.
              </p>

              {/* Dynamic Price Calculation */}
              <div className="my-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold text-blue-700 tracking-tight">
                    {calculatedSinglePrice} €
                  </span>
                  <span className="text-sm font-semibold text-slate-500">
                    / mois ({selectedSingleApps.length} app{selectedSingleApps.length > 1 ? 's' : ''})
                  </span>
                </div>
                <span className="text-xs text-slate-400 block mt-1">1,00 € TTC par application sélectionnée</span>
              </div>

              {/* Interactive App Selector */}
              <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase text-slate-500 mb-2 flex items-center justify-between">
                  <span>Choisissez vos applications :</span>
                  <span className="text-blue-700 font-semibold">{selectedSingleApps.length} sélectionnée(s)</span>
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {apps.slice(0, 8).map((app) => {
                    const isChecked = selectedSingleApps.includes(app.id);
                    return (
                      <label 
                        key={app.id} 
                        className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-blue-100/60 text-blue-950 font-medium' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSingleApp(app.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span className="truncate">{app.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">+1€/m</span>
                      </label>
                    );
                  })}
                </div>
                {selectedSingleApps.length >= 3 && (
                  <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Astuce : À partir de 3 apps, le <strong>Pass Alphabette à 3 €</strong> est plus avantageux et vous débloque toutes les 50+ applications !
                    </span>
                  </div>
                )}
              </div>

              {/* Feature List */}
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 mb-8 border-t border-slate-100 pt-6">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Accès complet et illimité à l'application choisie</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Sauvegarde chiffrée de vos projets & calculs</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Connexion directe via SSO Alphabette</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Modifiable ou résiliable chaque mois en 1 clic</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onSelectPlan('single_app', selectedSingleApps)}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
            >
              {user.subscriptionPlan === 'single_app' 
                ? `Mettre à jour mes applications (${calculatedSinglePrice}€/m)` 
                : `Choisir À la carte (${calculatedSinglePrice}€/m)`}
            </button>
          </div>

          {/* Plan 3: Pass Alphabette (3 € / mois - RECOMMANDÉ) */}
          <div className="relative rounded-3xl p-7 sm:p-8 flex flex-col justify-between bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950 text-white border-2 border-emerald-500 shadow-xl shadow-emerald-900/20">
            {/* Best Value Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs px-4 py-1 rounded-full uppercase tracking-wider shadow-md">
              Recommandé · Accès Illimité
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 border border-emerald-700/60 px-3 py-1 rounded-full">
                  Pass Alphabette
                </span>
                {user.subscriptionPlan === 'alphabette_pass' && (
                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-600/40">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Formule active
                  </span>
                )}
              </div>

              <h3 className="text-2xl font-black text-white tracking-tight">Pass Complet Écosystème</h3>
              <p className="text-xs text-slate-300 mt-1 min-h-[32px]">
                Débloquez instantanément l'intégralité des applications actuelles et futures du réseau.
              </p>

              {/* Price */}
              <div className="my-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-emerald-400 tracking-tight">3 €</span>
                  <span className="text-base font-semibold text-slate-300">/ mois</span>
                </div>
                <span className="text-xs text-emerald-200/80 block mt-1">
                  Accès à 100% des applications (présentes & les 50+ futures)
                </span>
              </div>

              {/* Feature List */}
              <ul className="space-y-3.5 text-xs sm:text-sm text-slate-200 mb-8 border-t border-slate-800 pt-6">
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="font-semibold text-white">
                    Toutes les 8 applications opérationnelles incluses
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span>
                    Accès automatique aux <strong>42 futures applications</strong> sans augmentation
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span>
                    SSO unifié : 1 session, zéro reconnexion sur toutes les plateformes
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span>
                    Accès prioritaire aux fonctionnalités beta et relais Mistral AI
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span>
                    Soutien direct à l’indépendance d’ALPHABETTE et à Valentin RICHAUD
                  </span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onSelectPlan('alphabette_pass')}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                user.subscriptionPlan === 'alphabette_pass'
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950'
              }`}
            >
              <span>{user.subscriptionPlan === 'alphabette_pass' ? 'Pass Alphabette Déjà Actif' : 'Prendre le Pass Complet (3 € / mois)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Security & European Sovereign payment guarantee */}
        <div className="mt-12 p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 text-slate-600 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Paiements Européens Sécurisés & Éthiques</h4>
              <p className="text-slate-500 text-xs mt-0.5">
                Prélèvement SEPA direct ou carte bancaire chiffrée. Résiliation en 1 clic sans préavis ni frais cachés.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-slate-500 text-xs shrink-0">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sans engagement
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 100% Déductible (professionnels)
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Facture européenne avec TVA
            </span>
          </div>
        </div>

      </div>
    </section>
  );
};
