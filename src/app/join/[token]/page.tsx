"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.token;
    if (!token) return;
    void fetch("/api/matches/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const body = (await response.json()) as { matchId?: string; error?: string };
        if (!response.ok || !body.matchId) {
          setError(body.error ?? "This invitation is not valid.");
          return;
        }
        router.replace(`/match/${body.matchId}`);
      })
      .catch(() => setError("This invitation is not valid."));
  }, [params.token, router]);

  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-serif text-4xl">{error ? "Can’t join" : "Joining the table"}</h1>
      {error ? <p className="mt-3 text-ink-soft">{error}</p> : <p className="mt-3 text-ink-soft">Checking the invitation.</p>}
      {error ? (
        <Link href="/play" className="mt-6 inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm font-semibold text-paper">
          Back to play
        </Link>
      ) : null}
    </main>
  );
}
