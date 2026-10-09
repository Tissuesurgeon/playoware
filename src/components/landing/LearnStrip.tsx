import Link from "next/link";

const links = [
  { href: "/learn", label: "Learn the rules" },
  { href: "/learn#strategy", label: "Timing a four" },
  { href: "/play/ai", label: "Practice" },
];

export function LearnStrip() {
  return (
    <section className="bg-walnut-deep text-paper" aria-labelledby="learn-title">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 md:flex-row md:items-end md:justify-between md:py-20">
        <div className="max-w-xl">
          <h2 id="learn-title" className="font-serif text-4xl leading-tight tracking-tight text-balance md:text-5xl">
            The hand keeps going until the last seed lands in an empty house.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-seed/90">
            A house that reaches four is captured. The first player to 25 seeds wins. An empty row has to be fed.
          </p>
        </div>
        <nav aria-label="Learn" className="flex flex-col gap-3 text-sm font-semibold">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="underline decoration-seed/40 underline-offset-4 hover:decoration-seed">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
