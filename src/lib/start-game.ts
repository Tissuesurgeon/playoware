"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalGameSession } from "@/lib/game/session";
import { aiLabel } from "@/lib/format";
import { readLocalName } from "@/lib/settings";
import { writeSnapshot } from "@/lib/storage";
import type { Difficulty } from "@/lib/ai";

export async function loadName() {
  try {
    const response = await fetch("/api/me");
    if (!response.ok) return readLocalName();
    const body = (await response.json()) as { displayName?: string };
    return body.displayName || readLocalName();
  } catch {
    return readLocalName();
  }
}

export function startGame(options: {
  mode: "local" | "ai";
  player1Name: string;
  player2Name: string;
  aiDifficulty?: Difficulty;
}) {
  const id = crypto.randomUUID();
  let seed = 1;
  for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const session = new LocalGameSession({
    id,
    mode: options.mode,
    player1Name: options.player1Name.trim() || "Player",
    player2Name: options.player2Name.trim() || "Guest",
    aiDifficulty: options.aiDifficulty,
    aiSeed: seed >>> 0,
  });
  writeSnapshot(session.snapshot(), true);
  return id;
}

export function useStart() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function go(options: Parameters<typeof startGame>[0]) {
    setPending(true);
    const name = options.player1Name || (await loadName());
    const id = startGame({ ...options, player1Name: name });
    router.push(`/game/${id}`);
  }

  return { pending, go };
}

export function difficultyName(difficulty: Difficulty) {
  return aiLabel(difficulty);
}
