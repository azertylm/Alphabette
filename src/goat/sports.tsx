import React from 'react';

/**
 * @file sports.ts
 * Univers disponibles dans Goat Chèvre The King.
 */

export type SportId = 'football' | 'nba';

export interface SportDefinition {
  id: SportId;
  label: string;
  shortLabel: string;
  emoji: string;
  tagline: string;
}

export const SPORTS: SportDefinition[] = [
  {
    id: 'football',
    label: 'Football International',
    shortLabel: 'Football',
    emoji: '⚽',
    tagline: 'Légendes des sélections et des grands clubs',
  },
  {
    id: 'nba',
    label: 'Basketball NBA',
    shortLabel: 'NBA',
    emoji: '🏀',
    tagline: 'Légendes de la ligue nord-américaine',
  },
];

export const getSport = (id: SportId): SportDefinition =>
  SPORTS.find((sport) => sport.id === id) ?? SPORTS[0];

const STORAGE_KEY = 'goat_sport_v1';

export function readStoredSport(): SportId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'football' || saved === 'nba') return saved;
  } catch {
    /* stockage indisponible : on utilise la valeur par défaut */
  }
  return 'football';
}

export function storeSport(sport: SportId): void {
  try {
    localStorage.setItem(STORAGE_KEY, sport);
  } catch {
    /* ignoré */
  }
}

interface SportSwitcherProps {
  value: SportId;
  onChange: (sport: SportId) => void;
  counts?: Partial<Record<SportId, number>>;
}

/**
 * Sélecteur d'univers au sommet de la page (Football International / Basketball NBA).
 */
export const SportSwitcher: React.FC<SportSwitcherProps> = ({ value, onChange, counts = {} }) => {
  return (
    <div
      role="tablist"
      aria-label="Choix de l'univers sportif"
      className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-700/70 backdrop-blur"
    >
      {SPORTS.map((sport) => {
        const isActive = sport.id === value;
        return (
          <button
            key={sport.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(sport.id)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 px-3 py-3 rounded-xl text-center transition-all cursor-pointer ${
              isActive
                ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-300 hover:bg-slate-800/80'
            }`}
          >
            <span className="text-lg sm:text-xl leading-none" aria-hidden="true">
              {sport.emoji}
            </span>
            <span className="flex flex-col items-center sm:items-start">
              <span className="text-xs sm:text-sm font-black tracking-tight leading-tight">
                <span className="sm:hidden">{sport.shortLabel}</span>
                <span className="hidden sm:inline">{sport.label}</span>
              </span>
              {counts[sport.id] !== undefined && (
                <span className={`text-[10px] font-semibold ${isActive ? 'text-slate-900/70' : 'text-slate-500'}`}>
                  {counts[sport.id]} joueurs
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};
