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
    <main className="mx-auto max-w-xl px-4 pt-8 pb-16">
      <h1 className="font-serif text-5xl tracking-tight">Settings</h1>

      <form
        className="mt-8 rounded-[28px] border border-line bg-paper p-5 sm:p-6"
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
        <label htmlFor="display-name" className="block text-sm font-semibold">
          Your name
        </label>
        <p className="mt-1 text-sm text-ink-soft">This is the name at the table.</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="display-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            className="h-11 w-full rounded-full border border-line bg-cream px-4"
          />
          <Button type="submit" className="shrink-0">
            Save
          </Button>
        </div>
        <p aria-live="polite" className="mt-3 min-h-5 text-sm text-ink-soft">
          {message}
        </p>
      </form>

      <section className="mt-4 rounded-[28px] border border-line bg-paper p-5 sm:p-6" aria-labelledby="prefs-title">
        <h2 id="prefs-title" className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
          Preferences
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Saved on this device as you change them.</p>

        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold">Sound</span>
            <span className="mt-0.5 block text-sm text-ink-soft">Seed drops and the end-of-game chime.</span>
          </span>
          <span className="relative inline-flex shrink-0">
            <input
              type="checkbox"
              checked={settings.sound}
              onChange={(event) => update({ ...settings, sound: event.target.checked })}
              className="peer sr-only"
            />
            <span
              className={`h-7 w-12 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#e7b15a] ${settings.sound ? "bg-forest" : "bg-line"}`}
            />
            <span
              className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-paper shadow-sm transition-transform duration-200 motion-reduce:transition-none ${settings.sound ? "translate-x-5" : ""}`}
            />
          </span>
        </label>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold">Animation speed</legend>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-full border border-line bg-cream p-1">
            {(
              [
                ["normal", "Normal"],
                ["fast", "Fast"],
                ["instant", "Instant"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="relative">
                <input
                  type="radio"
                  name="animation"
                  value={value}
                  checked={settings.animation === value}
                  onChange={() => update({ ...settings, animation: value })}
                  className="peer sr-only"
                />
                <span className="flex h-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold text-ink-soft transition-colors peer-checked:bg-paper peer-checked:text-forest peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#e7b15a]">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="motion" className="mt-6 block text-sm font-semibold">
          Motion
        </label>
        <select
          id="motion"
          value={settings.motion}
          onChange={(event) => update({ ...settings, motion: event.target.value as "system" | "reduce" | "full" })}
          className="mt-2 h-11 w-full rounded-full border border-line bg-cream px-4"
        >
          <option value="system">Match this device</option>
          <option value="reduce">Reduce motion</option>
          <option value="full">Play animations</option>
        </select>
      </section>
    </main>
  );
}
