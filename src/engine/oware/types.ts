export type Player = "player1" | "player2";

export type GameStatus = "in_progress" | "won" | "draw";

export type EndReason =
  | "majority"
  | "territory"
  | "starvation"
  | "repetition"
  | "resignation"
  | "agreement"
  | "timeout";

/** A move that can be replayed from the initial position. */
export interface Move {
  player: Player;
  /** Absolute pit index, 0–11. */
  pit: number;
  moveNumber: number;
}

export interface CapturedSeeds {
  player1: number;
  player2: number;
}

export interface GameState {
  board: number[];
  /** Owner of each pit. A player may own houses on both rows. */
  territory: Player[];
  round: number;
  /** Round openings already played, as territory plus the player who started. */
  openings: string[];
  currentPlayer: Player;
  capturedSeeds: CapturedSeeds;
  moveNumber: number;
  status: GameStatus;
  winner?: Player;
  endReason?: EndReason;
  moveHistory: Move[];
}

export interface GameResult {
  outcome: "win" | "draw";
  winner?: Player;
  score: CapturedSeeds;
  endReason: EndReason;
}

export type SowStep =
  | { kind: "pickup"; pit: number; count: number }
  | { kind: "drop"; pit: number }
  | { kind: "harvest"; pit: number; player: Player; count: number };

/** Derived facts about a move. Replay can compute these again. */
export interface AppliedMove {
  move: Move;
  sowPath: number[];
  capturedPits: number[];
  forfeitedPits: number[];
  seedsCaptured: number;
  grandSlam: boolean;
  steps: SowStep[];
}

export interface GameConfig {
  board?: number[];
  territory?: Player[];
  round?: number;
  openings?: string[];
  currentPlayer?: Player;
  capturedSeeds?: CapturedSeeds;
  moveNumber?: number;
  moveHistory?: Move[];
  /**
   * Position keys already seen on earlier turns, including the current
   * position when `alreadyResolved` is set.
   */
  seen?: string[];
  status?: GameStatus;
  winner?: Player;
  endReason?: EndReason;
  /** Skip terminal checks. Used when copying a live game. */
  alreadyResolved?: boolean;
}
