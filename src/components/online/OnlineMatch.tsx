"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMovePlayback } from "@/components/board/useMovePlayback";
import { PlayerBar } from "@/components/game/PlayerBar";
import { ResultDialog } from "@/components/game/ResultDialog";
import { useSettings } from "@/components/settings/SettingsProvider";
import { Button } from "@/components/ui/Button";
import { initialBoard, initialTerritory, opponent, type AppliedMove, type CapturedSeeds, type GameState, type Player } from "@/engine/oware";
import { OwareGameView } from "@/game/OwareGameView";
import { ownedHousesInView } from "@/game/layout/pits";
import { socketUrl } from "@/realtime/browser";
import type { MatchSnapshot, ServerMessage } from "@/realtime/protocol";

function inviteKey(matchId: string) {
  return `playoware:invite:${matchId}`;
}

export function rememberInvite(matchId: string, path: string) {
  sessionStorage.setItem(inviteKey(matchId), path);
}

export function OnlineMatch({ id }: { id: string }) {
  const router = useRouter();
  const { settings, reducedMotion, update } = useSettings();
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const link = useSyncExternalStore(
    () => () => undefined,
    () => sessionStorage.getItem(inviteKey(id)),
    () => null,
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<"connecting" | "open" | "closed">("connecting");
  const [seenOpponent, setSeenOpponent] = useState(false);
  const versionRef = useRef(0);
  const animatingRef = useRef(false);
  const pendingRef = useRef<MatchSnapshot | null>(null);
  const snapshotRef = useRef<MatchSnapshot | null>(null);
  const playback = useMovePlayback({
    speed: settings.animation,
    reduced: reducedMotion,
    sound: settings.sound,
    onDone: () => {
      animatingRef.current = false;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending && pending.version !== versionRef.current) applyRef.current(pending);
    },
  });
  const startRef = useRef(playback.start);
  const landRef = useRef(playback.land);
  const stopRef = useRef(playback.stop);
  startRef.current = playback.start;
  landRef.current = playback.land;
  stopRef.current = playback.stop;

  function applySnapshot(next: MatchSnapshot) {
    versionRef.current = next.version;
    snapshotRef.current = next;
    setSnapshot(next);
    stopRef.current();
  }
  const applyRef = useRef(applySnapshot);
  applyRef.current = applySnapshot;

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const current = snapshotRef.current;
      const number = Number(event.key);
      if (!current?.yourTurn || number < 1 || number > 6 || animatingRef.current) return;
      const viewer = current.you ?? "player1";
      const pit = ownedHousesInView(viewer, current.territory ?? initialTerritory())[number - 1];
      if (pit === undefined || !current.legalPits.includes(pit)) return;
      void sendAction(`/api/matches/${id}/moves`, { pit });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let timer = 0;

    function handle(message: ServerMessage) {
      if (message.type === "snapshot" || message.type === "gameOver") {
        const next = message.type === "snapshot" ? message.snapshot : message.snapshot;
        if (next.matchId !== id) return;
        const opponentSide = next.you === "player1" ? "player2" : "player1";
        const opponentConnected = opponentSide === "player1" ? next.player1Connected : next.player2Connected;
        if (opponentConnected) setSeenOpponent(true);
        if (next.version === versionRef.current) {
          snapshotRef.current = next;
          setSnapshot(next);
          if (animatingRef.current) {
            landRef.current({ board: next.board, captured: next.captured, currentPlayer: next.currentPlayer });
          }
          return;
        }
        if (animatingRef.current) {
          pendingRef.current = next;
          return;
        }
        applyRef.current(next);
        return;
      }
      if (message.type === "moveAccepted" && message.matchId === id) {
        if (message.version !== versionRef.current + 1) return;
        versionRef.current = message.version;
        animatingRef.current = true;
        startRef.current(message.beforeBoard, message.beforeCaptured, message.applied, message.ended);
        return;
      }
      if (message.type === "moveRejected" && message.matchId === id) setError(message.error);
      if (message.type === "error") setError(message.error);
    }

    function connect() {
      if (stopped) return;
      setSocketState("connecting");
      socket = new WebSocket(socketUrl());
      socket.onopen = () => {
        setSocketState("open");
        socket?.send(JSON.stringify({ type: "match.resume", matchId: id }));
      };
      socket.onmessage = (event) => {
        try {
          handle(JSON.parse(String(event.data)) as ServerMessage);
        } catch {
          setError("That message could not be read.");
        }
      };
      socket.onclose = () => {
        setSocketState("closed");
        if (!stopped) timer = window.setTimeout(connect, 1000);
      };
    }

    connect();
    void fetch(`/api/matches/${id}`)
      .then(async (response) => {
        const body = (await response.json()) as MatchSnapshot & { error?: string };
        if (!response.ok) {
          setError(body.error ?? "This match is not available.");
          return;
        }
        if (!animatingRef.current) applyRef.current(body);
      })
      .catch(() => setError("The server could not be reached."));

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, [id]);

  async function sendAction(path: string, body: Record<string, unknown>) {
    setError(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, expectedVersion: versionRef.current, clientMoveId: crypto.randomUUID() }),
    });
    const payload = (await response.json()) as {
      error?: string;
      snapshot?: MatchSnapshot;
      applied?: AppliedMove | null;
      beforeBoard?: number[];
      beforeCaptured?: CapturedSeeds;
      version?: number;
    };
    if (!response.ok) {
      setError(payload.error ?? "That move was rejected.");
      const fresh = await fetch(`/api/matches/${id}`);
      if (fresh.ok) applySnapshot((await fresh.json()) as MatchSnapshot);
      return;
    }
    if (
      payload.applied &&
      payload.beforeBoard &&
      payload.beforeCaptured &&
      payload.version === versionRef.current + 1
    ) {
      versionRef.current = payload.version;
      animatingRef.current = true;
      startRef.current(
        payload.beforeBoard,
        payload.beforeCaptured,
        payload.applied,
        payload.snapshot?.status === "completed",
        payload.snapshot
          ? {
              board: payload.snapshot.board,
              captured: payload.snapshot.captured,
              currentPlayer: payload.snapshot.currentPlayer,
            }
          : undefined,
      );
      if (payload.snapshot) {
        snapshotRef.current = payload.snapshot;
        setSnapshot(payload.snapshot);
      }
      return;
    }
    if (payload.snapshot && !animatingRef.current) {
      versionRef.current = payload.snapshot.version;
      snapshotRef.current = payload.snapshot;
      setSnapshot(payload.snapshot);
    }
  }

  if (!snapshot && !error) return <main className="p-8 text-sm text-ink-soft">Opening the table…</main>;
  if (!snapshot) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-serif text-4xl">This table isn’t yours</h1>
        <p className="mt-3 text-ink-soft">{error}</p>
        <Link href="/play" className="mt-6 inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm font-semibold text-paper">
          Back to play
        </Link>
      </main>
    );
  }

  const you = snapshot.you ?? "player1";
  const opponentSide = opponent(you);
  const names = { player1: snapshot.player1Name, player2: snapshot.player2Name || "Waiting" };
  const opponentConnected = opponentSide === "player1" ? snapshot.player1Connected : snapshot.player2Connected;
  const frame = playback.frame;
  const board = frame?.board ?? snapshot.board;
  const captured = frame?.captured ?? snapshot.captured;
  const over = snapshot.status === "completed" || snapshot.status === "expired" || snapshot.status === "abandoned";
  const waiting = snapshot.status === "waiting";
  const territory = snapshot.territory?.length === 12 ? snapshot.territory : initialTerritory();
  const state: GameState = {
    board: snapshot.board,
    territory,
    round: snapshot.round ?? 1,
    openings: [],
    currentPlayer: snapshot.currentPlayer,
    capturedSeeds: snapshot.captured,
    moveNumber: snapshot.pits.length,
    status: snapshot.status === "completed" ? (snapshot.winner ? "won" : "draw") : "in_progress",
    winner: snapshot.winner ?? undefined,
    endReason: (snapshot.endReason as GameState["endReason"]) ?? undefined,
    moveHistory: snapshot.pits.map((pit, index) => ({
      pit,
      player: (index % 2 === 0 ? "player1" : "player2") as Player,
      moveNumber: index + 1,
    })),
  };
  const houses = {
    player1: territory.filter((owner) => owner === "player1").length,
    player2: territory.filter((owner) => owner === "player2").length,
  };
  const speedLabel = settings.animation === "fast" ? "Fast" : settings.animation === "instant" ? "Instant" : "Normal";
  const invite = link ? `${window.location.origin}${link}` : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link href="/play" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft">
          ← Back
        </Link>
        <p className="font-serif text-xl">{waiting ? "Waiting" : "Oware"}</p>
        <button
          type="button"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft"
          onClick={() => {
            const order = ["normal", "fast", "instant"] as const;
            const next = order[(order.indexOf(settings.animation) + 1) % order.length] ?? "normal";
            update({ ...settings, animation: next });
          }}
        >
          {speedLabel}
        </button>
      </div>
      {socketState !== "open" ? <p className="text-center text-sm font-semibold text-ink-soft">Reconnecting…</p> : null}
      {seenOpponent && !opponentConnected && snapshot.status === "active" ? (
        <p className="text-center text-sm font-semibold text-ink-soft">Opponent disconnected. The game is held open.</p>
      ) : null}
      {waiting ? (
        <section className="rounded-3xl border border-line bg-paper p-6">
          <h1 className="font-serif text-3xl">Waiting for a friend</h1>
          <p className="mt-2 text-ink-soft">Send this link. It works once, for one player.</p>
          {invite ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <code className="rounded-2xl bg-cream px-3 py-2 text-sm break-all">{invite}</code>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(invite).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">The invitation link is on the device that created this table.</p>
          )}
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-ink-soft"
            onClick={() => {
              void fetch(`/api/matches/${id}/leave`, { method: "POST" }).then(() => router.push("/play"));
            }}
          >
            Cancel invitation
          </button>
        </section>
      ) : null}
      <PlayerBar
        name={names[opponentSide]}
        player={opponentSide}
        houses={houses[opponentSide]}
        seeds={captured[opponentSide]}
        active={!playback.playing && snapshot.yourTurn === false && !over && !waiting}
        status={waiting ? "Not here yet" : undefined}
      />
      <OwareGameView
        board={board.length === 12 ? board : initialBoard()}
        territory={territory}
        viewer={you}
        legalPits={playback.playing || over || waiting ? [] : snapshot.legalPits}
        captured={captured}
        reduced={reducedMotion}
        selectedPit={playback.playing ? playback.applied?.move.pit : undefined}
        landedPit={frame?.landedPit ?? undefined}
        hand={
          frame && frame.hand > 0 && frame.handPit !== null
            ? { pit: frame.handPit, count: frame.hand, player: names[playback.applied?.move.player ?? snapshot.currentPlayer] }
            : null
        }
        capture={
          frame?.capture
            ? { pit: frame.capture.pit, count: frame.capture.count, toward: frame.capture.player === you ? "bottom" : "top" }
            : null
        }
        activeBottom={(frame?.actor ?? snapshot.currentPlayer) === you}
        travelMs={playback.travelMs}
        captureMs={playback.captureMs}
        onPlay={(pit) => void sendAction(`/api/matches/${id}/moves`, { pit })}
        onAccelerate={playback.playing ? playback.accelerate : undefined}
        disabled={playback.playing || over || waiting || !snapshot.yourTurn}
      />
      <PlayerBar
        name={names[you]}
        player={you}
        houses={houses[you]}
        seeds={captured[you]}
        active={snapshot.yourTurn && !playback.playing && !over}
        status={snapshot.yourTurn && !over ? "Your turn" : undefined}
      />
      {error ? <p className="text-center text-sm text-bad">{error}</p> : null}
      {!waiting && !over ? (
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => void sendAction(`/api/matches/${id}/draw`, {})}>
            {snapshot.drawOffer && snapshot.drawOffer !== you ? "Accept draw" : "Offer draw"}
          </Button>
          <Button variant="danger" onClick={() => void sendAction(`/api/matches/${id}/resign`, {})}>
            Resign
          </Button>
        </div>
      ) : null}
      <p className="text-center text-sm text-ink-soft tabular-nums">Round {snapshot.round ?? 1}</p>
      {snapshot.status === "completed" ? (
        <ResultDialog
          names={names}
          you={snapshot.you}
          state={{ ...state, status: snapshot.winner ? "won" : "draw", winner: snapshot.winner ?? undefined }}
          saveState="saved"
          onRetrySave={() => undefined}
          onReview={() => router.push(`/review/${id}`)}
          onAgain={() => router.push("/play/queue")}
        />
      ) : null}
    </main>
  );
}
