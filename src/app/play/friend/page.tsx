"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { loadName, useStart } from "@/lib/start-game";

export default function PlayFriendPage() {
  const { pending, go } = useStart();
  const [you, setYou] = useState("Player");
  const [guest, setGuest] = useState("Guest");

  useEffect(() => {
    void loadName().then(setYou);
  }, []);

  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-serif text-5xl">Play friend</h1>
      <p className="mt-2 text-ink-soft">Both of you play on this device. The board turns toward the player to move.</p>
      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void go({ mode: "local", player1Name: you, player2Name: guest });
        }}
      >
        <label className="text-sm font-semibold">
          Your name
          <input
            value={you}
            onChange={(event) => setYou(event.target.value)}
            maxLength={24}
            className="mt-1 h-11 w-full rounded-2xl border border-line bg-paper px-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Friend’s name
          <input
            value={guest}
            onChange={(event) => setGuest(event.target.value)}
            maxLength={24}
            className="mt-1 h-11 w-full rounded-2xl border border-line bg-paper px-3 font-normal"
          />
        </label>
        <Button type="submit" disabled={pending}>
          Start game
        </Button>
      </form>
    </main>
  );
}
