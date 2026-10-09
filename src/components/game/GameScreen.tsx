"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { OwareGameView } from "@/game/OwareGameView";
import { useMovePlayback } from "@/components/board/useMovePlayback";
import { PlayerBar } from "@/components/game/PlayerBar";
import { ResultDialog } from "@/components/game/ResultDialog";
import { useSettings } from "@/components/settings/SettingsProvider";
import { Button } from "@/components/ui/Button";
import {
  formatMove,
  initialTerritory,
  opponent,
  replayGame,
  type Player,
} from "@/engine/oware";
import { ownedHousesInView } from "@/game/layout/pits";
import { chooseMove } from "@/lib/ai";
import { LocalGameSession, type SessionSnapshot } from "@/lib/game/session";
import { sounds } from "@/lib/sound";
import {
  claimAiTurn,
  isGameBusy,
  readGameRaw,
  releaseAiTurn,
  setGameBusy,
  subscribeGameStorage,
  writeSnapshot,
} from "@/lib/storage";

function loadSession(raw: string) {
  if (raw === "pending" || raw === "missing") return null;
  try {
    return LocalGameSession.fromSnapshot(JSON.parse(raw) as SessionSnapshot);
  } catch {
    return null;
  }
}

export function GameScreen({ id }: { id: string }) {
  const router = useRouter();
  const { settings, reducedMotion, update } = useSettings();
  const soundRef = useRef(settings.sound);
  const finishRef = useRef<() => void>(() => undefined);
  const thinkRef = useRef<() => void>(() => undefined);
  const persistRef = useRef<(current: LocalGameSession) => void>(() => undefined);
  const playback = useMovePlayback({
    speed: settings.animation,
    reduced: reducedMotion,
    sound: settings.sound,
    onDone: () => finishRef.current(),
  });
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    soundRef.current = settings.sound;
  }, [settings.sound]);

  const raw = useSyncExternalStore(
    subscribeGameStorage,
    () => readGameRaw(id),
    () => "pending",
  );
  const session = useMemo(() => loadSession(raw), [raw]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || isGameBusy(id)) return;
      const current = loadSession(readGameRaw(id));
      if (!current || !current.snapshot().running || current.getState().status !== "in_progress") return;
      current.tick(Date.now());
      const ended = current.getState().status !== "in_progress";
      writeSnapshot(current.snapshot(), !ended);
      if (ended) {
        if (soundRef.current) sounds.end();
        void persistResult(current);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [id]);

  useEffect(() => {
    function onVisible() {
      if (document.hidden) return;
      const current = loadSession(readGameRaw(id));
      if (!current?.snapshot().running || current.getState().status !== "in_progress") return;
      current.resume(Date.now());
      writeSnapshot(current.snapshot(), true);
    }
    document.addEventListener("visibilitychange", onVisible);
    onVisible();
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [id]);

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      const current = loadSession(readGameRaw(id));
      if (current?.getState().status === "in_progress") {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [id]);

  async function persistResult(current: LocalGameSession) {
    if (current.serverId || current.getState().status === "in_progress") return;
    setSaveState("saving");
    const snapshot = current.snapshot();
    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: current.id,
          mode: current.mode,
          player1Name: current.player1Name,
          player2Name: current.player2Name,
          aiDifficulty: current.aiDifficulty ?? null,
          moves: snapshot.moves.map((move) => ({ pit: move.pit })),
          endCommand: snapshot.endCommand,
          startedAt: current.startedAt,
          timeControlMs: 300_000,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      const body = (await response.json()) as { id: string };
      current.serverId = body.id;
      writeSnapshot(current.snapshot(), false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function finishAnimation() {
    const current = loadSession(readGameRaw(id));
    if (!current) return;
    current.finishAnimation(Date.now());
    const ended = current.getState().status !== "in_progress";
    writeSnapshot(current.snapshot(), !ended);
    playback.stop();
    setGameBusy(id, false);
    if (ended) {
      if (soundRef.current) sounds.end();
      void persistResult(current);
      return;
    }
    if (current.mode === "ai" && current.getState().currentPlayer === "player2") void runAi();
  }

  async function runAi() {
    if (!claimAiTurn(id)) return;
    const started = loadSession(readGameRaw(id));
    if (!started || started.getState().status !== "in_progress" || started.getState().currentPlayer !== "player2") {
      releaseAiTurn(id);
      return;
    }
    setThinking(true);
    const live = started.getState();
    const difficulty = started.aiDifficulty ?? "medium";
    const seed = started.aiSeed + live.moveNumber;
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    let pit: number;
    try {
      pit = chooseMove(live, difficulty, seed).pit;
    } catch {
      setThinking(false);
      releaseAiTurn(id);
      setNotice("The AI could not choose a move.");
      return;
    }
    setGameBusy(id, true);
    const current = loadSession(readGameRaw(id));
    if (!current || current.getState().status !== "in_progress" || current.getState().currentPlayer !== "player2") {
      setThinking(false);
      setGameBusy(id, false);
      releaseAiTurn(id);
      return;
    }
    try {
      const before = current.getState();
      const applied = current.submitMove(pit, Date.now());
      const after = current.getState();
      writeSnapshot(current.snapshot(), after.status === "in_progress");
      setThinking(false);
      releaseAiTurn(id);
      if (applied.grandSlam) setNotice("All six houses cannot be captured. The seeds stay.");
      playback.start(before.board, before.capturedSeeds, applied, after.status !== "in_progress", {
        board: after.board,
        captured: after.capturedSeeds,
        currentPlayer: after.currentPlayer,
      });
    } catch {
      setThinking(false);
      setGameBusy(id, false);
      releaseAiTurn(id);
      setNotice("The AI could not choose a move.");
    }
  }

  useEffect(() => {
    finishRef.current = finishAnimation;
    thinkRef.current = () => void runAi();
    persistRef.current = (current) => void persistResult(current);
  });

  function playPit(pit: number) {
    if (playback.playing) {
      playback.accelerate();
      return;
    }
    if (!session || thinking || isGameBusy(id)) return;
    const live = session.getState();
    if (live.status !== "in_progress") return;
    if (session.mode === "ai" && live.currentPlayer !== "player1") return;
    if (!session.getLegalMoves().includes(pit)) {
      setNotice("That move is not legal.");
      return;
    }
    setGameBusy(id, true);
    const current = loadSession(readGameRaw(id));
    if (!current || current.getState().status !== "in_progress" || !current.getLegalMoves().includes(pit)) {
      setGameBusy(id, false);
      return;
    }
    const before = current.getState();
    const applied = current.submitMove(pit, Date.now());
    const after = current.getState();
    writeSnapshot(current.snapshot(), after.status === "in_progress");
    setNotice(applied.grandSlam ? "All six houses cannot be captured. The seeds stay." : null);
    playback.start(before.board, before.capturedSeeds, applied, after.status !== "in_progress", {
      board: after.board,
      captured: after.capturedSeeds,
      currentPlayer: after.currentPlayer,
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = loadSession(readGameRaw(id));
      if (!current || current.serverId || current.getState().status === "in_progress") return;
      persistRef.current(current);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    const current = loadSession(readGameRaw(id));
    if (!current) return;
    const live = current.getState();
    if (soundRef.current && live.moveNumber === 0 && live.status === "in_progress") sounds.start();
    const timer =
      current.mode === "ai" && live.currentPlayer === "player2" && live.status === "in_progress"
        ? window.setTimeout(() => thinkRef.current(), 40)
        : 0;
    return () => window.clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const number = Number(event.key);
      if (number < 1 || number > 6 || !session) return;
      const live = session.getState();
      const viewer: Player = session.mode === "ai" ? "player1" : live.currentPlayer;
      const pit = ownedHousesInView(viewer, live.territory)[number - 1];
      if (pit === undefined) return;
      playPit(pit);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (raw === "pending") return <main className="p-8 text-sm text-ink-soft">Loading the game…</main>;
  if (!session) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-serif text-4xl">This game isn’t on this device</h1>
        <p className="mt-3 text-ink-soft">Start a new one from the play menu.</p>
        <Link href="/play" className="mt-6 inline-flex h-11 items-center rounded-full bg-clay px-5 text-sm font-semibold text-paper">
          Play Oware
        </Link>
      </main>
    );
  }

  const state = session.getState();
  const replay = replayGame(state.moveHistory);
  const clocks = session.previewClock(Date.now());
  const over = state.status !== "in_progress";
  const frame = playback.frame;
  const mover = playback.applied?.move.player;
  const viewer: Player = session.mode === "ai" ? "player1" : mover ?? state.currentPlayer;
  const actor = frame?.actor ?? mover ?? state.currentPlayer;
  const topPlayer = opponent(viewer);
  const names = { player1: session.player1Name, player2: session.player2Name };
  const offer = session.snapshot().drawOffer;
  const legal =
    playback.playing || thinking || over || (session.mode === "ai" && state.currentPlayer !== "player1")
      ? []
      : session.getLegalMoves();
  const captured = frame?.captured ?? state.capturedSeeds;
  const territory = state.territory ?? initialTerritory();
  const owned = {
    player1: territory.filter((owner) => owner === "player1").length,
    player2: territory.filter((owner) => owner === "player2").length,
  };
  const shownSave = saveState === "idle" && session.serverId ? "saved" : saveState;
  const speedLabel = settings.animation === "fast" ? "Fast" : settings.animation === "instant" ? "Instant" : "Normal";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link
          href="/play"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft"
          onClick={(event) => {
            if (state.status === "in_progress" && !window.confirm("Leave this game? You can resume it from home.")) {
              event.preventDefault();
            }
          }}
        >
          ← Back
        </Link>
        <p className="font-serif text-xl">Oware</p>
        <div className="flex items-center gap-3">
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
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft"
            aria-pressed={settings.sound}
            onClick={() => update({ ...settings, sound: !settings.sound })}
          >
            {settings.sound ? "Sound on" : "Sound off"}
          </button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {thinking ? "AI is thinking." : over ? "The game is over." : `${names[state.currentPlayer]} to move.`}
      </p>
      <PlayerBar
        name={names[topPlayer]}
        player={topPlayer}
        houses={owned[topPlayer]}
        seeds={captured[topPlayer]}
        clockMs={clocks[topPlayer]}
        active={!playback.playing && !over && state.currentPlayer === topPlayer}
        thinking={thinking && topPlayer === "player2"}
      />
      <OwareGameView
        board={frame?.board ?? state.board}
        territory={territory}
        viewer={viewer}
        legalPits={legal}
        captured={captured}
        reduced={reducedMotion}
        selectedPit={playback.playing ? playback.applied?.move.pit : undefined}
        lastPit={playback.playing ? undefined : state.moveHistory.at(-1)?.pit}
        landedPit={frame?.landedPit ?? undefined}
        hand={
          frame && frame.hand > 0 && frame.handPit !== null
            ? { pit: frame.handPit, count: frame.hand, player: names[playback.applied?.move.player ?? state.currentPlayer] }
            : null
        }
        capture={
          frame?.capture
            ? {
                pit: frame.capture.pit,
                count: frame.capture.count,
                toward: frame.capture.player === viewer ? "bottom" : "top",
              }
            : null
        }
        forfeitedPits={frame?.forfeitedPits ?? []}
        activeBottom={actor === viewer}
        travelMs={playback.travelMs}
        captureMs={playback.captureMs}
        onPlay={playPit}
        onAccelerate={playback.playing ? playback.accelerate : undefined}
        disabled={playback.playing || thinking || over}
      />
      <PlayerBar
        name={names[viewer]}
        player={viewer}
        houses={owned[viewer]}
        seeds={captured[viewer]}
        clockMs={clocks[viewer]}
        active={!playback.playing && !over && state.currentPlayer === viewer}
      />
      <p className="text-center text-sm text-ink-soft tabular-nums">Round {state.round}</p>
      <div className="flex justify-center gap-2">
        <Button
          variant="secondary"
          disabled={over || playback.playing || thinking}
          onClick={() => {
            const result = session.offerDraw(session.mode === "ai" ? "player1" : state.currentPlayer, Date.now());
            writeSnapshot(session.snapshot(), session.getState().status === "in_progress");
            if (result === "declined") setNotice("The AI declines the draw.");
            if (result === "accepted") {
              if (settings.sound) sounds.end();
              void persistResult(session);
            }
          }}
        >
          Draw
        </Button>
        <Button variant="danger" disabled={over} onClick={() => setConfirmResign(true)}>
          Resign
        </Button>
      </div>
      {offer ? (
        <div className="mx-auto w-full max-w-sm rounded-2xl bg-paper p-3 text-sm">
          <p>{names[offer]} offers a draw.</p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => {
                session.respondDraw(opponent(offer), true, Date.now());
                writeSnapshot(session.snapshot(), false);
                if (settings.sound) sounds.end();
                void persistResult(session);
              }}
            >
              Accept
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                session.respondDraw(opponent(offer), false, Date.now());
                writeSnapshot(session.snapshot(), true);
              }}
            >
              Decline
            </Button>
          </div>
        </div>
      ) : null}
      {notice ? (
        <p className={`text-center text-sm ${notice.startsWith("All six houses") ? "text-ink-soft" : "text-bad"}`}>{notice}</p>
      ) : null}
      {thinking ? <p className="text-center text-sm font-semibold text-ink-soft">AI is thinking…</p> : null}
      <section>
        <div className="rounded-3xl border border-line bg-paper p-4 sm:p-5">
          <h2 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Game</h2>
          <ol className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
            {replay.applied.length === 0 ? <li className="text-ink-soft">No moves yet.</li> : null}
            {replay.applied.map((applied) => (
              <li key={applied.move.moveNumber}>{formatMove(applied.move, applied.seedsCaptured, applied.capturedPits.length)}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-soft">Keys 1–6 play the houses you still own, from the left.</p>
        </div>
      </section>
      {confirmResign && !over ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="resign-title">
          <div className="w-full max-w-sm rounded-3xl bg-paper p-6">
            <h2 id="resign-title" className="font-serif text-2xl">Resign?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {names[session.mode === "ai" ? "player1" : state.currentPlayer]} will lose the game.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmResign(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const player = session.mode === "ai" ? "player1" : state.currentPlayer;
                  playback.stop();
                  setThinking(false);
                  setGameBusy(id, false);
                  session.resign(player, Date.now());
                  writeSnapshot(session.snapshot(), false);
                  setConfirmResign(false);
                  if (settings.sound) sounds.end();
                  void persistResult(session);
                }}
              >
                Resign
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {over && !playback.playing ? (
        <ResultDialog
          session={session}
          state={state}
          saveState={shownSave}
          onRetrySave={() => void persistResult(session)}
          onReview={() => router.push(`/review/${id}`)}
          onAgain={() => {
            const nextId = crypto.randomUUID();
            const next = new LocalGameSession({
              id: nextId,
              mode: session.mode,
              player1Name: session.player1Name,
              player2Name: session.player2Name,
              aiDifficulty: session.aiDifficulty,
              aiSeed: session.aiSeed + 1,
            });
            writeSnapshot(next.snapshot(), true);
            router.push(`/game/${nextId}`);
          }}
        />
      ) : null}
    </main>
  );
}
