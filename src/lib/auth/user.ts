import { cookies } from "next/headers";
import { getPrisma } from "@/lib/db/client";
import { LEGACY_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE } from "@/server/config";
import { createSession, userFromToken } from "@/server/session";

function cookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function readUser() {
  const prisma = getPrisma();
  if (!prisma) return { user: null, unavailable: true as const };
  try {
    const jar = await cookies();
    const user = await userFromToken(prisma, jar.get(SESSION_COOKIE)?.value);
    return { user, unavailable: false as const };
  } catch {
    return { user: null, unavailable: true as const };
  }
}

export async function getOrCreateUser() {
  const prisma = getPrisma();
  if (!prisma) return null;
  const jar = await cookies();
  const current = await userFromToken(prisma, jar.get(SESSION_COOKIE)?.value);
  if (current) return current;

  const legacyId = jar.get(LEGACY_COOKIE)?.value;
  if (legacyId) {
    const legacy = await prisma.user.findUnique({ where: { id: legacyId } });
    if (legacy) {
      const session = await createSession(prisma, legacy.id);
      jar.set(SESSION_COOKIE, session.token, cookieOptions());
      jar.set(LEGACY_COOKIE, "", cookieOptions(0));
      return legacy;
    }
  }

  const user = await prisma.user.create({
    data: { displayName: "Player", profile: { create: {} } },
  });
  const session = await createSession(prisma, user.id);
  jar.set(SESSION_COOKIE, session.token, cookieOptions());
  return user;
}
