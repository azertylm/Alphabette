import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  PlusCircle, 
  CheckCircle2, 
  Sparkles, 
  Layers, 
  SlidersHorizontal,
  Unlock,
  Lock
} from 'lucide-react';
import { AppItem, UserProfile, AppCategory } from '../types';
import { CATEGORIES } from '../data/initialApps';
import { AppCard } from './AppCard';

interface AppGridProps {
  apps: AppItem[];
  user: UserProfile;
  onLaunch: (app: AppItem) => void;
  onEditUrl: (app: AppItem) => void;
  onSelectSubscribe: (appId: string) => void;
  onAddNewAppSlot: () => void;
  onOpenUrlManager: () => void;
}

export const AppGrid: React.FC<AppGridProps> = ({
  apps,
  user,
  onLaunch,
  onEditUrl,
  onSelectSubscribe,
  onAddNewAppSlot,
  onOpenUrlManager
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [accessFilter, setAccessFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  // Filter applications
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      // Category filter
      const matchesCategory = selectedCategory === 'Toutes' || app.category === selectedCategory;

      // Text search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q || 
        app.name.toLowerCase().includes(q) ||
        app.tagline.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.tags.some(t => t.toLowerCase().includes(q));

      // Access filter
      const isUnlocked = 
        user.subscriptionPlan === 'alphabette_pass' || 
        (user.subscriptionPlan === 'single_app' && user.unlockedAppIds.includes(app.id));

      const matchesAccess = 
        accessFilter === 'all' ||
        (accessFilter === 'unlocked' && isUnlocked) ||
        (accessFilter === 'locked' && !isUnlocked);

      return matchesCategory && matchesSearch && matchesAccess;
    });
  }, [apps, selectedCategory, searchQuery, accessFilter, user]);

  // Counts by category
  const getCategoryCount = (category: string) => {
    if (category === 'Toutes') return apps.length;
    return apps.filter(a => a.category === category).length;
  };

  const unlockedCount = apps.filter(app => 
    user.subscriptionPlan === 'alphabette_pass' || 
    (user.subscriptionPlan === 'single_app' && user.unlockedAppIds.includes(app.id))
  ).length;

  return (
    <section id="applications" className="py-14 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
            <Layers className="w-4 h-4" />
            <span>Catalogue Central des Applications</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Les applications de l'écosystème
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1 max-w-2xl">
            {apps.length} applications configurées. Cliquez sur "Lancer l'app" pour vous connecter sans mot de passe grâce au SSO Alphabette.
          </p>
        </div>

        {/* Action quick buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenUrlManager}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <span>Gestionnaire d'URLs ({apps.filter(a => a.isConfigured).length}/{apps.length})</span>
          </button>
          
          <button
            onClick={onAddNewAppSlot}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ajouter une application</span>
          </button>
        </div>
      </div>

      {/* Control bar: Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-8 space-y-4">
        
        {/* Top row: Search input + Access toggles */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher une application (ex: Lidar, Solaire, Mistral, Entraide...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Access filter pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto text-xs font-medium text-slate-600">
            <button
              onClick={() => setAccessFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                accessFilter === 'all' 
                  ? 'bg-white text-slate-900 shadow-xs font-semibold' 
                  : 'hover:text-slate-900'
              }`}
            >
              Toutes ({apps.length})
            </button>
            <button
              onClick={() => setAccessFilter('unlocked')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                accessFilter === 'unlocked' 
                  ? 'bg-emerald-700 text-white shadow-xs font-semibold' 
                  : 'hover:text-slate-900'
              }`}
            >
              <Unlock className="w-3 h-3" />
              <span>Débloquées ({unlockedCount})</span>
            </button>
            <button
              onClick={() => setAccessFilter('locked')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                accessFilter === 'locked' 
                  ? 'bg-slate-800 text-white shadow-xs font-semibold' 
                  : 'hover:text-slate-900'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>À débloquer ({apps.length - unlockedCount})</span>
            </button>
          </div>
        </div>

        {/* Category selector row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Catégories :
          </span>
          {CATEGORIES.map((category) => {
            const count = getCategoryCount(category);
            const isSelected = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{category}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Cards */}
      {filteredApps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              user={user}
              onLaunch={onLaunch}
              onEditUrl={onEditUrl}
              onSelectSubscribe={onSelectSubscribe}
            />
          ))}

          {/* Add Application Card trigger */}
          <div 
            onClick={onAddNewAppSlot}
            className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center group cursor-pointer transition-all hover:bg-emerald-50/30 min-h-[280px]"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-emerald-100 text-slate-400 group-hover:text-emerald-700 flex items-center justify-center transition-colors mb-3">
              <PlusCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-base group-hover:text-emerald-800">
              Ajouter une application
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Créer le slot #{apps.length + 1} dans l'écosystème pour intégrer l'une des 42 futures solutions.
            </p>
            <span className="mt-4 text-xs font-semibold text-emerald-700 group-hover:underline">
              + Configurer un nouveau slot
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Aucune application ne correspond à votre filtre</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Essayez de réinitialiser la recherche ou de sélectionner la catégorie "Toutes".
          </p>
          <button
            onClick={() => {
              setSelectedCategory('Toutes');
              setSearchQuery('');
              setAccessFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {/* Extensibility reassurance badge */}
      <div className="mt-10 p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
            50+
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-950">Architecture extensible jusqu'à 50+ applications</h4>
            <p className="text-xs text-emerald-800">
              Chaque nouvelle application s'ajoute automatiquement au catalogue et au Pass Alphabette (3€/m) sans surcoût pour les abonnés.
            </p>
          </div>
        </div>
        <button
          onClick={onOpenUrlManager}
          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0 cursor-pointer"
        >
          Gérer la liste complète
        </button>
      </div>
    </section>
  );
};
