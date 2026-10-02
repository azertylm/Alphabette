import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Leaf, 
  EyeOff, 
  Globe2, 
  CheckCircle2,
  FileCheck,
  Server,
  Lock,
  Sparkles
} from 'lucide-react';

export const CommitmentsSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
            Manifeste Éthique & Souveraineté Numérique
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
            Pourquoi ALPHABETTE a choisi exclusivement Mistral AI
          </h2>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            La suite ALPHABETTE repose rigoureusement sur les technologies françaises de <strong>Mistral AI</strong> : conformité RGPD native, immunité juridique européenne et respect absolu de la confidentialité de vos données professionnelles.
          </p>
        </div>

        {/* 4 Pillars Detailed Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Pillar 1: Conformité RGPD Native & Hébergement France */}
          <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/90 flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-slate-900">
                Conformité RGPD Native (France & UE)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mistral AI est une entreprise française hébergeant ses infrastructures et ses modèles en Europe. Vos données traitées ne quittent à aucun moment le cadre juridique protecteur de l'Union européenne.
              </p>
              <div className="text-[11px] font-semibold text-blue-800 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Immunité totale contre le Cloud Act américain et les législations invasives
              </div>
            </div>
          </div>

          {/* Pillar 2: Confidentialité Absolue & Zéro Entraînement Public */}
          <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/90 flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-slate-900">
                Confidentialité Absolue (Zéro Réutilisation)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Les contrats commerciaux avec Mistral AI garantissent formellement que vos requêtes, prompts et pièces professionnelles ne sont <strong>jamais réutilisés</strong> pour l'entraînement public des futurs modèles.
              </p>
              <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Secret professionnel et propriété intellectuelle 100% préservés
              </div>
            </div>
          </div>

          {/* Pillar 3: Architecture Triple Niveau & Mode BYOK */}
          <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/90 flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-slate-900">
                3 Niveaux d'Accès : Essai 7j, BYOK & Managé
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Profitez de 7 jours d'essai offerts, puis apportez votre propre clé API Mistral pour consommer votre quota à prix coûtant (formule BYOK), ou laissez ALPHABETTE gérer l'infrastructure de A à Z (formule Confort).
              </p>
              <div className="text-[11px] font-semibold text-purple-800 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Support natif du développement local sous Mac (Metal / Ollama)
              </div>
            </div>
          </div>

          {/* Pillar 4: Économie Solidaire & Bouquet Transparent */}
          <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/90 flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-slate-900">
                Grille Tarifaire Frugale & Sans Engagement
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                39 € ou 59 € par an pour une application, ou 99 € et 199 € pour débloquer l'ensemble des 15 applications avec le Bouquet complet. Un prix fixe annuel, zéro commission cachée, zéro publicité.
              </p>
              <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Pilotage centralisé en temps réel depuis le hub http://alphabette.fr
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
