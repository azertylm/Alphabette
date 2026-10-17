import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Leaf, 
  Lock, 
  Database, 
  Link as LinkIcon, 
  Layers, 
  CreditCard,
  MapPin,
  ExternalLink,
  Sparkles
} from 'lucide-react';

interface FooterProps {
  onOpenPricing: () => void;
  onOpenUrlManager: () => void;
  onOpenDbArchitecture: () => void;
  appsCount: number;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenPricing,
  onOpenUrlManager,
  onOpenDbArchitecture,
  appsCount
}) => {
  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* BANDEAU OBLIGATOIRE DU HUB CENTRAL (Instruction Système Section 5) */}
        <div className="mb-12 p-6 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-2xl shrink-0 shadow-lg shadow-emerald-500/20">
              α
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-[11px] mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                Hub Central & Vitrine Officielle
              </div>
              <h3 className="text-lg font-black text-white tracking-tight">
                Découvrir toutes les applications de la suite sur <span className="text-emerald-400">http://alphabette.fr</span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Portail d'interconnexion pour les 15 applications métiers propulsées exclusivement par Mistral AI.
              </p>
            </div>
          </div>

          <a
            href="http://alphabette.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md hover:scale-102 flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Accéder au Hub Central</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800/80">
          
          {/* Col 1: Identity & Mistral AI */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 flex items-center justify-center font-bold text-lg">
                α
              </div>
              <div>
                <span className="text-xl font-extrabold text-white tracking-tight">ALPHABETTE SASU</span>
                <span className="block text-[11px] text-emerald-400 font-medium">Écosystème logiciel souverain & moteur Mistral AI exclusif</span>
              </div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              Établi à <strong>La Grande-Motte</strong>. Toutes les applications de la suite reposent rigoureusement et exclusivement sur <strong>Mistral AI</strong> (France/UE) pour garantir une conformité RGPD absolue, la souveraineté européenne et zéro réutilisation des données pour l'entraînement.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <MapPin className="w-3.5 h-3.5" /> La Grande-Motte (Hérault)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Mistral AI Exclusif
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Lock className="w-3.5 h-3.5" /> Zéro revente ni fuite
              </span>
            </div>
          </div>

          {/* Col 2: Navigation & Hub */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Navigation Hub
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#applications" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Catalogue Officiel ({appsCount} apps)</span>
                </a>
              </li>
              <li>
                <button onClick={onOpenPricing} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
                  <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tarifs : 39€/59€ (Unité) · 99€/199€ (Bouquet)</span>
                </button>
              </li>
              <li>
                <button onClick={onOpenUrlManager} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
                  <LinkIcon className="w-3.5 h-3.5 text-purple-500" />
                  <span>Gestion des URLs d'accès</span>
                </button>
              </li>
              <li>
                <button onClick={onOpenDbArchitecture} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Architecture BDD & SSO</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Applications Phares */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Grille Tarifaire Annuelle
            </h4>
            <ul className="space-y-1.5 text-slate-400 text-xs">
              <li className="font-semibold text-slate-300 pt-1">Application Individuelle :</li>
              <li className="pl-2">• Formule BYOK (Clé client) : <strong>39 € / an</strong></li>
              <li className="pl-2">• Formule Confort (Clé gérée) : <strong>59 € / an</strong></li>
              <li className="font-semibold text-slate-300 pt-1">Le Bouquet Complet (15 Apps) :</li>
              <li className="pl-2 text-emerald-400">• Pass Bouquet BYOK : <strong>99 € / an</strong></li>
              <li className="pl-2 text-emerald-400">• Pass Bouquet Intégral : <strong>199 € / an</strong></li>
              <li className="text-[11px] text-slate-500 pt-1">Essai 7 jours offerts sur toute inscription</li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright line */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} ALPHABETTE SASU — Établi à La Grande-Motte. Tous droits réservés.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Souveraineté des Données</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Technologie Mistral AI</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">100% Conforme RGPD</span>
            <span>•</span>
            <a
              href="/admin"
              title="Console d'administration du registre"
              className="text-slate-700 hover:text-emerald-500 transition-colors"
            >
              Console
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};
