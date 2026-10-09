import {
  OwareGame,
  initialTerritory,
  opponent,
  ownedPits,
  territorySeedCount,
  type GameState,
  type Move,
  type Player,
} from "@/engine/oware";

export type Difficulty = "beginner" | "easy" | "medium" | "hard";

export interface OwareAI {
  chooseMove(state: GameState): Move;
}

export interface RankedMove {
  pit: number;
  value: number;
  seedsCaptured: number;
}

const DEPTH: Record<Difficulty, number> = {
  beginner: 1,
  easy: 2,
  medium: 4,
  hard: 7,
};

export function evaluate(state: GameState, perspective: Player): number {
  const territory = state.territory ?? initialTerritory();
  const mine = territory.filter((owner) => owner === perspective).length;
  const theirs = territory.length - mine;
  const me = state.capturedSeeds[perspective];
  const them = state.capturedSeeds[opponent(perspective)];
  const houses = mine - theirs;
  const diff = me - them;

  if (state.status === "won") {
    return state.winner === perspective ? 100_000 + houses : -100_000 + houses;
  }
  if (state.status === "draw") return 0;

  let score = houses * 500 + diff * 40;
  const other = opponent(perspective);
  score += (territorySeedCount(state.board, territory, perspective) - territorySeedCount(state.board, territory, other)) * 2;
  for (const pit of ownedPits(territory, other)) {
    if ((state.board[pit] ?? 0) === 3) score += 6;
  }
  for (const pit of ownedPits(territory, perspective)) {
    if ((state.board[pit] ?? 0) === 3) score += 3;
  }
  return score;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function orderedPits(game: OwareGame): number[] {
  const board = game.getState().board;
  return game.getLegalMoves().slice().sort((a, b) => board[b]! - board[a]! || a - b);
}

function minimax(
  game: OwareGame,
  depth: number,
  alpha: number,
  beta: number,
  perspective: Player,
): number {
  const state = game.getState();
  if (depth === 0 || state.status !== "in_progress") return evaluate(state, perspective);

  const moves = orderedPits(game);
  const maximizing = state.currentPlayer === perspective;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (const pit of moves) {
    const child = game.clone({ trackHistory: false });
    child.makeMove(pit);
    const score = minimax(child, depth - 1, alpha, beta, perspective);
    if (maximizing) {
      if (score > best) best = score;
      if (score > alpha) alpha = score;
    } else {
      if (score < best) best = score;
      if (score < beta) beta = score;
    }
    if (alpha >= beta) break;
  }

  return best;
}

/** Rank legal moves for the side to move. Depth is the full search depth. */
export function rankMoves(state: GameState, depth: number): RankedMove[] {
  const game = OwareGame.fromState(state);
  if (game.isGameOver()) return [];
  const perspective = state.currentPlayer;
  const ranked = orderedPits(game).map((pit) => {
    const child = game.clone({ trackHistory: false });
    const applied = child.makeMove(pit);
    const value =
      depth <= 1
        ? evaluate(child.getState(), perspective)
        : minimax(child, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, perspective);
    return { pit, value, seedsCaptured: applied.seedsCaptured };
  });
  ranked.sort((a, b) => b.value - a.value || a.pit - b.pit);
  return ranked;
}

function bestPit(game: OwareGame, depth: number): number {
  const perspective = game.getState().currentPlayer;
  const moves = orderedPits(game);
  if (moves.length === 0) throw new Error("The AI has no legal move.");
  let pit = moves[0]!;
  let best = Number.NEGATIVE_INFINITY;
  let alpha = Number.NEGATIVE_INFINITY;
  const beta = Number.POSITIVE_INFINITY;

  for (const candidate of moves) {
    const child = game.clone({ trackHistory: false });
    child.makeMove(candidate);
    const score =
      depth <= 1
        ? evaluate(child.getState(), perspective)
        : minimax(child, depth - 1, alpha, beta, perspective);
    if (score > best || (score === best && candidate < pit)) {
      best = score;
      pit = candidate;
    }
    if (score > alpha) alpha = score;
  }

  return pit;
}

export function chooseMove(state: GameState, difficulty: Difficulty, seed = 1): Move {
  const game = OwareGame.fromState(state);
  if (game.isGameOver()) throw new Error("The AI cannot move in a finished game.");

  let pit: number;
  if (difficulty === "medium" || difficulty === "hard") {
    pit = bestPit(game, DEPTH[difficulty]);
  } else {
    const ranked = rankMoves(state, DEPTH[difficulty]);
    if (ranked.length === 0) throw new Error("The AI has no legal move.");
    pit = ranked[0]!.pit;
    const random = mulberry32(seed);
    const legal = ranked.map((entry) => entry.pit);
    if (difficulty === "beginner" && random() < 0.35) {
      pit = legal[Math.floor(random() * legal.length)]!;
    } else {
      const window = difficulty === "beginner" ? 80 : 30;
      const best = ranked[0]!.value;
      const band = ranked.filter((entry) => best - entry.value <= window);
      pit = band[Math.floor(random() * band.length)]!.pit;
    }
  }

  return {
    player: state.currentPlayer,
    pit,
    moveNumber: state.moveNumber + 1,
  };
}

export function createOwareAI(difficulty: Difficulty, seed = 1): OwareAI {
  return {
    chooseMove(state) {
      return chooseMove(state, difficulty, seed);
    },
  };
}

export const DIFFICULTIES: Array<{ id: Difficulty; label: string; blurb: string }> = [
  {
    id: "beginner",
    label: "Beginner",
    blurb: "Sees the next capture, and sometimes plays something else.",
  },
  {
    id: "easy",
    label: "Easy",
    blurb: "Looks a little further, with a small amount of uncertainty.",
  },
  {
    id: "medium",
    label: "Medium",
    blurb: "Searches several moves and always plays the same position the same way.",
  },
  {
    id: "hard",
    label: "Hard",
    blurb: "The deepest search. Deterministic, and the strongest opponent here.",
  },
];
