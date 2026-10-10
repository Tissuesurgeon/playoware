import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canResumeStoredGame } from "@/lib/game/session";

describe("stored games", () => {
  it("resumes a computer game and refuses a same-device human game", () => {
    expect(canResumeStoredGame("ai")).toBe(true);
    expect(canResumeStoredGame("local")).toBe(false);
  });

  it("keeps same-device human play off the screen and out of saved games", () => {
    const screen = readFileSync("src/components/game/GameScreen.tsx", "utf8");
    const route = readFileSync("src/app/api/games/route.ts", "utf8");
    const resume = readFileSync("src/components/navigation/ResumeGame.tsx", "utf8");
    expect(screen).toContain("canResumeStoredGame");
    expect(route).toContain("canResumeStoredGame");
    expect(route).not.toContain('body.mode !== "local"');
    expect(resume).toContain("canResumeStoredGame");
  });
});