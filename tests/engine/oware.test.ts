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

    const won = new OwareGame();
    won.resign("player1");
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
    const game = gameFrom([0, 3, 3, 0, 0, 0, 4, 4, 4, 4, 4, 4], "player1", captured(9, 9));
    const applied = game.makeMove(1);
    expect(applied.capturedPits).toEqual([2]);
    expect(applied.seedsCaptured).toBe(4);
    expect(applied.sowPath).toEqual([2, 3, 4]);
    expect(game.getState().board).toEqual([0, 0, 0, 1, 1, 0, 4, 4, 4, 4, 4, 4]);
    expect(game.getState().capturedSeeds).toEqual(captured(13, 9));
    expect(game.isGameOver()).toBe(false);
  });

  it("lets the opponent capture a four made in the middle of the sow", () => {
    const game = gameFrom([0, 6, 4, 4, 4, 4, 3, 0, 4, 4, 4, 4], "player1", captured(4, 3));
    const applied = game.makeMove(1);
    expect(applied.seedsCaptured).toBe(0);
    expect(applied.steps).toContainEqual({ kind: "harvest", pit: 6, player: "player2", count: 4 });
    expect(game.getState().capturedSeeds.player2).toBe(7);
    expect(game.getState().board[6]).toBe(0);
    expect(game.getState().board[7]).toBe(1);
    expect(game.isGameOver()).toBe(false);
  });

  it("captures four on the opponent's side when the last seed makes them", () => {
    const game = gameFrom([0, 5, 4, 4, 4, 4, 3, 1, 4, 4, 4, 0], "player1", captured(6, 5));
    const applied = game.makeMove(1);
    expect(applied.capturedPits).toEqual([6]);
    expect(applied.seedsCaptured).toBe(4);
    expect(game.getState().board[6]).toBe(0);
    expect(game.getState().capturedSeeds).toEqual(captured(10, 5));
    expect(game.isGameOver()).toBe(false);
  });
});

describe("feeding and starvation", () => {
  it("starts another round when the player to move cannot feed", () => {
    const game = gameFrom([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "player1", captured(22, 23));
    expect(game.isGameOver()).toBe(false);
    expect(game.getState().round).toBe(2);
    expect(game.getState().currentPlayer).toBe("player2");
    expect(game.getState().board).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    expect(game.getState().territory.filter((owner) => owner === "player1")).toHaveLength(6);
  });

  it("sets the board up again when the side to move has no seeds", () => {
    const game = gameFrom([0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0], "player1", captured(22, 22));
    expect(game.isGameOver()).toBe(false);
    expect(game.getState().round).toBe(2);
    expect(game.getState().board.every((seeds) => seeds === 4)).toBe(true);
  });

  it("requires a feed, then starts another round if the opponent cannot give seeds back", () => {
    const game = gameFrom([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], "player1", captured(23, 24));
    expect(game.getLegalMoves()).toEqual([5]);
    game.makeMove(5);
    expect(game.isGameOver()).toBe(false);
    expect(game.getState().round).toBe(2);
    expect(game.getState().currentPlayer).toBe("player2");
  });
});

describe("game end and scoring", () => {
  it("does not end the match when a capture passes 25 seeds", () => {
    const game = gameFrom([0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0], "player1", captured(21, 22));
    game.makeMove(4);
    expect(game.isGameOver()).toBe(false);
    expect(game.getState().round).toBe(2);
    expect(game.getState().board.every((seeds) => seeds === 4)).toBe(true);
  });

  it("keeps playing after a round that captures one to four houses", () => {
    for (const extra of [1, 2, 3, 4]) {
      const player1 = 23 + extra * 4;
      const game = gameFrom([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "player1", captured(player1, 48 - 1 - player1));
      expect(game.isGameOver()).toBe(false);
      expect(game.getState().round).toBe(2);
      expect(game.getState().currentPlayer).toBe("player2");
      expect(game.getState().board.every((seeds) => seeds === 4)).toBe(true);
      expect(game.getState().territory.filter((owner) => owner === "player1")).toHaveLength(6 + extra);
    }
  });

  it("lets a player with two houses choose either of them", () => {
    const territory = Array.from({ length: 12 }, (_, pit) => (pit < 2 ? "player1" : "player2")) as Array<
      "player1" | "player2"
    >;
    const game = new OwareGame({
      territory,
      currentPlayer: "player1",
      alreadyResolved: true,
    });
    expect(game.isGameOver()).toBe(false);
    expect(game.getLegalMoves()).toEqual([0, 1]);
    expect(() => game.makeMove(1)).not.toThrow();
  });

  it("ends when a player has only one house", () => {
    const territory = Array.from({ length: 12 }, (_, pit) => (pit === 11 ? "player2" : "player1")) as Array<
      "player1" | "player2"
    >;
    const game = new OwareGame({
      board: [3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      territory,
      currentPlayer: "player1",
      capturedSeeds: captured(41, 0),
    });
    expect(game.getResult()).toMatchObject({
      outcome: "win",
      winner: "player1",
      endReason: "territory",
    });
    expect(game.getState().territory.filter((owner) => owner === "player2")).toHaveLength(1);
    expect(game.getLegalMoves()).toEqual([]);
  });

  it("ends the match when a round leaves a player with one house", () => {
    const player1 = 23 + 5 * 4;
    const game = gameFrom([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "player1", captured(player1, 48 - 1 - player1));
    expect(game.getResult()).toMatchObject({
      outcome: "win",
      winner: "player1",
      endReason: "territory",
    });
    expect(game.getState().territory.filter((owner) => owner === "player2")).toHaveLength(1);
  });

  it("does not end when each player has captured two houses", () => {
    const game = OwareGame.fromHistory([{ pit: 1 }, { pit: 11 }, { pit: 4 }]);
    expect(game.isGameOver()).toBe(false);
    const capturedSeeds = game.getState().capturedSeeds;
    expect(capturedSeeds.player1).toBeLessThan(25);
    expect(capturedSeeds.player2).toBeLessThan(25);
    expect(housesCaptured(replayGame([{ pit: 1 }, { pit: 11 }, { pit: 4 }]).applied)).toEqual({
      player1: 2,
      player2: 2,
    });
  });

  it("continues when a player has exactly 24", () => {
    const game = gameFrom([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], "player1", captured(24, 22));
    game.makeMove(0);
    expect(game.isGameOver()).toBe(false);
    expect(game.getState().capturedSeeds.player1).toBe(24);
    expect(game.getState().board[1]).toBe(1);
  });

  it("keeps the same houses and replays after a 24–24 round", () => {
    const board = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2];
    const scores = captured(22, 22);
    const game = gameFrom(board, "player1", scores, [positionKey(board, "player1", scores)]);
    expect(game.isGameOver()).toBe(false);
    expect(game.getState().round).toBe(2);
    expect(game.getState().currentPlayer).toBe("player2");
    expect(game.getState().territory.filter((owner) => owner === "player1")).toHaveLength(6);
    expect(game.getState().board.every((seeds) => seeds === 4)).toBe(true);
  });

  it("starts another round when that opening was already played", () => {
    const board = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2];
    const scores = captured(22, 22);
    const same = "player1,player1,player1,player1,player1,player1,player2,player2,player2,player2,player2,player2";
    const game = new OwareGame({
      board,
      currentPlayer: "player1",
      capturedSeeds: scores,
      seen: [positionKey(board, "player1", scores)],
      openings: [`${same}|player1`, `${same}|player2`],
    });
    expect(game.isGameOver()).toBe(false);
    expect(game.getState().round).toBe(2);
    expect(game.getState().currentPlayer).toBe("player2");
    expect(game.getState().board.every((seeds) => seeds === 4)).toBe(true);
  });

  it("ends a repeated position by starting the next round", () => {
    const board = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2];
    const scores = captured(22, 23);
    const key = positionKey(board, "player1", scores);
    const game = gameFrom(board, "player1", scores, [key]);
    expect(game.isGameOver()).toBe(false);
    expect(game.getState().round).toBe(2);
    expect(game.getState().board.every((seeds) => seeds === 4)).toBe(true);
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
    expect(formatMove({ player: "player1", pit: 11, moveNumber: 4 })).toBe("4. Far pit 6");
    expect(formatMove({ player: "player2", pit: 0, moveNumber: 2 }, 4, 1)).toBe("2. Far pit 1 (+4 seeds, 1 house)");
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
