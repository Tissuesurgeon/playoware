import type { Player } from "@/engine/oware";

/** Distance between pit centers. */
export const PIT_SPACING = 1.16;

/** How far each row sits from the board center. Positive Z is the near side. */
export const ROW_Z = 0.92;

/** Height of the carrying cluster above the board surface. */
export const HAND_Y = 0.78;

/** Where captured seeds collect, on that player's side of the board. */
export const CAPTURE_Y = 0.22;

const COLUMNS = 6;

/**
 * Local board position for an engine pit when player 1 sits at the near side.
 * South pits 0–5 run left to right. North pits 6–11 run right to left, so
 * increasing the engine index walks anti-clockwise.
 */
export function pitPosition(engineIndex: number): { x: number; z: number } {
  const column = engineIndex < COLUMNS ? engineIndex : 11 - engineIndex;
  const near = engineIndex < COLUMNS;
  return {
    x: (column - 2.5) * PIT_SPACING,
    z: near ? ROW_Z : -ROW_Z,
  };
}

/** Owned houses from the viewer's left, near row first, then the far row. */
export function ownedHousesInView(viewer: Player, territory: readonly Player[]): number[] {
  const order =
    viewer === "player1"
      ? [0, 1, 2, 3, 4, 5, 11, 10, 9, 8, 7, 6]
      : [6, 7, 8, 9, 10, 11, 5, 4, 3, 2, 1, 0];
  return order.filter((pit) => territory[pit] === viewer);
}

/** Same mapping after turning the board so `viewer` sits at the near side. */
export function viewerPitPosition(engineIndex: number, viewer: Player): { x: number; z: number } {
  const local = pitPosition(engineIndex);
  if (viewer === "player1") return local;
  return { x: -local.x, z: -local.z };
}

export function captureBowlPosition(player: Player): { x: number; y: number; z: number } {
  return { x: player === "player1" ? 4.85 : -4.85, y: CAPTURE_Y, z: 0 };
}
