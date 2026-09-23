import React from 'react';
import { 
  SunMedium, 
  Zap, 
  HeartHandshake, 
  Newspaper, 
  Users, 
  Leaf, 
  Wheat, 
  ShieldCheck, 
  Sparkles, 
  Bike, 
  Layers, 
  ExternalLink, 
  Lock, 
  Unlock, 
  Link as LinkIcon, 
  CheckCircle2, 
  AlertCircle 
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
  // Determine if application is unlocked for current user
  const isUnlockedByPass = user.subscriptionPlan === 'alphabette_pass';
  const isUnlockedBySingle = user.subscriptionPlan === 'single_app' && user.unlockedAppIds.includes(app.id);
  const isUnlocked = isUnlockedByPass || isUnlockedBySingle;

  // Render proper icon
  const renderIcon = () => {
    const iconProps = { className: 'w-6 h-6' };
    switch (app.iconName) {
      case 'SunMedium': return <SunMedium {...iconProps} className="w-6 h-6 text-amber-500" />;
      case 'Zap': return <Zap {...iconProps} className="w-6 h-6 text-amber-500" />;
      case 'HeartHandshake': return <HeartHandshake {...iconProps} className="w-6 h-6 text-rose-500" />;
      case 'Newspaper': return <Newspaper {...iconProps} className="w-6 h-6 text-blue-500" />;
      case 'Users': return <Users {...iconProps} className="w-6 h-6 text-indigo-500" />;
      case 'Leaf': return <Leaf {...iconProps} className="w-6 h-6 text-emerald-500" />;
      case 'Wheat': return <Wheat {...iconProps} className="w-6 h-6 text-amber-600" />;
      case 'ShieldCheck': return <ShieldCheck {...iconProps} className="w-6 h-6 text-teal-500" />;
      case 'Sparkles': return <Sparkles {...iconProps} className="w-6 h-6 text-purple-500" />;
      case 'Bike': return <Bike {...iconProps} className="w-6 h-6 text-emerald-600" />;
      default: return <Layers {...iconProps} className="w-6 h-6 text-slate-500" />;
    }
  };

  // Category styling
  const getCategoryBadge = () => {
    switch (app.category) {
      case 'Écologie':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Social & Entraide':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'Outils IA':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Vie quotidienne':
        return 'bg-amber-50 text-amber-900 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div 
      className={`group relative flex flex-col justify-between bg-white rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
        isUnlocked 
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
              <span>{isUnlockedByPass ? 'Pass Illimité' : 'À la carte (1€)'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full shrink-0">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Nécessite abonnement</span>
            </span>
          )}
        </div>

        {/* App Title & Icon */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            {renderIcon()}
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors">
              {app.name}
            </h3>
            <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
              {app.tagline}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed my-3 flex-1">
          {app.description}
        </p>

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
            <span>Lancer l'app</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={() => onSelectSubscribe(app.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Débloquer (1€ ou 3€)</span>
          </button>
        )}
      </div>
    </div>
  );
};
