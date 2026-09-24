import React, { useState } from 'react';
import { 
  SunMedium, 
  Zap, 
  HeartHandshake, 
  Scale, 
  Newspaper, 
  Hammer, 
  ShieldCheck, 
  Layers, 
  ExternalLink, 
  Lock, 
  Unlock, 
  Link as LinkIcon, 
  CheckCircle2, 
  ChevronDown,
  ChevronUp,
  FileCheck,
  HeartPulse,
  PenTool,
  Landmark,
  FileX,
  Camera,
  ShieldAlert,
  Sparkles,
  Building2,
  Gift
} from 'lucide-react';
import { AppItem, UserProfile } from '../types';

interface AppCardProps {
  app: AppItem;
  user: UserProfile;
  onLaunch: (app: AppItem) => void;
  onEditUrl: (app: AppItem) => void;
  onSelectSubscribe: (appId: string) => void;
}

export const AppCard: React.FC<AppCardProps> = ({
  app,
  user,
  onLaunch,
  onEditUrl,
  onSelectSubscribe
}) => {
  const [showModules, setShowModules] = useState(false);

  // Determine if application is unlocked for current user
  const isProxilienFree = app.isPiloteFree;
  const isUnlockedByPass = user.subscriptionPlan === 'alphabette_pass' && !app.isB2B;
  const isUnlockedByB2B = user.subscriptionPlan === 'pro_b2b' && app.isB2B;
  const isUnlockedBySingle = user.subscriptionPlan === 'single_app' && user.unlockedAppIds.includes(app.id);
  const isUnlocked = isProxilienFree || isUnlockedByPass || isUnlockedByB2B || isUnlockedBySingle;

  // Render proper icon
  const renderIcon = () => {
    const iconProps = { className: 'w-6 h-6' };
    switch (app.iconName) {
      case 'SunMedium': return <SunMedium {...iconProps} className="w-6 h-6 text-amber-500" />;
      case 'Zap': return <Zap {...iconProps} className="w-6 h-6 text-amber-500" />;
      case 'HeartHandshake': return <HeartHandshake {...iconProps} className="w-6 h-6 text-rose-500" />;
      case 'Scale': return <Scale {...iconProps} className="w-6 h-6 text-indigo-600" />;
      case 'Newspaper': return <Newspaper {...iconProps} className="w-6 h-6 text-blue-600" />;
      case 'Hammer': return <Hammer {...iconProps} className="w-6 h-6 text-amber-700" />;
      case 'ShieldCheck': return <ShieldCheck {...iconProps} className="w-6 h-6 text-emerald-600" />;
      default: return <Layers {...iconProps} className="w-6 h-6 text-slate-500" />;
    }
  };

  // Category styling
  const getCategoryBadge = () => {
    switch (app.pole) {
      case 'b2b_solaire':
        return 'bg-amber-50 text-amber-900 border-amber-200';
      case 'citoyen_proximite':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'france_service':
        return 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getModuleIcon = (iconName: string) => {
    const props = { className: 'w-4 h-4 text-emerald-600 shrink-0' };
    switch (iconName) {
      case 'FileCheck': return <FileCheck {...props} />;
      case 'HeartPulse': return <HeartPulse {...props} />;
      case 'PenTool': return <PenTool {...props} />;
      case 'Landmark': return <Landmark {...props} />;
      case 'FileX': return <FileX {...props} />;
      case 'Camera': return <Camera {...props} />;
      case 'ShieldAlert': return <ShieldAlert {...props} />;
      default: return <ShieldCheck {...props} />;
    }
  };

  return (
    <div 
      className={`group relative flex flex-col justify-between bg-white rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
        app.isFranceServiceSuite
          ? 'border-emerald-300 ring-1 ring-emerald-400/20 bg-gradient-to-b from-white to-emerald-50/20'
          : isUnlocked 
            ? 'border-slate-200 hover:border-emerald-300' 
            : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Top Card Section */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        {/* Header line: Slot Number, Category, and Access Badge */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              Slot #{app.slotNumber < 10 ? `0${app.slotNumber}` : app.slotNumber}
            </span>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getCategoryBadge()}`}>
              {app.category}
            </span>
          </div>

          {/* Access status badge */}
          {isUnlocked ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
              <Unlock className="w-3 h-3 text-emerald-600" />
              <span>
                {isProxilienFree 
                  ? 'Gratuit Pilote' 
                  : isUnlockedByPass 
                    ? 'Pass Débloqué' 
                    : isUnlockedByB2B 
                      ? 'Licence B2B' 
                      : 'À l\'unité (15€)'}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full shrink-0">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Abonnement requis</span>
            </span>
          )}
        </div>

        {/* App Title & Icon */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
            {renderIcon()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-lg text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors">
                {app.name}
              </h3>
              {app.isPiloteFree && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                  Gratuit 1 an
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
              {app.tagline}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed my-3 flex-1">
          {app.description}
        </p>

        {/* France Service Special: Expandable Modules Drawer */}
        {app.franceServiceModules && app.franceServiceModules.length > 0 && (
          <div className="my-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
            <button
              onClick={() => setShowModules(!showModules)}
              className="w-full flex items-center justify-between text-xs font-bold text-emerald-900 hover:text-emerald-950 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Voir les 7 modules Zero-Knowledge ({app.franceServiceModules.length})</span>
              </div>
              {showModules ? <ChevronUp className="w-4 h-4 text-emerald-700" /> : <ChevronDown className="w-4 h-4 text-emerald-700" />}
            </button>

            {showModules && (
              <div className="mt-3 space-y-2 pt-2 border-t border-emerald-200/80">
                {app.franceServiceModules.map(mod => (
                  <div key={mod.id} className="p-2 bg-white rounded-lg border border-emerald-100 shadow-2xs">
                    <div className="flex items-center gap-2">
                      {getModuleIcon(mod.iconName)}
                      <span className="font-bold text-slate-900 text-xs">{mod.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                      {mod.description}
                    </p>
                    <p className="text-[10px] text-emerald-700 font-medium mt-1 italic">
                      🛡️ {mod.zeroKnowledgeNote}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pricing Note Highlight */}
        <div className="mt-1 mb-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 font-medium flex items-center justify-between">
          <span className="text-slate-500 font-normal">Tarif officiel :</span>
          <span className="font-bold text-slate-900">{app.pricingNote}</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 mb-2">
          {app.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
              #{tag}
            </span>
          ))}
        </div>

        {/* URL configuration status note */}
        <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="truncate max-w-[200px] text-slate-400 font-mono">
            {app.url}
          </span>
          {app.isConfigured ? (
            <span className="text-emerald-600 flex items-center gap-0.5 shrink-0 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Lien validé
            </span>
          ) : (
            <button 
              onClick={() => onEditUrl(app)} 
              className="text-purple-600 hover:text-purple-800 underline shrink-0 cursor-pointer text-[11px]"
            >
              Éditer le lien
            </button>
          )}
        </div>
      </div>

      {/* Footer / Launch action bar */}
      <div className="p-4 bg-slate-50/70 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-3">
        {/* URL Edit quick button */}
        <button
          onClick={() => onEditUrl(app)}
          title="Modifier le lien pour cette application"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors text-xs flex items-center gap-1 cursor-pointer"
        >
          <LinkIcon className="w-4 h-4 text-slate-400" />
          <span className="hidden sm:inline">Lien</span>
        </button>

        {/* Main Action Button */}
        {isUnlocked ? (
          <button
            onClick={() => onLaunch(app)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all hover:scale-101 cursor-pointer"
          >
            <span>Ouvrir l'application</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={() => onSelectSubscribe(app.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm shadow-xs transition-all cursor-pointer ${
              app.isB2B 
                ? 'bg-amber-900 hover:bg-amber-950 text-white' 
                : app.isFranceServiceSuite
                  ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {app.isB2B 
                ? 'Licence B2B (49 € HT/mois)' 
                : app.isFranceServiceSuite 
                  ? 'Débloquer (15 € seul ou Pass 40 €)' 
                  : 'Débloquer (15 € TTC/an)'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
