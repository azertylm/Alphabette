import { GoatPlayer, PlayersPayload } from './types';
import { SportId } from './sports';

/**
 * @file playersClient.ts
 * Chargement de la base des joueurs depuis /api/goat/players,
 * avec cache mémoire par univers sportif.
 */

const cache = new Map<SportId, PlayersPayload>();

export async function fetchPlayers(sport: SportId, force = false): Promise<PlayersPayload> {
  const cached = cache.get(sport);
  if (cached && !force) return cached;

  const response = await fetch(`/api/goat/players?sport=${sport}`, {
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error || `Base de joueurs indisponible (HTTP ${response.status}).`,
    );
  }

  const parsed = payload as PlayersPayload;
  cache.set(sport, parsed);
  return parsed;
}

export function getCachedPlayer(sport: SportId, playerId: string | null | undefined): GoatPlayer | undefined {
  if (!playerId) return undefined;
  return cache.get(sport)?.players.find((player) => player.id === playerId);
}

export function clearPlayersCache(): void {
  cache.clear();
}
