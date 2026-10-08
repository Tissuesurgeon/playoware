import { describe, expect, it } from "vitest";
import { concludeGame, InvalidGameError } from "@/lib/game/record";

describe("saved game replay", () => {
  it("ignores a client winner and uses the engine", () => {
    const { result } = concludeGame([{ pit: 0 }], { type: "resign", player: "player2" });
    expect(result.winner).toBe("player1");
    expect(result.endReason).toBe("resignation");
    expect(result.score).toEqual({ player1: 0, player2: 0 });
  });

  it("rejects a move list that is not finished", () => {
    expect(() => concludeGame([{ pit: 0 }], null)).toThrow(InvalidGameError);
  });

  it("rejects an illegal pit", () => {
    expect(() => concludeGame([{ pit: 8 }], null)).toThrow(InvalidGameError);
  });
});
