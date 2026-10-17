import React from 'react';
import { Crown, Layers3, Trophy, Users } from 'lucide-react';
import { SportId } from './sports';

/**
 * @file PyramidStage.tsx
 * Espace central de Goat Chèvre The King.
 *
 * Il accueille la pyramide interactive (étages 1-2-4-8 + mode Expert 16)
 * ainsi que le tiroir de réserve des joueurs, filtré par univers sportif.
 */

export interface PyramidTierDefinition {
  level: number;
  places: number;
  label: string;
  expert?: boolean;
}

export const PYRAMID_TIERS: PyramidTierDefinition[] = [
  { level: 1, places: 1, label: 'Le GOAT Ultime' },
  { level: 2, places: 2, label: 'Étage 2 — Les intouchables' },
  { level: 3, places: 4, label: 'Étage 3 — Les demi-dieux' },
  { level: 4, places: 8, label: 'Étage 4 — Le panthéon' },
  { level: 5, places: 16, label: 'Étage 5 — Mode Expert', expert: true },
];

interface PyramidStageProps {
  sport: SportId;
}

/**
 * Emplacement réservé de la pyramide et de la réserve des joueurs.
 * Les composants interactifs (glisser-déposer, duels express, mode chaos) viennent s'y brancher.
 */
export const PyramidStage: React.FC<PyramidStageProps> = ({ sport }) => {
  const tiers = PYRAMID_TIERS.filter((tier) => !tier.expert);

  return (
    <section aria-label="Espace central : pyramide et réserve" className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 space-y-8">

      {/* Pyramide */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
            <Layers3 className="w-4 h-4 text-amber-400" />
            La Pyramide GOAT
          </h2>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            15 places · univers {sport === 'football' ? 'Football' : 'NBA'}
          </span>
        </div>

        <div className="space-y-3">
          {tiers.map((tier) => (
            <div key={tier.level} className="space-y-1.5">
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {tier.level === 1 ? (
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <Crown className="w-3 h-3" />
                    {tier.label}
                  </span>
                ) : (
                  tier.label
                )}
              </p>
              <div
                className="grid gap-1.5 sm:gap-2 mx-auto"
                style={{ gridTemplateColumns: `repeat(${tier.places}, minmax(0, 1fr))`, maxWidth: `${tier.places * 9}rem` }}
              >
                {Array.from({ length: tier.places }).map((_, index) => (
                  <div
                    key={index}
                    className={`rounded-xl border border-dashed border-slate-700 bg-slate-950/60 flex flex-col items-center justify-center text-center ${
                      tier.level === 1 ? 'h-24 sm:h-28' : tier.level === 2 ? 'h-20 sm:h-24' : 'h-16 sm:h-20'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-600">Place libre</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          L'espace central accueillera la pyramide interactive (recherche, glisser-déposer, mode chaos).
        </p>
      </div>

      {/* Tiroir de réserve */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
            <Users className="w-4 h-4 text-emerald-400" />
            Réserve des joueurs
          </h2>
          <span className="text-[11px] font-semibold text-slate-400">Recherche rapide + filtre par époque</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2 h-11 rounded-xl bg-slate-950/70 border border-slate-800" />
          <div className="h-11 rounded-xl bg-slate-950/70 border border-slate-800" />
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="h-24 rounded-xl border border-slate-800 bg-slate-950/50" />
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Le tiroir affichera les joueurs de l'univers sélectionné avec photo, nom et années d'activité.
        </p>
      </div>

    </section>
  );
};
