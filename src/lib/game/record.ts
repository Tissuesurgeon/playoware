import { IllegalMoveError, OwareGame, type EndReason, type GameResult, type Player } from "@/engine/oware";
import type { EndCommand } from "@/lib/game/session";

export class InvalidGameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGameError";
  }
}

export function concludeGame(moves: Array<{ pit: number }>, endCommand: EndCommand | null) {
  const game = new OwareGame();
  try {
    for (const move of moves) {
      if (!Number.isInteger(move?.pit)) throw new InvalidGameError("A move is missing its pit.");
      game.makeMove(move.pit);
    }
    if (!game.isGameOver()) {
      if (!endCommand) throw new InvalidGameError("The game is not over.");
      applyEnd(game, endCommand);
    }
  } catch (error) {
    if (error instanceof InvalidGameError) throw error;
    if (error instanceof IllegalMoveError) throw new InvalidGameError(error.message);
    throw error;
  }

  const result = game.getResult();
  if (!result) throw new InvalidGameError("The game is not over.");
  return { state: game.getState(), result };
}

function applyEnd(game: OwareGame, command: EndCommand) {
  if (command.type === "resign" && isPlayer(command.player)) {
    game.resign(command.player);
    return;
  }
  if (command.type === "draw") {
    game.agreeDraw();
    return;
  }
  if (command.type === "timeout" && isPlayer(command.player)) {
    game.flag(command.player);
    return;
  }
  throw new InvalidGameError("The game is not over.");
}

function isPlayer(value: unknown): value is Player {
  return value === "player1" || value === "player2";
}

export function resultSummary(result: GameResult): { winner: Player | null; endReason: EndReason } {
  return { winner: result.winner ?? null, endReason: result.endReason };
}
