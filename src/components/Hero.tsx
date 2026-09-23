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
  Database
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
            L'écosystème d'applications éthiques, souveraines et sans pub pour{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 underline decoration-emerald-300 decoration-wavy decoration-from-font">
              3 € / mois
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto font-normal leading-relaxed">
            Le portail web central <strong className="text-slate-800 font-semibold">ALPHABETTE</strong> fédère vos outils d'écologie, d’entraide sociale, d'intelligence artificielle souveraine et de citoyenneté numérique. Un compte unique (SSO) pour accéder à l’ensemble de nos solutions sans traceur publicitaire.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#applications"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-md shadow-emerald-800/20 transition-all hover:scale-102 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Explorer les applications ({appsCount})</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="#ai-studio"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 font-semibold text-sm shadow-md transition-all hover:scale-102 cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Tester le Moteur IA Souverain</span>
            </a>

            <button
              onClick={onOpenPricing}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-sm shadow-xs transition-all hover:border-slate-400 cursor-pointer"
            >
              <span>Tarifs (1€ / 3€)</span>
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
            <h3 className="font-bold text-slate-900 text-base">IA Souveraine & Mistral AI</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Traitements effectués en priorité sur machine locale haute performance avec relais sécurisé Mistral AI situé en France.
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
              <div className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Catalogue Actuel</div>
              <div className="text-xl sm:text-2xl font-extrabold text-white">
                {appsCount} Applications Disponibles (Objectif 50+)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-center sm:text-left">
            <div>
              <div className="text-xs text-slate-400">À la carte</div>
              <div className="text-lg font-bold text-slate-200">1 € / mois <span className="text-xs font-normal text-slate-400">/ app</span></div>
            </div>
            <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>
            <div>
              <div className="text-xs text-emerald-400 font-semibold">Pass Complet</div>
              <div className="text-lg font-bold text-white">3 € / mois <span className="text-xs font-normal text-slate-400">toutes apps</span></div>
            </div>
            <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>
            <button
              onClick={onOpenDbArchitecture}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Voir l'architecture BDD multi-tenant</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
