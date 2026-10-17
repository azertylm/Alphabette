import React, { useMemo } from 'react';
import { Flame, Info } from 'lucide-react';
import { GoatPlayer } from './types';
import { computeControversy, controversyQuip } from './controversy';
import { CrownGoatMascot } from './CrownGoatMascot';

/**
 * @file ControversyGauge.tsx
 * Jauge de Controverse (% Non-conformiste), affichée dès que la pyramide est complétée.
 * Comparaison avec le classement standard (notoriété Wikidata) et verdict humoristique
 * à côté de la mascotte chèvre couronnée.
 */

interface ControversyGaugeProps {
  assignments: Record<string, string>;
  players: GoatPlayer[];
  isComplete: boolean;
  isHotTakeSet: boolean;
}

const TONES: Record<string, { ring: string; text: string; bg: string; bar: string }> = {
  emerald: {
    ring: 'border-emerald-400/40',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    bar: 'bg-emerald-500',
  },
  amber: {
    ring: 'border-amber-400/40',
    text: 'text-amber-300',
    bg: 'bg-amber-500/10',
    bar: 'bg-amber-500',
  },
  rose: {
    ring: 'border-rose-400/40',
    text: 'text-rose-300',
    bg: 'bg-rose-500/10',
    bar: 'bg-rose-500',
  },
};

export const ControversyGauge: React.FC<ControversyGaugeProps> = ({
  assignments,
  players,
  isComplete,
  isHotTakeSet,
}) => {
  const result = useMemo(() => computeControversy(assignments, players), [assignments, players]);

  const toneKey = result.percent <= 35 ? 'emerald' : result.percent <= 70 ? 'amber' : 'rose';
  const tone = TONES[toneKey];

  if (!isComplete) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 flex items-center gap-4">
        <CrownGoatMascot className="w-12 h-12 shrink-0 opacity-70" />
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Jauge de Controverse</h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Complète toutes les places de la pyramide pour découvrir ton % non-conformiste face au classement standard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border ${tone.ring} ${tone.bg} p-4 sm:p-6`}>
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <CrownGoatMascot className="w-20 h-20 shrink-0" />

        <div className="flex-1 w-full text-center sm:text-left">
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Jauge de Controverse</h2>

          <div className="mt-3 flex items-end justify-center sm:justify-start gap-3">
            <span className={`text-5xl font-black leading-none ${tone.text}`}>{result.percent}%</span>
            <span className="text-xs font-bold text-slate-300 pb-1">Non-conformiste</span>
          </div>

          <div className="mt-3 h-2.5 rounded-full bg-slate-950/70 overflow-hidden">
            <div className={`h-full ${tone.bar} transition-all duration-700`} style={{ width: `${result.percent}%` }} />
          </div>

          <p className={`mt-3 inline-flex items-center gap-1.5 text-sm font-black ${tone.text}`}>{result.label}</p>
          <p className="mt-1 text-xs text-slate-300 italic">« {controversyQuip(result.percent)} »</p>

          <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Info className="w-3 h-3" />
              {result.boldPicks}/{result.totalPicks} choix hors du classement standard
            </span>
            <span>· Standard : {result.consensusLeader} n°1 (notoriété Wikipédia)</span>
            {isHotTakeSet && (
              <span className="inline-flex items-center gap-1 text-orange-300 font-bold">
                <Flame className="w-3 h-3" />
                Hot Take déclaré
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
