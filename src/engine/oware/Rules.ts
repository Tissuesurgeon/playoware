import { sow } from "./Board";
import { initialTerritory, opponent, ownedPits, territorySeedCount } from "./Player";
import type { Player } from "./types";

export function isFeedingRequired(
  board: number[],
  player: Player,
  territory: readonly Player[] = initialTerritory(),
): boolean {
  return territorySeedCount(board, territory, opponent(player)) === 0;
}

/** True when sowing this pit leaves at least one seed on the opponent's houses. */
export function moveFeeds(
  board: number[],
  pit: number,
  player: Player,
  territory: readonly Player[] = initialTerritory(),
): boolean {
  const sown = sow(board, pit, player, territory);
  return territorySeedCount(sown.board, territory, opponent(player)) > 0;
}

export function legalMoves(
  board: number[],
  player: Player,
  territory: readonly Player[] = initialTerritory(),
): number[] {
  const playable = ownedPits(territory, player).filter((pit) => (board[pit] ?? 0) > 0);
  if (!isFeedingRequired(board, player, territory)) return playable;
  return playable.filter((pit) => moveFeeds(board, pit, player, territory));
}

export function illegalMoveReason(
  board: number[],
  player: Player,
  pit: number,
  territory: readonly Player[] = initialTerritory(),
): string | null {
  if (!Number.isInteger(pit) || pit < 0 || pit > 11) {
    return "That pit is not on the board.";
  }
  if (territory[pit] !== player) {
    return "You can only play a house you own.";
  }
  if ((board[pit] ?? 0) <= 0) {
    return "That pit is empty.";
  }
  if (isFeedingRequired(board, player, territory) && !moveFeeds(board, pit, player, territory)) {
    return "You must give your opponent a seed.";
  }
  return null;
}
