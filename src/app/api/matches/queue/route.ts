import { NextResponse } from "next/server";
import { cancelQueue, joinQueue, queueState } from "@/server/matches";
import { context, limited, matchResponse, tooMany, unavailable } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  try {
    return NextResponse.json(await queueState(prisma, user));
  } catch (error) {
    return matchResponse(error);
  }
}

export async function POST() {
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  if (!limited(user.id, "queue", 10, 60_000)) return tooMany();
  try {
    const result = await joinQueue(prisma, user);
    return NextResponse.json(result);
  } catch (error) {
    return matchResponse(error);
  }
}

export async function DELETE() {
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  try {
    return NextResponse.json(await cancelQueue(prisma, user));
  } catch (error) {
    return matchResponse(error);
  }
}
