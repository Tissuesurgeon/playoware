"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/components/settings/SettingsProvider";
import { Button } from "@/components/ui/Button";
import { readLocalName, writeLocalName } from "@/lib/settings";

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/me");
        if (response.ok) {
          const body = (await response.json()) as { displayName?: string };
          setName(body.displayName || readLocalName());
          return;
        }
      } catch {
        // Keep the name stored on this device.
      }
      setName(readLocalName());
    })();
  }, []);

  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-serif text-5xl">Settings</h1>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const displayName = name.trim().slice(0, 24) || "Player";
          writeLocalName(displayName);
          setName(displayName);
          try {
            const response = await fetch("/api/me", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ displayName }),
            });
            setMessage(response.ok ? "Saved." : "Saved on this device. The profile server did not respond.");
          } catch {
            setMessage("Saved on this device. The profile server did not respond.");
          }
        }}
      >
        <label className="text-sm font-semibold">
          Display name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            className="mt-1 h-11 w-full rounded-2xl border border-line bg-paper px-3 font-normal"
          />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm font-semibold">
          Sound
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(event) => update({ ...settings, sound: event.target.checked })}
          />
        </label>
        <fieldset className="text-sm font-semibold">
          <legend>Animation speed</legend>
          <div className="mt-2 flex flex-col gap-2 font-normal">
            {(
              [
                ["normal", "Normal"],
                ["fast", "Fast"],
                ["instant", "Instant"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="animation"
                  value={value}
                  checked={settings.animation === value}
                  onChange={() => update({ ...settings, animation: value })}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-semibold">
          Motion
          <select
            value={settings.motion}
            onChange={(event) =>
              update({ ...settings, motion: event.target.value as "system" | "reduce" | "full" })
            }
            className="mt-1 h-11 w-full rounded-2xl border border-line bg-paper px-3 font-normal"
          >
            <option value="system">Match this device</option>
            <option value="reduce">Reduce motion</option>
            <option value="full">Play animations</option>
          </select>
        </label>
        <Button type="submit">Save name</Button>
        {message ? <p className="text-sm text-ink-soft">{message}</p> : null}
      </form>
    </main>
  );
}
