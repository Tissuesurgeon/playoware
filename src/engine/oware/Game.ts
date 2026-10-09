import { sow } from "./Board";
import {
  PIT_COUNT,
  TOTAL_SEEDS,
  initialBoard,
  initialTerritory,
  nextTerritory,
  openingKey,
  opponent,
  ownedPits,
  roundStarter,
  territorySeedCount,
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
  territory: readonly Player[] = initialTerritory(),
): string {
  return `${board.join(",")}|${player}|${captured.player1}|${captured.player2}|${territory.join(",")}`;
}

/**
 * Pure Oware game. `getState()` is a copy. Illegal moves throw and
 * leave the position unchanged.
 */
export class OwareGame {
  private board: number[];
  private territory: Player[];
  private round: number;
  private openings: Set<string>;
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
    this.territory = config.territory ? config.territory.slice() : initialTerritory();
    this.round = config.round ?? 1;
    this.openings = new Set(config.openings ?? []);
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
      if (this.openings.size === 0) this.openings.add(openingKey(this.territory, roundStarter(this.round)));
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
      territory: state.territory,
      round: state.round,
      openings: state.openings,
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
      territory: this.territory,
      round: this.round,
      openings: [...this.openings],
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
      territory: this.territory.slice(),
      round: this.round,
      openings: [...this.openings],
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
    return legalMoves(this.board, this.currentPlayer, this.territory);
  }

  makeMove(pitIndex: number): AppliedMove {
    if (this.status !== "in_progress") {
      throw new IllegalMoveError("The game is already over.");
    }
    const reason = illegalMoveReason(this.board, this.currentPlayer, pitIndex, this.territory);
    if (reason) throw new IllegalMoveError(reason);

    const player = this.currentPlayer;
    const sown = sow(this.board, pitIndex, player, this.territory);
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

    this.board = sown.board;
    if (sown.roundClaim) {
      this.claimRemainder(sown.roundClaim.player, sown.roundClaim.unplaced);
      this.endRound();
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
    this.enterTurn();
  }

  private enterTurn(): void {
    if (this.status !== "in_progress") return;
    const key = positionKey(this.board, this.currentPlayer, this.captured, this.territory);
    if (this.seen.has(key)) {
      this.awardTerritory("player1");
      this.awardTerritory("player2");
      this.endRound();
      return;
    }
    if (legalMoves(this.board, this.currentPlayer, this.territory).length === 0) {
      this.awardTerritory("player1");
      this.awardTerritory("player2");
      this.endRound();
      return;
    }
    this.seen.add(key);
  }

  private claimRemainder(player: Player, unplaced: number): void {
    const left = this.board.reduce((sum, seeds) => sum + seeds, 0) + unplaced;
    if (left > 0) this.captured = { ...this.captured, [player]: this.captured[player] + left };
    this.board = Array.from({ length: PIT_COUNT }, () => 0);
  }

  private awardTerritory(player: Player): void {
    const seeds = territorySeedCount(this.board, this.territory, player);
    if (seeds === 0) return;
    this.captured = { ...this.captured, [player]: this.captured[player] + seeds };
    const board = this.board.slice();
    for (const pit of ownedPits(this.territory, player)) board[pit] = 0;
    this.board = board;
  }

  private endRound(): void {
    const territory = nextTerritory(this.territory, this.captured);
    const round = this.round + 1;
    const starter = roundStarter(round);
    const key = openingKey(territory, starter);
    const south = ownedPits(territory, "player1").length;
    const north = ownedPits(territory, "player2").length;
    if (south === 0 || north === 0) {
      this.territory = territory;
      this.finish("won", south === 0 ? "player2" : "player1", "territory");
      return;
    }
    this.openings.add(key);
    this.territory = territory;
    this.board = initialBoard();
    this.captured = { player1: 0, player2: 0 };
    this.currentPlayer = starter;
    this.round = round;
    this.seen = new Set([positionKey(this.board, starter, this.captured, territory)]);
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
