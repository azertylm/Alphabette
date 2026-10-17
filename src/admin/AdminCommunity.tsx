import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Heart, Loader2, RefreshCw, ShieldOff, ShieldCheck, Trash2, Users } from 'lucide-react';
import {
  AdminCommunityPyramid,
  AdminCommunityUser,
  deleteAdminPyramid,
  fetchAdminCommunityPyramids,
  fetchAdminCommunityUsers,
  setAdminPyramidHidden,
  setAdminUserBanned,
} from '../services/communityAdminService';

/**
 * @file AdminCommunity.tsx
 * Modération de la communauté (console /admin) : masquer / supprimer une
 * pyramide publiée, suspendre un compte.
 */

type Tab = 'pyramids' | 'users';

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(value),
    );
  } catch {
    return '';
  }
}

export const AdminCommunity: React.FC = () => {
  const [tab, setTab] = useState<Tab>('pyramids');
  const [pyramids, setPyramids] = useState<AdminCommunityPyramid[]>([]);
  const [users, setUsers] = useState<AdminCommunityUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextPyramids, nextUsers] = await Promise.all([
        fetchAdminCommunityPyramids(),
        fetchAdminCommunityUsers(),
      ]);
      setPyramids(nextPyramids);
      setUsers(nextUsers);
    } catch (err: any) {
      setError(err?.message || 'Modération indisponible.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleHidden = async (pyramid: AdminCommunityPyramid) => {
    setBusyId(pyramid.id);
    try {
      await setAdminPyramidHidden(pyramid.id, !pyramid.hidden);
      setPyramids((current) =>
        current.map((item) => (item.id === pyramid.id ? { ...item, hidden: !item.hidden } : item)),
      );
    } catch (err: any) {
      setError(err?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const removePyramid = async (pyramid: AdminCommunityPyramid) => {
    if (!window.confirm(`Supprimer définitivement « ${pyramid.title} » de ${pyramid.authorName} ?`)) return;
    setBusyId(pyramid.id);
    try {
      await deleteAdminPyramid(pyramid.id);
      setPyramids((current) => current.filter((item) => item.id !== pyramid.id));
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleBan = async (user: AdminCommunityUser) => {
    setBusyId(user.id);
    try {
      await setAdminUserBanned(user.id, !user.banned);
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, banned: !item.banned } : item)),
      );
    } catch (err: any) {
      setError(err?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const hiddenCount = pyramids.filter((pyramid) => pyramid.hidden).length;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-widest">
          <Users className="w-4 h-4 text-emerald-600" />
          Communauté
        </h2>

        <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
          {(
            [
              { id: 'pyramids', label: `Pyramides (${pyramids.length})` },
              { id: 'users', label: `Comptes (${users.length})` },
            ] as Array<{ id: Tab; label: string }>
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                tab === option.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {hiddenCount > 0 && (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
            {hiddenCount} masquée{hiddenCount > 1 ? 's' : ''}
          </span>
        )}

        <button
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && pyramids.length === 0 && users.length === 0 && (
        <div className="flex items-center gap-2 py-6 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement de la modération…
        </div>
      )}

      {tab === 'pyramids' && (
        <div className="space-y-2">
          {!isLoading && pyramids.length === 0 && (
            <p className="text-xs text-slate-500 py-4">
              Aucune pyramide publiée pour l'instant. Les classements partagés depuis /goat apparaîtront ici.
            </p>
          )}
          {pyramids.map((pyramid) => (
            <article
              key={pyramid.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3 ${
                pyramid.hidden ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200'
              }`}
            >
              <a
                href={pyramid.imageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="w-14 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0"
                title="Ouvrir l'image"
              >
                <img src={pyramid.imageUrl} alt={pyramid.title} className="w-full h-full object-contain" />
              </a>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">{pyramid.title}</h3>
                <p className="text-[11px] text-slate-500">
                  par <span className="font-semibold text-slate-700">{pyramid.authorName}</span> · {pyramid.sportLabel} ·{' '}
                  {formatDate(pyramid.createdAt)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {pyramid.controversy}% non-conformiste · {pyramid.filled}/{pyramid.total} places ·{' '}
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-500" />
                    {pyramid.likeCount}
                  </span>
                  {pyramid.hidden && <span className="ml-2 font-bold text-amber-700">masquée</span>}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void toggleHidden(pyramid)}
                  disabled={busyId === pyramid.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {pyramid.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {pyramid.hidden ? 'Réafficher' : 'Masquer'}
                </button>
                <button
                  onClick={() => void removePyramid(pyramid)}
                  disabled={busyId === pyramid.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-2">
          {!isLoading && users.length === 0 && (
            <p className="text-xs text-slate-500 py-4">Aucun compte créé pour l'instant.</p>
          )}
          {users.map((user) => (
            <article
              key={user.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3 ${
                user.banned ? 'border-red-200 bg-red-50/60' : 'border-slate-200'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-black shrink-0">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">{user.username}</h3>
                <p className="text-[11px] text-slate-500">
                  inscrit le {formatDate(user.createdAt)} · {user.pyramidCount} pyramide
                  {user.pyramidCount > 1 ? 's' : ''}
                  {user.banned && <span className="ml-2 font-bold text-red-700">suspendu</span>}
                </p>
              </div>
              <button
                onClick={() => void toggleBan(user)}
                disabled={busyId === user.id}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                  user.banned
                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {user.banned ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                {user.banned ? 'Réactiver' : 'Suspendre'}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
