import { SportId } from './sports';

/**
 * @file types.ts (goat)
 * Modèle de données de Goat Chèvre The King, aligné sur data/players.json
 * produit par scripts/fetch-players.ts.
 */

export interface GoatPlayer {
  id: string;
  name: string;
  sport: SportId;
  image: string;
  commonsUrl: string;
  startYear: number | null;
  endYear: number | null;
  /** Années formatées : "1998 - 2006" ou "2003 - Présent". */
  career: string;
  /** Notoriété Wikidata (nombre de versions linguistiques Wikipédia). */
  fame: number;
}

export interface PlayersPayload {
  generatedAt: string;
  source: string;
  license: string;
  counts: { football: number; nba: number; total: number };
  players: GoatPlayer[];
}

/** Filtres d'époque de la réserve des joueurs. */
export type EraFilter = 'toutes' | 'vintage' | 'moderne';

export const ERA_LABELS: Record<EraFilter, string> = {
  toutes: 'Toutes',
  vintage: 'Vintage < 2000',
  moderne: '2000 à aujourd’hui',
};

/** Applique le filtre d'époque à un joueur (basé sur le début de carrière). */
export function matchesEra(player: GoatPlayer, era: EraFilter): boolean {
  if (era === 'toutes') return true;
  const startYear = player.startYear ?? (player.endYear ? player.endYear - 10 : null);
  // Carrière inconnue : le joueur n'apparaît que dans le filtre « Toutes ».
  if (startYear === null) return false;
  return era === 'vintage' ? startYear < 2000 : startYear >= 2000;
}
