import Link from "next/link";

const options = [
  {
    href: "/play/ai",
    title: "Play against AI",
    copy: "Test your strategy against a computer opponent.",
    action: "Play AI",
  },
  {
    href: "/play/friend",
    title: "Play a Friend",
    copy: "Two people, one device. The board turns toward whoever is to move.",
    action: "Play a Friend",
  },
];

export function QuickPlay() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-6" aria-labelledby="quick-play-title">
      <h2 id="quick-play-title" className="font-serif text-3xl">
        How do you want to play?
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {options.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className="group rounded-3xl border border-line bg-paper p-6 transition hover:border-forest focus-visible:border-forest"
          >
            <h3 className="font-serif text-2xl">{option.title}</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-ink-soft">{option.copy}</p>
            <span className="mt-5 inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm font-semibold text-paper group-hover:bg-forest-dark">
              {option.action}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
