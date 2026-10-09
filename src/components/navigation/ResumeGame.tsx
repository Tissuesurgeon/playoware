"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import { readActiveGameId, readSnapshot, subscribeGameStorage } from "@/lib/storage";

export function ResumeGame() {
  const localId = useSyncExternalStore(subscribeGameStorage, readActiveGameId, () => null);
  const [onlineId, setOnlineId] = useState<string | null>(null);
  const local = localId ? readSnapshot(localId) : null;
  const aiId = local?.mode === "ai" ? localId : null;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/matches/active")
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { matchId?: string | null };
        if (!cancelled) setOnlineId(body.matchId ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (onlineId) {
    return (
      <p className="mt-5 text-sm text-ink-soft">
        A match is open.{" "}
        <Link href={`/match/${onlineId}`} className="font-semibold text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest">
          Rejoin
        </Link>
      </p>
    );
  }
  if (!aiId) return null;
  return (
    <p className="mt-5 text-sm text-ink-soft">
      A game against the computer is still open on this device.{" "}
      <Link href={`/game/${aiId}`} className="font-semibold text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest">
        Continue
      </Link>
    </p>
  );
}
