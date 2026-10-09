"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { rememberInvite } from "@/components/online/OnlineMatch";
import { NamePrompt } from "@/components/play/NamePrompt";
import { Button } from "@/components/ui/Button";
import { loadName, saveDisplayName } from "@/lib/start-game";

export default function PlayFriendPage() {
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
      <h1 className="font-serif text-5xl">Play a friend</h1>
      <p className="mt-3 max-w-md text-ink-soft">
        Create a private table and send the link. Your friend opens it on their own device.
      </p>
      <div className="mt-8">
        {error && !askName ? <p className="mb-4 text-sm text-bad">{error}</p> : null}
        <Button type="button" onClick={() => setAskName(true)}>
          Create invitation
        </Button>
      </div>
      <NamePrompt
        open={askName}
        name={name}
        onChange={setName}
        pending={pending}
        error={error}
        confirmLabel="Create invitation"
        onClose={() => {
          if (pending) return;
          setAskName(false);
        }}
        onConfirm={() => {
          setPending(true);
          setError(null);
          void saveDisplayName(name).then((saved) => {
            if (!saved.persisted) {
              setError(saved.error ?? "The name could not be saved. Check the connection and try again.");
              setPending(false);
              return;
            }
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
          });
        }}
      />
    </main>
  );
}
