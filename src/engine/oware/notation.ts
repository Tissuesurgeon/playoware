import { ownsPit } from "./Player";
import type { AppliedMove, Move, Player } from "./types";

/** Pit 1–6 from the player's left to right. */
export function relativePitNumber(player: Player, pit: number): number {
  if (!ownsPit(player, pit)) {
    throw new Error("Pit is not on this player's side.");
  }
  return player === "player1" ? pit + 1 : pit - 5;
}

export function absolutePit(player: Player, relative: number): number {
  if (!Number.isInteger(relative) || relative < 1 || relative > 6) {
    throw new Error("A pit number must be from 1 to 6.");
  }
  return player === "player1" ? relative - 1 : relative + 5;
}

/** Houses taken by each player across these moves, including a four taken mid-sow. */
export function housesCaptured(moves: AppliedMove[]): Record<Player, number> {
  const houses = { player1: 0, player2: 0 };
  for (const applied of moves) {
    for (const step of applied.steps) {
      if (step.kind === "harvest") houses[step.player] += 1;
    }
  }
  return houses;
}

export function formatMove(move: Move, seedsCaptured = 0, housesTaken = 0): string {
  const pit = relativePitNumber(move.player, move.pit);
  if (seedsCaptured <= 0 && housesTaken <= 0) return `${move.moveNumber}. Pit ${pit}`;
  const houses = housesTaken === 1 ? "1 house" : `${housesTaken} houses`;
  const seeds = seedsCaptured === 1 ? "1 seed" : `${seedsCaptured} seeds`;
  return `${move.moveNumber}. Pit ${pit} (+${seeds}, ${houses})`;
}

export function pitLabel(player: Player, pit: number, seeds: number, mine: boolean): string {
  const owner = mine ? "Your" : "Opponent";
  const number = ownsPit(player, pit)
    ? relativePitNumber(player, pit)
    : relativePitNumber(player === "player1" ? "player2" : "player1", pit);
  const noun = seeds === 1 ? "seed" : "seeds";
  return `${owner} pit ${number}, containing ${seeds} ${noun}`;
}
