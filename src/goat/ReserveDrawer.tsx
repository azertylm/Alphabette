import React, { useMemo, useState } from 'react';
import { CheckCircle2, Search, Users } from 'lucide-react';
import { EraFilter, ERA_LABELS, GoatPlayer, matchesEra } from './types';
import { PlayerCard } from './PlayerCard';

/**
 * @file ReserveDrawer.tsx
 * Réserve des joueurs de l'univers sélectionné : recherche rapide par nom
 * et filtre par époque (« Toutes », « Vintage < 2000 », « 2000 à aujourd'hui »).
 */

interface ReserveDrawerProps {
  players: GoatPlayer[];
  selectedPlayerId: string | null;
  hotTakeId: string | null;
  placedIds: string[];
  onSelectPlayer: (playerId: string) => void;
  onToggleHotTake: (playerId: string) => void;
}

const PAGE_SIZE = 60;

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const ReserveDrawer: React.FC<ReserveDrawerProps> = ({
  players,
  selectedPlayerId,
  hotTakeId,
  placedIds,
  onSelectPlayer,
  onToggleHotTake,
}) => {
  const [query, setQuery] = useState('');
  const [era, setEra] = useState<EraFilter>('toutes');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const placedSet = useMemo(() => new Set(placedIds), [placedIds]);
  const normalizedQuery = normalize(query.trim());

  const filtered = useMemo(
    () =>
      players.filter((player) => {
        if (!matchesEra(player, era)) return false;
        if (!normalizedQuery) return true;
        return normalize(player.name).includes(normalizedQuery);
      }),
    [players, era, normalizedQuery],
  );

  const visible = filtered.slice(0, limit);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
          <Users className="w-4 h-4 text-emerald-400" />
          Réserve des {players.length} joueurs
        </h2>
        <span className="text-[11px] font-semibold text-slate-400">
          {filtered.length} joueur{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Recherche + filtres d'époque */}
      <div className="flex flex-col lg:flex-row gap-2 mb-4">
        <label className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Rechercher un joueur par nom…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
          />
        </label>

        <div role="group" aria-label="Filtrer par époque" className="flex gap-1.5">
          {(Object.keys(ERA_LABELS) as EraFilter[]).map((option) => (
            <button
              key={option}
              onClick={() => {
                setEra(option);
                setLimit(PAGE_SIZE);
              }}
              className={`px-3 py-2.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                era === option
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-950 border border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {ERA_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {/* Grille de la réserve */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {visible.map((player) => (
            <div key={player.id} className="relative">
              <PlayerCard
                player={player}
                variant="reserve"
                isSelected={selectedPlayerId === player.id}
                isHotTake={hotTakeId === player.id}
                onClick={() => onSelectPlayer(player.id)}
                onToggleHotTake={() => onToggleHotTake(player.id)}
              />
              {placedSet.has(player.id) && (
                <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Placé
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-slate-500">Aucun joueur ne correspond à cette recherche.</p>
      )}

      {filtered.length > visible.length && (
        <button
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
          className="mt-4 w-full py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
        >
          Afficher {Math.min(PAGE_SIZE, filtered.length - visible.length)} joueurs de plus
        </button>
      )}
    </div>
  );
};
