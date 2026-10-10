"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMovePlayback } from "@/components/board/useMovePlayback";
import { PlayerBar } from "@/components/game/PlayerBar";
import { ResultDialog } from "@/components/game/ResultDialog";
import { useSettings } from "@/components/settings/SettingsProvider";
import { barState, rematchPath } from "@/components/online/turn";
import { Button } from "@/components/ui/Button";
import { initialBoard, initialTerritory, opponent, type AppliedMove, type CapturedSeeds, type GameState, type Player } from "@/engine/oware";
import { decideIncoming, preferNewer, shouldStartAccepted } from "@/lib/animation/incoming";
import { OwareGameView } from "@/game/OwareGameView";
import { ownedHousesInView } from "@/game/layout/pits";
import { connectionLabel, reconnectDelay } from "@/realtime/backoff";
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
  const inviteRef = useRef<HTMLParagraphElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<"connecting" | "open" | "closed">("connecting");
  const [pollOk, setPollOk] = useState(true);
  const [seenOpponent, setSeenOpponent] = useState(false);
  const versionRef = useRef(0);
  const animatingRef = useRef(false);
  const pendingRef = useRef<MatchSnapshot | null>(null);
  const snapshotRef = useRef<MatchSnapshot | null>(null);
  const playRef = useRef<(next: MatchSnapshot) => void>(() => undefined);
  const playback = useMovePlayback({
    speed: settings.animation,
    reduced: reducedMotion,
    sound: settings.sound,
    onDone: () => {
      animatingRef.current = false;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) playRef.current(pending);
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

  function playIncoming(next: MatchSnapshot) {
    const previous = snapshotRef.current;
    const opponentSide = next.you === "player1" ? "player2" : "player1";
    const opponentConnected = opponentSide === "player1" ? next.player1Connected : next.player2Connected;
    if (opponentConnected) setSeenOpponent(true);
    const decision = decideIncoming({
      hasSnapshot: previous !== null,
      currentVersion: versionRef.current,
      previousPitCount: previous?.pits.length ?? 0,
      nextVersion: next.version,
      nextPits: next.pits,
      animating: animatingRef.current,
    });
    if (decision.type === "ignore") return;
    if (decision.type === "hold") {
      pendingRef.current = preferNewer(pendingRef.current, next);
      return;
    }
    if (decision.type === "store") {
      versionRef.current = next.version;
      snapshotRef.current = next;
      setSnapshot(next);
      if (decision.land) {
        landRef.current({ board: next.board, captured: next.captured, currentPlayer: next.currentPlayer });
      }
      return;
    }
    if (decision.type === "apply") {
      applySnapshot(next);
      return;
    }
    versionRef.current = next.version;
    snapshotRef.current = next;
    setSnapshot(next);
    animatingRef.current = true;
    startRef.current(decision.sow.beforeBoard, decision.sow.beforeCaptured, decision.sow.applied, next.status === "completed", {
      board: next.board,
      captured: next.captured,
      currentPlayer: next.currentPlayer,
    });
  }
  playRef.current = playIncoming;

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
    let attempt = 0;

    function handle(message: ServerMessage) {
      if (message.type === "snapshot" || message.type === "gameOver") {
        const next = message.snapshot;
        if (next.matchId !== id) return;
        playRef.current(next);
        return;
      }
      if (message.type === "moveAccepted" && message.matchId === id) {
        if (!shouldStartAccepted({ currentVersion: versionRef.current, acceptedVersion: message.version, animating: animatingRef.current })) return;
        versionRef.current = message.version;
        animatingRef.current = true;
        startRef.current(message.beforeBoard, message.beforeCaptured, message.applied, message.ended);
        return;
      }
      if (message.type === "moveRejected" && message.matchId === id) setError(message.error);
      if (message.type === "error") setError(message.error);
    }

    function receive(next: MatchSnapshot) {
      playRef.current(next);
    }

    function connect(initial: boolean) {
      if (stopped) return;
      if (initial) setSocketState("connecting");
      socket = new WebSocket(socketUrl());
      socket.onopen = () => {
        attempt = 0;
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
        if (!stopped) {
          const delay = reconnectDelay(attempt);
          attempt += 1;
          timer = window.setTimeout(() => connect(false), delay);
        }
      };
    }

    async function poll() {
      try {
        const response = await fetch(`/api/matches/${id}`, { cache: "no-store" });
        const body = (await response.json()) as MatchSnapshot & { error?: string };
        if (stopped) return;
        if (!response.ok) {
          setPollOk(false);
          if (!snapshotRef.current) setError(body.error ?? "This match is not available.");
          return;
        }
        setPollOk(true);
        if (!snapshotRef.current) setError(null);
        receive(body);
      } catch {
        if (!stopped && !snapshotRef.current) setError("The server could not be reached.");
        if (!stopped) setPollOk(false);
      }
    }

    connect(true);
    void poll();
    const pollTimer = window.setInterval(() => void poll(), 2000);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(pollTimer);
      socket?.close();
      void fetch(`/api/matches/${id}/presence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connected: false }),
        keepalive: true,
      });
    };
  }, [id]);

  async function recoverMatch() {
    try {
      const fresh = await fetch(`/api/matches/${id}`, { cache: "no-store" });
      if (!fresh.ok) {
        setError((current) => current ?? "The server could not be reached.");
        return;
      }
      playRef.current((await fresh.json()) as MatchSnapshot);
    } catch {
      setError((current) => current ?? "The server could not be reached.");
    }
  }

  async function sendAction(path: string, body: Record<string, unknown>) {
    setError(null);
    try {
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
        await recoverMatch();
        return;
      }
      if (
        payload.applied &&
        payload.beforeBoard &&
        payload.beforeCaptured &&
        payload.version !== undefined &&
        shouldStartAccepted({ currentVersion: versionRef.current, acceptedVersion: payload.version, animating: animatingRef.current })
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
      if (payload.snapshot) playRef.current(payload.snapshot);
    } catch {
      await recoverMatch();
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
  const sower = playback.playing ? playback.applied?.move.player ?? null : null;
  const opponentBar = barState({ side: opponentSide, you, sower, yourTurn: snapshot.yourTurn, over, waiting });
  const yourBar = barState({ side: you, you, sower, yourTurn: snapshot.yourTurn, over, waiting });
  const invite = link ? `${window.location.origin}${link}` : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link href="/play" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft">
          ← Back
        </Link>
        {waiting ? null : (
          <>
            <p className="font-serif text-xl">Oware</p>
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
          </>
        )}
      </div>
      <p className="text-center text-sm font-semibold text-ink-soft">{connectionLabel({ socket: socketState, pollOk })}</p>
      {seenOpponent && !opponentConnected && snapshot.status === "active" ? (
        <p className="text-center text-sm font-semibold text-ink-soft">Opponent disconnected. The table stays open while they reconnect.</p>
      ) : null}
      {waiting ? (
        <section className="rounded-[28px] border border-line bg-paper p-5 sm:p-6">
          <h1 className="font-serif text-4xl tracking-tight text-balance">Waiting for a friend</h1>
          <p className="mt-2 max-w-[36ch] leading-7 text-ink-soft">Send this link. It works once, for one player.</p>
          {invite ? (
            <>
              <p ref={inviteRef} className="mt-5 overflow-x-auto rounded-2xl bg-cream px-4 py-3 text-sm whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{invite}</p>
              <button
                type="button"
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-forest text-sm font-semibold text-paper hover:bg-forest-dark"
                onClick={() => {
                  void navigator.clipboard.writeText(invite).then(
                    () => {
                      setCopied(true);
                      setError(null);
                      window.setTimeout(() => setCopied(false), 1500);
                    },
                    () => {
                      const node = inviteRef.current;
                      if (node) {
                        const range = document.createRange();
                        range.selectNodeContents(node);
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                      }
                      setCopied(false);
                      setError("The link is selected. Copy it from there.");
                    },
                  );
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </>
          ) : (
            <p className="mt-5 text-sm leading-6 text-ink-soft">The invitation link is on the device that created this table.</p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => {
              void fetch(`/api/matches/${id}/leave`, { method: "POST" }).then(() => router.push("/play"));
            }}
          >
            Cancel invitation
          </Button>
        </section>
      ) : null}
      {waiting ? (
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="h-9 w-9 shrink-0 rounded-full border border-dashed border-ink-soft/50 bg-paper sm:h-11 sm:w-11" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Empty seat</p>
            <p className="truncate font-serif text-lg leading-tight sm:text-xl">Not here yet</p>
          </div>
        </div>
      ) : (
        <PlayerBar
          name={names[opponentSide]}
          player={opponentSide}
          houses={houses[opponentSide]}
          seeds={captured[opponentSide]}
          active={opponentBar.active}
          status={opponentBar.status}
        />
      )}
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
        active={yourBar.active}
        status={yourBar.status}
      />
      {error ? <p className="text-center text-sm text-bad">{error}</p> : null}
      {!waiting && !over ? (
        <div className="flex justify-center gap-3">
          <Button variant="secondary" disabled={playback.playing} onClick={() => void sendAction(`/api/matches/${id}/draw`, {})}>
            {snapshot.drawOffer && snapshot.drawOffer !== you ? "Accept draw" : "Offer draw"}
          </Button>
          <Button variant="danger" disabled={playback.playing} onClick={() => void sendAction(`/api/matches/${id}/resign`, {})}>
            Resign
          </Button>
        </div>
      ) : null}
      {waiting ? null : <p className="text-center text-sm text-ink-soft tabular-nums">Round {snapshot.round ?? 1}</p>}
      {snapshot.status === "completed" ? (
        <ResultDialog
          names={names}
          you={snapshot.you}
          state={{ ...state, status: snapshot.winner ? "won" : "draw", winner: snapshot.winner ?? undefined }}
          saveState="saved"
          onRetrySave={() => undefined}
          onReview={() => router.push(`/review/${id}`)}
          onAgain={() => router.push(rematchPath(snapshot.kind))}
        />
      ) : null}
    </main>
  );
}
