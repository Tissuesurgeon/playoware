import type { AnimationEvent } from "@/lib/animation/sequence";

export type AnimationSpeed = "normal" | "fast" | "instant";

const BASE_MS: Record<AnimationEvent["type"], number> = {
  PICK_UP: 240,
  MOVE_TO_PIT: 280,
  DROP_SEED: 270,
  CAPTURE_PIT: 420,
  UPDATE_SCORE: 180,
  FORFEIT_CAPTURE: 420,
  CHANGE_TURN: 280,
  GAME_OVER: 650,
};

export function eventDuration(event: AnimationEvent, speed: AnimationSpeed, rushed = false): number {
  if (speed === "instant") return 0;
  const scale = speed === "fast" ? 0.45 : 1;
  const duration = Math.round(BASE_MS[event.type] * scale);
  return rushed ? Math.min(duration, 70) : duration;
}
