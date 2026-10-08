"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { readActiveGameId } from "@/lib/storage";

export function ResumeGame() {
  const id = useSyncExternalStore(
    () => () => undefined,
    () => readActiveGameId(),
    () => null,
  );
  if (!id) return null;
  return (
    <Link href={`/game/${id}`} className="inline-flex h-11 items-center rounded-full border border-forest px-5 text-sm font-semibold text-forest hover:bg-forest hover:text-paper">
      Continue game
    </Link>
  );
}
