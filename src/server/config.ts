export function reconnectGraceMs() {
  const value = Number(process.env.RECONNECT_GRACE_MS ?? 60_000);
  return Number.isFinite(value) && value >= 1_000 ? value : 60_000;
}

export function inviteTtlMs() {
  const value = Number(process.env.INVITE_TTL_MS ?? 24 * 60 * 60 * 1000);
  return Number.isFinite(value) && value >= 60_000 ? value : 24 * 60 * 60 * 1000;
}

export function queueTtlMs() {
  const value = Number(process.env.QUEUE_TTL_MS ?? 2 * 60 * 1000);
  return Number.isFinite(value) && value >= 5_000 ? value : 2 * 60 * 1000;
}

export const SESSION_COOKIE = "playoware_session";
export const LEGACY_COOKIE = "playoware_uid";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;
