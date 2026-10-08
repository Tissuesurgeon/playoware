"use client";

import Link from "next/link";
import { ResumeGame } from "@/components/navigation/ResumeGame";
import { useSettings } from "@/components/settings/SettingsProvider";
import { initialBoard } from "@/engine/oware";
import { OwareGameView } from "@/game/OwareGameView";
import { useStart } from "@/lib/start-game";

export function Hero() {
  const { pending, go } = useStart();
  const { reducedMotion } = useSettings();

  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-16">
      <div>
        <p className="text-xs font-semibold tracking-[0.22em] text-forest uppercase">The classic strategy game</p>
        <h1 className="mt-3 font-serif text-5xl tracking-tight text-balance md:text-6xl">Ancient strategy. A new way to play.</h1>
        <p className="mt-4 max-w-md text-lg leading-8 text-ink-soft">
          Play Oware online, challenge an AI opponent, and sharpen your strategy one move at a time.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => void go({ mode: "local", player1Name: "", player2Name: "Guest" })}
            className="inline-flex h-12 items-center rounded-full bg-forest px-7 text-sm font-semibold text-paper hover:bg-forest-dark disabled:opacity-60"
          >
            Play Oware
          </button>
          <Link
            href="/learn"
            className="inline-flex h-12 items-center rounded-full border border-line bg-paper px-6 text-sm font-semibold hover:border-ink"
          >
            Learn to Play
          </Link>
        </div>
        <p className="mt-4 text-sm text-ink-soft">Choose your opponent. Make your move. Master the board.</p>
        <div className="mt-6">
          <ResumeGame />
        </div>
      </div>
      <div aria-hidden>
        <OwareGameView board={initialBoard()} viewer="player1" legalPits={[]} disabled preview reduced={reducedMotion} />
      </div>
    </section>
  );
}
