"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { ownsPit, pitLabel } from "@/engine/oware";
import type { SceneBoardProps } from "@/game/board-types";

const OwareScene = dynamic(() => import("@/game/three/OwareScene").then((mod) => mod.OwareScene), {
  ssr: false,
});

export type { CaptureVisual, HandVisual } from "@/game/board-types";

class BoardBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-soft">
          The board needs WebGL, which this browser is not providing.
        </p>
      );
    }
    return this.props.children;
  }
}

export function OwareGameView({
  board,
  viewer,
  legalPits,
  captured = { player1: 0, player2: 0 },
  onPlay,
  disabled = false,
  preview = false,
  ...scene
}: SceneBoardProps) {
  const frame = preview ? "relative h-[min(52vh,440px)] min-h-[280px]" : "relative h-[min(68vh,620px)] min-h-[320px]";
  return (
    <div>
      <div className={`${frame} w-full overflow-hidden rounded-[28px] bg-cream`}>
        <div className="absolute inset-0" onPointerDown={() => scene.onAccelerate?.()} role="presentation">
          <BoardBoundary>
            <OwareScene
              board={board}
              viewer={viewer}
              legalPits={legalPits}
              captured={captured}
              onPlay={onPlay}
              disabled={disabled}
              preview={preview}
              {...scene}
            />
          </BoardBoundary>
        </div>
      </div>
      <div className="sr-only">
        {board.map((count, pit) => {
          const legal = !disabled && legalPits.includes(pit);
          return (
            <button key={pit} type="button" disabled={!legal} onClick={() => onPlay?.(pit)}>
              {pitLabel(viewer, pit, count ?? 0, ownsPit(viewer, pit))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
