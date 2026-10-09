import { NextResponse } from "next/server";
import { markPresence } from "@/server/matches";
import { context, matchResponse, unavailable } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request, contextParams: { params: Promise<{ id: string }> }) {
  const { id } = await contextParams.params;
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  let connected = false;
  try {
    const body = (await request.json()) as { connected?: unknown };
    connected = body.connected === true;
  } catch {
    connected = false;
  }
  try {
    await markPresence(prisma, id, user.id, connected);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return matchResponse(error);
  }
}
