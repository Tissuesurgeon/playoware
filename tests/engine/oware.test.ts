import { describe, expect, it } from "vitest";
import {
  IllegalMoveError,
  OwareGame,
  TOTAL_SEEDS,
  formatMove,
  housesCaptured,
  positionKey,
  relativePitNumber,
  replayGame,
} from "@/engine/oware";

function captured(player1: number, player2: number) {
  return { player1, player2 };
}

function gameFrom(
  board: number[],
  player: "player1" | "player2" = "player1",
  scores: { player1: number; player2: number } = { player1: 0, player2: 0 },
  seen: string[] = [],
) {
  return new OwareGame({
    board,
    currentPlayer: player,
    capturedSeeds: scores,
    seen,
  });
}

function seedTotal(state: ReturnType<OwareGame["getState"]>) {
  return (
    state.board.reduce((sum, seeds) => sum + seeds, 0) +
    state.capturedSeeds.player1 +
    state.capturedSeeds.player2
  );
}

describe("initial position", () => {
  it("starts with four seeds in every pit and player 1 to move", () => {
    const state = new OwareGame().getState();
    expect(state.board).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    expect(state.currentPlayer).toBe("player1");
    expect(state.capturedSeeds).toEqual(captured(0, 0));
    expect(state.moveNumber).toBe(0);
    expect(state.status).toBe("in_progress");
    expect(state.winner).toBeUndefined();
    expect(seedTotal(state)).toBe(TOTAL_SEEDS);
  });

  it("offers all six of the side to move and nothing else", () => {
    const game = new OwareGame();
    expect(game.getLegalMoves()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("illegal moves", () => {
  it("rejects the opponent's pits, empty pits, and moves after the game", () => {
    const game = new OwareGame();
    expect(() => game.makeMove(6)).toThrow(IllegalMoveError);
    expect(game.getState().board[0]).toBe(4);

    const empty = gameFrom([0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], "player1", captured(23, 23));
    expect(() => empty.makeMove(0)).toThrow(/empty/i);
    expect(empty.getState().board).toEqual([0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);

    const won = gameFrom([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "player1", captured(25, 23));
    expect(won.isGameOver()).toBe(true);
    expect(() => won.makeMove(0)).toThrow(/already over/i);
  });

  it("rejects a move that fails to feed an empty opponent", () => {
    const board = [1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0];
    const game = gameFrom(board, "player1", captured(22, 22));
    expect(game.getLegalMoves()).toEqual([5]);
    expect(() => game.makeMove(0)).toThrow(/opponent/i);
    expect(game.getState().board).toEqual(board);
  });
});

describe("sowing", () => {
  it("keeps sowing when the last seed lands in a house that already has seeds", () => {
    const game = gameFrom([0, 1, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0], "player1", captured(22, 22));
    const applied = game.makeMove(1);
    expect(applied.steps.filter((step) => step.kind === "pickup")).toEqual([
      { kind: "pickup", pit: 1, count: 1 },
      { kind: "pickup", pit: 2, count: 3 },
    ]);
    expect(applied.sowPath).toEqual([2, 3, 4, 5]);
    expect(game.getState().board).toEqual([0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
    expect(game.getState().currentPlayer).toBe("player2");
  });

  it("stops when the last seed lands in an empty house", () => {
    const game = gameFrom([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], "player1", captured(23, 23));
    const applied = game.makeMove(0);
    expect(applied.sowPath).toEqual([1]);
    expect(applied.steps.filter((step) => step.kind === "pickup")).toHaveLength(1);
    expect(game.getState().board[1]).toBe(1);
    expect(game.getState().board[0]).toBe(0);
  });

  it("wraps from the end of the board onto the other side", () => {
    const game = gameFrom(
      [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3],
      "player2",
      captured(22, 22),
    );
    const applied = game.makeMove(11);
    expect(applied.sowPath).toEqual([0, 1, 2]);
    expect(applied.seedsCaptured).toBe(0);
    expect(game.getState().board).toEqual([1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
    expect(game.isGameOver()).toBe(false);
  });

  it("places a seed back in the house the move started from", () => {
    const twelve = gameFrom(
      [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      "player1",
      captured(18, 18),
    );
    const applied = twelve.makeMove(0);
    expect(applied.sowPath).toContain(0);
    expect(twelve.getState().board).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(seedTotal(twelve.getState())).toBe(TOTAL_SEEDS);
  });
});

describe("captures", () => {
  it("captures four on the sower's side and continues with the remaining seeds", () => {
    const game = gameFrom([0, 3, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0], "player1", captured(20, 21));
    const applied = game.makeMove(1);
    expect(applied.capturedPits).toEqual([2]);
    expect(applied.seedsCaptured).toBe(4);
    expect(applied.sowPath).toEqual([2, 3, 4]);
    expect(game.getState().board).toEqual([0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0]);
    expect(game.getState().capturedSeeds).toEqual(captured(24, 21));
    expect(game.isGameOver()).toBe(false);
  });

  it("lets the opponent capture a four made in the middle of the sow", () => {
    const game = gameFrom([0, 6, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0], "player1", captured(19, 20));
    const applied = game.makeMove(1);
    expect(applied.seedsCaptured).toBe(0);
    expect(applied.steps).toContainEqual({ kind: "harvest", pit: 6, player: "player2", count: 4 });
    expect(game.getState().capturedSeeds.player2).toBe(24);
    expect(game.getState().board[6]).toBe(0);
    expect(game.getState().board[7]).toBe(1);
    expect(game.isGameOver()).toBe(false);
  });

  it("captures four on the opponent's side when the last seed makes them", () => {
    const game = gameFrom([0, 5, 0, 0, 0, 0, 3, 1, 0, 0, 0, 0], "player1", captured(19, 20));
    const applied = game.makeMove(1);
    expect(applied.capturedPits).toEqual([6]);
    expect(applied.seedsCaptured).toBe(4);
    expect(game.getState().board[6]).toBe(0);
    expect(game.getState().capturedSeeds).toEqual(captured(23, 20));
    expect(game.isGameOver()).toBe(false);
  });
});

describe("feeding and starvation", () => {
  it("ends immediately when the player to move cannot feed", () => {
    const game = gameFrom([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "player1", captured(22, 23));
    expect(game.isGameOver()).toBe(true);
    expect(game.getResult()).toEqual({
      outcome: "win",
      winner: "player1",
      score: captured(25, 23),
      endReason: "starvation",
    });
    expect(game.getState().board.every((seeds) => seeds === 0)).toBe(true);
  });

  it("lets the opponent collect when the side to move has no seeds", () => {
    const game = gameFrom([0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0], "player1", captured(22, 22));
    expect(game.getResult()).toMatchObject({
      winner: "player2",
      score: captured(22, 26),
      endReason: "starvation",
    });
  });

  it("requires a feed, then ends if the opponent still cannot give seeds back", () => {
    const game = gameFrom([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], "player1", captured(23, 24));
    expect(game.getLegalMoves()).toEqual([5]);
    game.makeMove(5);
    expect(game.getResult()).toEqual({
      outcome: "win",
      winner: "player2",
      score: captured(23, 25),
      endReason: "starvation",
    });
  });
});

describe("game end and scoring", () => {
  it("wins at 25 and leaves the remaining board seeds unawarded", () => {
    const game = gameFrom([0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0], "player1", captured(21, 22));
    game.makeMove(4);
    expect(game.getResult()).toMatchObject({
      outcome: "win",
      winner: "player1",
      score: captured(25, 22),
      endReason: "majority",
    });
    expect(game.getState().board[6]).toBe(1);
  });

  it("continues when a player has exactly 24", () => {
    const game = gameFrom([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], "player1", captured(24, 22));
    game.makeMove(0);
    expect(game.isGameOver()).toBe(false);
    expect(game.getState().capturedSeeds.player1).toBe(24);
    expect(game.getState().board[1]).toBe(1);
  });

  it("draws at 24–24 when starvation awards the rest", () => {
    const game = gameFrom([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "player1", captured(22, 24));
    expect(game.getResult()).toEqual({
      outcome: "draw",
      winner: undefined,
      score: captured(24, 24),
      endReason: "starvation",
    });
  });

  it("ends a repeated position by awarding each side its own seeds", () => {
    const board = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2];
    const scores = captured(22, 23);
    const key = positionKey(board, "player1", scores);
    const game = gameFrom(board, "player1", scores, [key]);
    expect(game.getResult()).toEqual({
      outcome: "win",
      winner: "player2",
      score: captured(23, 25),
      endReason: "repetition",
    });
    expect(game.getState().board.every((seeds) => seeds === 0)).toBe(true);
  });
});

describe("move history and replay", () => {
  it("records moves and rebuilds every position from them", () => {
    const game = new OwareGame();
    const played = [2, 8, 5, 11];
    for (const pit of played) game.makeMove(pit);

    const history = game.getMoveHistory();
    expect(history.map((move) => move.pit)).toEqual(played);
    expect(history.map((move) => move.moveNumber)).toEqual([1, 2, 3, 4]);
    expect(history.map((move) => move.player)).toEqual([
      "player1",
      "player2",
      "player1",
      "player2",
    ]);
    expect(formatMove(history[0])).toBe("1. Pit 3");
    expect(formatMove(history[0], 4, 1)).toBe("1. Pit 3 (+4 seeds, 1 house)");
    expect(formatMove(history[0], 8, 2)).toBe("1. Pit 3 (+8 seeds, 2 houses)");
    const capture = new OwareGame({
      board: [0, 3, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      capturedSeeds: { player1: 20, player2: 21 },
    });
    expect(housesCaptured([capture.makeMove(1)])).toEqual({ player1: 1, player2: 0 });
    expect(relativePitNumber("player2", 8)).toBe(3);

    const rebuilt = OwareGame.fromHistory(history);
    expect(rebuilt.getState()).toEqual(game.getState());

    const replay = replayGame(history);
    expect(replay.states.at(-1)).toEqual(game.getState());
    expect(replay.applied).toHaveLength(4);
  });

  it("rejects a history that leaves the rules", () => {
    expect(() => OwareGame.fromHistory([{ pit: 6 }])).toThrow(IllegalMoveError);
  });

  it("replays random legal games without losing a seed", () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let sample = 0; sample < 25; sample += 1) {
      const game = new OwareGame();
      const pits: number[] = [];
      for (let guard = 0; guard < 160 && !game.isGameOver(); guard += 1) {
        const moves = game.getLegalMoves();
        expect(moves.length).toBeGreaterThan(0);
        const pit = moves[Math.floor(random() * moves.length)]!;
        pits.push(pit);
        game.makeMove(pit);
        expect(seedTotal(game.getState())).toBe(TOTAL_SEEDS);
        expect(game.getState().board.every((n) => n >= 0)).toBe(true);
      }

      const rebuilt = OwareGame.fromHistory(pits.map((pit) => ({ pit })));
      expect(rebuilt.getState()).toEqual(game.getState());
      if (game.isGameOver()) {
        expect(rebuilt.getResult()).toEqual(game.getResult());
      }
    }
  });
});

describe("resign, draw, and timeout", () => {
  it("records resignation without touching the score", () => {
    const game = new OwareGame();
    game.makeMove(0);
    game.resign("player2");
    expect(game.getResult()).toMatchObject({
      outcome: "win",
      winner: "player1",
      score: captured(0, 0),
      endReason: "resignation",
    });
    expect(game.getState().board.reduce((sum, seeds) => sum + seeds, 0)).toBe(48);
  });

  it("records an agreed draw and a flag fall", () => {
    const draw = new OwareGame();
    draw.agreeDraw();
    expect(draw.getResult()?.outcome).toBe("draw");
    expect(draw.getResult()?.endReason).toBe("agreement");

    const flagged = new OwareGame();
    flagged.flag("player1");
    expect(flagged.getResult()).toMatchObject({
      winner: "player2",
      endReason: "timeout",
    });
    expect(() => flagged.agreeDraw()).toThrow(IllegalMoveError);
  });
});
