import { opponent, ownsPit } from "./Player";
import type { Player } from "./types";

export interface CaptureResult {
  pits: number[];
  seeds: number;
  grandSlam: boolean;
  forfeitedPits: number[];
}

const EMPTY: CaptureResult = {
  pits: [],
  seeds: 0,
  grandSlam: false,
  forfeitedPits: [],
};

/**
 * Capture the closing 2 or 3 and the contiguous opponent pits behind it.
 * Abapa takes at most five houses. A sixth house forfeits the whole capture.
 */
export function collectCapture(
  board: number[],
  lastPit: number,
  mover: Player,
): CaptureResult {
  const defender = opponent(mover);
  if (!ownsPit(defender, lastPit)) return EMPTY;

  const closing = board[lastPit];
  if (closing !== 2 && closing !== 3) return EMPTY;

  const pits: number[] = [];
  for (let index = lastPit; ownsPit(defender, index); index -= 1) {
    const seeds = board[index];
    if (seeds !== 2 && seeds !== 3) break;
    pits.push(index);
  }

  const seeds = pits.reduce((sum, pit) => sum + board[pit], 0);
  if (pits.length > 5) {
    return { pits: [], seeds: 0, grandSlam: true, forfeitedPits: pits };
  }

  return { pits, seeds, grandSlam: false, forfeitedPits: [] };
}
