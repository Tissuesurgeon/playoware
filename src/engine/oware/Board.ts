import { PIT_COUNT, initialTerritory, opponent } from "./Player";
import type { Player, SowStep } from "./types";

export interface Harvest {
  pit: number;
  player: Player;
  count: number;
}

export interface RoundClaim {
  player: Player;
  /** Seeds still in hand when the round stopped. They are not on the board. */
  unplaced: number;
}

export interface SownBoard {
  board: number[];
  path: number[];
  lastPit: number;
  steps: SowStep[];
  harvests: Harvest[];
  roundClaim: RoundClaim | null;
}

/**
 * Sow anti-clockwise, one seed per house, including the house the seeds
 * were lifted from. If the last seed lands in a house that already held
 * seeds, pick that house up and continue. Stop when the last seed lands
 * in an empty house, or when it makes four and those four are captured.
 * A house that reaches four on the sower's side is captured at once.
 * A four on the opponent's side is captured by them during the sow, and
 * by the sower when it is made by the last seed.
 */
export function sow(
  board: number[],
  pit: number,
  mover: Player,
  territory: readonly Player[] = initialTerritory(),
): SownBoard {
  const seeds = board[pit] ?? 0;
  if (!Number.isInteger(pit) || pit < 0 || pit >= PIT_COUNT) {
    throw new Error("Pit is off the board.");
  }
  if (seeds <= 0) {
    throw new Error("Cannot sow an empty pit.");
  }

  const next = board.slice();
  const steps: SowStep[] = [];
  const harvests: Harvest[] = [];
  const path: number[] = [];
  const seen = new Set<string>();
  let cursor = pit;
  let hand = seeds;
  next[cursor] = 0;
  steps.push({ kind: "pickup", pit: cursor, count: hand });
  let lastPit = cursor;
  let roundClaim: RoundClaim | null = null;

  outer: for (let guard = 0; guard < 400 && hand > 0; guard += 1) {
    let index = cursor;
    while (hand > 0) {
      index = (index + 1) % PIT_COUNT;
      next[index] = (next[index] ?? 0) + 1;
      hand -= 1;
      path.push(index);
      steps.push({ kind: "drop", pit: index });
      lastPit = index;
      if (next[index] !== 4) continue;
      const own = territory[index] === mover;
      const lastOfHand = hand === 0;
      const taker = own || lastOfHand ? mover : opponent(mover);
      next[index] = 0;
      const harvest: Harvest = { pit: index, player: taker, count: 4 };
      harvests.push(harvest);
      steps.push({ kind: "harvest", pit: index, player: taker, count: 4 });
      const onBoard = next.reduce((sum, count) => sum + count, 0);
      if (onBoard <= 8) {
        roundClaim = { player: taker, unplaced: hand };
        break outer;
      }
    }

    if (next[lastPit] === 0 || next[lastPit] === 1) break;
    const relayKey = `${next.join(",")}|${lastPit}`;
    if (seen.has(relayKey)) break;
    seen.add(relayKey);
    hand = next[lastPit] ?? 0;
    next[lastPit] = 0;
    steps.push({ kind: "pickup", pit: lastPit, count: hand });
    cursor = lastPit;
  }

  return { board: next, path, lastPit, steps, harvests, roundClaim };
}
