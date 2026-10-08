import Link from "next/link";

export function ComingSoon({ title, copy }: { title: string; copy: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-20">
      <p className="text-sm font-semibold tracking-[0.18em] text-clay uppercase">Coming soon</p>
      <h1 className="mt-3 font-serif text-5xl">{title}</h1>
      <p className="mt-4 leading-7 text-ink-soft">{copy}</p>
      <Link href="/play" className="mt-8 inline-flex h-11 items-center rounded-full bg-clay px-5 text-sm font-semibold text-paper">
        Play a game
      </Link>
    </main>
  );
}
