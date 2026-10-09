import { NextResponse } from "next/server";
import { activeMatchId } from "@/server/matches";
import { context, unavailable } from "@/server/http";

export async function GET() {
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  try {
    const matchId = await activeMatchId(prisma, user.id);
    return NextResponse.json({ matchId });
  } catch {
    return unavailable();
  }
}
