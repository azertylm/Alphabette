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
  MapPin
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
              <div>
                <span className="text-xl font-extrabold text-white tracking-tight">ALPHABETTE SASU</span>
                <span className="block text-[11px] text-emerald-400 font-medium">Éditeur de solutions logicielles & d'IA souveraines</span>
              </div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              Société par actions simplifiée unipersonnelle fondée par <strong>Valentin RICHAUD</strong> à <strong>La Grande-Motte</strong>. Conçue pour offrir des outils numériques indépendants, souverains, sans publicité et garantissant le respect absolu de la vie privée.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <MapPin className="w-3.5 h-3.5" /> La Grande-Motte (Hérault)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Zero-Knowledge France Service
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Lock className="w-3.5 h-3.5" /> Zéro revente de données
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
                  <span>Écosystème Officiel ({appsCount} apps)</span>
                </a>
              </li>
              <li>
                <button onClick={onOpenPricing} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
                  <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                  <span>Grille Tarifaire (15 € / 40 € an)</span>
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
              Pôles Applicatifs Validés
            </h4>
            <ul className="space-y-1.5 text-slate-400 text-xs">
              <li className="font-semibold text-slate-300 pt-1">B2B Énergie & Solaire :</li>
              <li className="pl-2">• LIDARSOL & OSOLAR (49 € HT/m)</li>
              <li className="font-semibold text-slate-300 pt-1">Citoyen & Proximité :</li>
              <li className="pl-2">• PROXILIEN (Pilote gratuit)</li>
              <li className="pl-2">• IADÉBAT, INFOS PERSO, L'ŒIL DE L'ATELIER (15 €/an)</li>
              <li className="font-semibold text-slate-300 pt-1">Suite France Service :</li>
              <li className="pl-2 text-emerald-400">• 7 modules Zero-Knowledge (15 €/an seul ou Pass 40 €/an)</li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright line */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} ALPHABETTE SASU — Fondé par Valentin RICHAUD à La Grande-Motte. Tous droits réservés.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Souveraineté des Données</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Architecture Zero-Knowledge</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">100% Conforme RGPD</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
