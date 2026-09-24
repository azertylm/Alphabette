import React, { useState } from 'react';
import { 
  Shield, 
  Sparkles, 
  Link as LinkIcon, 
  Database, 
  User, 
  ChevronDown, 
  ExternalLink, 
  Check, 
  Layers, 
  Menu, 
  X,
  CreditCard
} from 'lucide-react';
import { UserProfile, PlanType } from '../types';

interface HeaderProps {
  user: UserProfile;
  onChangeUserPlan: (plan: PlanType, unlockedAppIds?: string[]) => void;
  onOpenUrlManager: () => void;
  onOpenDbArchitecture: () => void;
  onOpenPricing: () => void;
  configuredCount: number;
  totalAppsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onChangeUserPlan,
  onOpenUrlManager,
  onOpenDbArchitecture,
  onOpenPricing,
  configuredCount,
  totalAppsCount
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getPlanBadge = () => {
    switch (user.subscriptionPlan) {
      case 'alphabette_pass':
        return {
          label: 'Pass ALPHABETTE (40€/an)',
          classes: 'bg-emerald-500/15 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/20',
          dot: 'bg-emerald-500'
        };
      case 'single_app':
        return {
          label: `À l'unité (${user.unlockedAppIds.length} app · 15€/an)`,
          classes: 'bg-blue-500/15 text-blue-800 border-blue-300 ring-1 ring-blue-400/20',
          dot: 'bg-blue-500'
        };
      case 'pro_b2b':
        return {
          label: 'Licence B2B Solaire (49€ HT/mois)',
          classes: 'bg-amber-500/15 text-amber-900 border-amber-300 ring-1 ring-amber-400/20',
          dot: 'bg-amber-500'
        };
      case 'pilot_free':
        return {
          label: 'Pilote La Grande-Motte (100% Gratuit)',
          classes: 'bg-teal-500/15 text-teal-800 border-teal-300 ring-1 ring-teal-400/20',
          dot: 'bg-teal-500'
        };
      default:
        return {
          label: 'Pass ALPHABETTE (40€/an)',
          classes: 'bg-emerald-500/15 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500'
        };
    }
  };

  const planBadge = getPlanBadge();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 transition-all shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Platform identity */}
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-emerald-700/20 transition-transform group-hover:scale-105">
                <span className="tracking-tighter font-serif">α</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900">ALPHABETTE</span>
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    HUB SSO
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Par Valentin RICHAUD · Écosystème Souverain
                </span>
              </div>
            </a>
          </div>

          {/* Desktop Navigation links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
            <a 
              href="#applications" 
              className="px-3 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Applications ({totalAppsCount})</span>
            </a>

            <a 
              href="#ai-studio" 
              className="px-3 py-2 rounded-lg hover:text-slate-900 hover:bg-emerald-50 transition-colors flex items-center gap-1.5 text-emerald-800 font-semibold"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Moteur IA Souverain</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                Mistral/Local
              </span>
            </a>

            <button 
              onClick={onOpenPricing}
              className="px-3 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Tarifs (15€ / 40€)</span>
            </button>

            <button 
              onClick={onOpenUrlManager}
              className="px-3 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer relative"
            >
              <LinkIcon className="w-4 h-4 text-purple-600" />
              <span>Gérer les URLs</span>
              <span className="ml-1 text-[11px] px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full font-semibold">
                {configuredCount}/{totalAppsCount}
              </span>
            </button>

            <button 
              onClick={onOpenDbArchitecture}
              className="px-3 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200"
            >
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Architecture BDD & SSO</span>
            </button>
          </nav>

          {/* User profile & Active Subscription Badge */}
          <div className="flex items-center gap-3">
            {/* Quick Subscription indicator */}
            <div 
              onClick={onOpenPricing}
              title="Cliquez pour changer d'offre ou tester les droits"
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-all hover:scale-102 ${planBadge.classes}`}
            >
              <span className={`w-2 h-2 rounded-full animate-pulse ${planBadge.dot}`}></span>
              <span>{planBadge.label}</span>
            </div>

            {/* User session SSO selector */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all text-slate-800 text-xs sm:text-sm font-medium shadow-xs"
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden lg:flex flex-col text-left leading-tight">
                  <span className="font-semibold text-slate-900 truncate max-w-[130px]">{user.name}</span>
                  <span className="text-[10px] text-slate-500">{user.role === 'superadmin' ? 'Fondateur · SSO Admin' : 'Compte Citoyen'}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div 
                  className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 divide-y divide-slate-100"
                  onMouseLeave={() => setIsUserMenuOpen(false)}
                >
                  <div className="pb-3 px-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-slate-900 text-sm">{user.name}</p>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {user.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="font-semibold block text-slate-700">Tenant :</span>
                      {user.tenantName} (<span className="text-[10px] font-mono">{user.tenantId}</span>)
                    </div>
                  </div>

                  {/* Plan Switcher Simulator for testing */}
                  <div className="py-2 px-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Simulateur de statut d’abonnement
                    </p>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          onChangeUserPlan('alphabette_pass');
                          setIsUserMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          user.subscriptionPlan === 'alphabette_pass'
                            ? 'bg-emerald-50 text-emerald-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>Pass ALPHABETTE (40 € TTC / an)</span>
                        {user.subscriptionPlan === 'alphabette_pass' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>

                      <button
                        onClick={() => {
                          onChangeUserPlan('single_app', ['iadebat']);
                          setIsUserMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          user.subscriptionPlan === 'single_app'
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>À l'unité (15 € TTC / an / app)</span>
                        {user.subscriptionPlan === 'single_app' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </button>

                      <button
                        onClick={() => {
                          onChangeUserPlan('pro_b2b');
                          setIsUserMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          user.subscriptionPlan === 'pro_b2b'
                            ? 'bg-amber-50 text-amber-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>Licence B2B Solaire (49 € HT / mois)</span>
                        {user.subscriptionPlan === 'pro_b2b' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </button>

                      <button
                        onClick={() => {
                          onChangeUserPlan('pilot_free');
                          setIsUserMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          user.subscriptionPlan === 'pilot_free'
                            ? 'bg-teal-50 text-teal-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>Pilote La Grande-Motte (Gratuit 1 an)</span>
                        {user.subscriptionPlan === 'pilot_free' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 px-1 flex flex-col gap-1">
                    <button
                      onClick={() => {
                        onOpenUrlManager();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-purple-600" />
                      <span>Configurer les URLs d'accès</span>
                    </button>
                    <button
                      onClick={() => {
                        onOpenDbArchitecture();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Database className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Architecture multi-tenant & SSO</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3">
          <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-600">Abonnement actif :</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planBadge.classes}`}>
              {planBadge.label}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <a 
              href="#applications" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-slate-100 flex items-center gap-2 text-sm"
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Applications ({totalAppsCount})</span>
            </a>
            <a 
              href="#ai-studio" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-emerald-800 font-semibold bg-emerald-50 hover:bg-emerald-100 flex items-center gap-2 text-sm"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Zero-Knowledge & IA Locale</span>
            </a>
            <button 
              onClick={() => {
                onOpenPricing();
                setIsMobileMenuOpen(false);
              }}
              className="px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-slate-100 flex items-center gap-2 text-sm text-left"
            >
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Tarifs officiels (15€ / 40€)</span>
            </button>
            <button 
              onClick={() => {
                onOpenUrlManager();
                setIsMobileMenuOpen(false);
              }}
              className="px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-slate-100 flex items-center gap-2 text-sm text-left"
            >
              <LinkIcon className="w-4 h-4 text-purple-600" />
              <span>Gérer les liens ({configuredCount}/{totalAppsCount})</span>
            </button>
            <button 
              onClick={() => {
                onOpenDbArchitecture();
                setIsMobileMenuOpen(false);
              }}
              className="px-3 py-2 rounded-lg text-slate-700 font-medium hover:bg-slate-100 flex items-center gap-2 text-sm text-left bg-emerald-50"
            >
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Architecture Technique & BDD</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
