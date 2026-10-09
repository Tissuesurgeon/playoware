import { movePitLabel, type GameState, type Player } from "@/engine/oware";
import { rankMoves } from "@/lib/ai";

export type MoveClass =
  | "best"
  | "strong"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "missed_capture";

export interface MoveAssessment {
  classification: MoveClass;
  bestPit: number;
  playedPit: number;
  evalLoss: number;
  seedsCaptured: number;
  bestCaptured: number;
  explanation: string;
}

const ANALYSIS_DEPTH = 3;

function label(player: Player, pit: number) {
  return movePitLabel(player, pit);
}

/**
 * Labels come from the gap between the played move and the engine's best
 * move at a fixed depth. They are a guide, not a perfect coach.
 */
export function assessMove(state: GameState, playedPit: number): MoveAssessment {
  const ranked = rankMoves(state, ANALYSIS_DEPTH);
  const best = ranked[0];
  const played = ranked.find((entry) => entry.pit === playedPit);
  if (!best || !played) {
    return {
      classification: "good",
      bestPit: playedPit,
      playedPit,
      evalLoss: 0,
      seedsCaptured: 0,
      bestCaptured: 0,
      explanation: "This move could not be compared with the engine.",
    };
  }

  const evalLoss = best.value - played.value;
  const missed = best.seedsCaptured > 0 && played.seedsCaptured === 0 && evalLoss > 40 && played.pit !== best.pit;
  let classification: MoveClass;
  if (played.pit === best.pit || evalLoss <= 0) classification = "best";
  else if (missed) classification = "missed_capture";
  else if (evalLoss <= 40) classification = "strong";
  else if (evalLoss <= 100) classification = "good";
  else if (evalLoss <= 220) classification = "inaccuracy";
  else if (evalLoss <= 450) classification = "mistake";
  else classification = "blunder";

  const player = state.currentPlayer;
  const bestName = label(player, best.pit);
  const playedName = label(player, played.pit);
  let explanation: string;
  if (classification === "best") {
    explanation = `${playedName} matches the engine's best move.`;
  } else if (classification === "missed_capture") {
    explanation = `You missed a capture. ${bestName} would have taken ${best.seedsCaptured} ${best.seedsCaptured === 1 ? "seed" : "seeds"}.`;
  } else if (classification === "blunder" || classification === "mistake") {
    explanation = `${playedName} gives away a large amount of the evaluation. ${bestName} was the stronger move.`;
  } else if (classification === "inaccuracy") {
    explanation = `${playedName} is a little worse than ${bestName} on the engine's evaluation.`;
  } else {
    explanation = `${playedName} is close to ${bestName}.`;
  }

  return {
    classification,
    bestPit: best.pit,
    playedPit,
    evalLoss,
    seedsCaptured: played.seedsCaptured,
    bestCaptured: best.seedsCaptured,
    explanation,
  };
}

export function classLabel(classification: MoveClass): string {
  switch (classification) {
    case "best":
      return "Best";
    case "strong":
      return "Strong";
    case "good":
      return "Good";
    case "inaccuracy":
      return "Inaccuracy";
    case "mistake":
      return "Mistake";
    case "blunder":
      return "Blunder";
    case "missed_capture":
      return "Missed capture";
  }
}
