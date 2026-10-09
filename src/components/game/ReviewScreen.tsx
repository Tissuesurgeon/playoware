"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { OwareGameView } from "@/game/OwareGameView";
import { useMovePlayback } from "@/components/board/useMovePlayback";
import { useSettings } from "@/components/settings/SettingsProvider";
import { formatMove, replayGame, type AppliedMove, type GameState } from "@/engine/oware";
import { assessMove, classLabel, type MoveAssessment } from "@/lib/game/analysis";
import { LocalGameSession } from "@/lib/game/session";
import { readSnapshot } from "@/lib/storage";

interface ReviewData {
  player1Name: string;
  player2Name: string;
  moves: Array<{ pit: number }>;
  scoreP1: number;
  scoreP2: number;
  winner: string | null;
  endReason: string | null;
}

export function ReviewScreen({ id }: { id: string }) {
  const { settings, reducedMotion } = useSettings();
  const [data, setData] = useState<ReviewData | null>(null);
  const [missing, setMissing] = useState(false);
  const [index, setIndex] = useState(0);
  const [labels, setLabels] = useState<Record<number, MoveAssessment>>({});
  const [reviewing, setReviewing] = useState(false);
  const reviewingRef = useRef(false);
  const pendingIndex = useRef(0);
  const indexRef = useRef(0);
  const replayRef = useRef<ReturnType<typeof replayGame> | null>(null);
  const jumpRef = useRef<(next: number) => void>(() => undefined);
  const continueRef = useRef<() => void>(() => undefined);
  const playback = useMovePlayback({
    speed: settings.animation,
    reduced: reducedMotion,
    sound: settings.sound,
    onDone: () => continueRef.current(),
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/games/${id}`);
        if (response.ok) {
          const body = (await response.json()) as ReviewData & { moves: Array<{ pit: number }> };
          if (!cancelled) setData(body);
          return;
        }
      } catch {
        // The game may only exist on this device.
      }
      const snapshot = readSnapshot(id);
      if (!snapshot) {
        if (!cancelled) setMissing(true);
        return;
      }
      const session = LocalGameSession.fromSnapshot(snapshot);
      const state = session.getState();
      if (!cancelled) {
        setData({
          player1Name: snapshot.player1Name,
          player2Name: snapshot.player2Name,
          moves: snapshot.moves.map((move) => ({ pit: move.pit })),
          scoreP1: state.capturedSeeds.player1,
          scoreP2: state.capturedSeeds.player2,
          winner: state.winner ?? null,
          endReason: state.endReason ?? null,
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const replay = useMemo(() => (data ? replayGame(data.moves) : null), [data]);

  function startMove(current: NonNullable<typeof replay>, moveIndex: number) {
    const applied = current.applied[moveIndex];
    const before = current.states[moveIndex];
    if (!applied || !before) {
      reviewingRef.current = false;
      setReviewing(false);
      return;
    }
    pendingIndex.current = moveIndex + 1;
    playback.start(before.board, before.capturedSeeds, applied, moveIndex === current.applied.length - 1);
  }

  function pauseReview() {
    reviewingRef.current = false;
    setReviewing(false);
    playback.stop();
  }

  function jump(next: number) {
    pauseReview();
    setIndex(next);
  }

  function playReview() {
    if (!replay || reviewing) return;
    const moveIndex = index > 0 ? index - 1 : 0;
    if (!replay.applied[moveIndex]) return;
    reviewingRef.current = true;
    setReviewing(true);
    startMove(replay, moveIndex);
  }

  useEffect(() => {
    indexRef.current = index;
    replayRef.current = replay;
    jumpRef.current = jump;
    continueRef.current = () => {
      if (!reviewingRef.current) return;
      const current = replayRef.current;
      const nextState = pendingIndex.current;
      setIndex(nextState);
      if (!current || nextState >= current.applied.length) {
        reviewingRef.current = false;
        setReviewing(false);
        return;
      }
      const applied = current.applied[nextState];
      const before = current.states[nextState];
      if (!applied || !before) {
        reviewingRef.current = false;
        setReviewing(false);
        return;
      }
      pendingIndex.current = nextState + 1;
      playback.start(before.board, before.capturedSeeds, applied, nextState === current.applied.length - 1);
    };
  });

  useEffect(() => {
    if (!replay) return;
    let cancelled = false;
    async function analyze() {
      for (let moveIndex = 0; moveIndex < replay!.applied.length; moveIndex += 1) {
        if (cancelled) return;
        const before = replay!.states[moveIndex];
        const played = replay!.applied[moveIndex]?.move.pit;
        if (!before || played === undefined) continue;
        const assessment = assessMove(before, played);
        if (cancelled) return;
        setLabels((current) => ({ ...current, [moveIndex]: assessment }));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }
    void analyze();
    return () => {
      cancelled = true;
    };
  }, [replay]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const current = replayRef.current;
      if (!current) return;
      if (event.key === "ArrowLeft") jumpRef.current(Math.max(0, indexRef.current - 1));
      if (event.key === "ArrowRight") jumpRef.current(Math.min(current.states.length - 1, indexRef.current + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (missing) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-serif text-4xl">Game not found</h1>
        <Link href="/history" className="mt-4 inline-block text-sm font-semibold text-clay">
          Game history
        </Link>
      </main>
    );
  }
  if (!data || !replay) return <main className="p-8 text-sm text-ink-soft">Loading the review…</main>;

  const state = replay.states[index] ?? replay.states[0]!;
  const frame = playback.frame;
  const playedMove: AppliedMove | null = playback.applied ?? (index > 0 ? (replay.applied[index - 1] ?? null) : null);
  const shown: GameState = frame
    ? { ...state, board: frame.board, capturedSeeds: frame.captured }
    : state;
  const played = playedMove;
  const assessment = index > 0 ? labels[index - 1] : undefined;
  const total = replay.states.length - 1;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Link href="/history" className="text-sm font-semibold text-ink-soft">
            ← History
          </Link>
          <h1 className="font-serif text-xl">Game review</h1>
          <span className="text-sm text-ink-soft">
            {data.scoreP1} — {data.scoreP2}
            <span className="mt-1 block text-xs">
              {shown.territory.filter((owner) => owner === "player1").length} houses —{" "}
              {shown.territory.filter((owner) => owner === "player2").length} houses
            </span>
          </span>
        </div>
        <OwareGameView
          board={shown.board}
          territory={shown.territory}
          viewer="player1"
          legalPits={[]}
          captured={shown.capturedSeeds}
          reduced={reducedMotion}
          selectedPit={playback.playing ? playback.applied?.move.pit : undefined}
          lastPit={playback.playing ? undefined : played?.move.pit}
          landedPit={frame?.landedPit ?? undefined}
          hand={
            frame && frame.hand > 0 && frame.handPit !== null
              ? {
                  pit: frame.handPit,
                  count: frame.hand,
                  player: (playback.applied?.move.player === "player2" ? data.player2Name : data.player1Name),
                }
              : null
          }
          capture={
            frame?.capture
              ? {
                  pit: frame.capture.pit,
                  count: frame.capture.count,
                  toward: frame.capture.player === "player1" ? "bottom" : "top",
                }
              : null
          }
          forfeitedPits={frame?.forfeitedPits ?? []}
          activeBottom={(frame?.actor ?? playback.applied?.move.player ?? state.currentPlayer) === "player1"}
          travelMs={playback.travelMs}
          captureMs={playback.captureMs}
          onAccelerate={playback.playing ? playback.accelerate : undefined}
          disabled
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" className="h-11 rounded-full border border-line px-4 text-sm font-semibold" onClick={() => jump(Math.max(0, index - 1))}>
            ← Previous
          </button>
          <button
            type="button"
            className="h-11 rounded-full bg-clay px-5 text-sm font-semibold text-paper"
            onClick={() => (reviewing ? pauseReview() : playReview())}
          >
            {reviewing ? "Pause" : "Play"}
          </button>
          <p className="text-sm font-semibold">
            Move {index} / {total}
          </p>
          <button type="button" className="h-11 rounded-full border border-line px-4 text-sm font-semibold" onClick={() => jump(Math.min(total, index + 1))}>
            Next →
          </button>
        </div>
        <div className="mt-4 rounded-3xl border border-line bg-paper p-4 text-sm">
          {played && assessment ? (
            <>
              <p className="font-semibold">{classLabel(assessment.classification)}</p>
              <p className="mt-1 text-ink-soft">{assessment.explanation}</p>
            </>
          ) : (
            <p className="text-ink-soft">Starting position. Both players have four seeds in every pit.</p>
          )}
          <p className="mt-3 text-xs text-ink-soft">
            Labels compare each move with a fixed-depth engine search. They are a guide, not a final judgment.
          </p>
        </div>
      </div>
      <aside className="rounded-3xl border border-line bg-paper p-4">
        <h2 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Move history</h2>
        <ol className="mt-3 max-h-[60vh] space-y-1 overflow-auto text-sm">
          {replay.applied.map((applied, moveIndex) => {
            const label = labels[moveIndex];
            return (
              <li key={applied.move.moveNumber}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-left ${index === moveIndex + 1 ? "bg-cream" : ""}`}
                  onClick={() => jump(moveIndex + 1)}
                >
                  <span>{formatMove(applied.move, applied.seedsCaptured, applied.capturedPits.length)}</span>
                  {label ? <span className="text-xs text-ink-soft">{classLabel(label.classification)}</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </main>
  );
}
