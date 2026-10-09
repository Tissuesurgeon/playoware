import type { AppliedMove, CapturedSeeds, Player } from "@/engine/oware";

export type MatchKind = "quick" | "friend";
export type MatchStatus = "waiting" | "active" | "completed" | "expired" | "abandoned";
export type Side = Player;

export interface MatchSnapshot {
  matchId: string;
  kind: MatchKind;
  status: MatchStatus;
  version: number;
  you: Side | null;
  player1Name: string;
  player2Name: string;
  board: number[];
  currentPlayer: Player;
  captured: CapturedSeeds;
  pits: number[];
  legalPits: number[];
  yourTurn: boolean;
  winner: Player | null;
  endReason: string | null;
  drawOffer: Side | null;
  player1Connected: boolean;
  player2Connected: boolean;
}

export type ClientMessage =
  | { type: "queue.join" }
  | { type: "queue.cancel" }
  | { type: "room.create" }
  | { type: "room.join"; token: string }
  | { type: "room.leave"; matchId: string }
  | { type: "match.resume"; matchId: string }
  | { type: "move"; matchId: string; pit: number; expectedVersion: number; clientMoveId: string }
  | { type: "resign"; matchId: string; expectedVersion: number; clientMoveId: string }
  | { type: "draw"; matchId: string; expectedVersion: number; clientMoveId: string };

export type ServerMessage =
  | { type: "queue"; status: "searching" | "cancelled"; matchId?: string }
  | { type: "matchFound"; matchId: string }
  | { type: "opponentJoined"; matchId: string }
  | { type: "snapshot"; snapshot: MatchSnapshot }
  | {
      type: "moveAccepted";
      matchId: string;
      version: number;
      ended: boolean;
      applied: AppliedMove;
      beforeBoard: number[];
      beforeCaptured: CapturedSeeds;
    }
  | { type: "moveRejected"; matchId: string; error: string }
  | { type: "presence"; matchId: string; player1Connected: boolean; player2Connected: boolean }
  | { type: "gameOver"; snapshot: MatchSnapshot }
  | { type: "inviteInvalid"; error: string }
  | { type: "error"; error: string };

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const message = value as { type?: unknown };
  return typeof message.type === "string";
}
