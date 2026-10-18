import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  EyeOff, 
  Leaf, 
  ArrowRight, 
  KeyRound, 
  Layers, 
  Database, 
  CreditCard, 
  CheckCircle2,
  Sparkles,
  Lock
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
    <section className="bg-white border-b border-slate-200 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top quiet metadata line */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium mb-4 text-center">
          <span className="text-emerald-700 font-semibold">ALPHABETTE SASU</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>Hub Central http://alphabette.fr</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="text-blue-700 font-semibold">Technologie Mistral AI Exclusive</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="text-slate-700 font-semibold">100% RGPD · Hébergement France</span>
        </div>

        {/* Main Headline & Subtitle */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Écosystème logiciel souverain propulsé par Mistral AI
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-700 font-normal leading-relaxed">
            Le hub central <strong className="text-slate-900 font-semibold">ALPHABETTE</strong> fédère les <strong className="text-emerald-800 font-bold">{appsCount} applications métiers</strong> de la suite. Toutes reposent rigoureusement sur les technologies françaises de <strong>Mistral AI</strong> : conformité RGPD native, données cloisonnées en Europe et zéro réutilisation pour l'entraînement.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium">
            <span className="text-emerald-700 font-bold">🎁 7 jours d'essai offerts</span>
            <span>·</span>
            <span>Application au choix : <strong className="text-blue-800 font-bold">15 € / an</strong></span>
            <span>·</span>
            <span>Écosystème complet : <strong className="text-emerald-800 font-bold">40 € / an</strong></span>
          </div>

          {/* Action CTAs */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#applications"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Explorer les {appsCount} applications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onOpenPricing}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Grille tarifaire (15 € · 40 €)</span>
            </button>

            <button
              onClick={onOpenUrlManager}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs sm:text-sm transition-all cursor-pointer border border-slate-200"
              title="Configurer les adresses réelles des 15 applications"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-600" />
              <span>Gérer les URLs</span>
            </button>
          </div>
        </div>

        {/* 4 Condensed Key Commitments */}
        <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Mistral AI Exclusif</h3>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Hébergement en France/Europe. Zéro transfert hors de l'Union européenne et stricte conformité RGPD.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-blue-700 shrink-0" />
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Confidentialité Absolue</h3>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Vos requêtes professionnelles et données ne sont jamais utilisées pour l'entraînement public des modèles.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Essai 7j & Prix unique</h3>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              7 jours offerts clés en main, puis 15 € / an pour une application ou 40 € / an pour tout l'écosystème. Sans engagement, zéro publicité.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Hub Centralisé & SSO</h3>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Un identifiant unique pour lancer les 15 applications avec circulation sécurisée des données inter-modules.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};
