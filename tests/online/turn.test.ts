import { describe, expect, it } from "vitest";
import { barState, rematchPath } from "@/components/online/turn";

describe("barState", () => {
  it("marks the committed sower and hides Your turn on the other bar", () => {
    expect(barState({ side: "player2", you: "player1", sower: "player2", yourTurn: true, over: false, waiting: false })).toEqual({
      active: true,
      status: "Sowing",
    });
    expect(barState({ side: "player1", you: "player1", sower: "player2", yourTurn: true, over: false, waiting: false })).toEqual({
      active: false,
    });
  });

  it("uses the server turn when nothing is sowing", () => {
    expect(barState({ side: "player1", you: "player1", sower: null, yourTurn: true, over: false, waiting: false })).toEqual({
      active: true,
      status: "Your turn",
    });
    expect(barState({ side: "player2", you: "player1", sower: null, yourTurn: true, over: false, waiting: false })).toEqual({
      active: false,
    });
  });
});

describe("rematchPath", () => {
  it("sends a friend back to invitations and a quick match back to the queue", () => {
    expect(rematchPath("friend")).toBe("/play/friend");
    expect(rematchPath("quick")).toBe("/play/queue");
  });
});
