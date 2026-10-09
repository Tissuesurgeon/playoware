"use client";

import { useEffect, useState } from "react";
import { NamePrompt } from "@/components/play/NamePrompt";
import { DIFFICULTIES, type Difficulty } from "@/lib/ai";
import { aiLabel } from "@/lib/format";
import { loadName, saveDisplayName, useStart } from "@/lib/start-game";

export default function PlayAiPage() {
  const { pending, go } = useStart();
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<Difficulty | null>(null);

  useEffect(() => {
    void loadName().then(setName);
  }, []);

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
            onClick={() => setChoice(level.id)}
            className="rounded-3xl border border-line bg-paper p-5 text-left hover:border-ink disabled:opacity-60"
          >
            <span className="block font-serif text-2xl">{level.label}</span>
            <span className="mt-1 block text-sm text-ink-soft">{level.blurb}</span>
          </button>
        ))}
      </div>
      <NamePrompt
        open={choice !== null}
        name={name}
        onChange={setName}
        pending={pending}
        confirmLabel="Start"
        onClose={() => setChoice(null)}
        onConfirm={() => {
          if (!choice) return;
          const trimmed = name.trim();
          const level = choice;
          void saveDisplayName(trimmed).then(() =>
            go({
              mode: "ai",
              player1Name: trimmed,
              player2Name: aiLabel(level),
              aiDifficulty: level,
            }),
          );
        }}
      />
    </main>
  );
}
