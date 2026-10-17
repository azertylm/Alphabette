import React from 'react';
import { Flame, GripVertical, X } from 'lucide-react';
import { GoatPlayer } from './types';
import { PlayerAvatar } from './PlayerAvatar';

/**
 * @file PlayerCard.tsx
 * Carte joueur : photo officielle cadrée, nom lisible et années d'activité juste en dessous.
 * Utilisée dans la pyramide (variant « slot ») et dans la réserve (variant « reserve »).
 */

interface PlayerCardProps {
  player: GoatPlayer;
  variant?: 'slot' | 'reserve';
  isSelected?: boolean;
  isHotTake?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onToggleHotTake?: () => void;
  onRemove?: () => void;
  compactTier?: 1 | 2 | 3 | 4;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  variant = 'slot',
  isSelected = false,
  isHotTake = false,
  isDragging = false,
  onClick,
  onToggleHotTake,
  onRemove,
  compactTier = 3,
}) => {
  const isSlot = variant === 'slot';

  const photoHeight = isSlot
    ? compactTier === 1
      ? 'h-16 sm:h-20'
      : compactTier === 2
        ? 'h-14 sm:h-16'
        : 'h-12 sm:h-14'
    : 'h-24 sm:h-28';

  const nameSize = isSlot ? (compactTier === 1 ? 'text-[11px] sm:text-xs' : 'text-[10px] sm:text-[11px]') : 'text-xs';
  const yearSize = isSlot ? 'text-[9px] sm:text-[10px]' : 'text-[10px]';

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', player.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onClick}
      className={`group relative rounded-xl overflow-hidden border text-left cursor-pointer select-none transition-all ${
        isSelected
          ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/20'
          : isHotTake
            ? 'border-orange-400/70 ring-1 ring-orange-400/40'
            : 'border-slate-700 hover:border-slate-500'
      } bg-slate-900 ${isDragging ? 'opacity-40' : ''}`}
      title={`${player.name} — ${player.career}`}
    >
      <PlayerAvatar player={player} className={`w-full ${photoHeight}`} />

      {isHotTake && (
        <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[9px] font-black shadow">
          <Flame className="w-2.5 h-2.5" />
          Hot Take
        </span>
      )}

      {isSlot && (
        <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-300 transition-opacity">
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      )}

      <div className={`px-1.5 py-1 bg-slate-950/90 ${isSlot ? '' : 'space-y-0.5'}`}>
        <p className={`${nameSize} font-bold text-white leading-tight line-clamp-2`}>{player.name}</p>
        <p className={`${yearSize} font-semibold text-amber-300/90 leading-tight whitespace-nowrap`}>{player.career}</p>
      </div>

      {onToggleHotTake && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleHotTake();
          }}
          title={isHotTake ? 'Retirer le badge Hot Take' : 'Déclarer ce joueur « Hot Take » 🔥'}
          className={`absolute bottom-1 right-1 w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isHotTake ? 'bg-orange-500 text-white' : 'bg-slate-800/90 text-slate-400 hover:text-orange-400'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
        </button>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          title="Retirer de la case"
          className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-slate-950/85 text-slate-300 hover:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
