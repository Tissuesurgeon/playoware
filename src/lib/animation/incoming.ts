import { OwareGame, type AppliedMove, type CapturedSeeds } from "@/engine/oware";

export interface SowReplay {
  beforeBoard: number[];
  beforeCaptured: CapturedSeeds;
  applied: AppliedMove;
}

/** Replay every sow except the last one, then play that last sow. */
export function latestSow(pits: number[]): SowReplay | null {
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

export type IncomingAction =
  | { type: "ignore" }
  | { type: "store"; land: boolean }
  | { type: "hold" }
  | { type: "animate"; sow: SowReplay }
  | { type: "apply" };

/**
 * Choose what to do with a server snapshot.
 * The snapshot is the committed state. This never builds a board from animation progress.
 * An older version is ignored, even when a sow is still on screen.
 */
export function decideIncoming(input: {
  hasSnapshot: boolean;
  currentVersion: number;
  previousPitCount: number;
  nextVersion: number;
  nextPits: number[];
  animating: boolean;
}): IncomingAction {
  if (!input.hasSnapshot) return { type: "store", land: false };
  if (input.nextVersion < input.currentVersion) return { type: "ignore" };
  if (input.nextVersion === input.currentVersion) return { type: "store", land: input.animating };
  if (input.animating) return { type: "hold" };
  if (input.nextPits.length <= input.previousPitCount) return { type: "apply" };
  const sow = latestSow(input.nextPits);
  if (!sow) return { type: "apply" };
  return { type: "animate", sow };
}

/** One start for a committed move, whether it arrives over HTTP or the socket. */
export function shouldStartAccepted(input: { currentVersion: number; acceptedVersion: number; animating: boolean }) {
  return !input.animating && input.acceptedVersion === input.currentVersion + 1;
}

/** Keep the newest held snapshot. A later, older poll must not replace it. */
export function preferNewer<T extends { version: number }>(held: T | null, incoming: T): T {
  if (!held || incoming.version >= held.version) return incoming;
  return held;
}
