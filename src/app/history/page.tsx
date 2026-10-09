import Link from "next/link";
import { readUser } from "@/lib/auth/user";
import { getPrisma } from "@/lib/db/client";
import { formatWhen } from "@/lib/format";

export default async function HistoryPage() {
  const { user, unavailable } = await readUser();
  const prisma = getPrisma();
  const connected = Boolean(prisma) && !unavailable;
  const games =
    connected && user && prisma
      ? await prisma.game
          .findMany({
            where: { OR: [{ player1UserId: user.id }, { player2UserId: user.id }] },
            orderBy: { endedAt: "desc" },
            take: 100,
          })
          .catch(() => null)
      : [];
  const offline = !connected || games === null;

  const resultStyles = {
    Win: "bg-forest/10 text-forest",
    Loss: "bg-bad/10 text-bad",
    Draw: "bg-ink/5 text-ink-soft",
  } as const;

  return (
    <main className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="font-serif text-5xl tracking-tight">My games</h1>
      {offline ? (
        <p className="mt-4 max-w-lg leading-7 text-ink-soft">
          History is saved in the database. It isn’t reachable right now. A finished game can still be reviewed from its result screen on this device.
        </p>
      ) : games.length === 0 ? (
        <div className="mt-8 rounded-[28px] border border-line bg-paper p-8">
          <p className="text-ink-soft">No games yet. Finished games will appear here.</p>
          <Link href="/play" className="mt-4 inline-flex h-11 items-center rounded-full bg-clay px-5 text-sm font-semibold text-paper hover:bg-clay-dark">
            Play Oware
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-[28px] border border-line bg-paper">
          {games.map((game) => {
            const mine = game.player1UserId === user?.id ? "player1" : "player2";
            const opponent = mine === "player1" ? game.player2Name : game.player1Name;
            const result = !game.winner ? "Draw" : game.winner === mine ? "Win" : "Loss";
            return (
              <li key={game.id}>
                <Link
                  href={`/review/${game.clientId}`}
                  className="flex min-h-11 items-center justify-between gap-4 px-5 py-4 transition-colors duration-200 hover:bg-cream motion-reduce:transition-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{opponent}</span>
                    <span className="mt-0.5 block text-sm text-ink-soft">{formatWhen(game.endedAt.toISOString())}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${resultStyles[result]}`}>{result}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
