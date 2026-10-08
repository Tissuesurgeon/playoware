import type { SessionSnapshot } from "@/lib/game/session";

const ACTIVE = "playoware:active";
const listeners = new Set<() => void>();
const busy = new Set<string>();
const aiClaims = new Set<string>();

export function subscribeGameStorage(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readGameRaw(id: string) {
  return sessionStorage.getItem(gameStorageKey(id)) ?? "missing";
}

export function setGameBusy(id: string, value: boolean) {
  if (value) busy.add(id);
  else busy.delete(id);
}

export function isGameBusy(id: string) {
  return busy.has(id);
}

export function claimAiTurn(id: string) {
  if (aiClaims.has(id)) return false;
  aiClaims.add(id);
  return true;
}

export function releaseAiTurn(id: string) {
  aiClaims.delete(id);
}

export function gameStorageKey(id: string) {
  return `playoware:game:${id}`;
}

export function readSnapshot(id: string): SessionSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(gameStorageKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionSnapshot;
  } catch {
    return null;
  }
}

export function writeSnapshot(snapshot: SessionSnapshot, inProgress: boolean) {
  sessionStorage.setItem(gameStorageKey(snapshot.id), JSON.stringify(snapshot));
  if (inProgress) sessionStorage.setItem(ACTIVE, snapshot.id);
  else if (sessionStorage.getItem(ACTIVE) === snapshot.id) sessionStorage.removeItem(ACTIVE);
  listeners.forEach((listener) => listener());
}

export function readActiveGameId() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE);
}
