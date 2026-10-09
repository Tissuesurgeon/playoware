import { NextResponse } from "next/server";
import { resignMatch } from "@/server/matches";
import { context, limited, matchResponse, tooMany, unavailable } from "@/server/http";

export async function POST(request: Request, contextParams: { params: Promise<{ id: string }> }) {
  const { id } = await contextParams.params;
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  if (!limited(user.id, "move", 30, 10_000)) return tooMany();
  let body: { expectedVersion?: unknown; clientMoveId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await resignMatch(prisma, user, {
        matchId: id,
        expectedVersion: Number(body.expectedVersion),
        clientMoveId: String(body.clientMoveId ?? ""),
      }),
    );
  } catch (error) {
    return matchResponse(error);
  }
}
