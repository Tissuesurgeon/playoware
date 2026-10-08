import { describe, expect, it } from "vitest";
import { LocalGameSession } from "@/lib/game/session";

function session(now = 0, initialMs = 5_000) {
  return new LocalGameSession({
    id: "game-1",
    mode: "local",
    player1Name: "Ama",
    player2Name: "Kofi",
    initialMs,
    now,
  });
}

describe("local game session", () => {
  it("resigns the player who resigns and leaves the score untouched", () => {
    const game = session();
    game.submitMove(0, 200);
    game.resign("player2", 200);
    expect(game.getState().endReason).toBe("resignation");
    expect(game.getState().winner).toBe("player1");
    expect(game.getState().capturedSeeds).toEqual({ player1: 0, player2: 0 });
  });

  it("requires the other person to accept a draw", () => {
    const game = session();
    expect(game.offerDraw("player1", 0)).toBe("pending");
    expect(game.getState().status).toBe("in_progress");
    game.respondDraw("player2", true, 10);
    expect(game.getState()).toMatchObject({ status: "draw", endReason: "agreement" });
  });

  it("drops a declined draw and continues", () => {
    const game = session();
    game.offerDraw("player1", 0);
    game.respondDraw("player2", false, 10);
    expect(game.getState().status).toBe("in_progress");
    expect(() => game.submitMove(0, 20)).not.toThrow();
  });

  it("lets the AI accept an even game and decline a game it is winning", () => {
    const even = new LocalGameSession({
      id: "ai-even",
      mode: "ai",
      player1Name: "Ama",
      player2Name: "AI",
      aiDifficulty: "medium",
      now: 0,
    });
    expect(even.offerDraw("player1", 0)).toBe("accepted");
    expect(even.getState().endReason).toBe("agreement");

    const lead = new LocalGameSession({
      id: "lead",
      mode: "ai",
      player1Name: "Ama",
      player2Name: "AI",
      aiDifficulty: "medium",
      now: 0,
      position: {
        board: [4, 4, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2],
        capturedSeeds: { player1: 0, player2: 12 },
      },
    });
    expect(lead.offerDraw("player1", 0)).toBe("declined");
    expect(lead.getState().status).toBe("in_progress");
  });

  it("flags the player whose clock expires", () => {
    const game = session(0, 1_000);
    game.tick(1_000);
    expect(game.getState()).toMatchObject({
      status: "won",
      winner: "player2",
      endReason: "timeout",
    });
  });

  it("charges the mover and then the opponent after the animation", () => {
    const game = session(0, 10_000);
    game.submitMove(0, 400);
    expect(game.getClock(400)).toEqual({ player1: 9_600, player2: 10_000 });
    game.finishAnimation(400);
    game.tick(900);
    expect(game.getClock(900)).toEqual({ player1: 9_600, player2: 9_500 });
  });

  it("restores a resigned game from its move list and end command", () => {
    const game = session();
    game.submitMove(2, 10);
    game.resign("player1", 10);
    const restored = LocalGameSession.fromSnapshot(game.snapshot(), 50);
    expect(restored.getState()).toMatchObject({
      winner: "player2",
      endReason: "resignation",
      moveNumber: 1,
    });
  });
});
