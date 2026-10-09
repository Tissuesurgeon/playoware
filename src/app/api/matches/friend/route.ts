import { NextResponse } from "next/server";
import { createFriendRoom } from "@/server/matches";
import { context, limited, matchResponse, tooMany, unavailable } from "@/server/http";

export async function POST() {
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  if (!limited(user.id, "room", 10, 60_000)) return tooMany();
  try {
    const room = await createFriendRoom(prisma, user);
    return NextResponse.json({
      matchId: room.matchId,
      token: room.token,
      path: room.token ? `/join/${room.token}` : null,
      resumed: room.resumed,
    });
  } catch (error) {
    return matchResponse(error);
  }
}
