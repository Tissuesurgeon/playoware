import { NextResponse } from "next/server";
import { leaveWaitingRoom } from "@/server/matches";
import { context, matchResponse, unavailable } from "@/server/http";

export async function POST(_request: Request, contextParams: { params: Promise<{ id: string }> }) {
  const { id } = await contextParams.params;
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  try {
    return NextResponse.json(await leaveWaitingRoom(prisma, user, id));
  } catch (error) {
    return matchResponse(error);
  }
}
