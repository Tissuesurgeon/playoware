"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { housesCaptured, replayGame, type GameState } from "@/engine/oware";
import type { LocalGameSession } from "@/lib/game/session";

export function ResultDialog({
  session,
  state,
  saveState,
  onAgain,
  onReview,
  onRetrySave,
}: {
  session: LocalGameSession;
  state: GameState;
  saveState: "idle" | "saving" | "saved" | "error";
  onAgain: () => void;
  onReview: () => void;
  onRetrySave: () => void;
}) {
  const router = useRouter();
  const score = state.capturedSeeds;
  const houses = housesCaptured(replayGame(state.moveHistory).applied);
  let title = "Draw";
  if (state.status === "won" && state.winner) {
    if (session.mode === "ai") title = state.winner === "player1" ? "You won" : "You lost";
    else title = `${state.winner === "player1" ? session.player1Name : session.player2Name} won`;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/45 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="w-full max-w-md rounded-3xl bg-paper p-8 text-center shadow-xl">
        <h2 id="result-title" className="font-serif text-4xl">
          {title}
        </h2>
        <p className="mt-4 font-serif text-3xl tabular-nums">
          {score.player1} — {score.player2}
        </p>
        <p className="mt-1 text-sm text-ink-soft tabular-nums">
          {houses.player1} {houses.player1 === 1 ? "house" : "houses"} — {houses.player2}{" "}
          {houses.player2 === 1 ? "house" : "houses"}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {session.player1Name} — {session.player2Name}
        </p>
        {saveState === "error" ? (
          <p className="mt-4 text-sm text-bad">
            Couldn’t save this game.{" "}
            <button type="button" className="font-semibold underline" onClick={onRetrySave}>
              Retry
            </button>
          </p>
        ) : null}
        {saveState === "saving" ? <p className="mt-4 text-sm text-ink-soft">Saving the game…</p> : null}
        <div className="mt-8 flex flex-col gap-3">
          <Button onClick={onAgain}>Play again</Button>
          <Button variant="secondary" onClick={onReview}>
            Review game
          </Button>
          <Button variant="ghost" onClick={() => router.push("/")}>
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}
