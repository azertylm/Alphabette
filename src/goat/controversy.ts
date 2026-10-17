import { GoatPlayer } from './types';

/**
 * @file controversy.ts
 * Jauge de Controverse (% Non-conformiste) : compare le classement de l'utilisateur
 * au classement standard pré-établi (notoriété Wikidata : nombre de versions linguistiques Wikipédia).
 *
 * Une pyramide « consensuelle » place le n°1 de notoriété au sommet.
 * Plus les choix s'écartent du standard aux étages prestigieux, plus le score grimpe.
 */

export type ControversyLabel =
  | 'Consensuel / Goûts classiques'
  | 'Connaisseur tranché'
  | 'Audacieux / Preneur de risques maximal';

export interface ControversyResult {
  /** Pourcentage d'originalité de 0 à 100. */
  percent: number;
  label: ControversyLabel;
  /** Nombre de placements hors du classement standard (pondérés). */
  boldPicks: number;
  totalPicks: number;
  /** Nom du n°1 du classement standard (repère affiché à l'utilisateur). */
  consensusLeader: string;
}

/** Classement standard : joueurs triés par notoriété décroissante. */
export function buildConsensusRanking(players: GoatPlayer[]): GoatPlayer[] {
  return [...players].sort((a, b) => b.fame - a.fame || a.name.localeCompare(b.name, 'fr'));
}

/** Bornes cumulées du « classement standard » par étage de pyramide. */
const CUMULATIVE_BOUNDS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 15, 5: 31 };

/** Poids d'audace d'un étage : le sommet pèse le plus lourd. */
const TIER_WEIGHTS: Record<number, number> = { 1: 1, 2: 1, 3: 0.75, 4: 0.5, 5: 0.25 };

export function tierLevelFromSlot(slot: string): number {
  const match = slot.match(/^L(\d+)-/);
  return match ? Number.parseInt(match[1], 10) : 4;
}

/**
 * Calcule le pourcentage de non-conformisme d'une pyramide complétée.
 * @param assignments slot -> playerId
 */
export function computeControversy(
  assignments: Record<string, string>,
  players: GoatPlayer[],
): ControversyResult {
  const ranking = buildConsensusRanking(players);
  const rankByPlayerId = new Map(ranking.map((player, index) => [player.id, index + 1]));

  let weightedTotal = 0;
  let weightedBold = 0;
  let boldPicks = 0;
  let totalPicks = 0;

  for (const [slot, playerId] of Object.entries(assignments)) {
    if (!playerId) continue;
    const level = tierLevelFromSlot(slot);
    const weight = TIER_WEIGHTS[level] ?? 0.5;
    const rank = rankByPlayerId.get(playerId) ?? Number.MAX_SAFE_INTEGER;
    const bound = CUMULATIVE_BOUNDS[level] ?? 15;

    weightedTotal += weight;
    totalPicks += 1;

    if (rank > bound) {
      weightedBold += weight;
      boldPicks += 1;
    }
  }

  const percent = weightedTotal === 0 ? 0 : Math.round((weightedBold / weightedTotal) * 100);

  return {
    percent,
    label: labelForPercent(percent),
    boldPicks,
    totalPicks,
    consensusLeader: ranking[0]?.name ?? '—',
  };
}

export function labelForPercent(percent: number): ControversyLabel {
  if (percent <= 35) return 'Consensuel / Goûts classiques';
  if (percent <= 70) return 'Connaisseur tranché';
  return 'Audacieux / Preneur de risques maximal';
}

/** Accroche humoristique associée au score. */
export function controversyQuip(percent: number): string {
  if (percent <= 35) return 'Tu joues la sécurité, la chèvre approuve mais s’ennuie un peu.';
  if (percent <= 70) return 'Sacré palmarès, la chèvre dresse l’oreille.';
  return 'La chèvre couronnée a failli lâcher sa couronne. Continue comme ça.';
}

/** Couleur d'accentuation selon le score (Tailwind). */
export function controversyTone(percent: number): string {
  if (percent <= 35) return 'emerald';
  if (percent <= 70) return 'amber';
  return 'rose';
}
