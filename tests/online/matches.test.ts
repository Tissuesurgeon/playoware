import { readFileSync } from "node:fs";
import { PrismaClient, type User } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  cancelQueue,
  createFriendRoom,
  joinFriendRoom,
  joinQueue,
  MatchError,
  markPresence,
  readMatch,
  resignMatch,
  submitMove,
  sweepGrace,
} from "@/server/matches";
import { createSession, userFromToken } from "@/server/session";
import { startGame } from "@/lib/start-game";

function loadEnv() {
  try {
    const text = readFileSync(".env", "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match?.[1] || process.env[match[1]]) continue;
      process.env[match[1]] = match[2]?.replace(/^"|"$/g, "") ?? "";
    }
  } catch {
    // The process environment already has the variables.
  }
}

loadEnv();

if (process.env.DATABASE_URL && /supabase\.co|pooler\.supabase\.com/.test(process.env.DATABASE_URL)) {
  process.env.DATABASE_URL = "postgresql://playoware:playoware@127.0.0.1:5434/playoware";
}

const prisma = new PrismaClient();

async function guest(name: string) {
  return prisma.user.create({ data: { displayName: name, profile: { create: {} } } });
}

async function reset() {
  await prisma.game.deleteMany({ where: { mode: "online" } });
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "MatchMove", "Match", "QueueEntry", "Session" RESTART IDENTITY CASCADE`);
}

beforeEach(async () => {
  await reset();
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe("sessions", () => {
  it("does not treat a user id as a session token", async () => {
    const user = await guest("Ada");
    expect(await userFromToken(prisma, user.id)).toBeNull();
    const session = await createSession(prisma, user.id);
    expect((await userFromToken(prisma, session.token))?.id).toBe(user.id);
  });
});

describe("queue", () => {
  it("pairs two different players and keeps one row per player", async () => {
    const first = await guest("Ada");
    const second = await guest("Kwame");
    const alone = await joinQueue(prisma, first);
    expect(alone).toEqual({ status: "searching", matchId: null });
    const again = await joinQueue(prisma, first);
    expect(again.status).toBe("searching");
    expect(await prisma.queueEntry.count({ where: { userId: first.id } })).toBe(1);

    const paired = await joinQueue(prisma, second);
    expect(paired.status).toBe("matched");
    expect(paired.matchId).toBeTruthy();
    const match = await prisma.match.findUnique({ where: { id: paired.matchId! } });
    expect(match?.status).toBe("active");
    expect(new Set([match?.player1UserId, match?.player2UserId])).toEqual(new Set([first.id, second.id]));
    expect(await prisma.match.count()).toBe(1);
  });

  it("lets a cancel and a claim finish as one outcome", async () => {
    const first = await guest("Ada");
    const second = await guest("Kwame");
    await joinQueue(prisma, first);
    const [cancelled, joined] = await Promise.all([cancelQueue(prisma, first), joinQueue(prisma, second)]);
    const matches = await prisma.match.findMany();
    expect(matches.length).toBeLessThanOrEqual(1);
    if (matches.length === 1) {
      expect(joined.matchId).toBe(matches[0]?.id);
      expect(cancelled.matchId === matches[0]?.id || cancelled.cancelled).toBe(true);
      expect(await prisma.queueEntry.count({ where: { userId: first.id, status: "waiting" } })).toBe(0);
    } else {
      expect(cancelled.cancelled).toBe(true);
      expect(joined.status).toBe("searching");
    }
  });

  it("returns the claimed match when the queue row is already taken", async () => {
    const first = await guest("Ada");
    const second = await guest("Kwame");
    await joinQueue(prisma, first);
    const joined = await joinQueue(prisma, second);
    const cancelled = await cancelQueue(prisma, first);
    expect(cancelled).toEqual({ cancelled: false, matchId: joined.matchId });
  });
});

describe("invitations", () => {
  it("rejects a full, expired, or closed invitation and gives the seat to one joiner", async () => {
    const host = await guest("Ada");
    const room = await createFriendRoom(prisma, host);
    expect(room.token).toBeTruthy();
    const token = room.token!;
    expect((await joinFriendRoom(prisma, host, token)).already).toBe(true);

    await prisma.match.update({
      where: { id: room.matchId },
      data: { inviteExpiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(joinFriendRoom(prisma, await guest("Late"), token)).rejects.toMatchObject({ code: "expired" });
    expect((await prisma.match.findUnique({ where: { id: room.matchId } }))?.status).toBe("expired");

    const fresh = await createFriendRoom(prisma, host);
    const openToken = fresh.token!;
    const [a, b] = await Promise.allSettled([
      joinFriendRoom(prisma, await guest("One"), openToken),
      joinFriendRoom(prisma, await guest("Two"), openToken),
    ]);
    const fulfilled = [a, b].filter((result) => result.status === "fulfilled");
    const rejected = [a, b].filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(MatchError);
    const seated = await prisma.match.findUnique({ where: { id: fresh.matchId } });
    expect(seated?.status).toBe("active");
    expect(seated?.player2UserId).toBeTruthy();

    await expect(joinFriendRoom(prisma, await guest("Third"), openToken)).rejects.toMatchObject({ code: "full" });
  });
});

describe("moves", () => {
  async function table() {
    const first = await guest("Ada");
    const second = await guest("Kwame");
    await joinQueue(prisma, first);
    const joined = await joinQueue(prisma, second);
    const match = await prisma.match.findUniqueOrThrow({ where: { id: joined.matchId! } });
    const player1 = match.player1UserId === first.id ? first : second;
    const player2 = player1.id === first.id ? second : first;
    return { matchId: match.id, player1, player2 };
  }

  it("commits a legal move and ignores illegal, out-of-turn, stale, and duplicate requests", async () => {
    const { matchId, player1, player2 } = await table();
    const stranger = await guest("Stranger");
    await expect(readMatch(prisma, stranger, matchId)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(move(stranger, matchId, 0, 0, "stranger-move")).rejects.toMatchObject({ code: "unauthorized" });

    const before = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    await expect(move(player2, matchId, 6, 0, "out-of-turn-move")).rejects.toMatchObject({ code: "turn" });
    await expect(move(player1, matchId, 6, 0, "illegal-opponent-pit")).rejects.toMatchObject({ code: "illegal" });
    await expect(move(player1, matchId, 0, 4, "stale-version-move")).rejects.toMatchObject({ code: "stale" });
    const unchanged = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(unchanged.version).toBe(before.version);

    const committed = await move(player1, matchId, 0, 0, "legal-move-0001");
    expect(committed.duplicate).toBe(false);
    expect(committed.version).toBe(1);
    expect(committed.applied?.move.pit).toBe(0);

    const repeated = await move(player1, matchId, 0, 0, "legal-move-0001");
    expect(repeated.duplicate).toBe(true);
    expect(repeated.version).toBe(1);
    expect(await prisma.matchMove.count({ where: { matchId } })).toBe(1);

    const [firstTry, secondTry] = await Promise.allSettled([
      move(player2, matchId, 6, 1, "race-move-aaaa"),
      move(player2, matchId, 7, 1, "race-move-bbbb"),
    ]);
    const won = [firstTry, secondTry].filter((result) => result.status === "fulfilled");
    expect(won).toHaveLength(1);
    expect((await prisma.match.findUnique({ where: { id: matchId } }))?.version).toBe(2);
  });
});

describe("reconnect", () => {
  it("holds the match through the grace window and then awards it", async () => {
    const first = await guest("Ada");
    const second = await guest("Kwame");
    await joinQueue(prisma, first);
    const joined = await joinQueue(prisma, second);
    const matchId = joined.matchId!;
    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    await markPresence(prisma, matchId, match.player1UserId!, true);
    await markPresence(prisma, matchId, match.player2UserId!, true);
    await markPresence(prisma, matchId, match.player2UserId!, false);

    await sweepGrace(prisma, new Date());
    const held = await readMatch(prisma, first.id === match.player1UserId ? first : second, matchId);
    expect(held.status).toBe("active");
    expect(held.yourTurn).toBe(true);

    await sweepGrace(prisma, new Date(Date.now() + 120_000));
    const viewer = first.id === match.player1UserId ? first : second;
    const finished = await readMatch(prisma, viewer, matchId);
    expect(finished.status).toBe("completed");
    expect(finished.yourTurn).toBe(false);
    expect(finished.winner).toBe("player1");
    expect(finished.legalPits).toEqual([]);

    const games = await prisma.game.findMany({ where: { clientId: matchId } });
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ mode: "online", timeControlMs: 0, winner: "player1" });
  });

  it("does not award the game while both players are still moving", async () => {
    const first = await guest("Ada");
    const second = await guest("Kwame");
    await joinQueue(prisma, first);
    const joined = await joinQueue(prisma, second);
    const matchId = joined.matchId!;
    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    const player1 = match.player1UserId === first.id ? first : second;
    const player2 = player1.id === first.id ? second : first;
    await move(player1, matchId, 0, 0, "keep-playing-0001");
    await move(player2, matchId, 6, 1, "keep-playing-0002");
    await sweepGrace(prisma, new Date(Date.now() + 120_000));
    const current = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(current.status).toBe("active");
    expect(current.version).toBe(2);
    expect(current.player1DisconnectedAt).toBeNull();
    expect(current.player2DisconnectedAt).toBeNull();
  });
});

describe("history", () => {
  it("writes one finished game and leaves an unfinished match out of history", async () => {
    const first = await guest("Ada");
    const second = await guest("Kwame");
    await joinQueue(prisma, first);
    const joined = await joinQueue(prisma, second);
    const matchId = joined.matchId!;
    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    const player1 = (match.player1UserId === first.id ? first : second) as User;
    await move(player1, matchId, 0, 0, "history-move-01");
    expect(await prisma.game.count({ where: { clientId: matchId } })).toBe(0);

    await resignMatch(prisma, player1, { matchId, expectedVersion: 1, clientMoveId: "history-resign" });
    await resignMatch(prisma, player1, { matchId, expectedVersion: 1, clientMoveId: "history-resign" });
    const games = await prisma.game.findMany({ where: { clientId: matchId }, include: { moves: true } });
    expect(games).toHaveLength(1);
    expect(games[0]?.mode).toBe("online");
    expect(games[0]?.moves.map((row) => row.pit)).toEqual([0]);
    expect(games[0]?.player1UserId).toBeTruthy();
    expect(games[0]?.player2UserId).toBeTruthy();
  });
});

describe("product surface", () => {
  it("starts an AI game locally and does not queue", async () => {
    const memory = new Map<string, string>();
    viSession(memory);
    const id = startGame({ mode: "ai", player1Name: "Ada", player2Name: "Computer" });
    const raw = memory.get(`playoware:game:${id}`);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).mode).toBe("ai");
    expect(await prisma.queueEntry.count()).toBe(0);
  });

  it("does not offer a same-device human game", () => {
    const files = [
      "src/components/landing/Hero.tsx",
      "src/components/landing/QuickPlay.tsx",
      "src/app/play/page.tsx",
      "src/app/play/friend/page.tsx",
    ].map((file) => readFileSync(file, "utf8"));
    const combined = files.join("\n");
    expect(combined).not.toContain('mode: "local"');
    expect(combined).not.toContain("Pass the device");
    expect(combined).not.toContain("Same device");
    expect(combined).toContain("/play/queue");
    expect(combined).toContain("/play/friend");
    expect(combined).toContain("/play/ai");
  });
});

function move(user: User, matchId: string, pit: number, expectedVersion: number, clientMoveId: string) {
  return submitMove(prisma, user, { matchId, pit, expectedVersion, clientMoveId });
}

function viSession(memory: Map<string, string>) {
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  Object.defineProperty(globalThis, "sessionStorage", { value: storage, configurable: true });
}
