import { describe, expect, it } from "vitest";
import { OwareGame, type GameState } from "@/engine/oware";
import { chooseMove, createOwareAI, evaluate, rankMoves, type Difficulty } from "@/lib/ai";

function assertLegal(state: GameState, pit: number) {
  const game = OwareGame.fromState(state);
  expect(game.getLegalMoves()).toContain(pit);
}

describe("Oware AI", () => {
  const opening = new OwareGame().getState();

  it("returns a legal move at every difficulty", () => {
    const difficulties: Difficulty[] = ["beginner", "easy", "medium", "hard"];
    for (const difficulty of difficulties) {
      const move = createOwareAI(difficulty, 3).chooseMove(opening);
      assertLegal(opening, move.pit);
      expect(move.player).toBe("player1");
      expect(move.moveNumber).toBe(1);
    }
  });

  it("plays medium and hard the same way twice", () => {
    for (const difficulty of ["medium", "hard"] as const) {
      const first = chooseMove(opening, difficulty);
      const second = chooseMove(opening, difficulty);
      expect(second).toEqual(first);
    }
  });

  it("keeps a seeded beginner stable and able to disagree with hard", () => {
    const first = chooseMove(opening, "beginner", 7);
    const second = chooseMove(opening, "beginner", 7);
    expect(second).toEqual(first);

    const hard = chooseMove(opening, "hard");
    const varied = Array.from({ length: 24 }, (_, seed) => chooseMove(opening, "beginner", seed + 1).pit);
    expect(varied.some((pit) => pit !== hard.pit)).toBe(true);
  });

  it("takes a clear capture with the deeper difficulties", () => {
    const state = new OwareGame({
      board: [1, 5, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0],
      capturedSeeds: { player1: 20, player2: 19 },
    }).getState();
    for (const difficulty of ["medium", "hard"] as const) {
      expect(chooseMove(state, difficulty).pit).toBe(1);
    }
    const ranked = rankMoves(state, 3);
    expect(ranked[0]?.pit).toBe(1);
    expect(ranked[0]!.value).toBeGreaterThan(ranked.find((entry) => entry.pit === 0)!.value);
  });

  it("never chooses an illegal move across a short game", () => {
    const game = new OwareGame();
    const ai = createOwareAI("easy", 4);
    for (let turn = 0; turn < 12 && !game.isGameOver(); turn += 1) {
      const move = ai.chooseMove(game.getState());
      expect(() => game.makeMove(move.pit)).not.toThrow();
    }
  });

  it("scores a drawn or losing position below a winning one for the AI", () => {
    const even = evaluate(opening, "player2");
    const ahead = evaluate(
      new OwareGame({
        board: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0],
        capturedSeeds: { player1: 0, player2: 8 },
      }).getState(),
      "player2",
    );
    expect(ahead).toBeGreaterThan(even);
  });
});
