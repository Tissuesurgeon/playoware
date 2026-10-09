"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { rememberInvite } from "@/components/online/OnlineMatch";
import { Button } from "@/components/ui/Button";

export default function PlayFriendPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-serif text-5xl">Play a friend</h1>
      <p className="mt-3 max-w-md text-ink-soft">
        Create a private table and send the link. Your friend opens it on their own device.
      </p>
      {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
      <Button
        className="mt-8"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          void fetch("/api/matches/friend", { method: "POST" })
            .then(async (response) => {
              const body = (await response.json()) as { matchId?: string; path?: string | null; error?: string };
              if (!response.ok || !body.matchId) {
                setError(body.error ?? "Couldn’t create a table.");
                setPending(false);
                return;
              }
              if (body.path) rememberInvite(body.matchId, body.path);
              router.push(`/match/${body.matchId}`);
            })
            .catch(() => {
              setError("Couldn’t create a table.");
              setPending(false);
            });
        }}
      >
        Create invitation
      </Button>
    </main>
  );
}
