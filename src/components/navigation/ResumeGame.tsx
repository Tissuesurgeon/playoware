"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import { canResumeStoredGame } from "@/lib/game/session";
import { readActiveGameId, readSnapshot, subscribeGameStorage } from "@/lib/storage";

export function ResumeGame({ prominent = false }: { prominent?: boolean }) {
  const localId = useSyncExternalStore(subscribeGameStorage, readActiveGameId, () => null);
  const [onlineId, setOnlineId] = useState<string | null>(null);
  const local = localId ? readSnapshot(localId) : null;
  const aiId = local && canResumeStoredGame(local.mode) ? localId : null;

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

  const resume = onlineId
    ? {
        href: `/match/${onlineId}`,
        status: "Match in progress",
        label: "Rejoin the table",
        line: "A match is open.",
        action: "Rejoin",
      }
    : aiId
      ? {
          href: `/game/${aiId}`,
          status: "Game in progress",
          label: "Continue against the computer",
          line: "A game against the computer is still open on this device.",
          action: "Continue",
        }
      : null;
  if (!resume) return null;

  if (prominent) {
    return (
      <Link
        href={resume.href}
        className="flex min-h-11 items-center justify-between gap-4 rounded-[28px] bg-forest px-5 py-4 text-paper transition-colors duration-200 hover:bg-forest-dark motion-reduce:transition-none"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 shrink-0 rounded-full bg-seed" aria-hidden />
            {resume.status}
          </span>
          <span className="mt-1 block font-serif text-2xl tracking-tight text-balance">{resume.label}</span>
        </span>
        <span aria-hidden className="text-2xl leading-none">
          →
        </span>
      </Link>
    );
  }

  return (
    <p className="mt-5 text-sm text-ink-soft">
      {resume.line}{" "}
      <Link href={resume.href} className="font-semibold text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest">
        {resume.action}
      </Link>
    </p>
  );
}
