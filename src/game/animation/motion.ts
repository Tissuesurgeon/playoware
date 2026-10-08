import { HAND_Y, pitPosition } from "@/game/layout/pits";

export function clamp01(value: number) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/** Smooth start and finish for the hand travelling between pits. */
export function easeInOut(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Downward ease with a small settle at the end of a drop. */
export function dropEase(t: number) {
  const x = clamp01(t);
  const landed = 1 - (1 - x) * (1 - x);
  const bounce = Math.sin(x * Math.PI) * (1 - x) * 0.18;
  return { progress: landed, lift: bounce };
}

export interface Point {
  x: number;
  y: number;
  z: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpPoint(from: Point, to: Point, t: number): Point {
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), z: lerp(from.z, to.z, t) };
}

/** Carries the seed cluster from pit to pit in board space. */
export class HandMotion {
  private from: Point = { x: 0, y: HAND_Y, z: 0 };
  private to: Point = { x: 0, y: HAND_Y, z: 0 };
  private started = 0;
  private duration = 1;
  private placed = false;

  retarget(pit: number, now: number, duration: number, reduced: boolean) {
    const place = pitPosition(pit);
    const next = { x: place.x, y: HAND_Y, z: place.z };
    this.from = !this.placed || reduced ? next : this.sample(now);
    this.to = next;
    this.placed = true;
    this.started = now;
    this.duration = reduced ? 1 : Math.max(1, duration);
  }

  sample(now: number): Point {
    const t = easeInOut((now - this.started) / this.duration);
    return lerpPoint(this.from, this.to, t);
  }
}
