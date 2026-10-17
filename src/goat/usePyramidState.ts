import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoatPlayer } from './types';
import { SportId } from './sports';
import {
  PyramidState,
  clearStoredPyramid,
  createEmptyPyramid,
  loadPyramid,
  savePyramid,
  totalPlaces,
  visibleSlotIds,
} from './pyramidModel';

/**
 * @file usePyramidState.ts
 * État de la pyramide GOAT : placements, badge Hot Take, mode expert,
 * avec sauvegarde automatique dans le navigateur (localStorage, un état par univers).
 */

export interface PyramidApi {
  state: PyramidState;
  placedIds: string[];
  filledVisibleCount: number;
  totalVisibleCount: number;
  isComplete: boolean;
  place: (targetSlot: string, playerId: string) => void;
  removeFromSlot: (targetSlot: string) => void;
  clearSlot: (targetSlot: string) => void;
  chaosFill: (pool: GoatPlayer[]) => void;
  toggleHotTake: (playerId: string) => void;
  setExpertMode: (enabled: boolean) => void;
  reset: () => void;
}

export function usePyramidState(sport: SportId): PyramidApi {
  const [state, setState] = useState<PyramidState>(() => loadPyramid(sport));

  // Un état distinct par univers sportif.
  useEffect(() => {
    setState(loadPyramid(sport));
  }, [sport]);

  // Sauvegarde automatique.
  useEffect(() => {
    savePyramid(sport, state);
  }, [sport, state]);

  const placedIds = useMemo(
    () => Object.values(state.assignments).filter((value): value is string => Boolean(value)),
    [state.assignments],
  );

  const visibleSlots = useMemo(() => visibleSlotIds(state.expertMode), [state.expertMode]);
  const filledVisibleCount = visibleSlots.filter((id) => Boolean(state.assignments[id])).length;
  const totalVisibleCount = visibleSlots.length;

  /** Place un joueur sur une case (le retire de sa case précédente le cas échéant). */
  const place = useCallback((targetSlot: string, playerId: string) => {
    setState((prev) => {
      const assignments = { ...prev.assignments };

      // Un joueur n'occupe qu'une seule case.
      for (const [key, value] of Object.entries(assignments)) {
        if (value === playerId) delete assignments[key];
      }

      // Si la case cible était occupée, on échange les positions.
      const displaced = assignments[targetSlot];
      const previousSlot = Object.entries(prev.assignments).find(([, value]) => value === playerId)?.[0];
      assignments[targetSlot] = playerId;
      if (displaced && previousSlot) assignments[previousSlot] = displaced;

      return { ...prev, assignments };
    });
  }, []);

  const removeFromSlot = useCallback((targetSlot: string) => {
    setState((prev) => {
      const assignments = { ...prev.assignments };
      const removed = assignments[targetSlot];
      delete assignments[targetSlot];
      return {
        ...prev,
        assignments,
        hotTake: removed && prev.hotTake === removed ? null : prev.hotTake,
      };
    });
  }, []);

  const clearSlot = removeFromSlot;

  /** Mode Chaos 🎲 : remplit les cases vides restantes au hasard. */
  const chaosFill = useCallback(
    (pool: GoatPlayer[]) => {
      setState((prev) => {
        const assignments = { ...prev.assignments };
        const used = new Set(Object.values(assignments));
        const available = pool.filter((player) => !used.has(player.id));

        for (const id of visibleSlotIds(prev.expertMode)) {
          if (assignments[id]) continue;
          if (available.length === 0) break;
          const index = Math.floor(Math.random() * available.length);
          assignments[id] = available[index].id;
          available.splice(index, 1);
        }

        return { ...prev, assignments };
      });
    },
    [],
  );

  /** Badge « Hot Take 🔥 » : un seul joueur marqué à la fois. */
  const toggleHotTake = useCallback((playerId: string) => {
    setState((prev) => ({ ...prev, hotTake: prev.hotTake === playerId ? null : playerId }));
  }, []);

  const setExpertMode = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, expertMode: enabled }));
  }, []);

  const reset = useCallback(() => {
    clearStoredPyramid(sport);
    setState({ ...createEmptyPyramid() });
  }, [sport]);

  return {
    state,
    placedIds,
    filledVisibleCount,
    totalVisibleCount,
    isComplete: totalVisibleCount > 0 && filledVisibleCount === totalVisibleCount,
    place,
    removeFromSlot,
    clearSlot,
    chaosFill,
    toggleHotTake,
    setExpertMode,
    reset,
  };
}

export { totalPlaces };
