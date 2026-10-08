"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  serverSettingsSnapshot,
  settingsSnapshot,
  subscribeSettings,
  usePrefersReducedMotion,
  writeSettings,
  type Settings,
} from "@/lib/settings";

interface SettingsValue {
  settings: Settings;
  reducedMotion: boolean;
  update: (next: Settings) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribeSettings, settingsSnapshot, serverSettingsSnapshot);
  const settings = JSON.parse(raw) as Settings;
  const systemReduced = usePrefersReducedMotion();

  const value = useMemo<SettingsValue>(() => {
    const reducedMotion =
      settings.motion === "reduce" || (settings.motion === "system" && systemReduced);
    return {
      settings,
      reducedMotion,
      update(next) {
        writeSettings(next);
      },
    };
  }, [settings, systemReduced]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("Settings are missing.");
  return value;
}
