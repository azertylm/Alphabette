import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Leaf, 
  Lock, 
  Database, 
  Link as LinkIcon, 
  Layers, 
  CreditCard 
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
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800/80">
          
          {/* Col 1: Identity */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 flex items-center justify-center font-bold text-lg">
                α
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">ALPHABETTE</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              Portail web central et fédérateur d'applications écologiques, sociales et citoyennes. Fondé par <strong>Valentin RICHAUD</strong> pour bâtir un écosystème numérique souverain, éthique et débarrassé de toute publicité.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <Leaf className="w-3.5 h-3.5" /> Hébergement décarboné
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-400">
                <Cpu className="w-3.5 h-3.5" /> Relais Mistral AI (France)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Lock className="w-3.5 h-3.5" /> 100% RGPD
              </span>
            </div>
          </div>

          {/* Col 2: Navigation & Hub */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Navigation
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#applications" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Applications ({appsCount})</span>
                </a>
              </li>
              <li>
                <button onClick={onOpenPricing} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
                  <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tarifs (1€ ou 3€ / mois)</span>
                </button>
              </li>
              <li>
                <button onClick={onOpenUrlManager} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
                  <LinkIcon className="w-3.5 h-3.5 text-purple-500" />
                  <span>Gestion des URLs d'applications</span>
                </button>
              </li>
              <li>
                <button onClick={onOpenDbArchitecture} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Architecture BDD multi-tenant</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Applications Phares */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Applications du Réseau
            </h4>
            <ul className="space-y-2 text-slate-400 text-xs">
              <li>• LIDARSOL (Cadastre & solaire)</li>
              <li>• OSOLAR (Optimisation énergétique)</li>
              <li>• PROXILIEN (Entraide intergénérationnelle)</li>
              <li>• INFOS PERSO (Actualité dépolluée)</li>
              <li className="text-slate-500 italic">+ 46 futures applications en cours</li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright line */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} ALPHABETTE — Société éditrice fondée par Valentin RICHAUD. Tous droits réservés.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Souveraineté des Données</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Politique RGPD Stricte</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Charte Éco-Conception</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
