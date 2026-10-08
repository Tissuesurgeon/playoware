"use client";

import { DIFFICULTIES } from "@/lib/ai";
import { aiLabel } from "@/lib/format";
import { useStart } from "@/lib/start-game";

export default function PlayAiPage() {
  const { pending, go } = useStart();

  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-serif text-5xl">Play AI</h1>
      <p className="mt-2 text-ink-soft">Difficulty changes how far the engine searches.</p>
      <div className="mt-8 flex flex-col gap-3">
        {DIFFICULTIES.map((level) => (
          <button
            key={level.id}
            type="button"
            disabled={pending}
            onClick={() =>
              void go({
                mode: "ai",
                player1Name: "",
                player2Name: aiLabel(level.id),
                aiDifficulty: level.id,
              })
            }
            className="rounded-3xl border border-line bg-paper p-5 text-left hover:border-ink disabled:opacity-60"
          >
            <span className="block font-serif text-2xl">{level.label}</span>
            <span className="mt-1 block text-sm text-ink-soft">{level.blurb}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
