import Link from "next/link";

const items = [
  {
    href: "/learn",
    title: "Learn the Rules",
    copy: "Understand the board, sowing, feeding, and capturing.",
  },
  {
    href: "/learn#strategy",
    title: "Understand Strategy",
    copy: "Plan the timing of a four, and notice when you must feed your opponent.",
  },
  {
    href: "/play/ai",
    title: "Practice and Improve",
    copy: "The surest practice is a game. Start against the computer.",
  },
];

export function LearnStrip() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12" aria-labelledby="learn-title">
      <h2 id="learn-title" className="font-serif text-3xl">
        New to Oware?
      </h2>
      <p className="mt-2 max-w-xl text-ink-soft">Learn the rules, understand captures, and discover the strategy behind every move.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <Link key={item.title} href={item.href} className="rounded-3xl bg-walnut-deep p-6 text-paper hover:bg-walnut">
            <h3 className="font-serif text-2xl">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-seed/90">{item.copy}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
