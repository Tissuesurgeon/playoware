import { sow } from "./Board";
import {
  TOTAL_SEEDS,
  WIN_SCORE,
  initialBoard,
  opponent,
  sidePits,
  sideSeedCount,
} from "./Player";
import { illegalMoveReason, legalMoves } from "./Rules";
import type {
  AppliedMove,
  CapturedSeeds,
  EndReason,
  GameConfig,
  GameResult,
  GameState,
  GameStatus,
  Move,
  Player,
} from "./types";

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalMoveError";
  }
}

export function positionKey(
  board: number[],
  player: Player,
  captured: CapturedSeeds,
): string {
  return `${board.join(",")}|${player}|${captured.player1}|${captured.player2}`;
}

/**
 * Pure Oware game. `getState()` is a copy. Illegal moves throw and
 * leave the position unchanged.
 */
export class OwareGame {
  private board: number[];
  private currentPlayer: Player;
  private captured: CapturedSeeds;
  private moveNumber: number;
  private history: Move[];
  private seen: Set<string>;
  private status: GameStatus;
  private winner?: Player;
  private endReason?: EndReason;

  constructor(config: GameConfig = {}) {
    this.board = config.board ? config.board.slice() : initialBoard();
    this.currentPlayer = config.currentPlayer ?? "player1";
    this.captured = {
      player1: config.capturedSeeds?.player1 ?? 0,
      player2: config.capturedSeeds?.player2 ?? 0,
    };
    this.moveNumber = config.moveNumber ?? 0;
    this.history = (config.moveHistory ?? []).map((move) => ({ ...move }));
    this.seen = new Set(config.seen ?? []);
    this.status = config.status ?? "in_progress";
    this.winner = config.winner;
    this.endReason = config.endReason;
    this.assertSeeds();

    if (this.status === "in_progress" && !config.alreadyResolved) {
      this.resolvePosition();
    }
  }

  static fromHistory(moves: Array<Pick<Move, "pit">>): OwareGame {
    const game = new OwareGame();
    for (const move of moves) {
      game.makeMove(move.pit);
    }
    return game;
  }

  static fromState(state: GameState, seen: string[] = []): OwareGame {
    return new OwareGame({
      board: state.board,
      currentPlayer: state.currentPlayer,
      capturedSeeds: state.capturedSeeds,
      moveNumber: state.moveNumber,
      moveHistory: state.moveHistory,
      seen,
      status: state.status,
      winner: state.winner,
      endReason: state.endReason,
      alreadyResolved: state.status !== "in_progress",
    });
  }

  clone(options?: { trackHistory?: boolean }): OwareGame {
    return new OwareGame({
      board: this.board,
      currentPlayer: this.currentPlayer,
      capturedSeeds: this.captured,
      moveNumber: this.moveNumber,
      moveHistory: options?.trackHistory === false ? [] : this.history,
      seen: [...this.seen],
      status: this.status,
      winner: this.winner,
      endReason: this.endReason,
      alreadyResolved: true,
    });
  }

  getState(): GameState {
    return {
      board: this.board.slice(),
      currentPlayer: this.currentPlayer,
      capturedSeeds: { ...this.captured },
      moveNumber: this.moveNumber,
      status: this.status,
      winner: this.winner,
      endReason: this.endReason,
      moveHistory: this.history.map((move) => ({ ...move })),
    };
  }

  getLegalMoves(): number[] {
    if (this.status !== "in_progress") return [];
    return legalMoves(this.board, this.currentPlayer);
  }

  makeMove(pitIndex: number): AppliedMove {
    if (this.status !== "in_progress") {
      throw new IllegalMoveError("The game is already over.");
    }
    const reason = illegalMoveReason(this.board, this.currentPlayer, pitIndex);
    if (reason) throw new IllegalMoveError(reason);

    const player = this.currentPlayer;
    const sown = sow(this.board, pitIndex, player);
    this.board = sown.board;
    let seedsCaptured = 0;
    const capturedPits: number[] = [];
    for (const harvest of sown.harvests) {
      this.captured = {
        ...this.captured,
        [harvest.player]: this.captured[harvest.player] + harvest.count,
      };
      if (harvest.player === player) {
        seedsCaptured += harvest.count;
        capturedPits.push(harvest.pit);
      }
    }
    this.moveNumber += 1;
    const move: Move = { player, pit: pitIndex, moveNumber: this.moveNumber };
    this.history = [...this.history, move];

    const applied: AppliedMove = {
      move,
      sowPath: sown.path,
      capturedPits,
      forfeitedPits: [],
      seedsCaptured,
      grandSlam: false,
      steps: sown.steps,
    };

    const { player1, player2 } = this.captured;
    if (player1 >= WIN_SCORE || player2 >= WIN_SCORE) {
      if (player1 === player2) this.finish("draw", undefined, "majority");
      else this.finish("won", player1 > player2 ? "player1" : "player2", "majority");
    } else {
      this.currentPlayer = opponent(player);
      this.enterTurn();
    }

    this.assertSeeds();
    return applied;
  }

  isGameOver(): boolean {
    return this.status !== "in_progress";
  }

  getResult(): GameResult | null {
    if (this.status === "in_progress" || !this.endReason) return null;
    return {
      outcome: this.status === "draw" ? "draw" : "win",
      winner: this.winner,
      score: { ...this.captured },
      endReason: this.endReason,
    };
  }

  getMoveHistory(): Move[] {
    return this.history.map((move) => ({ ...move }));
  }

  resign(player: Player): void {
    this.requireInProgress();
    this.finish("won", opponent(player), "resignation");
  }

  agreeDraw(): void {
    this.requireInProgress();
    this.finish("draw", undefined, "agreement");
  }

  flag(player: Player): void {
    this.requireInProgress();
    this.finish("won", opponent(player), "timeout");
  }

  private resolvePosition(): void {
    const { player1, player2 } = this.captured;
    if (player1 >= WIN_SCORE || player2 >= WIN_SCORE) {
      if (player1 === player2) this.finish("draw", undefined, "majority");
      else this.finish("won", player1 > player2 ? "player1" : "player2", "majority");
      return;
    }
    this.enterTurn();
  }

  private enterTurn(): void {
    if (this.status !== "in_progress") return;
    const key = positionKey(this.board, this.currentPlayer, this.captured);
    if (this.seen.has(key)) {
      this.awardSide("player1");
      this.awardSide("player2");
      this.finishByScore("repetition");
      return;
    }
    if (legalMoves(this.board, this.currentPlayer).length === 0) {
      this.endStarvation();
      return;
    }
    this.seen.add(key);
  }

  private endStarvation(): void {
    const mover = this.currentPlayer;
    const other = opponent(mover);
    if (sideSeedCount(this.board, other) === 0) {
      this.awardSide(mover);
    } else {
      this.awardSide(other);
    }
    this.finishByScore("starvation");
  }

  private awardSide(player: Player): void {
    const seeds = sideSeedCount(this.board, player);
    if (seeds === 0) return;
    this.captured = { ...this.captured, [player]: this.captured[player] + seeds };
    const board = this.board.slice();
    for (const pit of sidePits(player)) board[pit] = 0;
    this.board = board;
  }

  private finishByScore(reason: EndReason): void {
    const { player1, player2 } = this.captured;
    if (player1 === player2) this.finish("draw", undefined, reason);
    else this.finish("won", player1 > player2 ? "player1" : "player2", reason);
  }

  private finish(status: GameStatus, winner: Player | undefined, reason: EndReason): void {
    this.status = status;
    this.winner = winner;
    this.endReason = reason;
  }

  private requireInProgress(): void {
    if (this.status !== "in_progress") {
      throw new IllegalMoveError("The game is already over.");
    }
  }

  private assertSeeds(): void {
    const onBoard = this.board.reduce((sum, seeds) => sum + seeds, 0);
    const total = onBoard + this.captured.player1 + this.captured.player2;
    if (this.board.length !== 12) {
      throw new Error("Board must have 12 pits.");
    }
    if (this.board.some((seeds) => !Number.isInteger(seeds) || seeds < 0)) {
      throw new Error("Pits must hold non-negative whole seeds.");
    }
    if (this.captured.player1 < 0 || this.captured.player2 < 0) {
      throw new Error("Captured seeds cannot be negative.");
    }
    if (total !== TOTAL_SEEDS) {
      throw new Error(`Seed count is ${total}, expected ${TOTAL_SEEDS}.`);
    }
  }
}

export function replayGame(moves: Array<Pick<Move, "pit">>): {
  states: GameState[];
  applied: AppliedMove[];
} {
  const game = new OwareGame();
  const states = [game.getState()];
  const applied: AppliedMove[] = [];
  for (const move of moves) {
    applied.push(game.makeMove(move.pit));
    states.push(game.getState());
  }
  return { states, applied };
}
