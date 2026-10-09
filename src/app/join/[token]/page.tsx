"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NamePrompt } from "@/components/play/NamePrompt";
import { Button } from "@/components/ui/Button";
import { loadName, saveDisplayName } from "@/lib/start-game";

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [askName, setAskName] = useState(false);

  useEffect(() => {
    void loadName().then(setName);
  }, []);

  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-serif text-5xl">Join the table</h1>
      <p className="mt-3 text-ink-soft">Sit down when you’re ready. The invitation works once.</p>
      <div className="mt-8 flex flex-col items-start gap-5">
        {error && !askName ? <p className="text-sm text-bad">{error}</p> : null}
        <Button type="button" onClick={() => setAskName(true)}>
          Sit down
        </Button>
        <Link href="/play" className="text-sm font-semibold text-ink-soft">
          Back to play
        </Link>
      </div>
      <NamePrompt
        open={askName}
        name={name}
        onChange={setName}
        pending={pending}
        error={error}
        confirmLabel="Sit down"
        onClose={() => {
          if (pending) return;
          setAskName(false);
        }}
        onConfirm={() => {
          const token = params.token;
          if (!token) return;
          setPending(true);
          setError(null);
          void saveDisplayName(name).then((saved) => {
            if (!saved.persisted) {
              setError(saved.error ?? "The name could not be saved. Check the connection and try again.");
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
      />
    </main>
  );
}
