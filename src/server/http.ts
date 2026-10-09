import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth/user";
import { getPrisma } from "@/lib/db/client";
import { MatchError } from "@/server/matches";
import { allow } from "@/server/limits";

export async function context() {
  const prisma = getPrisma();
  if (!prisma) return { prisma: null, user: null };
  try {
    const user = await getOrCreateUser();
    return { prisma, user };
  } catch {
    return { prisma: null, user: null };
  }
}

export function unavailable() {
  return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
}

export function tooMany() {
  return NextResponse.json({ error: "Too many attempts. Wait a moment." }, { status: 429 });
}

export function matchResponse(error: unknown) {
  if (error instanceof MatchError) {
    const status =
      error.code === "unauthorized" ? 403
      : error.code === "expired" ? 410
      : error.code === "stale" || error.code === "turn" || error.code === "full" || error.code === "busy" || error.code === "closed" ? 409
      : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return unavailable();
}

export function limited(userId: string, action: string, max: number, windowMs: number) {
  return allow(`${userId}:${action}`, max, windowMs);
}
