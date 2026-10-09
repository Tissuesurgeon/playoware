"use client";

import Link from "next/link";
import { ResumeGame } from "@/components/navigation/ResumeGame";
import { useSettings } from "@/components/settings/SettingsProvider";
import { initialBoard } from "@/engine/oware";
import { OwareGameView } from "@/game/OwareGameView";

export function Hero() {
  const { reducedMotion } = useSettings();

  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-2 px-4 pt-4 pb-8 md:grid-cols-2 md:gap-10 md:py-10">
      <div className="order-2 md:order-1 md:py-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-forest uppercase">The classic strategy game</p>
        <h1 className="mt-3 font-serif text-[clamp(2.5rem,4vw,3.6rem)] leading-[1.02] tracking-tight">
          Ancient strategy.
          <br />
          A new way to play.
        </h1>
        <p className="mt-5 max-w-[36ch] text-lg leading-8 text-ink-soft">
          Forty-eight seeds on a wooden board. Find an opponent online, invite a friend, or play the computer.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/play/queue" className="inline-flex h-12 items-center rounded-full bg-forest px-7 text-sm font-semibold text-paper hover:bg-forest-dark">
            Quick Match
          </Link>
          <Link href="/learn" className="text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink">
            Learn the rules
          </Link>
        </div>
        <ResumeGame />
      </div>
      <div className="order-1 md:order-2" aria-hidden>
        <OwareGameView board={initialBoard()} viewer="player1" legalPits={[]} disabled preview reduced={reducedMotion} />
      </div>
    </section>
  );
}
