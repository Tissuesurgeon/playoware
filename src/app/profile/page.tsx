import Link from "next/link";
import { readUser } from "@/lib/auth/user";
import { getPrisma } from "@/lib/db/client";

export default async function ProfilePage() {
  const { user, unavailable } = await readUser();
  const prisma = getPrisma();
  const connected = Boolean(prisma) && !unavailable;
  const games =
    connected && user && prisma
      ? await prisma.game
          .findMany({
            where: { OR: [{ player1UserId: user.id }, { player2UserId: user.id }] },
          })
          .catch(() => null)
      : [];
  const offline = !connected || games === null;

  let wins = 0;
  let losses = 0;
  let draws = 0;
  if (games && user) {
    for (const game of games) {
      const mine = game.player1UserId === user.id ? "player1" : "player2";
      if (!game.winner) draws += 1;
      else if (game.winner === mine) wins += 1;
      else losses += 1;
    }
  }
  const total = wins + losses + draws;
  const winRate = total === 0 ? "—" : `${((wins / total) * 100).toFixed(1)}%`;
  const name = user?.displayName ?? "Player";

  return (
    <main className="mx-auto max-w-xl px-4 pt-8 pb-16">
      <h1 className="font-serif text-5xl tracking-tight text-balance">{name}</h1>
      <p className="mt-2 text-sm font-semibold tracking-wide text-ink-soft uppercase">Oware rating</p>
      <p className="font-serif text-3xl">Unrated</p>
      {offline ? (
        <p className="mt-6 text-sm text-ink-soft">
          Statistics come from saved games. The database isn’t reachable, so these numbers stay at zero until it is.
        </p>
      ) : null}
      <dl className="mt-8 grid grid-cols-2 gap-3">
        {(
          [
            ["Games", total],
            ["Wins", wins],
            ["Losses", losses],
            ["Draws", draws],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-line bg-paper p-4">
            <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
            <dd className="mt-1 font-serif text-3xl">{value}</dd>
          </div>
        ))}
        <div className="col-span-2 flex items-baseline justify-between rounded-3xl border border-line bg-paper p-4">
          <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Win rate</dt>
          <dd className="font-serif text-3xl">{winRate}</dd>
        </div>
      </dl>
      <Link href="/history" className="mt-8 inline-flex h-11 items-center rounded-full bg-clay px-5 text-sm font-semibold text-paper hover:bg-clay-dark">
        Game history
      </Link>
    </main>
  );
}
