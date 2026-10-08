import type { Player } from "@/engine/oware";

export interface HandVisual {
  pit: number;
  count: number;
  /** Name of the player carrying the seeds. */
  player?: string;
}

export interface CaptureVisual {
  pit: number;
  count: number;
  toward: "top" | "bottom";
}

export interface SceneBoardProps {
  board: number[];
  viewer: Player;
  legalPits: number[];
  selectedPit?: number;
  lastPit?: number;
  landedPit?: number;
  hand?: HandVisual | null;
  capture?: CaptureVisual | null;
  captured?: { player1: number; player2: number };
  forfeitedPits?: number[];
  activeBottom?: boolean;
  travelMs?: number;
  captureMs?: number;
  reduced?: boolean;
  onPlay?: (pit: number) => void;
  onAccelerate?: () => void;
  disabled?: boolean;
  /** Static opening board. Skips the continuous render loop. */
  preview?: boolean;
}
