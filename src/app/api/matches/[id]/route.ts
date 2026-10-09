import { readMatch } from "@/server/matches";
import { context, matchResponse, unavailable } from "@/server/http";
import { NextResponse } from "next/server";

export async function GET(_request: Request, contextParams: { params: Promise<{ id: string }> }) {
  const { id } = await contextParams.params;
  const { prisma, user } = await context();
  if (!prisma || !user) return unavailable();
  try {
    return NextResponse.json(await readMatch(prisma, user, id));
  } catch (error) {
    return matchResponse(error);
  }
}
