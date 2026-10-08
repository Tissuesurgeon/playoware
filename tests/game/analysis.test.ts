import { describe, expect, it } from "vitest";
import { OwareGame } from "@/engine/oware";
import { assessMove } from "@/lib/game/analysis";

describe("move assessment", () => {
  const state = new OwareGame({
    board: [1, 5, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0],
    capturedSeeds: { player1: 20, player2: 19 },
  }).getState();

  it("calls the capturing move best", () => {
    const assessment = assessMove(state, 1);
    expect(assessment.classification).toBe("best");
    expect(assessment.bestPit).toBe(1);
    expect(assessment.explanation).toMatch(/best move/i);
  });

  it("flags the move that skips the capture", () => {
    const assessment = assessMove(state, 0);
    expect(assessment.classification).toBe("missed_capture");
    expect(assessment.bestPit).toBe(1);
    expect(assessment.explanation).toMatch(/missed a capture/i);
    expect(assessment.evalLoss).toBeGreaterThan(0);
  });
});
