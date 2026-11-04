import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { raceBest, recordRace, raceKey } from "../src/sprint/progression";
import { raceMedal, formatRaceTime } from "../src/sprint/model";
import { SPRINT_COURSES } from "../src/sprint/courses";
import type { RaceResult } from "../src/sprint/types";
let memory: Map<string, string>;
const r = (patch: Partial<RaceResult> = {}): RaceResult => ({
  mode: "sprint",
  courseId: 1,
  time: 23.47,
  medal: "Gold",
  joke: "No meeting.",
  code: "SPRINT-C01",
  ...patch,
});
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) || null,
    setItem: (k: string, v: string) => memory.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("stores only successful supplied results and lower times improve a record", () => {
  expect(raceBest("sprint", 1)).toBeNull();
  expect(recordRace(r()).improved).toBe(true);
  expect(recordRace(r({ time: 25 })).improved).toBe(false);
  expect(recordRace(r({ time: 21 })).improved).toBe(true);
  expect(raceBest("sprint", 1)?.time).toBe(21);
});
it("does not invent PB differences smaller than the displayed centisecond", () => {
  recordRace(r({ time: 23.471 }));
  expect(recordRace(r({ time: 23.4701 })).improved).toBe(false);
  expect(recordRace(r({ time: 23.46 })).improved).toBe(true);
});
it("never mixes pure sprint, daily word dates or courses", () => {
  recordRace(r());
  recordRace(
    r({
      mode: "buzzword",
      day: "2026-11-04",
      code: "2026-11-04-C01",
      word: "SYNC",
      time: 31,
    }),
  );
  recordRace(
    r({
      mode: "buzzword",
      day: "2026-11-05",
      code: "2026-11-05-C01",
      word: "PIVOT",
      time: 29,
    }),
  );
  expect(raceBest("sprint", 1)?.time).toBe(23.47);
  expect(raceBest("buzzword", 1, "2026-11-04", "2026-11-04-C01")?.time).toBe(
    31,
  );
  expect(raceBest("buzzword", 1, "2026-11-05", "2026-11-05-C01")?.time).toBe(
    29,
  );
  expect(raceBest("sprint", 2)).toBeNull();
});
it("does not edit the existing heist save key", () => {
  memory.set("office-escape-v1", "HEIST-UNCHANGED");
  recordRace(r());
  expect(memory.get("office-escape-v1")).toBe("HEIST-UNCHANGED");
});
it("handles corrupt, missing and denied storage without blocking a result", () => {
  memory.set("office-escape-races-v1", "{bad");
  expect(raceBest("sprint", 1)).toBeNull();
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
  });
  expect(recordRace(r()).best.time).toBe(23.47);
});
it("records time, never an invented points score", () => {
  const saved = recordRace(r()).best;
  expect(saved).not.toHaveProperty("score");
  expect(saved).not.toHaveProperty("lootValue");
  expect(raceKey(saved)).toBe("sprint:1");
});
it("medals agree with the displayed clock at a sub-centisecond boundary", () => {
  const c = { ...SPRINT_COURSES[0], gold: 19.6, silver: 25 };
  expect(formatRaceTime(19.609)).toBe("00:19.60");
  expect(raceMedal(19.609, c)).toBe("Gold");
  expect(raceMedal(19.61, c)).toBe("Silver");
});
