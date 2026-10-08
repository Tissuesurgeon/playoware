"use client";

import { useMemo, useState } from "react";
import { OwareGameView } from "@/game/OwareGameView";
import { housesCaptured, OwareGame, replayGame, type AppliedMove } from "@/engine/oware";

const GRAND_SLAM = {
  board: [0, 0, 0, 0, 0, 6, 1, 1, 1, 1, 1, 1],
  capturedSeeds: { player1: 18, player2: 18 },
  currentPlayer: "player1" as const,
};

export default function EngineLabPage() {
  const [game, setGame] = useState(() => new OwareGame());
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<AppliedMove | null>(null);
  const state = game.getState();
  const legal = useMemo(() => game.getLegalMoves(), [game]);

  function play(pit: number) {
    try {
      const next = game.clone();
      const applied = next.makeMove(pit);
      setGame(next);
      setLast(applied);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Illegal move");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-3xl">Engine lab</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {state.status === "in_progress"
          ? `${state.currentPlayer} to move`
          : `${state.status} ${state.endReason ?? ""} ${state.winner ?? ""}`}
      </p>
      <div className="mt-6">
        <OwareGameView
          board={state.board}
          viewer="player1"
          legalPits={legal}
          captured={state.capturedSeeds}
          lastPit={last?.move.pit}
          onPlay={play}
        />
      </div>
      <p className="mt-4 text-sm">
        Captured {state.capturedSeeds.player1} — {state.capturedSeeds.player2} seeds,{" "}
        {housesCaptured(replayGame(state.moveHistory).applied).player1} —{" "}
        {housesCaptured(replayGame(state.moveHistory).applied).player2} houses
      </p>
      {last?.grandSlam ? <p className="mt-2 text-sm text-ink-soft">All six houses cannot be captured. The seeds stay.</p> : null}
      {error ? <p className="mt-2 text-sm text-bad">{error}</p> : null}
      <div className="mt-4 flex gap-4">
        <button
          type="button"
          className="text-sm font-semibold"
          onClick={() => {
            setGame(new OwareGame());
            setLast(null);
            setError(null);
          }}
        >
          Reset
        </button>
        <button
          type="button"
          className="text-sm font-semibold"
          onClick={() => {
            setGame(new OwareGame(GRAND_SLAM));
            setLast(null);
            setError(null);
          }}
        >
          Grand slam position
        </button>
      </div>
    </main>
  );
}
