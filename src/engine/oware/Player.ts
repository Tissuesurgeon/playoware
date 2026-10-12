import type { CapturedSeeds, Player } from "./types";

export const PIT_COUNT = 12;
export const SEEDS_PER_PIT = 4;
export const TOTAL_SEEDS = PIT_COUNT * SEEDS_PER_PIT;
export const WIN_SCORE = 25;

export function opponent(player: Player): Player {
  return player === "player1" ? "player2" : "player1";
}

/** Absolute pit indexes on a player's side, left to right from that player's view. */
export function sidePits(player: Player): number[] {
  return player === "player1" ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];
}

export function ownsPit(player: Player, pit: number): boolean {
  return player === "player1" ? pit >= 0 && pit <= 5 : pit >= 6 && pit <= 11;
}

export function initialTerritory(): Player[] {
  return Array.from({ length: PIT_COUNT }, (_, pit) => (pit < 6 ? "player1" : "player2"));
}

/** A player's original houses, from their rightmost to their leftmost. */
export function rightToLeft(player: Player): number[] {
  return player === "player1" ? [5, 4, 3, 2, 1, 0] : [11, 10, 9, 8, 7, 6];
}

export function ownedPits(territory: readonly Player[], player: Player): number[] {
  const pits: number[] = [];
  for (let pit = 0; pit < territory.length; pit += 1) {
    if (territory[pit] === player) pits.push(pit);
  }
  return pits;
}

export function territorySeedCount(board: number[], territory: readonly Player[], player: Player): number {
  return ownedPits(territory, player).reduce((sum, pit) => sum + (board[pit] ?? 0), 0);
}

export function roundStarter(round: number): Player {
  return round % 2 === 1 ? "player1" : "player2";
}

export function openingKey(territory: readonly Player[], starter: Player): string {
  return `${territory.join(",")}|${starter}`;
}

/**
 * Houses earned are complete fours. An equal count leaves territory as it is.
 * A player who earned more houses than they own takes the difference, reclaiming
 * their own houses from the left before taking the opponent's rightmost houses.
 */
export function nextTerritory(territory: readonly Player[], captured: CapturedSeeds): Player[] {
  const earned: Record<Player, number> = {
    player1: Math.floor(captured.player1 / 4),
    player2: Math.floor(captured.player2 / 4),
  };
  if (earned.player1 === earned.player2) return territory.slice();
  const next = territory.slice();
  for (const winner of ["player1", "player2"] as const) {
    const owned = next.filter((owner) => owner === winner).length;
    const gain = earned[winner] - owned;
    if (gain <= 0) continue;
    const loser = opponent(winner);
    const reclaim = sidePits(winner).filter((pit) => next[pit] === loser);
    const theirs = rightToLeft(loser).filter((pit) => next[pit] === loser);
    for (const pit of [...reclaim, ...theirs].slice(0, gain)) next[pit] = winner;
  }
  return next;
}

export function initialBoard(): number[] {
  return Array.from({ length: PIT_COUNT }, () => SEEDS_PER_PIT);
}

export function sideSeedCount(board: number[], player: Player): number {
  return sidePits(player).reduce((sum, pit) => sum + board[pit], 0);
}
