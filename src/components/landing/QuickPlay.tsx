import Link from "next/link";

export function QuickPlay() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16" aria-labelledby="quick-play-title">
      <h2 id="quick-play-title" className="font-serif text-4xl tracking-tight text-balance">
        Choose a game
      </h2>
      <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Link href="/play/queue" className="flex min-h-56 flex-col justify-between rounded-[28px] bg-walnut-deep p-8 text-paper hover:bg-walnut">
          <div>
            <h3 className="font-serif text-4xl tracking-tight text-balance">Quick Match</h3>
            <p className="mt-3 max-w-md text-base leading-7 text-seed/90">
              Search for another player. When someone is waiting, you share a table.
            </p>
          </div>
          <span className="mt-8 inline-flex h-11 w-fit items-center rounded-full bg-forest px-5 text-sm font-semibold text-paper">
            Find an opponent
          </span>
        </Link>
        <Link href="/play/friend" className="flex min-h-56 flex-col justify-between rounded-[28px] border border-line bg-paper p-8 hover:border-ink">
          <div>
            <h3 className="font-serif text-3xl tracking-tight text-balance">Play a friend</h3>
            <p className="mt-3 leading-7 text-ink-soft">A private link. They open it on their own device.</p>
          </div>
          <span className="mt-8 text-sm font-semibold text-forest underline decoration-forest/30 underline-offset-4">
            Create an invitation
          </span>
        </Link>
      </div>
      <Link href="/play/ai" className="mt-4 block rounded-[28px] border border-line bg-paper px-8 py-5 hover:border-ink">
        <span className="font-serif text-2xl">Play the computer</span>
        <span className="mt-1 block text-sm text-ink-soft">Beginner through hard, on this device. No one else joins.</span>
      </Link>
    </section>
  );
}
