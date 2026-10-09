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

/**
 * Owned houses from the left of the shared south-facing board.
 * A player's own row comes first, then houses they have captured on the other row.
 */
export function ownedHousesInView(viewer: Player, territory: readonly Player[]): number[] {
  const order =
    viewer === "player1"
      ? [0, 1, 2, 3, 4, 5, 11, 10, 9, 8, 7, 6]
      : [11, 10, 9, 8, 7, 6, 0, 1, 2, 3, 4, 5];
  return order.filter((pit) => territory[pit] === viewer);
}

/**
 * Side bowls sit beside the plank, which a wide screen can spare.
 * On a phone they sit just past each player's row, so the six houses can use the width.
 */
export function captureBowlPosition(player: Player, placement: "side" | "end" = "side"): { x: number; y: number; z: number } {
  if (placement === "end") return { x: 0, y: CAPTURE_Y, z: player === "player1" ? 2.15 : -2.15 };
  return { x: player === "player1" ? 4.85 : -4.85, y: CAPTURE_Y, z: 0 };
}
