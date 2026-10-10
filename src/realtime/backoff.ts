const DELAYS = [1_000, 2_000, 4_000, 8_000];

/** Delay before the next socket attempt. The caller resets the attempt to 0 when the socket opens. */
export function reconnectDelay(attempt: number) {
  const index = Math.max(0, Math.min(DELAYS.length - 1, Math.floor(attempt)));
  return DELAYS[index] ?? 8_000;
}

export type SocketLink = "connecting" | "open" | "closed";

/** One status line for the match and the queue. The server still owns forfeits. */
export function connectionLabel(input: { socket: SocketLink; pollOk: boolean }): "Connecting" | "Live" | "Polling" | "Reconnecting" {
  if (input.socket === "open") return "Live";
  if (input.socket === "connecting") return "Connecting";
  if (input.pollOk) return "Polling";
  return "Reconnecting";
}
