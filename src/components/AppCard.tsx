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
  Building,
  Receipt,
  Shield,
  CloudSun,
  Bookmark,
  FileText
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
  const isUnlockedByPass = (
    user.subscriptionPlan === 'bouquet_integral' || 
    user.subscriptionPlan === 'bouquet_byok' || 
    user.subscriptionPlan === 'alphabette_pass' ||
    user.subscriptionPlan === 'trial_7d'
  );
  const isUnlockedByB2B = user.subscriptionPlan === 'pro_b2b' && app.isB2B;
  const isUnlockedBySingle = (
    user.subscriptionPlan === 'single_byok' || 
    user.subscriptionPlan === 'single_managed' || 
    user.subscriptionPlan === 'single_app'
  ) && user.unlockedAppIds.includes(app.id);
  const isUnlocked = isProxilienFree || isUnlockedByPass || isUnlockedByB2B || isUnlockedBySingle;

  // Render proper icon
  const renderIcon = () => {
    const iconProps = { className: 'w-6 h-6' };
    switch (app.iconName) {
      case 'SunMedium': return <SunMedium {...iconProps} className="w-6 h-6 text-amber-600" />;
      case 'Zap': return <Zap {...iconProps} className="w-6 h-6 text-amber-600" />;
      case 'HeartHandshake': return <HeartHandshake {...iconProps} className="w-6 h-6 text-rose-600" />;
      case 'Scale': return <Scale {...iconProps} className="w-6 h-6 text-indigo-700" />;
      case 'Newspaper': return <Newspaper {...iconProps} className="w-6 h-6 text-blue-700" />;
      case 'Hammer': return <Hammer {...iconProps} className="w-6 h-6 text-amber-800" />;
      case 'ShieldCheck': return <ShieldCheck {...iconProps} className="w-6 h-6 text-emerald-700" />;
      case 'Building': return <Building {...iconProps} className="w-6 h-6 text-blue-800" />;
      case 'Receipt': return <Receipt {...iconProps} className="w-6 h-6 text-emerald-800" />;
      case 'Shield': return <Shield {...iconProps} className="w-6 h-6 text-indigo-800" />;
      case 'CloudSun': return <CloudSun {...iconProps} className="w-6 h-6 text-amber-700" />;
      case 'Bookmark': return <Bookmark {...iconProps} className="w-6 h-6 text-purple-700" />;
      case 'FileText': return <FileText {...iconProps} className="w-6 h-6 text-slate-700" />;
      default: return <Layers {...iconProps} className="w-6 h-6 text-slate-600" />;
    }
  };

  const getModuleIcon = (iconName: string) => {
    const props = { className: 'w-4 h-4 text-emerald-700 shrink-0' };
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
      className={`relative flex flex-col justify-between bg-white rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
        app.isFranceServiceSuite
          ? 'border-emerald-400 ring-2 ring-emerald-500/10'
          : isUnlocked 
            ? 'border-slate-300 hover:border-emerald-400' 
            : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Card Section */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        
        {/* Header line: unboxed metadata with separators (zero-pill design) */}
        <div className="flex items-center justify-between gap-2 mb-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-semibold text-slate-600">
              Slot #{app.slotNumber < 10 ? `0${app.slotNumber}` : app.slotNumber}
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className={`font-semibold ${
              app.pole === 'france_service' 
                ? 'text-emerald-800 font-bold' 
                : app.pole === 'b2b_solaire' 
                  ? 'text-amber-800' 
                  : 'text-blue-800'
            }`}>
              {app.category}
            </span>
          </div>

          {/* Access status text */}
          {isUnlocked ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {isProxilienFree 
                  ? 'Gratuit Pilote' 
                  : isUnlockedByPass 
                    ? 'Pass 40 € Actif' 
                    : isUnlockedByB2B 
                      ? 'Licence B2B' 
                      : 'À l\'unité (15€)'}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Abonnement requis</span>
            </span>
          )}
        </div>

        {/* App Title & Icon */}
        <div className="flex items-start gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
            {renderIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-tight">
                {app.name}
              </h3>
              {app.isPiloteFree && (
                <span className="text-[11px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-md">
                  Pilote Gratuit 1 an
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {app.tagline}
            </p>
          </div>
        </div>

        {/* Description - High contrast, legible */}
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed my-3 flex-1">
          {app.description}
        </p>

        {/* Service France Special: Expandable Modules Drawer */}
        {app.franceServiceModules && app.franceServiceModules.length > 0 && (
          <div className="my-3 p-3 bg-emerald-50/80 rounded-xl border border-emerald-200">
            <button
              onClick={() => setShowModules(!showModules)}
              className="w-full flex items-center justify-between text-xs font-bold text-emerald-950 hover:text-emerald-800 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Consulter les 7 modules inclus ({app.franceServiceModules.length})</span>
              </div>
              {showModules ? <ChevronUp className="w-4 h-4 text-emerald-800" /> : <ChevronDown className="w-4 h-4 text-emerald-800" />}
            </button>

            {showModules && (
              <div className="mt-3 space-y-2 pt-2 border-t border-emerald-200">
                {app.franceServiceModules.map(mod => (
                  <div key={mod.id} className="p-2.5 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                    <div className="flex items-center gap-2">
                      {getModuleIcon(mod.iconName)}
                      <span className="font-bold text-slate-900 text-xs">{mod.name}</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1 leading-snug">
                      {mod.description}
                    </p>
                    <p className="text-[11px] text-emerald-800 font-medium mt-1">
                      🛡️ {mod.zeroKnowledgeNote}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pricing Note Highlight */}
        <div className="mt-1 mb-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 flex items-center justify-between">
          <span className="text-slate-600 font-medium">Tarif :</span>
          <span className="font-bold text-slate-900">{app.pricingNote}</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 mb-2">
          {app.tags.map((tag) => (
            <span key={tag} className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>

        {/* URL configuration status note */}
        <div className="mt-2 text-xs text-slate-600 flex items-center justify-between">
          <span className="truncate max-w-[200px] text-slate-500 font-mono text-[11px]">
            {app.url}
          </span>
          {app.isConfigured ? (
            <span className="text-emerald-700 flex items-center gap-1 shrink-0 font-medium text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> Lien validé
            </span>
          ) : (
            <button 
              onClick={() => onEditUrl(app)} 
              className="text-purple-700 hover:text-purple-900 font-medium underline shrink-0 cursor-pointer text-xs"
            >
              Éditer l'adresse
            </button>
          )}
        </div>
      </div>

      {/* Footer / Launch action bar */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-between gap-3">
        {/* URL Edit quick button */}
        <button
          onClick={() => onEditUrl(app)}
          title="Modifier l'adresse URL"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors text-xs flex items-center gap-1 cursor-pointer"
        >
          <LinkIcon className="w-4 h-4 text-slate-500" />
          <span className="hidden sm:inline">Lien</span>
        </button>

        {/* Main Action Button */}
        {isUnlocked ? (
          <button
            onClick={() => onLaunch(app)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            <span>Ouvrir l'application</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={() => onSelectSubscribe(app.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer ${
              app.isB2B 
                ? 'bg-amber-900 hover:bg-amber-950 text-white' 
                : app.isFranceServiceSuite
                  ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-300" />
            <span>
              {app.isB2B 
                ? 'Licence B2B (49 € HT/mois)' 
                : 'Débloquer (Dès 39 € ou Bouquet 99 €)'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
