import type { MatchKind } from "@/realtime/protocol";
import type { Player } from "@/engine/oware";

/** Whose bar is active. During a sow this is the player on the committed move. */
export function barState(input: {
  side: Player;
  you: Player;
  sower: Player | null;
  yourTurn: boolean;
  over: boolean;
  waiting: boolean;
}): { active: boolean; status?: string } {
  if (input.waiting) {
    return { active: false, status: input.side === input.you ? "You're seated" : undefined };
  }
  if (input.sower) {
    const sowing = input.sower === input.side;
    return { active: sowing && !input.over, status: sowing ? "Sowing" : undefined };
  }
  if (input.over) return { active: false };
  const mine = input.side === input.you;
  const active = mine ? input.yourTurn : input.yourTurn === false;
  return { active, status: mine && input.yourTurn ? "Your turn" : undefined };
}

export function rematchPath(kind: MatchKind) {
  return kind === "friend" ? "/play/friend" : "/play/queue";
}
