import { describe, expect, it } from "vitest";
import { OwareGame } from "@/engine/oware";
import { decideIncoming, latestSow, preferNewer, shouldStartAccepted } from "@/lib/animation/incoming";

describe("latestSow", () => {
  it("rebuilds the newest sow from the pit history", () => {
    const game = new OwareGame();
    game.makeMove(0);
    const beforeSecond = game.getState();
    const applied = game.makeMove(6);
    const step = latestSow([0, 6]);
    expect(step?.beforeBoard).toEqual(beforeSecond.board);
    expect(step?.beforeCaptured).toEqual(beforeSecond.capturedSeeds);
    expect(step?.applied.move.pit).toBe(6);
    expect(step?.applied.move.player).toBe("player2");
    expect(step?.applied.steps.some((move) => move.kind === "pickup")).toBe(true);
    expect(step?.applied.steps).toEqual(applied.steps);
  });
});

describe("decideIncoming", () => {
  it("stores the first snapshot without replaying earlier pits", () => {
    expect(
      decideIncoming({
        hasSnapshot: false,
        currentVersion: 0,
        previousPitCount: 0,
        nextVersion: 4,
        nextPits: [0, 6, 1, 7],
        animating: false,
      }),
    ).toEqual({ type: "store", land: false });
  });

  it("ignores an older snapshot instead of queuing it", () => {
    expect(
      decideIncoming({
        hasSnapshot: true,
        currentVersion: 2,
        previousPitCount: 2,
        nextVersion: 1,
        nextPits: [0],
        animating: true,
      }),
    ).toEqual({ type: "ignore" });
  });

  it("stores a duplicate version and lands the server board only while a sow is playing", () => {
    expect(
      decideIncoming({
        hasSnapshot: true,
        currentVersion: 2,
        previousPitCount: 2,
        nextVersion: 2,
        nextPits: [0, 6],
        animating: true,
      }),
    ).toEqual({ type: "store", land: true });
    expect(
      decideIncoming({
        hasSnapshot: true,
        currentVersion: 2,
        previousPitCount: 2,
        nextVersion: 2,
        nextPits: [0, 6],
        animating: false,
      }),
    ).toEqual({ type: "store", land: false });
  });

  it("holds a newer snapshot until the current sow finishes", () => {
    expect(
      decideIncoming({
        hasSnapshot: true,
        currentVersion: 1,
        previousPitCount: 1,
        nextVersion: 2,
        nextPits: [0, 6],
        animating: true,
      }).type,
    ).toBe("hold");
  });

  it("animates only the newest committed sow when several pits arrive at once", () => {
    const game = new OwareGame();
    game.makeMove(0);
    game.makeMove(6);
    const beforeLast = game.getState();
    const decision = decideIncoming({
      hasSnapshot: true,
      currentVersion: 1,
      previousPitCount: 1,
      nextVersion: 3,
      nextPits: [0, 6, 1],
      animating: false,
    });
    expect(decision.type).toBe("animate");
    if (decision.type !== "animate") return;
    expect(decision.sow.applied.move.pit).toBe(1);
    expect(decision.sow.beforeBoard).toEqual(beforeLast.board);
    expect(decision.sow.beforeBoard).not.toEqual(new OwareGame().getState().board);
  });

  it("applies a version that grew without a new pit", () => {
    expect(
      decideIncoming({
        hasSnapshot: true,
        currentVersion: 1,
        previousPitCount: 1,
        nextVersion: 2,
        nextPits: [0],
        animating: false,
      }),
    ).toEqual({ type: "apply" });
  });

  it("treats a lost response as the refetched snapshot, and drops it when a newer version is already current", () => {
    const recovered = decideIncoming({
      hasSnapshot: true,
      currentVersion: 1,
      previousPitCount: 1,
      nextVersion: 2,
      nextPits: [0, 6],
      animating: false,
    });
    expect(recovered.type).toBe("animate");
    if (recovered.type === "animate") expect(recovered.sow.applied.move.pit).toBe(6);

    expect(
      decideIncoming({
        hasSnapshot: true,
        currentVersion: 2,
        previousPitCount: 2,
        nextVersion: 1,
        nextPits: [0],
        animating: false,
      }),
    ).toEqual({ type: "ignore" });
  });
});

describe("accepted moves", () => {
  it("starts a committed move once, from either the response or the socket", () => {
    expect(shouldStartAccepted({ currentVersion: 1, acceptedVersion: 2, animating: false })).toBe(true);
    expect(shouldStartAccepted({ currentVersion: 2, acceptedVersion: 2, animating: false })).toBe(false);
    expect(shouldStartAccepted({ currentVersion: 1, acceptedVersion: 2, animating: true })).toBe(false);
    expect(shouldStartAccepted({ currentVersion: 1, acceptedVersion: 3, animating: false })).toBe(false);
  });

  it("keeps the newer held snapshot", () => {
    expect(preferNewer({ version: 4 }, { version: 3 }).version).toBe(4);
    expect(preferNewer(null, { version: 3 }).version).toBe(3);
  });
});
