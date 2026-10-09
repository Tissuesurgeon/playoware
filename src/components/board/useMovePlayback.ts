"use client";

import { useEffect, useRef, useState } from "react";
import type { AppliedMove, CapturedSeeds, Player } from "@/engine/oware";
import { buildMoveAnimation, foldAnimation, type VisualFrame } from "@/lib/animation/sequence";
import { eventDuration, type AnimationSpeed } from "@/lib/animation/timing";
import { sounds } from "@/lib/sound";

interface PlayState {
  beforeBoard: number[];
  beforeCaptured: CapturedSeeds;
  applied: AppliedMove;
  index: number;
}

export interface SettledMove {
  board: number[];
  captured: CapturedSeeds;
  currentPlayer: Player;
}

export function useMovePlayback(options: {
  speed: AnimationSpeed;
  reduced: boolean;
  sound: boolean;
  onDone: () => void;
}) {
  const [play, setPlay] = useState<PlayState | null>(null);
  const [events, setEvents] = useState<ReturnType<typeof buildMoveAnimation>>([]);
  const [settle, setSettle] = useState<SettledMove | null>(null);
  const [rush, setRush] = useState(0);
  const onDoneRef = useRef(options.onDone);
  const soundRef = useRef(options.sound);
  const speedRef = useRef(options.speed);
  const reducedRef = useRef(options.reduced);
  const rushRef = useRef(0);
  const soundedRef = useRef(-1);

  useEffect(() => {
    onDoneRef.current = options.onDone;
    soundRef.current = options.sound;
    speedRef.current = options.speed;
    reducedRef.current = options.reduced;
  });

  const folded: VisualFrame | null =
    play && events.length > 0 ? foldAnimation(play.beforeBoard, play.beforeCaptured, events, play.index) : null;
  const frame: VisualFrame | null =
    folded && settle && play && play.index >= events.length - 1
      ? {
          ...folded,
          board: settle.board.slice(),
          captured: { ...settle.captured },
          hand: 0,
          handPit: null,
          capture: null,
          actor: settle.currentPlayer,
        }
      : folded;

  useEffect(() => {
    if (!play || events.length === 0 || play.index < 0) return;
    const event = events[play.index];
    if (!event) return;
    if (soundedRef.current !== play.index) {
      soundedRef.current = play.index;
      if (soundRef.current && event.type === "PICK_UP") sounds.pickup();
      if (soundRef.current && event.type === "DROP_SEED") sounds.sow();
      if (soundRef.current && event.type === "CAPTURE_PIT") sounds.capture();
      if (soundRef.current && event.type === "CHANGE_TURN") sounds.turn();
    }
    const finished = play.index >= events.length - 1;
    const delay = eventDuration(event, speedRef.current, rushRef.current >= 1);
    const timer = window.setTimeout(() => {
      if (finished) {
        setPlay(null);
        setEvents([]);
        setSettle(null);
        rushRef.current = 0;
        soundedRef.current = -1;
        setRush(0);
        onDoneRef.current();
        return;
      }
      setPlay((current) => (current ? { ...current, index: current.index + 1 } : current));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [play, events, rush]);

  function start(
    beforeBoard: number[],
    beforeCaptured: CapturedSeeds,
    applied: AppliedMove,
    ended: boolean,
    settled?: SettledMove,
  ) {
    if (reducedRef.current || speedRef.current === "instant") {
      queueMicrotask(() => onDoneRef.current());
      return;
    }
    rushRef.current = 0;
    soundedRef.current = -1;
    setRush(0);
    setSettle(settled ? { board: settled.board.slice(), captured: { ...settled.captured }, currentPlayer: settled.currentPlayer } : null);
    setEvents(buildMoveAnimation(beforeBoard, applied, ended));
    setPlay({
      beforeBoard: beforeBoard.slice(),
      beforeCaptured: { ...beforeCaptured },
      applied,
      index: 0,
    });
  }

  function land(settled: SettledMove) {
    setSettle({ board: settled.board.slice(), captured: { ...settled.captured }, currentPlayer: settled.currentPlayer });
  }

  function accelerate() {
    if (!play) return;
    if (rushRef.current >= 1) {
      rushRef.current = 2;
      setRush(2);
      setPlay((current) => (current ? { ...current, index: events.length - 1 } : current));
      return;
    }
    rushRef.current = 1;
    setRush(1);
  }

  function stop() {
    rushRef.current = 0;
    soundedRef.current = -1;
    setRush(0);
    setPlay(null);
    setEvents([]);
    setSettle(null);
  }

  const travelMs = eventDuration({ type: "MOVE_TO_PIT", pit: 0 }, options.speed, rush >= 1);
  const captureMs = eventDuration(
    { type: "CAPTURE_PIT", pit: 0, seedCount: 0, player: "player1" },
    options.speed,
    rush >= 1,
  );

  return {
    playing: play !== null,
    frame,
    applied: play?.applied ?? null,
    travelMs,
    captureMs,
    start,
    land,
    accelerate,
    stop,
  };
}
