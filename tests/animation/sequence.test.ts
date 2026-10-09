import { describe, expect, it } from "vitest";
import { OwareGame, type CapturedSeeds } from "@/engine/oware";
import { buildMoveAnimation, foldAnimation } from "@/lib/animation/sequence";

function captured(player1: number, player2: number): CapturedSeeds {
  return { player1, player2 };
}

function play(
  board: number[],
  pit: number,
  player: "player1" | "player2" = "player1",
  scores: CapturedSeeds = captured(0, 0),
) {
  const game = new OwareGame({ board, currentPlayer: player, capturedSeeds: scores });
  const before = game.getState();
  const applied = game.makeMove(pit);
  const after = game.getState();
  const events = buildMoveAnimation(before.board, applied, after.status !== "in_progress");
  const frame = foldAnimation(before.board, before.capturedSeeds, events, events.length - 1);
  expect(frame.board).toEqual(after.board);
  expect(frame.captured).toEqual(after.capturedSeeds);
  expect(frame.hand).toBe(0);
  return { events, applied, before, after, frame };
}

describe("buildMoveAnimation", () => {
  it("picks the house up again when the last seed lands in a filled house", () => {
    const { events } = play([0, 1, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0], 1, "player1", captured(22, 22));
    expect(events.filter((event) => event.type === "PICK_UP")).toEqual([
      { type: "PICK_UP", pit: 1, seedCount: 1 },
      { type: "PICK_UP", pit: 2, seedCount: 3 },
    ]);
    expect(events.filter((event) => event.type === "DROP_SEED").map((event) => (event.type === "DROP_SEED" ? event.pit : -1))).toEqual([
      2, 3, 4, 5,
    ]);
    expect(events.at(-1)).toEqual({ type: "CHANGE_TURN", player: "player2" });
  });

  it("stops after the last seed falls in an empty house", () => {
    const { events } = play([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], 0, "player1", captured(23, 23));
    expect(events.filter((event) => event.type === "PICK_UP")).toHaveLength(1);
    expect(events.filter((event) => event.type === "DROP_SEED")).toEqual([
      { type: "DROP_SEED", pit: 1, seedsInHand: 0 },
    ]);
  });

  it("follows a wrap from the last pit onto the other side", () => {
    const { events } = play([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3], 11, "player2", captured(22, 22));
    const moves = events.filter((event) => event.type === "MOVE_TO_PIT");
    expect(moves.map((event) => (event.type === "MOVE_TO_PIT" ? event.pit : -1))).toEqual([0, 1, 2]);
    expect(events.filter((event) => event.type === "DROP_SEED")).toHaveLength(3);
  });

  it("captures four and keeps the remaining seeds in hand", () => {
    const { events } = play([0, 3, 3, 0, 0, 0, 4, 4, 4, 4, 4, 4], 1, "player1", captured(9, 9));
    expect(events).toContainEqual({ type: "CAPTURE_PIT", pit: 2, seedCount: 4, player: "player1" });
    expect(events).toContainEqual({ type: "UPDATE_SCORE", player: "player1", amount: 4 });
    const captureAt = events.findIndex((event) => event.type === "CAPTURE_PIT");
    const laterDrop = events.slice(captureAt).find((event) => event.type === "DROP_SEED");
    expect(laterDrop).toEqual({ type: "DROP_SEED", pit: 3, seedsInHand: 1 });
    expect(events.at(-1)).toEqual({ type: "CHANGE_TURN", player: "player2" });
  });

  it("builds the same sequence every time for the same move", () => {
    const game = new OwareGame();
    const before = game.getState();
    const applied = game.makeMove(4);
    const first = buildMoveAnimation(before.board, applied, false);
    const second = buildMoveAnimation(before.board, applied, false);
    expect(second).toEqual(first);
    const mid = foldAnimation(before.board, before.capturedSeeds, first, 2);
    expect(mid.hand).toBe(3);
    expect(mid.board[4]).toBe(0);
    expect(mid.originPit).toBe(4);
  });
});
