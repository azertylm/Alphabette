import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Leaf, 
  EyeOff, 
  Globe2, 
  CheckCircle2,
  FileCheck,
  Server
} from 'lucide-react';

export const CommitmentsSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
            Manifeste Éthique & Souveraineté
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
            Pourquoi ALPHABETTE est différent des plateformes traditionnelles
          </h2>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            Fondée par Valentin RICHAUD, la société ALPHABETTE fait le choix radical de la souveraineté technologique, de la frugalité numérique et de la primauté des droits citoyens.
          </p>
        </div>

        {/* 4 Pillars Detailed Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Pillar 1: IA Souveraine & Architecture Zero-Knowledge */}
          <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/90 flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-slate-900">
                Architecture Zero-Knowledge & IA Locale
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Les modules sensibles de la suite <strong>France Service</strong> fonctionnent selon le principe du <em>Zero-Knowledge</em> : l'ensemble des données et calculs s'exécutent directement sur votre terminal. Aucune information personnelle n'est envoyée ni stockée sur nos serveurs.
              </p>
              <div className="text-[11px] font-semibold text-blue-800 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aucune exploitation de vos données personnelles ni de vos contrats
              </div>
            </div>
          </div>

          {/* Pillar 2: Hébergement Éco-Responsable */}
          <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/90 flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Leaf className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-slate-900">
                Hébergement Éco-Responsable & Frugal
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Infrastructures européennes sélectionnées pour leur indicateur d'efficacité énergétique (PUE inférieur à 1.2), alimentées par des sources d'électricité décarbonées et garantissant un cycle de vie prolongé des serveurs.
              </p>
              <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Code écoconçu, sans scripts lourds ni trackers énergivores
              </div>
            </div>
          </div>

          {/* Pillar 3: Zéro Pub & 100% RGPD */}
          <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/90 flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <EyeOff className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-slate-900">
                Zéro Publicité & Respect Intégral du RGPD
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Aucune régie publicitaire, aucun cookie de profilage commercial. Vos données personnelles restent votre propriété exclusive et peuvent être exportées ou supprimées en un clic conformément à la réglementation européenne.
              </p>
              <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Chiffrement fort des bases de données au repos et en transit
              </div>
            </div>
          </div>

          {/* Pillar 4: Souveraineté Juridique & Indépendance */}
          <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/90 flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Globe2 className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-slate-900">
                Indépendance Européenne Stricte
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Immunité totale contre les législations extraterritoriales (US Cloud Act / FISA). La société ALPHABETTE est de droit français et régie exclusivement par les cours de justice européennes.
              </p>
              <div className="text-[11px] font-semibold text-purple-800 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Modèle financé par les usagers (15 € ou 40 € / an) pour une indépendance totale sans publicité
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
