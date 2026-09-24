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
  Info,
  SunMedium,
  Lock,
  Building2,
  Calendar,
  CreditCard
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
  // Selectable apps for the 15 € / an unit plan (Service France, IADébat, Infos Perso, L'Œil de l'Atelier)
  const unitEligibleApps = apps.filter(a => !a.isB2B && !a.isPiloteFree);

  const [selectedUnitApps, setSelectedUnitApps] = useState<string[]>(
    user.unlockedAppIds.length > 0 ? user.unlockedAppIds : ['france-service']
  );

  const toggleUnitApp = (appId: string) => {
    setSelectedUnitApps(prev => 
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
  };

  const calculatedUnitPrice = selectedUnitApps.length * 15;

  return (
    <section id="tarifs" className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grille Tarifaire Officielle ALPHABETTE SASU</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Tarification sobre, transparente et sans prélèvement mensuel abusif
          </h2>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            Édité à La Grande-Motte par Valentin RICHAUD. Zéro régie publicitaire, zéro revente de données personnelles. Choisissez à l'unité (15 € / an) ou le paquet complet (40 € / an pour toutes les applis).
          </p>
        </div>

        {/* 3 Main Offer Cards: À l'unité (15€/an) | Pass ALPHABETTE (40€/an) | Pôle Pro B2B Solaire (49€ HT/mois) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-12">
          
          {/* Card 1: À l'unité (15 € TTC / an) */}
          <div className={`rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all ${
            user.subscriptionPlan === 'single_app' 
              ? 'bg-white border-2 border-blue-500 shadow-md ring-2 ring-blue-300/40' 
              : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                  À l'Unité (15 € / an par application)
                </span>
                {user.subscriptionPlan === 'single_app' && (
                  <span className="text-xs font-semibold text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md">
                    <Check className="w-3.5 h-3.5" /> Formule active
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-slate-900">Application à l'unité</h3>
              <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                Disponible pour l'application Service France (7 modules inclus) ou pour IADébat, Infos Perso et L'Œil de l'Atelier.
              </p>

              {/* Price */}
              <div className="my-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold text-blue-700 tracking-tight">
                    {calculatedUnitPrice} €
                  </span>
                  <span className="text-sm font-semibold text-slate-500">
                    TTC / an ({selectedUnitApps.length} app{selectedUnitApps.length > 1 ? 's' : ''})
                  </span>
                </div>
                <span className="text-xs text-slate-400 block mt-1">
                  Soit <strong>15 € TTC / an pour l'application choisie</strong> · Aucun prélèvement mensuel
                </span>
              </div>

              {/* Interactive Selector */}
              <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase text-slate-500 mb-2 flex items-center justify-between">
                  <span>Sélectionnez votre application (15 € / an chacune) :</span>
                  <span className="text-blue-700 font-semibold">{selectedUnitApps.length} choisie(s)</span>
                </p>
                <div className="space-y-1.5 text-xs">
                  {unitEligibleApps.map((app) => {
                    const isChecked = selectedUnitApps.includes(app.id);
                    return (
                      <label 
                        key={app.id} 
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-blue-100/70 text-blue-950 font-medium' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleUnitApp(app.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <div>
                            <span className="font-semibold">{app.name}</span>
                            {app.id === 'france-service' && (
                              <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                                7 modules Zero-Knowledge
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">15 € / an</span>
                      </label>
                    );
                  })}
                </div>
                {selectedUnitApps.length >= 3 && (
                  <div className="mt-2 text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      À partir de 3 applications (45 €) ou 4 applications (60 €), le <strong>paquet complet Pass ALPHABETTE à 40 € / an</strong> est plus économique et inclut toutes les applis !
                    </span>
                  </div>
                )}
              </div>

              {/* Feature List */}
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 mb-8 border-t border-slate-100 pt-6">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Accès annuel complet à l'application sélectionnée</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Abonnement annuel unique : zéro frais bancaire mensuel</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Zéro publicité, zéro revente de vos données personnelles</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Authentification sécurisée SSO ALPHABETTE</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onSelectPlan('single_app', selectedUnitApps)}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
            >
              {user.subscriptionPlan === 'single_app' 
                ? `Mettre à jour ma sélection (${calculatedUnitPrice} € TTC / an)` 
                : `Choisir à l'unité (${calculatedUnitPrice} € TTC / an)`}
            </button>
          </div>

          {/* Card 2: Le « Pass ALPHABETTE » (40 € TTC / an - RECOMMANDÉ BUNDLE) */}
          <div className="relative rounded-3xl p-7 sm:p-8 flex flex-col justify-between bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950 text-white border-2 border-emerald-500 shadow-xl shadow-emerald-900/20">
            {/* Best Value Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs px-4 py-1 rounded-full uppercase tracking-wider shadow-md">
              Formule Recommandée · Paquet Complet
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 border border-emerald-700/60 px-3 py-1 rounded-full">
                  Pass ALPHABETTE (Toutes les Applis)
                </span>
                {user.subscriptionPlan === 'alphabette_pass' && (
                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-600/40">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Formule active
                  </span>
                )}
              </div>

              <h3 className="text-2xl font-black text-white tracking-tight">Le Paquet Pass ALPHABETTE</h3>
              <p className="text-xs text-slate-300 mt-1 min-h-[32px]">
                Le paquet à 40 € pour TOUTES les applications : Service France et ses 7 modules + IADébat + Infos Perso + L'Œil de l'Atelier.
              </p>

              {/* Price */}
              <div className="my-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-emerald-400 tracking-tight">40 €</span>
                  <span className="text-base font-semibold text-slate-300">TTC / an</span>
                </div>
                <span className="text-xs text-emerald-200/80 block mt-1">
                  Abonnement annuel unique tout compris (soit ~3,33 € / mois sans prélèvement récurrent)
                </span>
              </div>

              {/* Feature List */}
              <ul className="space-y-3.5 text-xs sm:text-sm text-slate-200 mb-8 border-t border-slate-800 pt-6">
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="font-semibold text-white">
                    Toutes les applications citoyennes : IADébat, Infos Perso, L'Œil de l'Atelier
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="font-semibold text-emerald-300">
                    L'Application Globale « France Service » et ses 7 modules 100% locaux (Zero-Knowledge)
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-slate-300">
                    ClairContrat, MémoSanté, PlumeCitoyenne, Patrimoine en Poche, Résil-Express, ÉtatDesLieux Protect, Vigilance Succession
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span>
                    SSO unifié central : 1 seul mot de passe pour tout l'écosystème
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span>
                    Soutien direct aux solutions souveraines d'ALPHABETTE SASU
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
              <span>{user.subscriptionPlan === 'alphabette_pass' ? 'Pass ALPHABETTE Déjà Actif' : 'Prendre le Pass ALPHABETTE (40 € TTC / an)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 3: Pôle Professionnel B2B (Solaire) : LIDARSOL & OSOLAR (49 € HT / mois) */}
          <div className="rounded-3xl p-7 sm:p-8 flex flex-col justify-between bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  Pôle Professionnel B2B Solaire
                </span>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Entreprises
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900">LIDARSOL & OSOLAR</h3>
              <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                Outils métiers de cartographie 3D et chiffrage commercial photovoltaïque pour les professionnels.
              </p>

              {/* Price */}
              <div className="my-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">49 €</span>
                  <span className="text-sm font-semibold text-slate-500">HT / mois</span>
                </div>
                <span className="text-xs text-slate-400 block mt-1">
                  Par application métier (Abonnement professionnel récurrent)
                </span>
              </div>

              {/* Feature List */}
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 mb-8 border-t border-slate-100 pt-6">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>LIDARSOL</strong> : Analyse 3D des toitures par LiDAR HD IGN</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>OSOLAR</strong> : Dimensionnement technico-financier & devis photovoltaïques</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Calcul d'ombrages, surface utile et rentabilité kWh</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Export des rapports clients aux formats PDF & SIG</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Facturation déductible avec TVA & support dédié</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onSelectPlan('pro_b2b')}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all cursor-pointer"
            >
              Souscrire à une licence Pro Solaire (49 € HT / mois)
            </button>
          </div>

        </div>

        {/* Focus Special: PROXILIEN à La Grande-Motte */}
        <div className="p-6 bg-emerald-50/80 rounded-2xl border border-emerald-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[11px] font-bold uppercase tracking-wider mb-1">
                Programme Pilote Communal
              </div>
              <h4 className="font-bold text-slate-900 text-base">
                PROXILIEN : 100 % Gratuit la 1ère année à La Grande-Motte
              </h4>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Dans le cadre de la phase de test pilote initiée à La Grande-Motte, l'accès à la plateforme d'entraide de proximité et de lien civique est intégralement offert la première année pour les résidents et acteurs locaux. Le déploiement sous licences municipales auprès d'autres communes et usagers est planifié sous 3 à 4 mois.
              </p>
            </div>
          </div>

          <a
            href="#applications"
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
          >
            Découvrir Proxilien
          </a>
        </div>

      </div>
    </section>
  );
};
