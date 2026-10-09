"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { initialTerritory, type GameState, type Player } from "@/engine/oware";
import type { LocalGameSession } from "@/lib/game/session";

function endingLabel(reason: GameState["endReason"]) {
  if (reason === "majority") return "First to 25 seeds.";
  if (reason === "territory") return "All six houses were captured.";
  if (reason === "starvation") return "No legal move remained.";
  if (reason === "repetition") return "The same position came around again.";
  if (reason === "resignation") return "One player left the table.";
  if (reason === "agreement") return "Both players agreed to a draw.";
  if (reason === "timeout") return "The clock ran out.";
  return null;
}

export function ResultDialog({
  session,
  names,
  you,
  state,
  saveState,
  onAgain,
  onReview,
  onRetrySave,
}: {
  session?: LocalGameSession;
  names?: { player1: string; player2: string };
  you?: Player | null;
  state: GameState;
  saveState: "idle" | "saving" | "saved" | "error";
  onAgain: () => void;
  onReview: () => void;
  onRetrySave: () => void;
}) {
  const router = useRouter();
  const score = state.capturedSeeds;
  const territory = state.territory ?? initialTerritory();
  const houses = {
    player1: territory.filter((owner) => owner === "player1").length,
    player2: territory.filter((owner) => owner === "player2").length,
  };
  const player1Name = names?.player1 ?? session?.player1Name ?? "Player";
  const player2Name = names?.player2 ?? session?.player2Name ?? "Player";
  let title = "Draw";
  if (state.status === "won" && state.winner) {
    if (you) title = state.winner === you ? "You won" : "You lost";
    else if (session?.mode === "ai") title = state.winner === "player1" ? "You won" : "You lost";
    else title = `${state.winner === "player1" ? player1Name : player2Name} won`;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/45 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="max-h-[90svh] w-full max-w-md overflow-auto rounded-3xl bg-paper p-5 text-center shadow-xl sm:p-8">
        <h2 id="result-title" className="font-serif text-3xl sm:text-4xl">
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
          {player1Name} — {player2Name}
        </p>
        {endingLabel(state.endReason) ? <p className="mt-3 text-sm text-ink-soft">{endingLabel(state.endReason)}</p> : null}
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
