import Link from "next/link";

export default function LearnPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-14">
      <p className="text-xs font-semibold tracking-[0.22em] text-forest uppercase">Learn</p>
      <h1 className="mt-3 font-serif text-5xl">How Oware is played</h1>
      <p className="mt-4 text-lg leading-8 text-ink-soft">
        Twelve houses, forty-eight seeds, and a hand that keeps moving until it lands in an empty house.
      </p>

      <section className="mt-10" aria-labelledby="board-title">
        <h2 id="board-title" className="font-serif text-3xl">
          The board
        </h2>
        <p className="mt-3 leading-7 text-ink-soft">
          Each player owns one row of six pits. The game starts with four seeds in every pit. Seeds are never sown into a store. You play from your own side, and the first player moves first.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="sowing-title">
        <h2 id="sowing-title" className="font-serif text-3xl">
          Sowing
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-7 text-ink-soft">
          <li>Lift every seed from one of your pits.</li>
          <li>Drop them one by one, anti-clockwise, including the pit you started from if the hand comes all the way around.</li>
          <li>If the last seed lands in a house that already had seeds, pick up every seed now in that house and keep sowing.</li>
          <li>The move stops when the last seed lands in a house that was empty.</li>
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="capture-title">
        <h2 id="capture-title" className="font-serif text-3xl">
          Capture
        </h2>
        <p className="mt-3 leading-7 text-ink-soft">A house is captured when a sown seed makes it hold exactly four.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-ink-soft">
          <li>Four on your own side are yours immediately. The rest of the hand keeps sowing.</li>
          <li>Four on your opponent’s side in the middle of a handful are theirs.</li>
          <li>Four made by the last seed of a handful are yours, even on their side, and the move ends.</li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="feeding-title">
        <h2 id="feeding-title" className="font-serif text-3xl">
          Feeding
        </h2>
        <p className="mt-3 leading-7 text-ink-soft">
          If your opponent’s row is empty at the start of your turn, you must play a move that leaves them at least one seed, when you can. If you cannot, you take the seeds still on your side and the game ends.
        </p>
      </section>

      <section id="strategy" className="mt-10 scroll-mt-24" aria-labelledby="strategy-title">
        <h2 id="strategy-title" className="font-serif text-3xl">
          Strategy
        </h2>
        <p className="mt-3 leading-7 text-ink-soft">
          A four is the only capture, so the useful question is where the last seed of a handful will land. Making four on your own side in the middle of a sow scores and still leaves you a hand. Making four on their side before the hand is empty gives the seeds to them. Leave yourself a way to feed an empty row, or the game can end before you wanted it to.
        </p>
        <p className="mt-3 leading-7 text-ink-soft">The first player to capture 25 seeds wins. Exactly 24 does not end the game.</p>
      </section>

      <Link href="/play/ai" className="mt-10 inline-flex h-12 items-center rounded-full bg-forest px-6 text-sm font-semibold text-paper hover:bg-forest-dark">
        Practice against the AI
      </Link>
    </main>
  );
}
