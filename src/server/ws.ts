import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { PrismaClient } from "@prisma/client";
import type { ServerMessage } from "@/realtime/protocol";
import { isClientMessage } from "@/realtime/protocol";
import { SESSION_COOKIE } from "@/server/config";
import { allow } from "@/server/limits";
import {
  cancelQueue,
  createFriendRoom,
  drawMatch,
  joinFriendRoom,
  joinQueue,
  latestView,
  leaveWaitingRoom,
  markPresence,
  MatchError,
  readMatch,
  resignMatch,
  submitMove,
  sweepGrace,
} from "@/server/matches";
import { applyDatabaseUrl } from "@/lib/db/url";
import { readCookie, userFromToken } from "@/server/session";

loadEnv();
applyDatabaseUrl();

const prisma = new PrismaClient({
  transactionOptions: { maxWait: 10_000, timeout: 20_000 },
});
const port = Number(process.env.WS_PORT ?? 3001);
const sockets = new Set<Client>();

interface Client {
  socket: WebSocket;
  userId: string;
  matches: Set<string>;
}

function loadEnv() {
  try {
    const text = readFileSync(".env", "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      const value = match[2]?.replace(/^"|"$/g, "") ?? "";
      process.env[match[1]!] = value;
    }
  } catch {
    // The process environment already has the variables.
  }
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

async function fanout(matchId: string) {
  const view = await latestView(prisma, matchId);
  if (!view) return;
  const players = new Set([view.match.player1UserId, view.match.player2UserId].filter((id): id is string => Boolean(id)));
  for (const client of sockets) {
    if (!players.has(client.userId)) continue;
    const snapshot = view.snapshotFor(client.userId);
    if (snapshot.status === "active" && snapshot.version === 0) {
      send(client.socket, snapshot.kind === "friend" ? { type: "opponentJoined", matchId } : { type: "matchFound", matchId });
    }
    if (view.applied) {
      send(client.socket, {
        type: "moveAccepted",
        matchId,
        version: view.applied.version,
        ended: snapshot.status === "completed",
        applied: view.applied.applied,
        beforeBoard: view.applied.beforeBoard,
        beforeCaptured: view.applied.beforeCaptured,
      });
    }
    if (snapshot.status === "completed" || snapshot.status === "expired" || snapshot.status === "abandoned") {
      send(client.socket, { type: "gameOver", snapshot });
    }
    send(client.socket, { type: "snapshot", snapshot });
    client.matches.add(matchId);
  }
}

async function watch(client: Client, matchId: string) {
  client.matches.add(matchId);
  await markPresence(prisma, matchId, client.userId, true);
  const snapshot = await readMatch(prisma, { id: client.userId, displayName: "", createdAt: new Date() }, matchId).catch(() => null);
  if (snapshot) send(client.socket, { type: "snapshot", snapshot });
}

async function onMessage(client: Client, raw: string) {
  if (raw.length > 8_000) {
    send(client.socket, { type: "error", error: "That message was too large." });
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    send(client.socket, { type: "error", error: "That message could not be read." });
    return;
  }
  if (!isClientMessage(parsed)) {
    send(client.socket, { type: "error", error: "That message could not be read." });
    return;
  }
  if (!allow(`${client.userId}:socket`, 40, 10_000)) {
    send(client.socket, { type: "error", error: "Too many attempts. Wait a moment." });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: client.userId } });
  if (!user) {
    send(client.socket, { type: "error", error: "Reload the page." });
    return;
  }
  try {
    if (parsed.type === "queue.join") {
      const result = await joinQueue(prisma, user);
      if (result.matchId) send(client.socket, { type: "matchFound", matchId: result.matchId });
      else send(client.socket, { type: "queue", status: "searching" });
      return;
    }
    if (parsed.type === "queue.cancel") {
      const result = await cancelQueue(prisma, user);
      if (result.matchId) send(client.socket, { type: "matchFound", matchId: result.matchId });
      else send(client.socket, { type: "queue", status: "cancelled" });
      return;
    }
    if (parsed.type === "room.create") {
      const room = await createFriendRoom(prisma, user);
      send(client.socket, { type: "snapshot", snapshot: await readMatch(prisma, user, room.matchId) });
      return;
    }
    if (parsed.type === "room.join") {
      const joined = await joinFriendRoom(prisma, user, parsed.token);
      await watch(client, joined.matchId);
      return;
    }
    if (parsed.type === "room.leave") {
      await leaveWaitingRoom(prisma, user, parsed.matchId);
      return;
    }
    if (parsed.type === "match.resume") {
      await watch(client, parsed.matchId);
      return;
    }
    if (parsed.type === "move") {
      await watch(client, parsed.matchId);
      await submitMove(prisma, user, parsed);
      return;
    }
    if (parsed.type === "resign") {
      await resignMatch(prisma, user, parsed);
      return;
    }
    if (parsed.type === "draw") {
      await drawMatch(prisma, user, parsed);
    }
  } catch (error) {
    const message = error instanceof MatchError ? error.message : "The server could not do that.";
    if (parsed.type === "room.join") send(client.socket, { type: "inviteInvalid", error: message });
    else if ("matchId" in parsed && typeof parsed.matchId === "string") {
      send(client.socket, { type: "moveRejected", matchId: parsed.matchId, error: message });
    } else send(client.socket, { type: "error", error: message });
  }
}

export async function attachRealtime(server: Server) {
  const listen = new (await import("pg")).default.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await listen.connect();
  } catch (error) {
    const unreachable = error instanceof Error && "code" in error && error.code === "ENETUNREACH";
    if (unreachable && /supabase/.test(process.env.DATABASE_URL ?? "")) {
      console.error(
        "The Supabase direct host is IPv6-only and this machine has no IPv6 route. Use the session pooler string from the Supabase connect dialog, on port 5432, with sslmode=require.",
      );
    }
    throw error;
  }
  await listen.query("LISTEN playoware_match");
  listen.on("notification", (message) => {
    if (message.channel === "playoware_match" && message.payload) void fanout(message.payload);
  });

  const wss = new WebSocketServer({ server });
  wss.on("connection", (socket, request) => {
    void (async () => {
      const token = readCookie(request.headers.cookie, SESSION_COOKIE);
      const user = await userFromToken(prisma, token);
      if (!user) {
        send(socket, { type: "error", error: "Reload the page." });
        socket.close();
        return;
      }
      const client: Client = { socket, userId: user.id, matches: new Set() };
      sockets.add(client);
      socket.on("message", (data) => {
        void onMessage(client, data.toString());
      });
      socket.on("close", () => {
        sockets.delete(client);
        const matchIds = [...client.matches];
        const userId = client.userId;
        setTimeout(() => {
          const stillHere = [...sockets].some((other) => other.userId === userId);
          if (stillHere) return;
          for (const matchId of matchIds) void markPresence(prisma, matchId, userId, false);
        }, 1_500);
      });
    })();
  });

  setInterval(() => {
    void sweepGrace(prisma).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("sweep failed", message);
    });
  }, 5_000);
}

async function main() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("playoware realtime");
  });
  await attachRealtime(server);
  server.listen(port, "127.0.0.1", () => {
    console.log(`realtime listening on ws://127.0.0.1:${port}`);
  });
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  void main();
}
