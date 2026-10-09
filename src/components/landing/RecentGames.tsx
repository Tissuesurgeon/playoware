import Link from "next/link";
import { readUser } from "@/lib/auth/user";
import { getPrisma } from "@/lib/db/client";
import { formatWhen } from "@/lib/format";

export async function RecentGames() {
  const { user, unavailable } = await readUser();
  const prisma = getPrisma();
  if (!prisma || unavailable || !user) return null;

  const games = await prisma.game
    .findMany({
      where: { OR: [{ player1UserId: user.id }, { player2UserId: user.id }] },
      orderBy: { endedAt: "desc" },
      take: 3,
    })
    .catch(() => null);

  if (!games || games.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16" aria-labelledby="recent-title">
      <div className="flex items-end justify-between gap-4">
        <h2 id="recent-title" className="font-serif text-3xl">
          Recent games
        </h2>
        <Link href="/history" className="text-sm font-semibold text-forest">
          All games
        </Link>
      </div>
      <ul className="mt-5 divide-y divide-line rounded-3xl border border-line bg-paper">
        {games.map((game) => {
          const mine = game.player1UserId === user.id ? "player1" : "player2";
          const opponent = mine === "player1" ? game.player2Name : game.player1Name;
          const result = !game.winner ? "Draw" : game.winner === mine ? "Win" : "Loss";
          return (
            <li key={game.id}>
              <Link href={`/review/${game.clientId}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-cream">
                <span className="font-semibold">{opponent}</span>
                <span className="text-sm text-ink-soft">
                  {result} · {formatWhen(game.endedAt.toISOString())}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
