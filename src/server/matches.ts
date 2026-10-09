import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient, User } from "@prisma/client";
import { IllegalMoveError, OwareGame, type AppliedMove } from "@/engine/oware";
import type { MatchSnapshot, MatchStatus, Side } from "@/realtime/protocol";
import { inviteTtlMs, queueTtlMs, reconnectGraceMs } from "@/server/config";
import { hashToken } from "@/server/session";

type Db = PrismaClient | Prisma.TransactionClient;

export class MatchError extends Error {
  constructor(
    message: string,
    readonly code: "unauthorized" | "invalid" | "full" | "expired" | "closed" | "turn" | "stale" | "illegal" | "busy",
  ) {
    super(message);
    this.name = "MatchError";
  }
}

const OPEN = ["waiting", "active"];

export async function createFriendRoom(prisma: PrismaClient, user: User) {
  const existing = await openMatch(prisma, user.id);
  if (existing?.kind === "friend" && existing.status === "waiting" && existing.player1UserId === user.id) {
    return { matchId: existing.id, token: null as string | null, resumed: true };
  }
  if (existing) throw new MatchError("Finish your current match first.", "busy");
  await prisma.queueEntry.deleteMany({ where: { userId: user.id, status: "waiting" } });
  const token = randomBytes(16).toString("base64url");
  const match = await prisma.match.create({
    data: {
      kind: "friend",
      status: "waiting",
      player1UserId: user.id,
      player1Name: user.displayName,
      inviteHash: hashToken(token),
      inviteExpiresAt: new Date(Date.now() + inviteTtlMs()),
    },
  });
  return { matchId: match.id, token, resumed: false };
}

export async function joinFriendRoom(prisma: PrismaClient, user: User, token: string) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) throw new MatchError("This invitation is not valid.", "invalid");
  const hash = hashToken(token);
  const result = await prisma.$transaction(async (tx) => {
    const found = await tx.match.findUnique({ where: { inviteHash: hash } });
    if (!found) return { error: "invalid" as const };
    await lockMatch(tx, found.id);
    const match = await tx.match.findUnique({ where: { id: found.id } });
    if (!match || match.kind !== "friend") return { error: "invalid" as const };
    if (match.player1UserId === user.id) return { matchId: match.id, already: true as const };
    if (match.inviteExpiresAt && match.inviteExpiresAt.getTime() <= Date.now()) {
      await tx.match.update({ where: { id: match.id }, data: { status: "expired" } });
      return { error: "expired" as const };
    }
    if (match.status !== "waiting" || match.player2UserId) return { error: "full" as const };
    const elsewhere = await openMatch(tx, user.id);
    if (elsewhere && elsewhere.id !== match.id) return { error: "busy" as const };
    await tx.match.update({
      where: { id: match.id },
      data: {
        player2UserId: user.id,
        player2Name: user.displayName,
        status: "active",
        player2DisconnectedAt: new Date(),
      },
    });
    await tx.queueEntry.deleteMany({ where: { userId: user.id, status: "waiting" } });
    await notify(tx, match.id);
    return { matchId: match.id, already: false as const };
  });
  if ("error" in result && result.error) {
    const message =
      result.error === "expired"
        ? "This invitation has expired."
        : result.error === "full"
          ? "This table is already full."
          : result.error === "busy"
            ? "Finish your current match first."
            : "This invitation is not valid.";
    throw new MatchError(message, result.error);
  }
  return result;
}

export async function leaveWaitingRoom(prisma: PrismaClient, user: User, matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.player1UserId !== user.id) throw new MatchError("You are not in this match.", "unauthorized");
  if (match.status !== "waiting" || match.player2UserId) throw new MatchError("This match has already started.", "closed");
  await prisma.match.update({ where: { id: match.id }, data: { status: "abandoned", completedAt: new Date() } });
  await notify(prisma, match.id);
  return { ok: true as const };
}

export async function joinQueue(prisma: PrismaClient, user: User) {
  const existing = await openMatch(prisma, user.id);
  if (existing) return { status: "matched" as const, matchId: existing.id };
  const claimed = await prisma.queueEntry.findUnique({ where: { userId: user.id } });
  if (claimed?.status === "claimed" && claimed.matchId) {
    const match = await prisma.match.findUnique({ where: { id: claimed.matchId } });
    if (match && OPEN.includes(match.status)) return { status: "matched" as const, matchId: match.id };
  }
  await prisma.queueEntry.upsert({
    where: { userId: user.id },
    create: { userId: user.id, status: "waiting" },
    update: { status: "waiting", matchId: null, createdAt: new Date() },
  });
  const matchId = await pairQueue(prisma);
  if (!matchId) return { status: "searching" as const, matchId: null };
  const mine = await prisma.queueEntry.findUnique({ where: { userId: user.id } });
  if (mine?.matchId) return { status: "matched" as const, matchId: mine.matchId };
  return { status: "searching" as const, matchId: null };
}

export async function cancelQueue(prisma: PrismaClient, user: User) {
  const removed = await prisma.queueEntry.deleteMany({ where: { userId: user.id, status: "waiting" } });
  if (removed.count > 0) return { cancelled: true as const, matchId: null };
  const entry = await prisma.queueEntry.findUnique({ where: { userId: user.id } });
  if (entry?.matchId) return { cancelled: false as const, matchId: entry.matchId };
  return { cancelled: true as const, matchId: null };
}

export async function submitMove(
  prisma: PrismaClient,
  user: User,
  input: { matchId: string; pit: number; expectedVersion: number; clientMoveId: string },
) {
  assertClientMoveId(input.clientMoveId);
  if (!Number.isInteger(input.pit) || input.pit < 0 || input.pit > 11) {
    throw new MatchError("That house is not on the board.", "illegal");
  }
  return commitAction(prisma, user, input.matchId, input.expectedVersion, input.clientMoveId, {
    kind: "move",
    pit: input.pit,
  });
}

export async function resignMatch(
  prisma: PrismaClient,
  user: User,
  input: { matchId: string; expectedVersion: number; clientMoveId: string },
) {
  assertClientMoveId(input.clientMoveId);
  return commitAction(prisma, user, input.matchId, input.expectedVersion, input.clientMoveId, { kind: "resign" });
}

export async function drawMatch(
  prisma: PrismaClient,
  user: User,
  input: { matchId: string; expectedVersion: number; clientMoveId: string },
) {
  assertClientMoveId(input.clientMoveId);
  return prisma.$transaction(async (tx) => {
    await lockMatch(tx, input.matchId);
    const loaded = await load(tx, input.matchId);
    if (!loaded) throw new MatchError("You are not in this match.", "unauthorized");
    const side = sideOf(loaded.match, user.id);
    if (!side) throw new MatchError("You are not in this match.", "unauthorized");
    const duplicate = loaded.match.moves.find((move) => move.clientMoveId === input.clientMoveId);
    if (duplicate) return resultFrom(loaded, duplicate.sequence, true);
    if (loaded.match.status !== "active") throw new MatchError("This match is not active.", "closed");
    if (!Number.isInteger(input.expectedVersion) || loaded.match.version !== input.expectedVersion) {
      throw new MatchError("The board has moved on.", "stale");
    }
    if (!loaded.match.drawOffer) {
      await tx.match.update({
        where: { id: loaded.match.id },
        data: { drawOffer: side, ...present(side) },
      });
      await notify(tx, loaded.match.id);
      const next = await load(tx, loaded.match.id);
      return { duplicate: false, version: next!.match.version, applied: null, snapshot: snapshotOf(next!, user.id), offered: true };
    }
    if (loaded.match.drawOffer === side) {
      const next = await load(tx, loaded.match.id);
      return { duplicate: false, version: next!.match.version, applied: null, snapshot: snapshotOf(next!, user.id), offered: true };
    }
    return applyLocked(tx, loaded, user.id, side, input.clientMoveId, { kind: "draw" });
  });
}

export async function forfeitDisconnected(prisma: PrismaClient, matchId: string, side: Side, clientMoveId: string) {
  return prisma.$transaction(async (tx) => {
    await lockMatch(tx, matchId);
    const loaded = await load(tx, matchId);
    if (!loaded || loaded.match.status !== "active") return null;
    const duplicate = loaded.match.moves.find((move) => move.clientMoveId === clientMoveId);
    if (duplicate) return resultFrom(loaded, duplicate.sequence, true);
    const userId = side === "player1" ? loaded.match.player1UserId : loaded.match.player2UserId;
    if (!userId) return null;
    const since = side === "player1" ? loaded.match.player1DisconnectedAt : loaded.match.player2DisconnectedAt;
    const acted = loaded.match.moves.some(
      (move) => move.player === side && move.kind === "move" && since && move.createdAt >= since,
    );
    if (!since || acted) {
      if (acted) await tx.match.update({ where: { id: matchId }, data: present(side) });
      return null;
    }
    return applyLocked(tx, loaded, userId, side, clientMoveId, { kind: "forfeit" });
  });
}

export async function markPresence(prisma: PrismaClient, matchId: string, userId: string, connected: boolean) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || (match.player1UserId !== userId && match.player2UserId !== userId)) return;
  if (match.status !== "waiting" && match.status !== "active") return;
  const mine = match.player1UserId === userId ? "player1" : "player2";
  if (connected) {
    await prisma.match.update({
      where: { id: matchId },
      data: mine === "player1" ? { player1DisconnectedAt: null } : { player2DisconnectedAt: null },
    });
  } else if (mine === "player1" && !match.player1DisconnectedAt) {
    await prisma.match.update({ where: { id: matchId }, data: { player1DisconnectedAt: new Date() } });
  } else if (mine === "player2" && !match.player2DisconnectedAt) {
    await prisma.match.update({ where: { id: matchId }, data: { player2DisconnectedAt: new Date() } });
  } else {
    return;
  }
  await notify(prisma, matchId);
}

export async function sweepGrace(prisma: PrismaClient, now = new Date()) {
  const deadline = new Date(now.getTime() - reconnectGraceMs());
  const expiredInvites = await prisma.match.findMany({
    where: { status: "waiting", inviteExpiresAt: { lt: now } },
  });
  for (const match of expiredInvites) {
    await prisma.match.update({ where: { id: match.id }, data: { status: "expired" } });
    await notify(prisma, match.id);
  }
  await prisma.queueEntry.deleteMany({ where: { status: "waiting", createdAt: { lt: new Date(now.getTime() - queueTtlMs()) } } });
  const stale = await prisma.match.findMany({
    where: {
      status: "active",
      OR: [{ player1DisconnectedAt: { lt: deadline } }, { player2DisconnectedAt: { lt: deadline } }],
    },
  });
  for (const match of stale) await settleDisconnect(prisma, match, deadline, now);
}

async function settleDisconnect(
  prisma: PrismaClient,
  match: { id: string; player1DisconnectedAt: Date | null; player2DisconnectedAt: Date | null },
  deadline: Date,
  now: Date,
) {
  const firstGone = match.player1DisconnectedAt && match.player1DisconnectedAt < deadline
    ? await awayLongEnough(prisma, match, "player1", deadline)
    : false;
  const secondGone = match.player2DisconnectedAt && match.player2DisconnectedAt < deadline
    ? await awayLongEnough(prisma, match, "player2", deadline)
    : false;
  if (!firstGone && !secondGone) return;
  if (firstGone && secondGone) {
    await prisma.match.update({ where: { id: match.id }, data: { status: "abandoned", completedAt: now } });
    await notify(prisma, match.id);
    return;
  }
  const side: Side = firstGone ? "player1" : "player2";
  const since = (side === "player1" ? match.player1DisconnectedAt : match.player2DisconnectedAt) ?? now;
  await forfeitDisconnected(prisma, match.id, side, `forfeit:${side}:${since.toISOString()}`);
}

export async function readMatch(prisma: PrismaClient, user: User, matchId: string) {
  await markPresence(prisma, matchId, user.id, true);
  await sweepOne(prisma, matchId);
  const loaded = await load(prisma, matchId);
  if (!loaded || !sideOf(loaded.match, user.id)) throw new MatchError("You are not in this match.", "unauthorized");
  return snapshotOf(loaded, user.id);
}

export async function activeMatchId(prisma: PrismaClient, userId: string) {
  const match = await openMatch(prisma, userId);
  return match?.id ?? null;
}

export async function queueState(prisma: PrismaClient, user: User) {
  const existing = await openMatch(prisma, user.id);
  if (existing) return { status: "matched" as const, matchId: existing.id };
  const entry = await prisma.queueEntry.findUnique({ where: { userId: user.id } });
  const fresh = entry?.status === "waiting" && entry.createdAt.getTime() > Date.now() - queueTtlMs();
  if (fresh) return { status: "searching" as const, matchId: null };
  return { status: "idle" as const, matchId: null };
}

export async function latestView(prisma: PrismaClient, matchId: string) {
  const loaded = await load(prisma, matchId);
  if (!loaded) return null;
  return {
    snapshotFor(userId: string) {
      return snapshotOf(loaded, userId);
    },
    match: loaded.match,
    applied: appliedOf(loaded),
  };
}

async function pairQueue(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    const cutoff = new Date(Date.now() - queueTtlMs());
    const rows = await tx.$queryRaw<Array<{ id: string; userId: string }>>`
      SELECT id, "userId" FROM "QueueEntry"
      WHERE status = 'waiting' AND "createdAt" > ${cutoff}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 2
    `;
    if (rows.length < 2) return null;
    const [first, second] = rows;
    if (!first || !second || first.userId === second.userId) return null;
    const users = await tx.user.findMany({ where: { id: { in: [first.userId, second.userId] } } });
    const now = new Date();
    const match = await tx.match.create({
      data: {
        kind: "quick",
        status: "active",
        player1UserId: first.userId,
        player2UserId: second.userId,
        player1Name: users.find((user) => user.id === first.userId)?.displayName || "Player",
        player2Name: users.find((user) => user.id === second.userId)?.displayName || "Player",
        player1DisconnectedAt: now,
        player2DisconnectedAt: now,
      },
    });
    await tx.queueEntry.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { status: "claimed", matchId: match.id },
    });
    await notify(tx, match.id);
    return match.id;
  });
}

async function commitAction(
  prisma: PrismaClient,
  user: User,
  matchId: string,
  expectedVersion: number,
  clientMoveId: string,
  action: { kind: "move"; pit: number } | { kind: "resign" },
) {
  return prisma.$transaction(async (tx) => {
    await lockMatch(tx, matchId);
    const loaded = await load(tx, matchId);
    if (!loaded) throw new MatchError("You are not in this match.", "unauthorized");
    const side = sideOf(loaded.match, user.id);
    if (!side) throw new MatchError("You are not in this match.", "unauthorized");
    const duplicate = loaded.match.moves.find((move) => move.clientMoveId === clientMoveId);
    if (duplicate) return resultFrom(loaded, duplicate.sequence, true);
    if (loaded.match.status !== "active") throw new MatchError("This match is not active.", "closed");
    if (!Number.isInteger(expectedVersion) || loaded.match.version !== expectedVersion) {
      throw new MatchError("The board has moved on.", "stale");
    }
    if (action.kind === "move" && loaded.game.getState().currentPlayer !== side) {
      throw new MatchError("It is not your turn.", "turn");
    }
    return applyLocked(tx, loaded, user.id, side, clientMoveId, action);
  });
}

async function applyLocked(
  tx: Prisma.TransactionClient,
  loaded: Loaded,
  userId: string,
  side: Side,
  clientMoveId: string,
  action: { kind: "move"; pit: number } | { kind: "resign" | "draw" | "forfeit" },
) {
  const before = loaded.game.getState();
  let applied: AppliedMove | null = null;
  try {
    if (action.kind === "move") applied = loaded.game.makeMove(action.pit);
    else if (action.kind === "draw") loaded.game.agreeDraw();
    else loaded.game.resign(action.kind === "forfeit" ? side : sideOf(loaded.match, userId) ?? side);
  } catch (error) {
    if (error instanceof IllegalMoveError) throw new MatchError(error.message, "illegal");
    throw error;
  }
  const nextVersion = loaded.match.version + 1;
  await tx.matchMove.create({
    data: {
      matchId: loaded.match.id,
      sequence: nextVersion,
      player: side,
      pit: action.kind === "move" ? action.pit : -1,
      kind: action.kind,
      clientMoveId,
    },
  });
  const state = loaded.game.getState();
  const finished = loaded.game.isGameOver();
  await tx.match.update({
    where: { id: loaded.match.id },
    data: {
      version: nextVersion,
      drawOffer: null,
      scoreP1: state.capturedSeeds.player1,
      scoreP2: state.capturedSeeds.player2,
      winner: state.winner ?? null,
      endReason: state.endReason ?? null,
      ...(action.kind === "move" ? present(side) : {}),
      status: finished ? "completed" : "active",
      completedAt: finished ? new Date() : null,
    },
  });
  if (finished) await writeHistory(tx, loaded.match.id, loaded.game);
  await notify(tx, loaded.match.id);
  const next = await load(tx, loaded.match.id);
  return {
    duplicate: false,
    version: nextVersion,
    applied,
    beforeBoard: before.board,
    beforeCaptured: before.capturedSeeds,
    snapshot: snapshotOf(next!, userId),
    offered: false,
  };
}

async function writeHistory(tx: Prisma.TransactionClient, matchId: string, game: OwareGame) {
  const match = await tx.match.findUnique({ where: { id: matchId }, include: { moves: { orderBy: { sequence: "asc" } } } });
  if (!match) return;
  const result = game.getResult();
  if (!result) return;
  const existing = await tx.game.findUnique({ where: { clientId: match.id } });
  if (existing) return;
  const pits = match.moves.filter((move) => move.kind === "move");
  await tx.game.create({
    data: {
      clientId: match.id,
      ruleset: "abapa",
      mode: "online",
      status: result.outcome === "draw" ? "draw" : "won",
      endReason: result.endReason,
      winner: result.winner ?? null,
      scoreP1: result.score.player1,
      scoreP2: result.score.player2,
      timeControlMs: 0,
      player1UserId: match.player1UserId,
      player2UserId: match.player2UserId,
      player1Name: match.player1Name,
      player2Name: match.player2Name || "Player",
      startedAt: match.createdAt,
      moves: {
        create: pits.map((move, index) => ({
          moveNumber: index + 1,
          player: move.player,
          pit: move.pit,
        })),
      },
    },
  });
  await tx.queueEntry.deleteMany({
    where: { userId: { in: [match.player1UserId, match.player2UserId].filter((id): id is string => Boolean(id)) } },
  });
}

async function sweepOne(prisma: PrismaClient, matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return;
  const now = new Date();
  if (match.status === "waiting" && match.inviteExpiresAt && match.inviteExpiresAt.getTime() <= now.getTime()) {
    await prisma.match.update({ where: { id: match.id }, data: { status: "expired" } });
    await notify(prisma, match.id);
    return;
  }
  if (match.status !== "active") return;
  await settleDisconnect(prisma, match, new Date(now.getTime() - reconnectGraceMs()), now);
}

function resultFrom(loaded: Loaded, sequence: number, duplicate: boolean) {
  const previous = loaded.match.moves.filter((move) => move.sequence < sequence);
  const current = loaded.match.moves.find((move) => move.sequence === sequence);
  const game = engineFrom(previous);
  const before = game.getState();
  let applied: AppliedMove | null = null;
  if (current?.kind === "move") applied = game.makeMove(current.pit);
  const userId = current?.player === "player2" ? loaded.match.player2UserId : loaded.match.player1UserId;
  return {
    duplicate,
    version: sequence,
    applied,
    beforeBoard: before.board,
    beforeCaptured: before.capturedSeeds,
    snapshot: snapshotOf(loaded, userId ?? ""),
    offered: false,
  };
}

function appliedOf(loaded: Loaded) {
  const last = loaded.match.moves.at(-1);
  if (!last || last.kind !== "move" || last.sequence !== loaded.match.version) return null;
  const previous = loaded.match.moves.slice(0, -1);
  const game = engineFrom(previous);
  const before = game.getState();
  const applied = game.makeMove(last.pit);
  return { version: last.sequence, applied, beforeBoard: before.board, beforeCaptured: before.capturedSeeds };
}

interface Loaded {
  match: Prisma.MatchGetPayload<{ include: { moves: true } }>;
  game: OwareGame;
}

async function load(db: Db, matchId: string): Promise<Loaded | null> {
  const match = await db.match.findUnique({ where: { id: matchId }, include: { moves: { orderBy: { sequence: "asc" } } } });
  if (!match) return null;
  return { match, game: engineFrom(match.moves) };
}

function engineFrom(moves: Array<{ kind: string; pit: number; player: string }>) {
  const pits = moves.filter((move) => move.kind === "move");
  const game = OwareGame.fromHistory(pits.map((move) => ({ pit: move.pit })));
  const ending = [...moves].reverse().find((move) => move.kind !== "move");
  if (ending && !game.isGameOver()) {
    if (ending.kind === "draw") game.agreeDraw();
    else if (ending.player === "player1" || ending.player === "player2") game.resign(ending.player);
  }
  return game;
}

function snapshotOf(loaded: Loaded, userId: string): MatchSnapshot {
  const state = loaded.game.getState();
  const you = sideOf(loaded.match, userId);
  const status = loaded.match.status as MatchStatus;
  const yourTurn = status === "active" && you !== null && state.currentPlayer === you && state.status === "in_progress";
  return {
    matchId: loaded.match.id,
    kind: loaded.match.kind === "friend" ? "friend" : "quick",
    status,
    version: loaded.match.version,
    you,
    player1Name: loaded.match.player1Name,
    player2Name: loaded.match.player2Name,
    board: state.board,
    territory: state.territory,
    round: state.round,
    currentPlayer: state.currentPlayer,
    captured: state.capturedSeeds,
    pits: state.moveHistory.map((move) => move.pit),
    legalPits: yourTurn ? loaded.game.getLegalMoves() : [],
    yourTurn,
    winner: state.winner ?? null,
    endReason: state.endReason ?? null,
    drawOffer: loaded.match.drawOffer === "player1" || loaded.match.drawOffer === "player2" ? loaded.match.drawOffer : null,
    player1Connected: loaded.match.player1DisconnectedAt === null,
    player2Connected: loaded.match.player2UserId ? loaded.match.player2DisconnectedAt === null : false,
  };
}

function present(side: Side) {
  return side === "player1" ? { player1DisconnectedAt: null } : { player2DisconnectedAt: null };
}

async function awayLongEnough(
  prisma: PrismaClient,
  match: { id: string; player1DisconnectedAt: Date | null; player2DisconnectedAt: Date | null },
  side: Side,
  deadline: Date,
) {
  const since = side === "player1" ? match.player1DisconnectedAt : match.player2DisconnectedAt;
  if (!since || since >= deadline) return false;
  const acted = await prisma.matchMove.findFirst({
    where: { matchId: match.id, player: side, kind: "move", createdAt: { gte: since } },
  });
  if (!acted) return true;
  await prisma.match.update({ where: { id: match.id }, data: present(side) });
  return false;
}

function sideOf(match: { player1UserId: string | null; player2UserId: string | null }, userId: string): Side | null {
  if (match.player1UserId === userId) return "player1";
  if (match.player2UserId === userId) return "player2";
  return null;
}

async function openMatch(db: Db, userId: string) {
  return db.match.findFirst({
    where: { status: { in: OPEN }, OR: [{ player1UserId: userId }, { player2UserId: userId }] },
    orderBy: { createdAt: "desc" },
  });
}

async function lockMatch(tx: Prisma.TransactionClient, matchId: string) {
  await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`;
}

async function notify(db: Db, matchId: string) {
  try {
    await db.$executeRaw`SAVEPOINT playoware_notify`;
  } catch {
    await db.$executeRaw`SELECT pg_notify('playoware_match', ${matchId})`.catch(() => undefined);
    return;
  }
  try {
    await db.$executeRaw`SELECT pg_notify('playoware_match', ${matchId})`;
    await db.$executeRaw`RELEASE SAVEPOINT playoware_notify`;
  } catch {
    await db.$executeRaw`ROLLBACK TO SAVEPOINT playoware_notify`.catch(() => undefined);
  }
}

function assertClientMoveId(value: string) {
  if (typeof value !== "string" || value.length < 8 || value.length > 80) {
    throw new MatchError("That move could not be accepted.", "illegal");
  }
}
