import { describe, expect, it } from "vitest";
import { connectionLabel, reconnectDelay } from "@/realtime/backoff";

describe("reconnectDelay", () => {
  it("backs off and then stays at the cap", () => {
    expect(reconnectDelay(0)).toBe(1_000);
    expect(reconnectDelay(1)).toBe(2_000);
    expect(reconnectDelay(2)).toBe(4_000);
    expect(reconnectDelay(3)).toBe(8_000);
    expect(reconnectDelay(9)).toBe(8_000);
  });

  it("starts again from the first delay after a successful open resets the attempt", () => {
    let attempt = 3;
    expect(reconnectDelay(attempt)).toBe(8_000);
    attempt = 0;
    expect(reconnectDelay(attempt)).toBe(1_000);
  });
});

describe("connectionLabel", () => {
  it("names the four link states", () => {
    expect(connectionLabel({ socket: "connecting", pollOk: true })).toBe("Connecting");
    expect(connectionLabel({ socket: "open", pollOk: true })).toBe("Live");
    expect(connectionLabel({ socket: "open", pollOk: false })).toBe("Live");
    expect(connectionLabel({ socket: "closed", pollOk: true })).toBe("Polling");
    expect(connectionLabel({ socket: "closed", pollOk: false })).toBe("Reconnecting");
  });
});
