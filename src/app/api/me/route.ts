import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth/user";
import { getPrisma } from "@/lib/db/client";

export async function GET() {
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ displayName: "Player", persisted: false });
  try {
    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ displayName: "Player", persisted: false });
    return NextResponse.json({ displayName: user.displayName, persisted: true });
  } catch {
    return NextResponse.json({ displayName: "Player", persisted: false });
  }
}

export async function PATCH(request: Request) {
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  let body: { displayName?: unknown };
  try {
    body = (await request.json()) as { displayName?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.displayName !== "string") {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const displayName = body.displayName.trim().slice(0, 24);
  if (!displayName) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  try {
    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
    const updated = await prisma.user.update({ where: { id: user.id }, data: { displayName } });
    return NextResponse.json({ displayName: updated.displayName });
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
