import { describe, expect, it } from "vitest";
import { OwareGame } from "@/engine/oware";
import { latestSow } from "@/lib/animation/incoming";

describe("latestSow", () => {
  it("rebuilds the newest sow from the pit history", () => {
    const game = new OwareGame();
    game.makeMove(0);
    const beforeSecond = game.getState();
    const applied = game.makeMove(6);
    const step = latestSow([0, 6]);
    expect(step?.beforeBoard).toEqual(beforeSecond.board);
    expect(step?.beforeCaptured).toEqual(beforeSecond.capturedSeeds);
    expect(step?.applied.move.pit).toBe(6);
    expect(step?.applied.move.player).toBe("player2");
    expect(step?.applied.steps.some((move) => move.kind === "pickup")).toBe(true);
    expect(step?.applied.steps).toEqual(applied.steps);
  });
});
