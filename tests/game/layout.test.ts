import { describe, expect, it } from "vitest";
import { OwareGame, type AppliedMove } from "@/engine/oware";
import { buildMoveAnimation } from "@/lib/animation/sequence";
import { HandMotion } from "@/game/animation/motion";
import { ownedHousesInView, pitPosition } from "@/game/layout/pits";
import { PIT_CLUSTER_RADIUS, getSeedPosition } from "@/game/layout/seeds";

function drops(events: ReturnType<typeof buildMoveAnimation>) {
  return events.filter((event) => event.type === "DROP_SEED").map((event) => (event.type === "DROP_SEED" ? event.pit : -1));
}

describe("pit mapping", () => {
  it("puts player 1 left to right on the near side and player 2 right to left on the far side", () => {
    const near = [0, 1, 2, 3, 4, 5].map(pitPosition);
    const far = [11, 10, 9, 8, 7, 6].map(pitPosition);
    for (let index = 1; index < near.length; index += 1) {
      expect(near[index]!.x).toBeGreaterThan(near[index - 1]!.x);
      expect(near[index]!.z).toBeGreaterThan(0);
    }
    expect(far.map((place) => place.x)).toEqual(near.map((place) => place.x));
    expect(far.every((place) => place.z < 0)).toBe(true);
  });

  it("lists owned houses from the left of the shared board", () => {
    const territory = Array.from({ length: 12 }, (_, pit) => (pit < 6 ? "player1" : "player2")) as Array<
      "player1" | "player2"
    >;
    territory[0] = "player2";
    territory[11] = "player1";
    expect(ownedHousesInView("player1", territory)).toEqual([1, 2, 3, 4, 5, 11]);
    expect(ownedHousesInView("player2", territory)).toEqual([10, 9, 8, 7, 6, 0]);
  });

  it("gives every engine pit its own place", () => {
    const places = Array.from({ length: 12 }, (_, pit) => pitPosition(pit));
    const keys = new Set(places.map((place) => `${place.x},${place.z}`));
    expect(keys.size).toBe(12);
  });
});

describe("seed placement", () => {
  it("stays inside the pit and repeats the same place", () => {
    const first = getSeedPosition(3, 2, 8);
    expect(getSeedPosition(3, 2, 8)).toEqual(first);
    const radius = Math.hypot(first.x, first.z);
    expect(radius).toBeLessThan(PIT_CLUSTER_RADIUS);
    expect(first.y).toBeLessThan(0.2);
  });

  it("does not lay every seed on one line", () => {
    const places = Array.from({ length: 6 }, (_, index) => getSeedPosition(1, index, 6));
    const xs = new Set(places.map((place) => place.x.toFixed(3)));
    const zs = new Set(places.map((place) => place.z.toFixed(3)));
    expect(xs.size).toBeGreaterThan(1);
    expect(zs.size).toBeGreaterThan(1);
  });
});

describe("hand motion", () => {
  it("arrives at the engine pit instead of a screen coordinate", () => {
    const motion = new HandMotion();
    motion.retarget(0, 0, 100, false);
    motion.retarget(4, 100, 200, false);
    const arrived = motion.sample(300);
    const pit = pitPosition(4);
    expect(arrived.x).toBeCloseTo(pit.x);
    expect(arrived.z).toBeCloseTo(pit.z);
  });
});

describe("engine path is the visual path", () => {
  it("drops seeds on the engine sowing path, including a lap through the starting pit", () => {
    const game = new OwareGame({
      board: [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      capturedSeeds: { player1: 18, player2: 18 },
    });
    const before = game.getState();
    const applied = game.makeMove(0);
    const events = buildMoveAnimation(before.board, applied, false);
    expect(drops(events)).toEqual(applied.sowPath);
    expect(applied.sowPath).toContain(0);
  });

  it("does not drop into the starting pit when the engine path skips it", () => {
    const applied: AppliedMove = {
      move: { player: "player1", pit: 0, moveNumber: 1 },
      sowPath: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1],
      capturedPits: [],
      forfeitedPits: [],
      seedsCaptured: 0,
      grandSlam: false,
      steps: [
        { kind: "pickup", pit: 0, count: 12 },
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1].map((pit) => ({ kind: "drop" as const, pit })),
      ],
    };
    expect(drops(buildMoveAnimation([12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], applied, false))).toEqual(applied.sowPath);
    expect(drops(buildMoveAnimation([12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], applied, false))).not.toContain(0);
  });

  it("captures pits in the order the engine harvested them", () => {
    const game = new OwareGame({
      board: [0, 3, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      capturedSeeds: { player1: 20, player2: 21 },
    });
    const before = game.getState();
    const applied = game.makeMove(1);
    const captured = buildMoveAnimation(before.board, applied, false).filter((event) => event.type === "CAPTURE_PIT");
    expect(captured.map((event) => (event.type === "CAPTURE_PIT" ? event.pit : -1))).toEqual(applied.capturedPits);
    expect(captured.map((event) => (event.type === "CAPTURE_PIT" ? event.player : ""))).toEqual(["player1"]);
  });

  it("plays no capture when the engine forfeits the capture", () => {
    const applied: AppliedMove = {
      move: { player: "player1", pit: 5, moveNumber: 1 },
      sowPath: [6, 7, 8, 9, 10, 11],
      capturedPits: [],
      forfeitedPits: [11, 10, 9, 8, 7, 6],
      seedsCaptured: 0,
      grandSlam: true,
      steps: [
        { kind: "pickup", pit: 5, count: 6 },
        ...[6, 7, 8, 9, 10, 11].map((pit) => ({ kind: "drop" as const, pit })),
      ],
    };
    const events = buildMoveAnimation([0, 0, 0, 0, 0, 6, 1, 1, 1, 1, 1, 1], applied, false);
    expect(events.some((event) => event.type === "CAPTURE_PIT" || event.type === "UPDATE_SCORE")).toBe(false);
    expect(events).toContainEqual({ type: "FORFEIT_CAPTURE", pits: applied.forfeitedPits });
    expect(drops(events)).toEqual(applied.sowPath);
  });

  it("plays consecutive captures in engine order and ends the game when the engine does", () => {
    const applied: AppliedMove = {
      move: { player: "player1", pit: 1, moveNumber: 4 },
      sowPath: [2, 3],
      capturedPits: [2, 3],
      forfeitedPits: [],
      seedsCaptured: 8,
      grandSlam: false,
      steps: [
        { kind: "pickup", pit: 1, count: 2 },
        { kind: "drop", pit: 2 },
        { kind: "harvest", pit: 2, player: "player1", count: 4 },
        { kind: "drop", pit: 3 },
        { kind: "harvest", pit: 3, player: "player1", count: 4 },
      ],
    };
    const events = buildMoveAnimation([0, 2, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0], applied, true);
    expect(events.filter((event) => event.type === "CAPTURE_PIT").map((event) => (event.type === "CAPTURE_PIT" ? event.pit : -1))).toEqual([
      2, 3,
    ]);
    expect(events.at(-1)).toEqual({ type: "GAME_OVER" });
    expect(events.some((event) => event.type === "CHANGE_TURN")).toBe(false);
  });

  it("rebuilds the same visual sequence from a recorded game", () => {
    const game = new OwareGame();
    const pits = [0, 1, 2].map(() => {
      const pit = game.getLegalMoves()[0];
      if (pit === undefined) throw new Error("expected a legal move");
      const before = game.getState();
      const applied = game.makeMove(pit);
      return { pit, events: buildMoveAnimation(before.board, applied, game.isGameOver()) };
    });
    const replay = new OwareGame();
    for (const recorded of pits) {
      const before = replay.getState();
      const applied = replay.makeMove(recorded.pit);
      expect(buildMoveAnimation(before.board, applied, replay.isGameOver())).toEqual(recorded.events);
    }
  });
});
