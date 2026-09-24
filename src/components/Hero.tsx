import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  EyeOff, 
  Leaf, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  KeyRound,
  ExternalLink,
  Layers,
  Database,
  CreditCard
} from 'lucide-react';

interface HeroProps {
  onOpenPricing: () => void;
  onOpenUrlManager: () => void;
  onOpenDbArchitecture: () => void;
  appsCount: number;
}

export const Hero: React.FC<HeroProps> = ({
  onOpenPricing,
  onOpenUrlManager,
  onOpenDbArchitecture,
  appsCount
}) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/30 to-slate-50 border-b border-slate-200/80 pt-12 pb-16 sm:pt-16 sm:pb-24">
      {/* Subtle background sovereignty motif */}
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px]"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-900 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
            <span>Fondé par Valentin RICHAUD</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span>IA Souveraine : Machine locale + Relais Mistral AI (France)</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs">
            <EyeOff className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zéro Publicité · 100% RGPD</span>
          </div>
        </div>

        {/* Main Headline */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
            L'écosystème d'applications éthiques, souveraines et sans pub d'
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 underline decoration-emerald-300 decoration-wavy decoration-from-font">
              ALPHABETTE SASU
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto font-normal leading-relaxed">
            Fondé à La Grande-Motte par Valentin RICHAUD, le portail <strong className="text-slate-800 font-semibold">ALPHABETTE</strong> fédère vos outils d'énergie solaire B2B, d’entraide citoyenne locale et la suite globale <strong className="text-emerald-700 font-semibold">France Service</strong> en architecture 100% locale (Zero-Knowledge). Zéro régie publicitaire, zéro revente de données personnelles.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#applications"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-md shadow-emerald-800/20 transition-all hover:scale-102 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Catalogue officiel ({appsCount} solutions)</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              onClick={onOpenPricing}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md transition-all hover:scale-102 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Tarifs officiels (15€ / 40€ an)</span>
            </button>

            <button
              onClick={onOpenUrlManager}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-semibold text-sm transition-all cursor-pointer"
              title="Configurer les liens réels des applications pour Valentin RICHAUD"
            >
              <KeyRound className="w-4 h-4 text-purple-700" />
              <span>Gérer les URLs</span>
            </button>
          </div>
        </div>

        {/* 4 Sovereign Pillars Grid */}
        <div className="mt-14 pt-10 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Leaf className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Hébergement Éco-responsable</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Serveurs européens alimentés par énergie décarbonée, empreinte matérielle optimisée et écoconception logicielle stricte.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Zero-Knowledge & IA Locale</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              La suite France Service s'exécute 100% sur votre appareil : aucune donnée personnelle ne transite sur les serveurs d'ALPHABETTE.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Zéro Pub · Respect Total RGPD</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vos données ne sont ni revendues, ni profilées, ni monétisées. Zéro régie publicitaire, zéro pistage inter-sites.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Single Sign-On (SSO) Central</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Une seule authentification sur Alphabette pour déverrouiller et utiliser l’ensemble de vos applications sans mot de passe multiple.
            </p>
          </div>
        </div>

        {/* Quick Numbers Bar */}
        <div className="mt-8 bg-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xl border border-emerald-500/30">
              α
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Catalogue ALPHABETTE</div>
              <div className="text-xl sm:text-2xl font-extrabold text-white">
                3 Pôles d'Excellence · 7 Solutions Centrales
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-center sm:text-left">
            <div>
              <div className="text-xs text-slate-400">À l'unité (Citoyen)</div>
              <div className="text-lg font-bold text-slate-200">15 € <span className="text-xs font-normal text-slate-400">TTC / an</span></div>
            </div>
            <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>
            <div>
              <div className="text-xs text-emerald-400 font-semibold">Pass ALPHABETTE</div>
              <div className="text-lg font-bold text-white">40 € <span className="text-xs font-normal text-slate-400">TTC / an</span></div>
            </div>
            <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>
            <div>
              <div className="text-xs text-amber-400 font-semibold">B2B Solaire</div>
              <div className="text-lg font-bold text-white">49 € <span className="text-xs font-normal text-slate-400">HT / mois</span></div>
            </div>
            <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>
            <button
              onClick={onOpenDbArchitecture}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Architecture technique</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
