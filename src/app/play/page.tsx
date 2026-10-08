"use client";

import Link from "next/link";
import { useStart } from "@/lib/start-game";

const choices = [
  {
    href: null,
    title: "Quick play",
    copy: "Play immediately",
    action: "quick" as const,
  },
  {
    href: "/play/ai",
    title: "Play AI",
    copy: "Challenge the engine",
    action: null,
  },
  {
    href: "/play/friend",
    title: "Play friend",
    copy: "Same-device game",
    action: null,
  },
];

export default function PlayPage() {
  const { pending, go } = useStart();

  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-serif text-5xl">Play</h1>
      <p className="mt-2 text-ink-soft">Choose how you want to play. Online games are not in this version.</p>
      <div className="mt-8 flex flex-col gap-3">
        {choices.map((choice) =>
          choice.action ? (
            <button
              key={choice.title}
              type="button"
              disabled={pending}
              onClick={() => void go({ mode: "local", player1Name: "", player2Name: "Guest" })}
              className="rounded-3xl border border-line bg-paper p-5 text-left hover:border-ink"
            >
              <span className="block font-serif text-2xl">{choice.title}</span>
              <span className="mt-1 block text-sm text-ink-soft">{choice.copy}</span>
            </button>
          ) : (
            <Link key={choice.title} href={choice.href!} className="rounded-3xl border border-line bg-paper p-5 hover:border-ink">
              <span className="block font-serif text-2xl">{choice.title}</span>
              <span className="mt-1 block text-sm text-ink-soft">{choice.copy}</span>
            </Link>
          ),
        )}
      </div>
    </main>
  );
}
