"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { socketUrl } from "@/realtime/browser";

export default function QueuePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let timer = 0;

    function connect() {
      if (stopped) return;
      socket = new WebSocket(socketUrl());
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string; matchId?: string; error?: string };
          if (message.type === "matchFound" && message.matchId) router.push(`/match/${message.matchId}`);
          if (message.type === "error" && message.error) setError(message.error);
        } catch {
          setError("The search connection dropped.");
        }
      };
      socket.onclose = () => {
        if (!stopped) timer = window.setTimeout(connect, 1000);
      };
    }

    void fetch("/api/matches/queue", { method: "POST" })
      .then(async (response) => {
        const body = (await response.json()) as { matchId?: string | null; error?: string };
        if (stopped) return;
        if (!response.ok) {
          setError(body.error ?? "Matchmaking is unavailable.");
          return;
        }
        if (body.matchId) {
          router.push(`/match/${body.matchId}`);
          return;
        }
        connect();
      })
      .catch(() => {
        if (!stopped) setError("Matchmaking is unavailable.");
      });
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socket?.close();
      void fetch("/api/matches/queue", { method: "DELETE" });
    };
  }, [router]);

  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-xs font-semibold tracking-[0.18em] text-forest uppercase">Quick match</p>
      <h1 className="mt-3 font-serif text-5xl">Looking for an opponent</h1>
      <p className="mt-4 text-ink-soft">You’ll both be sent to the same table when someone else is searching.</p>
      {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
      <Button
        className="mt-8"
        variant="secondary"
        onClick={() => {
          void fetch("/api/matches/queue", { method: "DELETE" }).then(() => router.push("/play"));
        }}
      >
        Cancel
      </Button>
    </main>
  );
}
