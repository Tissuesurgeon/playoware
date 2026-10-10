"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NamePrompt } from "@/components/play/NamePrompt";
import { Button } from "@/components/ui/Button";
import { loadName, saveDisplayName } from "@/lib/start-game";
import { connectionLabel, reconnectDelay, type SocketLink } from "@/realtime/backoff";
import { socketUrl } from "@/realtime/browser";

export default function QueuePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [searching, setSearching] = useState(false);
  const [askName, setAskName] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<SocketLink>("connecting");
  const [pollOk, setPollOk] = useState(true);

  useEffect(() => {
    void loadName().then(setName);
  }, []);

  useEffect(() => {
    if (!searching) return;
    let stopped = false;
    let matched = false;
    let socket: WebSocket | null = null;
    let timer = 0;
    let poll = 0;
    let attempt = 0;

    function openMatch(matchId: string) {
      matched = true;
      router.push(`/match/${matchId}`);
    }

    function connect(initial: boolean) {
      if (stopped) return;
      if (initial) setSocketState("connecting");
      socket = new WebSocket(socketUrl());
      socket.onopen = () => {
        attempt = 0;
        setSocketState("open");
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string; matchId?: string; error?: string };
          if (message.type === "matchFound" && message.matchId) openMatch(message.matchId);
          if (message.type === "error" && message.error) setError(message.error);
        } catch {
          setError("The search connection dropped.");
        }
      };
      socket.onclose = () => {
        setSocketState("closed");
        if (!stopped) {
          const delay = reconnectDelay(attempt);
          attempt += 1;
          timer = window.setTimeout(() => connect(false), delay);
        }
      };
    }

    async function look() {
      if (stopped) return;
      try {
        const response = await fetch("/api/matches/queue", { cache: "no-store" });
        const body = (await response.json()) as { status?: string; matchId?: string | null; error?: string };
        if (stopped) return;
        if (!response.ok) {
          setPollOk(false);
          return;
        }
        setPollOk(true);
        if (body.matchId) {
          openMatch(body.matchId);
          return;
        }
        if (body.status === "idle") {
          setError("The search ended. Try again.");
          setSearching(false);
        }
      } catch {
        if (!stopped) setPollOk(false);
      }
    }

    void fetch("/api/matches/queue", { method: "POST" })
      .then(async (response) => {
        const body = (await response.json()) as { matchId?: string | null; error?: string };
        if (stopped) return;
        if (!response.ok) {
          setError(body.error ?? "Matchmaking is unavailable.");
          setSearching(false);
          return;
        }
        if (body.matchId) {
          openMatch(body.matchId);
          return;
        }
        connect(true);
        void look();
        poll = window.setInterval(() => void look(), 2000);
      })
      .catch(() => {
        if (!stopped) {
          setError("Matchmaking is unavailable.");
          setSearching(false);
        }
      });
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      socket?.close();
      if (!matched) void fetch("/api/matches/queue", { method: "DELETE" });
    };
  }, [router, searching]);

  if (!searching) {
    return (
      <main className="mx-auto max-w-xl px-4 py-14">
        <p className="text-xs font-semibold tracking-[0.18em] text-forest uppercase">Quick match</p>
        <h1 className="mt-3 font-serif text-5xl">Find an opponent</h1>
        <p className="mt-3 text-ink-soft">You’ll both be sent to the same table when someone else is searching.</p>
        <div className="mt-8">
          {error && !askName ? <p className="mb-4 text-sm text-bad">{error}</p> : null}
          <Button type="button" onClick={() => setAskName(true)}>
            Find a match
          </Button>
        </div>
        <NamePrompt
          open={askName}
          name={name}
          onChange={setName}
          pending={pending}
          error={error}
          confirmLabel="Find a match"
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
              setSearching(true);
            });
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-xs font-semibold tracking-[0.18em] text-forest uppercase">Quick match</p>
      <h1 className="mt-3 font-serif text-5xl">Looking for an opponent</h1>
      <p className="mt-3 text-sm font-semibold text-ink-soft">{connectionLabel({ socket: socketState, pollOk })}</p>
      <p className="mt-4 text-ink-soft">You’ll both be sent to the same table when someone else is searching.</p>
      {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
      <Button
        className="mt-8"
        variant="secondary"
        onClick={() => {
          setSearching(false);
          setPending(false);
          setAskName(false);
        }}
      >
        Cancel
      </Button>
    </main>
  );
}
