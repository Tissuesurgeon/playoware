import { NextResponse } from "next/server";
import { joinFriendRoom } from "@/server/matches";
import { context, limited, matchResponse, tooMany, unavailable } from "@/server/http";

export async function POST(request: Request) {
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  if (!limited(user.id, "join", 20, 60_000)) return tooMany();
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.token !== "string") return NextResponse.json({ error: "This invitation is not valid." }, { status: 400 });
  try {
    const joined = await joinFriendRoom(prisma, user, body.token);
    return NextResponse.json(joined);
  } catch (error) {
    return matchResponse(error);
  }
}
