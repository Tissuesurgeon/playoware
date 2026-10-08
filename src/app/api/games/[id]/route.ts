import { NextResponse } from "next/server";
import { readUser } from "@/lib/auth/user";
import { getPrisma } from "@/lib/db/client";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  try {
    const { user } = await readUser();
    if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const game = await prisma.game.findFirst({
      where: {
        OR: [{ id }, { clientId: id }],
        AND: [{ OR: [{ player1UserId: user.id }, { player2UserId: user.id }] }],
      },
      include: { moves: { orderBy: { moveNumber: "asc" } } },
    });
    if (!game) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({
      id: game.id,
      clientId: game.clientId,
      player1Name: game.player1Name,
      player2Name: game.player2Name,
      winner: game.winner,
      scoreP1: game.scoreP1,
      scoreP2: game.scoreP2,
      endReason: game.endReason,
      moves: game.moves.map((move) => ({ pit: move.pit, player: move.player, moveNumber: move.moveNumber })),
    });
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
