import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { RegistryApp } from '../types';
import { fetchPublicApps } from '../services/registryService';
import { RegistryIcon } from './RegistryIcon';

/**
 * @file AppsRegistrySection.tsx
 * Section « Nos Applications » de la vitrine alphabette.fr.
 *
 * Charge automatiquement, depuis le registre central, toutes les applications
 * au statut « actif ». Ajouter une application dans /admin la fait apparaître ici.
 */

const BadgeChip: React.FC<{ badge: NonNullable<RegistryApp['badge']> }> = ({ badge }) => (
  <span
    className={
      badge === 'Nouveau'
        ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wide'
        : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide'
    }
  >
    {badge === 'Nouveau' ? <Sparkles className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
    {badge}
  </span>
);

export const AppsRegistrySection: React.FC = () => {
  const [apps, setApps] = useState<RegistryApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setApps(await fetchPublicApps());
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger le registre des applications.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  return (
    <section id="nos-applications" className="py-10 sm:py-14 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* En-tête de section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>Registre central ALPHABETTE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Nos Applications
            </h2>
            <p className="text-sm text-slate-700 mt-1 max-w-2xl">
              Catalogue synchronisé en direct : {isLoading ? '…' : apps.length} application
              {apps.length > 1 ? 's' : ''} publiée{apps.length > 1 ? 's' : ''} sur l'écosystème.
            </p>
          </div>

          <button
            onClick={loadApps}
            className="self-start inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>

        {/* États de chargement / erreur / vide */}
        {isLoading && apps.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Registre indisponible</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && apps.length === 0 && (
          <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-sm text-slate-600">
            Aucune application publiée pour le moment. Activez-les depuis la console d'administration.
          </div>
        )}

        {/* Grille des applications actives */}
        {apps.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {apps.map((app) => (
              <article
                key={app.id}
                className="group flex flex-col gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-emerald-300 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-700 shrink-0 group-hover:border-emerald-300">
                      <RegistryIcon name={app.icon} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">{app.name}</h3>
                      <p className="text-[11px] text-slate-500 truncate">/{app.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {app.gratuit && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wide">
                        Gratuit
                      </span>
                    )}
                    {app.badge && <BadgeChip badge={app.badge} />}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80 mt-auto">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    En ligne
                  </span>
                  {app.url && (
                    <a
                      href={app.url}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-emerald-700 transition-colors"
                    >
                      <span>Ouvrir</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

      </div>
    </section>
  );
};
