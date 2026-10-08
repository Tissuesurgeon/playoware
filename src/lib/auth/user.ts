import { cookies } from "next/headers";
import { getPrisma } from "@/lib/db/client";

const COOKIE = "playoware_uid";

export async function readUserId() {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function readUser() {
  const prisma = getPrisma();
  if (!prisma) return { user: null, unavailable: true as const };
  const id = await readUserId();
  if (!id) return { user: null, unavailable: false as const };
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    return { user, unavailable: false as const };
  } catch {
    return { user: null, unavailable: true as const };
  }
}

export async function getOrCreateUser() {
  const prisma = getPrisma();
  if (!prisma) return null;
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) {
    const user = await prisma.user.findUnique({ where: { id: existing } });
    if (user) return user;
  }
  const user = await prisma.user.create({
    data: { displayName: "Player", profile: { create: {} } },
  });
  jar.set(COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  return user;
}
