import { describe, expect, it } from "vitest";
import { FUN_LINES, FunFriday, judgeClap } from "../src/game/fun";
import type { FunHit } from "../src/game/fun";

const MISS: FunHit = { hit: false, points: 0, accuracy: 0 };

function play(positions: number[]): FunFriday {
  const game = new FunFriday();
  positions.forEach((position) => game.beat(position));
  return game;
}

describe("judgeClap", () => {
  it("awards the maximum exactly at the target center", () => {
    expect(judgeClap(0.55)).toEqual({ hit: true, points: 100, accuracy: 1 });
  });

  it.each([0.43, 0.67])(
    "includes the window edge %s for 20 points",
    (position) => {
      const result = judgeClap(position);
      expect(result.hit).toBe(true);
      expect(result.points).toBe(20);
      expect(result.accuracy).toBeCloseTo(0, 12);
    },
  );

  it.each([0.429999, 0.670001, 0, 1, -1, 2])(
    "misses outside the window at %s",
    (position) => {
      expect(judgeClap(position)).toEqual(MISS);
    },
  );

  it("scores symmetric distances equally and rounds to integer points", () => {
    expect(judgeClap(0.49).points).toBe(60);
    expect(judgeClap(0.61).points).toBe(60);
    expect(judgeClap(0.49).accuracy).toBeCloseTo(0.5, 12);
    expect(judgeClap(0.61).accuracy).toBeCloseTo(0.5, 12);
    expect(judgeClap(0.5).points).toBe(67);
    expect(judgeClap(0.6).points).toBe(67);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "treats non-finite position %s as a miss",
    (position) => {
      expect(judgeClap(position)).toEqual(MISS);
    },
  );

  it("saturates accuracy and scores to their declared bounds", () => {
    for (let step = -1000; step <= 2000; step += 1) {
      const result = judgeClap(step / 1000);
      expect(result.points).toBeGreaterThanOrEqual(0);
      expect(result.points).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.points)).toBe(true);
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
    }
  });
});

describe("FunFriday", () => {
  it("starts with a clean five-round activity", () => {
    const game = new FunFriday();
    expect(game.round).toBe(0);
    expect(game.hits).toBe(0);
    expect(game.score).toBe(0);
    expect(game.results).toEqual([]);
    expect(game.total).toBe(5);
    expect(game.finished).toBe(false);
  });

  it("records exactly one attempt per round and completes five perfect hits", () => {
    const game = new FunFriday();
    for (let round = 0; round < game.total; round += 1) {
      expect(game.finished).toBe(false);
      expect(game.beat(0.55)).toEqual({ hit: true, points: 100, accuracy: 1 });
      expect(game.round).toBe(round + 1);
      expect(game.hits).toBe(round + 1);
      expect(game.score).toBe((round + 1) * 100);
      expect(game.results).toHaveLength(round + 1);
    }
    expect(game.finished).toBe(true);
    expect(game.result).toEqual({
      success: true,
      hits: 5,
      score: 500,
      bsChange: -25,
      coffee: 1,
      distractSeconds: 12,
    });
  });

  it("advances and records misses without granting points or hits", () => {
    const game = play([0, 1, 0.4299, 0.6701, Number.NaN]);
    expect(game.round).toBe(5);
    expect(game.results).toEqual([MISS, MISS, MISS, MISS, MISS]);
    expect(game.finished).toBe(true);
    expect(game.result).toEqual({
      success: false,
      hits: 0,
      score: 0,
      bsChange: 8,
      coffee: 0,
      distractSeconds: 0,
    });
  });

  it("requires at least three hits, independent of the total score", () => {
    const failure = play([0.55, 0.55, 0, 0, 0]);
    const success = play([0.43, 0.67, 0.43, 0, 0]);
    expect(failure.result).toEqual({
      success: false,
      hits: 2,
      score: 200,
      bsChange: 8,
      coffee: 0,
      distractSeconds: 0,
    });
    expect(success.result).toEqual({
      success: true,
      hits: 3,
      score: 60,
      bsChange: -25,
      coffee: 1,
      distractSeconds: 12,
    });
  });

  it("ignores all beats after completion and protects the final state", () => {
    const game = play([0.55, 0, 0.55, 0.43, 0]);
    const before = {
      round: game.round,
      hits: game.hits,
      score: game.score,
      results: game.results.map((result) => ({ ...result })),
      result: game.result,
    };
    for (const position of [0.55, 0.55, 0, Number.NaN]) {
      expect(game.beat(position)).toEqual(MISS);
    }
    expect(game.finished).toBe(true);
    expect(game.round).toBe(before.round);
    expect(game.hits).toBe(before.hits);
    expect(game.score).toBe(before.score);
    expect(game.results).toEqual(before.results);
    expect(game.result).toEqual(before.result);
  });

  it("does not let mutation of a returned attempt change recorded results", () => {
    const game = new FunFriday();
    const attempt = game.beat(0.55);
    attempt.points = 0;
    attempt.hit = false;
    expect(game.results[0]).toEqual({ hit: true, points: 100, accuracy: 1 });
    expect(game.hits).toBe(1);
    expect(game.score).toBe(100);
  });

  it.each([2600, 2420, 2240, 2060, 1880])(
    "uses duration %s ms in the corresponding round",
    (duration) => {
      const game = new FunFriday();
      const round = (2600 - duration) / 180;
      for (let previous = 0; previous < round; previous += 1) game.beat(0);
      expect(game.marker(0)).toBe(0);
      expect(game.marker(duration / 4)).toBeCloseTo(0.25, 12);
      expect(game.marker(duration / 2)).toBeCloseTo(0.5, 12);
      expect(game.marker(duration * 0.55)).toBeCloseTo(0.55, 12);
      expect(game.marker(duration)).toBe(1);
      expect(game.marker(duration * 2)).toBe(1);
      expect(game.round).toBe(round);
      expect(game.results).toHaveLength(round);
    },
  );

  it("clamps marker time and never advances a round on its own", () => {
    const game = new FunFriday();
    expect(game.marker(-100)).toBe(0);
    expect(game.marker(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(game.marker(Number.POSITIVE_INFINITY)).toBe(1);
    expect(game.marker(Number.NaN)).toBe(0);
    expect(game.marker(1e9)).toBe(1);
    expect(game.round).toBe(0);
    expect(game.results).toEqual([]);
  });

  it("parks the marker at the end once finished", () => {
    const game = play([0, 0, 0, 0, 0]);
    expect(game.marker(0)).toBe(1);
    expect(game.marker(100000)).toBe(1);
    expect(game.round).toBe(5);
  });

  it("reports rewards without applying or accumulating side effects", () => {
    const game = play([0.55, 0.55, 0.55, 0, 0]);
    const initialResults = game.results.map((result) => ({ ...result }));
    const first = game.result;
    expect(game.result).toEqual(first);
    expect(game.result).not.toBe(first);
    first.bsChange = 999;
    first.coffee = 99;
    first.distractSeconds = 999;
    expect(game.result.bsChange).toBe(-25);
    expect(game.result.coffee).toBe(1);
    expect(game.result.distractSeconds).toBe(12);
    expect(game.results).toEqual(initialResults);
    expect(game.round).toBe(5);
    expect(game.hits).toBe(3);
    expect(game.score).toBe(300);
  });

  it("keeps separate activities independent", () => {
    const first = play([0.55]);
    const second = new FunFriday();
    expect(first.results).not.toBe(second.results);
    expect(second.round).toBe(0);
    expect(second.hits).toBe(0);
    expect(second.score).toBe(0);
    expect(second.results).toEqual([]);
  });
});

describe("FUN_LINES", () => {
  it("provides five distinct short slogans for the five rounds", () => {
    expect(FUN_LINES).toHaveLength(5);
    expect(new Set(FUN_LINES).size).toBe(5);
    for (const line of FUN_LINES) {
      expect(line.trim().length).toBeGreaterThan(0);
      expect(line.length).toBeLessThan(90);
    }
  });
});
