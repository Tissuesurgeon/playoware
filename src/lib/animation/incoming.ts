import { OwareGame, type AppliedMove, type CapturedSeeds } from "@/engine/oware";

/** Replay every sow except the last one, then play that last sow. */
export function latestSow(pits: number[]): {
  beforeBoard: number[];
  beforeCaptured: CapturedSeeds;
  applied: AppliedMove;
} | null {
  const pit = pits.at(-1);
  if (pit === undefined) return null;
  const game = OwareGame.fromHistory(pits.slice(0, -1).map((played) => ({ pit: played })));
  const before = game.getState();
  try {
    const applied = game.makeMove(pit);
    return { beforeBoard: before.board, beforeCaptured: before.capturedSeeds, applied };
  } catch {
    return null;
  }
}
