import { sow } from "./Board";
import { opponent, ownsPit, sidePits, sideSeedCount } from "./Player";
import type { Player } from "./types";

export function isFeedingRequired(board: number[], player: Player): boolean {
  return sideSeedCount(board, opponent(player)) === 0;
}

/** True when sowing this pit drops at least one seed on the opponent's side. */
export function moveFeeds(board: number[], pit: number, player: Player): boolean {
  const sown = sow(board, pit, player);
  return sideSeedCount(sown.board, opponent(player)) > 0;
}

export function legalMoves(board: number[], player: Player): number[] {
  const playable = sidePits(player).filter((pit) => board[pit] > 0);
  if (!isFeedingRequired(board, player)) return playable;
  return playable.filter((pit) => moveFeeds(board, pit, player));
}

export function illegalMoveReason(
  board: number[],
  player: Player,
  pit: number,
): string | null {
  if (!Number.isInteger(pit) || pit < 0 || pit > 11) {
    return "That pit is not on the board.";
  }
  if (!ownsPit(player, pit)) {
    return "You can only play a pit on your side.";
  }
  if (board[pit] <= 0) {
    return "That pit is empty.";
  }
  if (isFeedingRequired(board, player) && !moveFeeds(board, pit, player)) {
    return "You must give your opponent a seed.";
  }
  return null;
}
