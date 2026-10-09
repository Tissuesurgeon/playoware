import { NextResponse } from "next/server";
import { submitMove } from "@/server/matches";
import { context, limited, matchResponse, tooMany, unavailable } from "@/server/http";

export async function POST(request: Request, contextParams: { params: Promise<{ id: string }> }) {
  const { id } = await contextParams.params;
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  if (!limited(user.id, "move", 30, 10_000)) return tooMany();
  let body: { pit?: unknown; expectedVersion?: unknown; clientMoveId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const result = await submitMove(prisma, user, {
      matchId: id,
      pit: Number(body.pit),
      expectedVersion: Number(body.expectedVersion),
      clientMoveId: String(body.clientMoveId ?? ""),
    });
    return NextResponse.json(result);
  } catch (error) {
    return matchResponse(error);
  }
}
