import Link from "next/link";
import { ResumeGame } from "@/components/navigation/ResumeGame";

const others = [
  {
    href: "/play/friend",
    title: "Play a friend",
    copy: "A private link. They open it on their own device.",
    action: "Create an invitation",
  },
  {
    href: "/play/ai",
    title: "Play the computer",
    copy: "A solo game on this device. You pick how strong it plays.",
    action: "Choose a level",
  },
];

export default function PlayPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16">
      <h1 className="font-serif text-5xl tracking-tight text-balance">Play</h1>
      <p className="mt-3 max-w-[40ch] text-lg leading-8 text-ink-soft">Choose who sits across from you.</p>
      <div className="mt-8 flex flex-col gap-4">
        <ResumeGame prominent />
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <Link
            href="/play/queue"
            className="flex h-full flex-col justify-between rounded-[28px] bg-walnut-deep p-6 text-paper transition-colors duration-200 hover:bg-walnut motion-reduce:transition-none sm:p-8"
          >
            <div>
              <h2 className="font-serif text-4xl tracking-tight text-balance">Quick Match</h2>
              <p className="mt-3 max-w-md text-base leading-7 text-seed">
                Search for another player. When someone is waiting, you share a table.
              </p>
            </div>
            <span className="mt-8 inline-flex h-11 w-fit items-center rounded-full bg-forest px-5 text-sm font-semibold text-paper">
              Find an opponent
            </span>
          </Link>
          <div className="grid gap-4 sm:grid-cols-2 lg:h-full lg:grid-cols-1 lg:grid-rows-2">
            {others.map((choice) => (
              <Link
                key={choice.href}
                href={choice.href}
                className="flex h-full min-h-11 flex-col justify-between rounded-[28px] border border-line bg-paper px-6 py-5 transition-colors duration-200 hover:bg-cream motion-reduce:transition-none"
              >
                <span>
                  <span className="block font-serif text-3xl tracking-tight text-balance">{choice.title}</span>
                  <span className="mt-2 block max-w-[36ch] text-sm leading-6 text-ink-soft">{choice.copy}</span>
                </span>
                <span className="mt-6 text-sm font-semibold text-forest">{choice.action}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
