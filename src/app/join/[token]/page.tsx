"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlayerNameField } from "@/components/play/PlayerNameField";
import { Button } from "@/components/ui/Button";
import { loadName, saveDisplayName } from "@/lib/start-game";

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void loadName().then(setName);
  }, []);

  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-serif text-5xl">Join the table</h1>
      <p className="mt-3 text-ink-soft">Enter your name, then sit down. The invitation works once.</p>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const token = params.token;
          if (!token) return;
          setPending(true);
          setError(null);
          void saveDisplayName(name).then((saved) => {
            if (!saved.persisted) {
              setError("The name could not be saved. Check the connection and try again.");
              setPending(false);
              return;
            }
            void fetch("/api/matches/join", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token }),
            })
              .then(async (response) => {
                const body = (await response.json()) as { matchId?: string; error?: string };
                if (!response.ok || !body.matchId) {
                  setError(body.error ?? "This invitation is not valid.");
                  setPending(false);
                  return;
                }
                router.replace(`/match/${body.matchId}`);
              })
              .catch(() => {
                setError("This invitation is not valid.");
                setPending(false);
              });
          });
        }}
      >
        <PlayerNameField name={name} onChange={setName} />
        {error ? <p className="text-sm text-bad">{error}</p> : null}
        <Button type="submit" disabled={pending || !name.trim()}>
          Sit down
        </Button>
        <Link href="/play" className="text-sm font-semibold text-ink-soft">
          Back to play
        </Link>
      </form>
    </main>
  );
}
