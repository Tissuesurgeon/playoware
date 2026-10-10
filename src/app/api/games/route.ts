import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth/user";
import { getPrisma } from "@/lib/db/client";
import { concludeGame, InvalidGameError } from "@/lib/game/record";
import { canResumeStoredGame } from "@/lib/game/session";
import type { EndCommand } from "@/lib/game/session";
import type { Difficulty } from "@/lib/ai";

const DIFFICULTIES = new Set<Difficulty>(["beginner", "easy", "medium", "hard"]);

function nameOf(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, 24);
  return trimmed || fallback;
}

export async function GET() {
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ games: [], unavailable: true });
  try {
    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ games: [], unavailable: true });
    const games = await prisma.game.findMany({
      where: { OR: [{ player1UserId: user.id }, { player2UserId: user.id }] },
      orderBy: { endedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({
      unavailable: false,
      games: games.map((game) => ({
        id: game.id,
        clientId: game.clientId,
        mode: game.mode,
        player1Name: game.player1Name,
        player2Name: game.player2Name,
        winner: game.winner,
        scoreP1: game.scoreP1,
        scoreP2: game.scoreP2,
        endReason: game.endReason,
        aiDifficulty: game.aiDifficulty,
        endedAt: game.endedAt.toISOString(),
        player1UserId: game.player1UserId,
        player2UserId: game.player2UserId,
      })),
    });
  } catch {
    return NextResponse.json({ games: [], unavailable: true });
  }
}

export async function POST(request: Request) {
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  let body: {
    clientId?: unknown;
    mode?: unknown;
    player1Name?: unknown;
    player2Name?: unknown;
    aiDifficulty?: unknown;
    moves?: unknown;
    endCommand?: EndCommand | null;
    startedAt?: unknown;
    timeControlMs?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.clientId !== "string" || body.clientId.length < 8 || body.clientId.length > 80) {
    return NextResponse.json({ error: "Missing game id." }, { status: 400 });
  }
  if (typeof body.mode !== "string" || !canResumeStoredGame(body.mode)) {
    return NextResponse.json({ error: "Unknown game mode." }, { status: 400 });
  }
  if (!Array.isArray(body.moves) || body.moves.length > 400) {
    return NextResponse.json({ error: "Move list is invalid." }, { status: 400 });
  }

  const moves = body.moves.map((move) => {
    const pit = typeof move === "object" && move && "pit" in move ? Number((move as { pit: unknown }).pit) : NaN;
    return { pit };
  });
  const difficulty =
    typeof body.aiDifficulty === "string" && DIFFICULTIES.has(body.aiDifficulty as Difficulty)
      ? (body.aiDifficulty as Difficulty)
      : null;

  try {
    const existing = await prisma.game.findUnique({ where: { clientId: body.clientId } });
    if (existing) return NextResponse.json({ id: existing.id, clientId: existing.clientId });

    const { state, result } = concludeGame(moves, body.endCommand ?? null);
    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

    const startedAt = typeof body.startedAt === "string" ? new Date(body.startedAt) : new Date();
    const game = await prisma.game.create({
      data: {
        clientId: body.clientId,
        ruleset: "abapa",
        mode: body.mode,
        status: result.outcome === "draw" ? "draw" : "won",
        endReason: result.endReason,
        winner: result.winner ?? null,
        scoreP1: result.score.player1,
        scoreP2: result.score.player2,
        timeControlMs: 0,
        player1UserId: user.id,
        player1Name: nameOf(body.player1Name, user.displayName),
        player2Name: nameOf(body.player2Name, body.mode === "ai" ? "AI" : "Guest"),
        aiDifficulty: body.mode === "ai" ? difficulty : null,
        startedAt: Number.isNaN(startedAt.getTime()) ? new Date() : startedAt,
        moves: {
          create: state.moveHistory.map((move) => ({
            moveNumber: move.moveNumber,
            player: move.player,
            pit: move.pit,
          })),
        },
      },
    });
    return NextResponse.json({ id: game.id, clientId: game.clientId });
  } catch (error) {
    if (error instanceof InvalidGameError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
