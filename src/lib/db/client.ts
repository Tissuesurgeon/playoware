import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient();
  return globalForPrisma.prisma;
}

export async function withDatabase<T>(run: (prisma: PrismaClient) => Promise<T>) {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    return await run(prisma);
  } catch {
    return null;
  }
}
