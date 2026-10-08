"use client";

import { useSyncExternalStore } from "react";

export type AnimationSpeed = "normal" | "fast" | "instant";

export interface Settings {
  sound: boolean;
  motion: "system" | "reduce" | "full";
  animation: AnimationSpeed;
}

const KEY = "playoware:settings";
const NAME_KEY = "playoware:name";

const defaults: Settings = { sound: true, motion: "system", animation: "normal" };

export function readSettings(): Settings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const animation: AnimationSpeed =
      parsed.animation === "fast" || parsed.animation === "instant" ? parsed.animation : "normal";
    return {
      sound: parsed.sound !== false,
      motion: parsed.motion === "reduce" || parsed.motion === "full" ? parsed.motion : "system",
      animation,
    };
  } catch {
    return defaults;
  }
}

const listeners = new Set<() => void>();

export function writeSettings(settings: Settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
  listeners.forEach((listener) => listener());
}

export function subscribeSettings(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function settingsSnapshot() {
  return JSON.stringify(readSettings());
}

export function serverSettingsSnapshot() {
  return JSON.stringify(defaults);
}

export function readLocalName() {
  if (typeof window === "undefined") return "Player";
  return localStorage.getItem(NAME_KEY) || "Player";
}

export function writeLocalName(name: string) {
  localStorage.setItem(NAME_KEY, name);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
