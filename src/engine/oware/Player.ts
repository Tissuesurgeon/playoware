import type { Player } from "./types";

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

export function initialBoard(): number[] {
  return Array.from({ length: PIT_COUNT }, () => SEEDS_PER_PIT);
}

export function sideSeedCount(board: number[], player: Player): number {
  return sidePits(player).reduce((sum, pit) => sum + board[pit], 0);
}
