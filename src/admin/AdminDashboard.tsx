import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  LogOut,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { RegistryApp, RegistryAppBadge, RegistryAppStatus } from '../types';
import {
  createRegistryApp,
  fetchAdminApps,
  toggleApp,
  updateRegistryApp,
} from '../services/registryService';
import { REGISTRY_ICON_NAMES, RegistryIcon } from '../components/RegistryIcon';
import { AdminCommunity } from './AdminCommunity';

/**
 * @file AdminDashboard.tsx
 * Console de gestion du registre des applications ALPHABETTE :
 * activation/masquage en 1 clic, changement de statut et de badge,
 * et enregistrement de nouvelles applications sans toucher au code.
 */

interface AdminDashboardProps {
  initialApps: RegistryApp[];
  onLogout: () => void;
}

const STATUS_LABELS: Record<RegistryAppStatus, string> = {
  actif: 'Actif (visible)',
  brouillon: 'Brouillon (masqué)',
  maintenance: 'Maintenance',
};

const STATUS_STYLES: Record<RegistryAppStatus, string> = {
  actif: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  brouillon: 'bg-slate-100 text-slate-600 border-slate-200',
  maintenance: 'bg-amber-100 text-amber-800 border-amber-200',
};

const emptyForm = {
  name: '',
  slug: '',
  icon: 'Sparkles',
  status: 'brouillon' as RegistryAppStatus,
  badge: '' as '' | Exclude<RegistryAppBadge, null>,
  url: '',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialApps, onLogout }) => {
  const [apps, setApps] = useState<RegistryApp[]>(initialApps);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'tous' | RegistryAppStatus>('tous');
  const [form, setForm] = useState({ ...emptyForm });
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const reload = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setApps(await fetchAdminApps());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Registre indisponible.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const stats = useMemo(
    () => ({
      total: apps.length,
      actifs: apps.filter((a) => a.status === 'actif').length,
      brouillons: apps.filter((a) => a.status === 'brouillon').length,
      maintenance: apps.filter((a) => a.status === 'maintenance').length,
    }),
    [apps],
  );

  const visibleApps = useMemo(() => {
    const query = search.toLowerCase().trim();
    return apps.filter((app) => {
      const matchesStatus = statusFilter === 'tous' || app.status === statusFilter;
      const matchesSearch =
        !query ||
        app.name.toLowerCase().includes(query) ||
        app.slug.toLowerCase().includes(query) ||
        (app.url || '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [apps, search, statusFilter]);

  /** Bascule 1 clic actif <-> masqué. */
  const handleToggle = async (app: RegistryApp) => {
    setBusyId(app.id);
    setError(null);
    try {
      const updated = await toggleApp(app.id);
      setApps((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      notify(
        updated.status === 'actif'
          ? `« ${updated.name} » est maintenant en ligne sur alphabette.fr`
          : `« ${updated.name} » a été masquée`,
      );
    } catch (err: any) {
      setError(err?.message || 'Bascule impossible.');
    } finally {
      setBusyId(null);
    }
  };

  /** Changement de statut ou de badge depuis la liste. */
  const handlePatch = async (app: RegistryApp, patch: Partial<RegistryApp>) => {
    setBusyId(app.id);
    setError(null);
    try {
      const updated = await updateRegistryApp(app.id, patch);
      setApps((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      notify(`« ${updated.name} » mise à jour`);
    } catch (err: any) {
      setError(err?.message || 'Mise à jour impossible.');
    } finally {
      setBusyId(null);
    }
  };

  /** Enregistrement d'une nouvelle application dans le registre. */
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      const created = await createRegistryApp({
        name: form.name,
        slug: form.slug,
        icon: form.icon,
        status: form.status,
        badge: form.badge === '' ? null : form.badge,
        url: form.url,
      });
      setApps((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
      setForm({ ...emptyForm });
      notify(`« ${created.name} » enregistrée dans le registre (/${created.slug})`);
    } catch (err: any) {
      setError(err?.message || "Enregistrement impossible.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 text-xs sm:text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Barre supérieure */}
      <header className="bg-slate-950 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 flex items-center justify-center font-black text-lg">
              α
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight">Console d'administration</h1>
              <p className="text-[11px] text-emerald-400 font-medium">Registre des applications ALPHABETTE</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voir le site</span>
            </a>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Statistiques */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Applications', value: stats.total, tone: 'text-slate-900' },
            { label: 'En ligne', value: stats.actifs, tone: 'text-emerald-700' },
            { label: 'Masquées', value: stats.brouillons, tone: 'text-slate-500' },
            { label: 'Maintenance', value: stats.maintenance, tone: 'text-amber-700' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
              <p className={`text-2xl font-black mt-1 ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* Liste des applications */}
          <section className="xl:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex-1 min-w-[220px] relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher par nom, slug ou URL…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                    className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="tous">Tous les statuts</option>
                    <option value="actif">Actif</option>
                    <option value="brouillon">Brouillon</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <button
                  onClick={reload}
                  className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Rafraîchir</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {visibleApps.map((app) => (
                <article
                  key={app.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center gap-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-emerald-700 shrink-0">
                      <RegistryIcon name={app.icon} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{app.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[app.status]}`}
                        >
                          {app.status}
                        </span>
                        {app.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wide">
                            {app.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        /{app.slug}
                        {app.url ? ` · ${app.url}` : ' · aucune URL'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={app.status}
                      disabled={busyId === app.id}
                      onChange={(event) => handlePatch(app, { status: event.target.value as RegistryAppStatus })}
                      className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white outline-none focus:border-emerald-500 cursor-pointer"
                      title="Changer le statut"
                    >
                      {(Object.keys(STATUS_LABELS) as RegistryAppStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>

                    <select
                      value={app.badge ?? ''}
                      disabled={busyId === app.id}
                      onChange={(event) =>
                        handlePatch(app, { badge: (event.target.value || null) as RegistryAppBadge })
                      }
                      className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white outline-none focus:border-emerald-500 cursor-pointer"
                      title="Changer le badge"
                    >
                      <option value="">Aucun badge</option>
                      <option value="Nouveau">Nouveau</option>
                      <option value="Populaire">Populaire</option>
                    </select>

                    <button
                      onClick={() => handleToggle(app)}
                      disabled={busyId === app.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                        app.status === 'actif'
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      }`}
                    >
                      {app.status === 'actif' ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Masquer</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Activer</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              ))}

              {visibleApps.length === 0 && (
                <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-sm text-slate-600">
                  Aucune application ne correspond à cette recherche.
                </div>
              )}
            </div>
          </section>

          {/* Formulaire d'ajout */}
          <section className="xl:col-span-1">
            <form
              onSubmit={handleCreate}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 sticky top-6"
            >
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-700" />
                <h2 className="font-black text-slate-900 text-sm">Nouvelle application</h2>
              </div>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-600">Nom de l'application *</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Goat Chèvre The King"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-600">Slug (laisser vide = déduit du nom)</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">/</span>
                  <input
                    value={form.slug}
                    onChange={(event) => setForm({ ...form, slug: event.target.value })}
                    placeholder="goat"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-600">Icône</span>
                <select
                  value={form.icon}
                  onChange={(event) => setForm({ ...form, icon: event.target.value })}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {REGISTRY_ICON_NAMES.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-bold text-slate-600">Statut</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value as RegistryAppStatus })}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="brouillon">Brouillon</option>
                    <option value="actif">Actif</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold text-slate-600">Badge</span>
                  <select
                    value={form.badge}
                    onChange={(event) => setForm({ ...form, badge: event.target.value as typeof form.badge })}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">Aucun</option>
                    <option value="Nouveau">Nouveau</option>
                    <option value="Populaire">Populaire</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-600">URL (externe ou chemin interne)</span>
                <input
                  value={form.url}
                  onChange={(event) => setForm({ ...form, url: event.target.value })}
                  placeholder="/goat ou https://exemple.fr"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>

              <button
                type="submit"
                disabled={isSaving || !form.name.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm transition-colors cursor-pointer"
              >
                {isSaving ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? 'Enregistrement…' : "Enregistrer l'application"}</span>
              </button>

              <p className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
                <Wrench className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Écriture directe dans <code>data/apps-registry.json</code>. Une application « actif » apparaît
                  immédiatement dans la section « Nos Applications ».
                </span>
              </p>
            </form>
          </section>

        </div>

        {/* Modération de la communauté (pyramides partagées + comptes) */}
        <AdminCommunity />
      </main>
    </div>
  );
};
