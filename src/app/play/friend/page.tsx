"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { rememberInvite } from "@/components/online/OnlineMatch";
import { PlayerNameField } from "@/components/play/PlayerNameField";
import { Button } from "@/components/ui/Button";
import { loadName, saveDisplayName } from "@/lib/start-game";

export default function PlayFriendPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void loadName().then(setName);
  }, []);

  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-serif text-5xl">Play a friend</h1>
      <p className="mt-3 max-w-md text-ink-soft">
        Create a private table and send the link. Your friend opens it on their own device.
      </p>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          void saveDisplayName(name).then((saved) => {
            if (!saved.persisted) {
              setError("The name could not be saved. Check the connection and try again.");
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
      >
        <PlayerNameField name={name} onChange={setName} />
        {error ? <p className="text-sm text-bad">{error}</p> : null}
        <Button type="submit" disabled={pending || !name.trim()}>
          Create invitation
        </Button>
      </form>
    </main>
  );
}
