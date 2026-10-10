import {
  OwareGame,
  type EndReason,
  type GameState,
  type Move,
  type Player,
} from "@/engine/oware";
import { evaluate, type Difficulty } from "@/lib/ai";

export const INITIAL_CLOCK_MS = 5 * 60 * 1000;

export type GameMode = "local" | "ai";

/** Stored computer games can be resumed. A same-device human snapshot cannot. */
export function canResumeStoredGame(mode: string) {
  return mode === "ai";
}

export interface EndCommand {
  type: "resign" | "draw" | "timeout";
  player?: Player;
}

export interface SessionOptions {
  id: string;
  mode: GameMode;
  player1Name: string;
  player2Name: string;
  aiDifficulty?: Difficulty;
  aiSeed?: number;
  initialMs?: number;
  now?: number;
  moves?: Move[];
  /** A mid-game rules position. Product games leave this empty and replay moves. */
  position?: {
    board: number[];
    capturedSeeds: { player1: number; player2: number };
    currentPlayer?: Player;
  };
  clocks?: { player1: number; player2: number };
  drawOffer?: Player | null;
  endCommand?: EndCommand | null;
  startedAt?: string;
  serverId?: string;
  running?: boolean;
  updatedAt?: number;
}

export interface SessionSnapshot {
  id: string;
  mode: GameMode;
  player1Name: string;
  player2Name: string;
  aiDifficulty?: Difficulty;
  aiSeed: number;
  moves: Move[];
  clocks: { player1: number; player2: number };
  drawOffer: Player | null;
  endCommand: EndCommand | null;
  startedAt: string;
  serverId?: string;
  running: boolean;
  updatedAt: number;
}

export class LocalGameSession {
  readonly id: string;
  readonly mode: GameMode;
  readonly player1Name: string;
  readonly player2Name: string;
  readonly aiDifficulty?: Difficulty;
  readonly aiSeed: number;
  readonly startedAt: string;
  serverId?: string;

  private game: OwareGame;
  private remaining: { player1: number; player2: number };
  private updatedAt: number;
  private running: boolean;
  private drawOffer: Player | null;
  private endCommand: EndCommand | null;

  constructor(options: SessionOptions) {
    this.id = options.id;
    this.mode = options.mode;
    this.player1Name = options.player1Name;
    this.player2Name = options.player2Name;
    this.aiDifficulty = options.aiDifficulty;
    this.aiSeed = options.aiSeed ?? 1;
    this.startedAt = options.startedAt ?? new Date().toISOString();
    this.serverId = options.serverId;
    this.game = options.position
      ? new OwareGame({
          board: options.position.board,
          capturedSeeds: options.position.capturedSeeds,
          currentPlayer: options.position.currentPlayer,
        })
      : OwareGame.fromHistory(options.moves ?? []);
    this.endCommand = options.endCommand ?? null;
    if (!this.game.isGameOver() && this.endCommand) {
      this.applyEnd(this.endCommand);
    }
    const initial = options.initialMs ?? INITIAL_CLOCK_MS;
    this.remaining = options.clocks ?? { player1: initial, player2: initial };
    this.updatedAt = options.updatedAt ?? options.now ?? Date.now();
    this.running = this.game.isGameOver() ? false : (options.running ?? true);
    this.drawOffer = this.game.isGameOver() ? null : (options.drawOffer ?? null);
  }

  static fromSnapshot(snapshot: SessionSnapshot, now = Date.now()): LocalGameSession {
    return new LocalGameSession({
      ...snapshot,
      now,
    });
  }

  getState(): GameState {
    return this.game.getState();
  }

  getLegalMoves(): number[] {
    return this.game.getLegalMoves();
  }

  getClock(now: number): { player1: number; player2: number } {
    this.charge(now);
    return { ...this.remaining };
  }

  /** Display time without committing it. Rendering can call this safely. */
  previewClock(now: number): { player1: number; player2: number } {
    const clocks = { ...this.remaining };
    if (!this.running || this.game.isGameOver()) return clocks;
    const elapsed = now - this.updatedAt;
    if (elapsed <= 0) return clocks;
    const player = this.game.getState().currentPlayer;
    clocks[player] = Math.max(0, clocks[player] - elapsed);
    return clocks;
  }

  tick(now: number): void {
    this.charge(now);
  }

  pause(now: number): void {
    this.charge(now);
    this.running = false;
  }

  resume(now: number): void {
    if (this.game.isGameOver()) return;
    this.updatedAt = now;
    this.running = true;
  }

  submitMove(pit: number, now: number) {
    this.charge(now);
    if (this.drawOffer) this.drawOffer = null;
    const applied = this.game.makeMove(pit);
    this.running = false;
    this.updatedAt = now;
    return applied;
  }

  finishAnimation(now: number): void {
    this.resume(now);
  }

  resign(player: Player, now: number): void {
    this.charge(now);
    this.endCommand = { type: "resign", player };
    this.game.resign(player);
    this.stop(now);
  }

  offerDraw(by: Player, now: number): "pending" | "accepted" | "declined" {
    this.charge(now);
    if (this.game.isGameOver()) {
      throw new Error("The game is already over.");
    }
    if (this.mode === "ai") {
      const score = evaluate(this.game.getState(), "player2");
      if (score <= 0) {
        this.endCommand = { type: "draw" };
        this.game.agreeDraw();
        this.stop(now);
        return "accepted";
      }
      return "declined";
    }
    this.drawOffer = by;
    return "pending";
  }

  respondDraw(by: Player, accept: boolean, now: number): void {
    if (!this.drawOffer || this.drawOffer === by) {
      throw new Error("There is no draw offer to answer.");
    }
    if (accept) {
      this.endCommand = { type: "draw" };
      this.game.agreeDraw();
      this.stop(now);
      return;
    }
    this.drawOffer = null;
  }

  cancelDraw(): void {
    this.drawOffer = null;
  }

  snapshot(): SessionSnapshot {
    return {
      id: this.id,
      mode: this.mode,
      player1Name: this.player1Name,
      player2Name: this.player2Name,
      aiDifficulty: this.aiDifficulty,
      aiSeed: this.aiSeed,
      moves: this.game.getMoveHistory(),
      clocks: { ...this.remaining },
      drawOffer: this.drawOffer,
      endCommand: this.endCommand,
      startedAt: this.startedAt,
      serverId: this.serverId,
      running: this.running && !this.game.isGameOver(),
      updatedAt: this.updatedAt,
    };
  }

  private charge(now: number): void {
    if (!this.running || this.game.isGameOver()) {
      this.updatedAt = now;
      return;
    }
    const elapsed = now - this.updatedAt;
    this.updatedAt = now;
    if (elapsed <= 0) return;
    const player = this.game.getState().currentPlayer;
    this.remaining[player] = Math.max(0, this.remaining[player] - elapsed);
  }

  private applyEnd(command: EndCommand): void {
    if (command.type === "resign" && command.player) this.game.resign(command.player);
    if (command.type === "draw") this.game.agreeDraw();
    if (command.type === "timeout" && command.player) this.game.flag(command.player);
  }

  private stop(now: number): void {
    this.running = false;
    this.drawOffer = null;
    this.updatedAt = now;
  }
}

export function endReasonOf(command: EndCommand | null): EndReason | undefined {
  if (!command) return undefined;
  if (command.type === "resign") return "resignation";
  if (command.type === "draw") return "agreement";
  return "timeout";
}
