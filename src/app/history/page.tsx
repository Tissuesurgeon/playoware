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

  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-serif text-5xl">My games</h1>
      {offline ? (
        <p className="mt-4 max-w-lg text-ink-soft">
          History is saved in the database. It isn’t reachable right now. A finished game can still be reviewed from its result screen on this device.
        </p>
      ) : games.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-line bg-paper p-8">
          <p className="text-ink-soft">No games yet. Finished games will appear here.</p>
          <Link href="/play" className="mt-4 inline-flex h-11 items-center rounded-full bg-clay px-5 text-sm font-semibold text-paper">
            Play Oware
          </Link>
        </div>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead className="text-xs tracking-wide text-ink-soft uppercase">
            <tr>
              <th className="py-2 font-semibold">Opponent</th>
              <th className="py-2 font-semibold">Result</th>
              <th className="py-2 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => {
              const mine = game.player1UserId === user?.id ? "player1" : "player2";
              const opponent = mine === "player1" ? game.player2Name : game.player1Name;
              const result = !game.winner ? "Draw" : game.winner === mine ? "Win" : "Loss";
              return (
                <tr key={game.id} className="border-t border-line">
                  <td className="py-3">
                    <Link href={`/review/${game.clientId}`} className="font-semibold">
                      {opponent}
                    </Link>
                  </td>
                  <td className="py-3">{result}</td>
                  <td className="py-3 text-ink-soft">{formatWhen(game.endedAt.toISOString())}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
