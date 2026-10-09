"use client";

import Link from "next/link";

const choices = [
  { href: "/play/queue", title: "Quick Match", copy: "Find another player online" },
  { href: "/play/friend", title: "Play a friend", copy: "Send a private invitation" },
  { href: "/play/ai", title: "Play the computer", copy: "A solo game on this device" },
];

export default function PlayPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-serif text-5xl">Play</h1>
      <p className="mt-2 text-ink-soft">Online games are played by two people on their own devices. The computer stays on this one.</p>
      <div className="mt-8 flex flex-col gap-3">
        {choices.map((choice) => (
          <Link key={choice.href} href={choice.href} className="rounded-3xl border border-line bg-paper p-5 hover:border-ink">
            <span className="block font-serif text-2xl">{choice.title}</span>
            <span className="mt-1 block text-sm text-ink-soft">{choice.copy}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
