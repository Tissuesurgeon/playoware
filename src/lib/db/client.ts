import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "@/lib/db/url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma() {
  applyDatabaseUrl();
  if (!process.env.DATABASE_URL) return null;
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000, timeout: 20_000 },
    });
  }
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
