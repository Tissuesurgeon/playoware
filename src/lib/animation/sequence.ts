import { opponent, type AppliedMove, type CapturedSeeds, type Player } from "@/engine/oware";

export type AnimationEvent =
  | { type: "PICK_UP"; pit: number; seedCount: number }
  | { type: "MOVE_TO_PIT"; pit: number }
  | { type: "DROP_SEED"; pit: number; seedsInHand: number }
  | { type: "CAPTURE_PIT"; pit: number; seedCount: number; player: Player }
  | { type: "UPDATE_SCORE"; player: Player; amount: number }
  | { type: "FORFEIT_CAPTURE"; pits: number[] }
  | { type: "CHANGE_TURN"; player: Player }
  | { type: "GAME_OVER" };

export interface VisualFrame {
  board: number[];
  captured: CapturedSeeds;
  /** Houses captured during this animation, not the whole game. */
  houses: CapturedSeeds;
  hand: number;
  handPit: number | null;
  originPit: number | null;
  landedPit: number | null;
  capture: { pit: number; count: number; player: Player } | null;
  forfeitedPits: number[];
  actor: Player | null;
  gameOver: boolean;
}

export function buildMoveAnimation(
  beforeBoard: number[],
  applied: AppliedMove,
  ended: boolean,
): AnimationEvent[] {
  const events: AnimationEvent[] = [];
  let hand = 0;

  for (const step of applied.steps) {
    if (step.kind === "pickup") {
      hand = step.count;
      events.push({ type: "PICK_UP", pit: step.pit, seedCount: step.count });
      continue;
    }
    if (step.kind === "drop") {
      hand -= 1;
      events.push({ type: "MOVE_TO_PIT", pit: step.pit });
      events.push({ type: "DROP_SEED", pit: step.pit, seedsInHand: hand });
      continue;
    }
    events.push({ type: "CAPTURE_PIT", pit: step.pit, seedCount: step.count, player: step.player });
    events.push({ type: "UPDATE_SCORE", player: step.player, amount: step.count });
  }

  if (applied.grandSlam && applied.forfeitedPits.length > 0) {
    events.push({ type: "FORFEIT_CAPTURE", pits: applied.forfeitedPits });
  }
  if (ended) events.push({ type: "GAME_OVER" });
  else events.push({ type: "CHANGE_TURN", player: opponent(applied.move.player) });
  return events;
}

export function foldAnimation(
  beforeBoard: number[],
  beforeCaptured: CapturedSeeds,
  events: AnimationEvent[],
  through: number,
): VisualFrame {
  const board = beforeBoard.slice();
  const captured = { ...beforeCaptured };
  const houses = { player1: 0, player2: 0 };
  let hand = 0;
  let handPit: number | null = null;
  let originPit: number | null = null;
  let landedPit: number | null = null;
  let capture: VisualFrame["capture"] = null;
  let forfeitedPits: number[] = [];
  let actor: Player | null = null;
  let gameOver = false;
  const end = Math.min(through, events.length - 1);

  for (let index = 0; index <= end; index += 1) {
    const event = events[index];
    if (!event) break;
    landedPit = null;
    if (event.type !== "CAPTURE_PIT") capture = null;
    switch (event.type) {
      case "PICK_UP":
        board[event.pit] = 0;
        hand = event.seedCount;
        handPit = event.pit;
        originPit = event.pit;
        break;
      case "MOVE_TO_PIT":
        handPit = event.pit;
        break;
      case "DROP_SEED":
        board[event.pit] = (board[event.pit] ?? 0) + 1;
        hand = event.seedsInHand;
        landedPit = event.pit;
        break;
      case "CAPTURE_PIT":
        board[event.pit] = 0;
        capture = { pit: event.pit, count: event.seedCount, player: event.player };
        houses[event.player] += 1;
        break;
      case "UPDATE_SCORE":
        captured[event.player] += event.amount;
        break;
      case "FORFEIT_CAPTURE":
        forfeitedPits = event.pits;
        hand = 0;
        handPit = null;
        break;
      case "GAME_OVER":
        gameOver = true;
        hand = 0;
        handPit = null;
        break;
      case "CHANGE_TURN":
        hand = 0;
        handPit = null;
        actor = event.player;
        break;
      default:
        break;
    }
  }

  return { board, captured, houses, hand, handPit, originPit, landedPit, capture, forfeitedPits, actor, gameOver };
}
