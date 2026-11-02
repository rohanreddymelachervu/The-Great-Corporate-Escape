// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Navigator,
  blocked,
  center,
  circleHits,
  clamp,
  dailySeed,
  dist,
  hash,
  inCone,
  medal,
  move,
  rng,
  scoreRun,
  segmentHits,
  visible,
} from "../src/game/logic";
import { freshSave, load, persist, record } from "../src/game/progression";
import type { Point, Rect, Result } from "../src/game/types";

const rectangle: Rect = { x: 10, y: 10, w: 20, h: 20 };
const sample = (seed: number, length = 32) => {
  const random = rng(seed);
  return Array.from({ length }, () => random());
};

/** Check edges, not just waypoints: clear nodes alone do not prove a usable path. */
function pathCollisions(
  start: Point,
  path: Point[],
  radius: number,
  obstacles: Rect[],
): string[] {
  const errors: string[] = [];
  let from = start;
  for (const to of path) {
    const steps = Math.max(1, Math.ceil(dist(from, to) * 2));
    for (let i = 0; i <= steps; i++) {
      const p = {
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
      };
      if (blocked(p, radius, obstacles)) {
        errors.push(
          `${JSON.stringify(from)} -> ${JSON.stringify(to)} intersects at ${JSON.stringify(p)}`,
        );
        break;
      }
    }
    from = to;
  }
  return errors;
}

function boundary(width: number, height: number): Rect[] {
  return [
    { x: 0, y: 0, w: width, h: 12 },
    { x: 0, y: height - 12, w: width, h: 12 },
    { x: 0, y: 0, w: 12, h: height },
    { x: width - 12, y: 0, w: 12, h: height },
  ];
}

function result(overrides: Partial<Result> = {}): Result {
  return {
    level: 1,
    time: 60,
    bs: 0,
    spots: 0,
    hits: 0,
    collectibles: 3,
    distractions: 0,
    score: 10000,
    medal: "Ghost Employee",
    daily: false,
    seed: "campaign",
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("basic geometry", () => {
  it.each([
    [-1, 0],
    [0, 0],
    [5, 5],
    [10, 10],
    [11, 10],
  ])("clamps %s to %s", (value, expected) => {
    expect(clamp(value, 0, 10)).toBe(expected);
  });
  it("computes Euclidean distance, symmetry, and a rectangle center without mutation", () => {
    const a = { x: -3, y: -4 },
      b = { x: 0, y: 0 };
    expect(dist(a, b)).toBe(5);
    expect(dist(b, a)).toBe(5);
    expect(dist(a, a)).toBe(0);
    expect(center(rectangle)).toEqual({ x: 20, y: 20 });
    expect(rectangle).toEqual({ x: 10, y: 10, w: 20, h: 20 });
  });
});

describe("seeded randomness and UTC daily challenges", () => {
  it.each([
    ["", 2166136261],
    ["a", 3826002220],
    ["hello", 1335831723],
  ])("hash(%j) has a stable unsigned FNV-1a value", (text, expected) => {
    expect(hash(text)).toBe(expected);
  });
  it("hashes Unicode deterministically and differentiates adjacent day seeds", () => {
    expect(hash("ಕಾಫಿ ☕")).toBe(hash("ಕಾಫಿ ☕"));
    expect(hash("2026-10-30")).not.toBe(hash("2026-10-31"));
    expect(hash("ಕಾಫಿ ☕")).toBeGreaterThanOrEqual(0);
    expect(hash("ಕಾಫಿ ☕")).toBeLessThan(2 ** 32);
  });
  it("replays the same sequence independently for the same seed", () => {
    expect(sample(12345, 256)).toEqual(sample(12345, 256));
    expect(sample(12345)).not.toEqual(sample(12346));
    const a = rng(42),
      b = rng(42);
    a();
    a();
    expect(b()).toBe(sample(42)[0]);
  });
  it("pins the PRNG algorithm against an accidental implementation change", () => {
    expect(sample(1, 3)).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });
  it.each([0, 1, -1, 2147483647, 4294967295])(
    "seed %s always produces finite values in [0, 1)",
    (seed) => {
      const values = sample(seed, 1000);
      expect(values.every((v) => Number.isFinite(v) && v >= 0 && v < 1)).toBe(
        true,
      );
      expect(new Set(values).size).toBeGreaterThan(990);
    },
  );
  it("normalizes seed state to 32 bits", () => {
    expect(sample(-1)).toEqual(sample(0xffffffff));
    expect(sample(1)).toEqual(sample(0x100000001));
  });
  it.each([
    ["2026-01-01T00:10:00+05:30", "2025-12-31"],
    ["2025-12-31T23:50:00-08:00", "2026-01-01"],
    ["2024-02-29T23:59:59.999Z", "2024-02-29"],
    ["2024-03-01T00:00:00.000Z", "2024-03-01"],
  ])("uses the UTC calendar date of %s", (iso, expected) => {
    expect(dailySeed(new Date(iso))).toBe(expected);
  });
  it("defaults to the current clock and rolls over exactly at UTC midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T23:59:59.999Z"));
    expect(dailySeed()).toBe("2026-10-30");
    vi.advanceTimersByTime(1);
    expect(dailySeed()).toBe("2026-10-31");
  });
  it("produces identical daily random streams for equivalent instants/timezones", () => {
    const a = dailySeed(new Date("2026-10-30T21:00:00Z"));
    const b = dailySeed(new Date("2026-10-31T02:30:00+05:30"));
    expect(sample(hash(a))).toEqual(sample(hash(b)));
  });
});

describe("circle versus solid rectangles", () => {
  it.each([
    ["inside", { x: 20, y: 20 }, 1, true],
    ["left overlap", { x: 6, y: 20 }, 5, true],
    ["right overlap", { x: 34, y: 20 }, 5, true],
    ["top overlap", { x: 20, y: 6 }, 5, true],
    ["bottom overlap", { x: 20, y: 34 }, 5, true],
    ["side tangency permits movement", { x: 5, y: 20 }, 5, false],
    ["corner tangency permits movement", { x: 7, y: 6 }, 5, false],
    ["corner overlap", { x: 7, y: 7 }, 5, true],
    ["outside corner bounding box but not circle", { x: 6, y: 6 }, 5, false],
    ["zero radius", { x: 20, y: 20 }, 0, false],
  ] as const)("%s", (_name, p, radius, expected) => {
    expect(circleHits(p, radius, rectangle)).toBe(expected);
  });
  it("handles negative world coordinates", () => {
    expect(circleHits({ x: -5, y: -5 }, 2, { x: -6, y: -6, w: 3, h: 3 })).toBe(
      true,
    );
  });
  it("blocked checks every obstacle and supports an empty world", () => {
    expect(blocked({ x: 20, y: 20 }, 1, [])).toBe(false);
    expect(
      blocked({ x: 20, y: 20 }, 1, [{ x: 100, y: 100, w: 5, h: 5 }, rectangle]),
    ).toBe(true);
    expect(blocked({ x: 100, y: 0 }, 1, [rectangle])).toBe(false);
  });
});

describe("swept circle movement and wall sliding", () => {
  it("moves freely, including negative and fractional deltas, without mutating its input", () => {
    const p = Object.freeze({ x: 30, y: 40 });
    const moved = move(p, -12.5, 7.25, 11, []);
    expect(moved.x).toBeCloseTo(17.5);
    expect(moved.y).toBeCloseTo(47.25);
    expect(p).toEqual({ x: 30, y: 40 });
    expect(move(p, 0, 0, 11, [])).toEqual(p);
  });
  it.each([
    [{ x: 20, y: 100 }, 500, 0, { x: 100, y: 0, w: 1, h: 300 }, "x", 89, -1],
    [{ x: 180, y: 100 }, -500, 0, { x: 100, y: 0, w: 1, h: 300 }, "x", 112, 1],
    [{ x: 100, y: 20 }, 0, 500, { x: 0, y: 100, w: 300, h: 1 }, "y", 89, -1],
    [{ x: 100, y: 180 }, 0, -500, { x: 0, y: 100, w: 300, h: 1 }, "y", 112, 1],
  ] as const)(
    "does not tunnel through a 1px wall from %j",
    (start, dx, dy, wall, axis, limit, sign) => {
      const actual = move(start, dx, dy, 11, [wall]);
      expect(blocked(actual, 11, [wall])).toBe(false);
      if (sign < 0) expect(actual[axis]).toBeLessThanOrEqual(limit);
      else expect(actual[axis]).toBeGreaterThanOrEqual(limit);
      expect(Math.abs(actual[axis] - limit)).toBeLessThanOrEqual(5);
    },
  );
  it("slides down a vertical wall while its x movement is stopped", () => {
    const wall = { x: 100, y: 0, w: 20, h: 400 };
    const p = move({ x: 80, y: 60 }, 100, 100, 11, [wall]);
    expect(p.x).toBeGreaterThanOrEqual(84);
    expect(p.x).toBeLessThanOrEqual(89);
    expect(p.y).toBeCloseTo(160);
    expect(blocked(p, 11, [wall])).toBe(false);
  });
  it("slides horizontally along a floor and escapes when moving away", () => {
    const floor = { x: 0, y: 100, w: 400, h: 20 };
    const p = move({ x: 60, y: 85 }, 100, 100, 11, [floor]);
    expect(p.x).toBeCloseTo(160);
    expect(p.y).toBeLessThanOrEqual(89);
    const away = move(p, -10, -25, 11, [floor]);
    expect(away.x).toBeCloseTo(p.x - 10);
    expect(away.y).toBeCloseTo(p.y - 25);
  });
  it("stops both axes in an inside corner without penetration", () => {
    const obstacles = [
      { x: 100, y: 0, w: 20, h: 200 },
      { x: 0, y: 100, w: 200, h: 20 },
    ];
    const p = move({ x: 50, y: 50 }, 300, 300, 11, obstacles);
    expect(p.x).toBeLessThanOrEqual(89);
    expect(p.y).toBeLessThanOrEqual(89);
    expect(blocked(p, 11, obstacles)).toBe(false);
  });
  it("maintains circle clearance over a reproducible random movement sequence", () => {
    const obstacles = [...boundary(300, 300), { x: 120, y: 80, w: 30, h: 140 }];
    let p = { x: 60, y: 60 };
    const random = rng(20261030);
    for (let i = 0; i < 400; i++) {
      p = move(
        p,
        (random() - 0.5) * 180,
        (random() - 0.5) * 180,
        11,
        obstacles,
      );
      expect(
        blocked(p, 11, obstacles),
        `movement ${i}: ${JSON.stringify(p)}`,
      ).toBe(false);
    }
  });
});

describe("segments, line of sight, and field of view", () => {
  it.each([
    ["crosses", { x: 0, y: 20 }, { x: 40, y: 20 }, true],
    ["vertical crossing", { x: 20, y: 0 }, { x: 20, y: 40 }, true],
    ["entirely inside", { x: 15, y: 15 }, { x: 25, y: 25 }, true],
    ["corner touches", { x: 0, y: 0 }, { x: 10, y: 10 }, true],
    ["along edge", { x: 0, y: 10 }, { x: 40, y: 10 }, true],
    ["parallel outside", { x: 0, y: 9 }, { x: 40, y: 9 }, false],
    ["stops short", { x: 0, y: 20 }, { x: 9, y: 20 }, false],
    ["beyond the segment", { x: 31, y: 20 }, { x: 40, y: 20 }, false],
    ["zero-length inside", { x: 20, y: 20 }, { x: 20, y: 20 }, true],
    ["zero-length outside", { x: 0, y: 0 }, { x: 0, y: 0 }, false],
  ] as const)("%s is symmetric", (_name, a, b, expected) => {
    expect(segmentHits(a, b, rectangle)).toBe(expected);
    expect(segmentHits(b, a, rectangle)).toBe(expected);
  });
  it("blocks sight in both directions, but not around the unobstructed side", () => {
    expect(visible({ x: 0, y: 20 }, { x: 40, y: 20 }, [rectangle])).toBe(false);
    expect(visible({ x: 40, y: 20 }, { x: 0, y: 20 }, [rectangle])).toBe(false);
    expect(visible({ x: 0, y: 0 }, { x: 40, y: 0 }, [rectangle])).toBe(true);
    expect(visible({ x: 0, y: 20 }, { x: 40, y: 20 }, [])).toBe(true);
  });
  it("includes the range and FOV boundaries, rejects points just beyond either", () => {
    const a = { x: 0, y: 0 };
    expect(inCone(a, { x: 100, y: 0 }, 0, 100, Math.PI / 2, [])).toBe(true);
    expect(inCone(a, { x: 100.001, y: 0 }, 0, 100, Math.PI / 2, [])).toBe(
      false,
    );
    expect(inCone(a, { x: 20, y: 20 }, 0, 100, Math.PI / 2, [])).toBe(true);
    const outside = Math.PI / 4 + 0.001;
    expect(
      inCone(
        a,
        { x: 20 * Math.cos(outside), y: 20 * Math.sin(outside) },
        0,
        100,
        Math.PI / 2,
        [],
      ),
    ).toBe(false);
    expect(inCone(a, { x: -1, y: 0 }, 0, 100, Math.PI / 2, [])).toBe(false);
  });
  it("wraps angles across -π/+π and by complete revolutions", () => {
    const a = { x: 0, y: 0 },
      b = { x: -100, y: -1 };
    expect(inCone(a, b, Math.PI - 0.01, 110, 0.1, [])).toBe(true);
    expect(inCone(a, b, Math.PI - 0.01 + 8 * Math.PI, 110, 0.1, [])).toBe(true);
  });
  it("requires LOS even for a target inside the cone and range", () => {
    expect(
      inCone({ x: 0, y: 20 }, { x: 40, y: 20 }, 0, 100, Math.PI / 2, [
        rectangle,
      ]),
    ).toBe(false);
    expect(
      inCone({ x: 0, y: 0 }, { x: 40, y: 0 }, 0, 100, Math.PI / 2, [rectangle]),
    ).toBe(true);
  });
});

describe("Navigator A* and swept path clearance", () => {
  it("returns a direct exact endpoint when the full radius fits", () => {
    const nav = new Navigator(240, 240, boundary(240, 240));
    const a = { x: 40, y: 40 },
      b = { x: 200, y: 200 };
    expect(nav.path(a, b)).toEqual([b]);
    expect(nav.path(a, a)).toEqual([a]);
  });
  it("builds row-major grid centers and inflates obstacles by radius + 2", () => {
    const obstacles = [{ x: 96, y: 72, w: 48, h: 96 }];
    const nav = new Navigator(250, 190, obstacles, 11);
    expect(nav.step).toBe(24);
    expect(nav.cols).toBe(11);
    expect(nav.rows).toBe(8);
    expect(nav.point(0)).toEqual({ x: 12, y: 12 });
    expect(nav.point(nav.cols)).toEqual({ x: 12, y: 36 });
    for (let i = 0; i < nav.walk.length; i++) {
      expect(Boolean(nav.walk[i])).toBe(!blocked(nav.point(i), 13, obstacles));
    }
  });
  it("detours around a wall, returns the exact target, and clears every swept edge", () => {
    const obstacles = [...boundary(336, 288), { x: 144, y: 72, w: 24, h: 144 }];
    const nav = new Navigator(336, 288, obstacles);
    const a = { x: 60, y: 132 },
      b = { x: 276, y: 132 };
    const path = nav.path(a, b);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(b);
    expect(pathCollisions(a, path, nav.radius, obstacles)).toEqual([]);
    expect(nav.path(a, b)).toEqual(path);
    expect(nav.path(b, a).at(-1)).toEqual(a);
  });
  it("does not route through a complete divider or walk outside the enclosing walls", () => {
    const obstacles = [...boundary(240, 240), { x: 108, y: 12, w: 24, h: 216 }];
    const nav = new Navigator(240, 240, obstacles);
    expect(nav.path({ x: 60, y: 120 }, { x: 180, y: 120 })).toEqual([]);
  });
  it("returns no route when no nearby walkable start or goal exists", () => {
    const nav = new Navigator(240, 240, [{ x: 0, y: 0, w: 240, h: 240 }]);
    expect(nav.path({ x: 60, y: 60 }, { x: 180, y: 180 })).toEqual([]);
  });
  it("rejects a doorway narrower than the diameter despite a clear center line", () => {
    const obstacles = [
      ...boundary(288, 288),
      { x: 132, y: 12, w: 24, h: 123 },
      { x: 132, y: 153, w: 24, h: 123 },
    ];
    const nav = new Navigator(288, 288, obstacles, 11);
    expect(visible({ x: 60, y: 144 }, { x: 228, y: 144 }, obstacles)).toBe(
      true,
    );
    expect(nav.path({ x: 60, y: 144 }, { x: 228, y: 144 })).toEqual([]);
  });
  it("does not mutate the supplied endpoints or obstacle definitions", () => {
    const obstacles = Object.freeze([
      Object.freeze({ x: 96, y: 72, w: 48, h: 96 }),
    ]);
    const a = Object.freeze({ x: 60, y: 132 }),
      b = Object.freeze({ x: 204, y: 132 });
    const before = JSON.stringify({ obstacles, a, b });
    const nav = new Navigator(288, 240, obstacles as unknown as Rect[]);
    nav.path(a, b);
    expect(JSON.stringify({ obstacles, a, b })).toBe(before);
  });
  it("keeps endpoint connectors clear when routing off-grid near a wall corner", () => {
    const obstacles = [...boundary(288, 288), { x: 96, y: 96, w: 72, h: 72 }];
    const nav = new Navigator(288, 288, obstacles);
    const points = [
      { x: 80, y: 85 },
      { x: 85, y: 80 },
      { x: 181, y: 85 },
      { x: 85, y: 181 },
      { x: 180, y: 180 },
      { x: 204, y: 132 },
      { x: 60, y: 132 },
      { x: 132, y: 204 },
    ];
    const failures: string[] = [];
    for (const a of points)
      for (const b of points) {
        if (a === b) continue;
        const path = nav.path(a, b);
        if (!path.length || dist(path.at(-1)!, b) > 0.001)
          failures.push(`No complete route: ${JSON.stringify({ a, b })}`);
        failures.push(...pathCollisions(a, path, nav.radius, obstacles));
      }
    expect(failures).toEqual([]);
  });
});

describe("run scoring and medal rules", () => {
  it("calculates a perfect par-time run with all component bonuses", () => {
    expect(scoreRun(60, 60, 0, 0, 2, 3, 0)).toBe(12150);
  });
  it("scores time as 35 points per second until twice par, then floors its time bonus", () => {
    expect(
      scoreRun(59, 60, 1, 1, 0, 0, 0) - scoreRun(60, 60, 1, 1, 0, 0, 0),
    ).toBe(35);
    expect(scoreRun(120, 60, 1, 1, 0, 0, 0)).toBe(4820);
    expect(scoreRun(999, 60, 1, 1, 0, 0, 0)).toBe(4820);
  });
  it("awards 2500 for never spotted, 1500 for never caught, and penalizes each spotting", () => {
    const base = scoreRun(120, 60, 0, 0, 0, 0, 0);
    expect(base - scoreRun(120, 60, 1, 0, 0, 0, 0)).toBe(2680);
    expect(base - scoreRun(120, 60, 0, 1, 0, 0, 0)).toBe(1500);
    expect(
      scoreRun(120, 60, 1, 1, 0, 0, 0) - scoreRun(120, 60, 2, 1, 0, 0, 0),
    ).toBe(180);
  });
  it("awards 300 per item, caps distraction credit at six, and charges 18 per BS", () => {
    const base = scoreRun(120, 60, 1, 1, 0, 0, 0);
    expect(scoreRun(120, 60, 1, 1, 3, 0, 0) - base).toBe(900);
    expect(scoreRun(120, 60, 1, 1, 0, 6, 0) - base).toBe(900);
    expect(scoreRun(120, 60, 1, 1, 0, 99, 0)).toBe(
      scoreRun(120, 60, 1, 1, 0, 6, 0),
    );
    expect(base - scoreRun(120, 60, 1, 1, 0, 0, 10)).toBe(180);
  });
  it("rounds fractional scores and never drops below 100", () => {
    expect(scoreRun(119.99, 60, 1, 1, 0, 0, 0)).toBe(4820);
    expect(scoreRun(119.98, 60, 1, 1, 0, 0, 0)).toBe(4821);
    expect(scoreRun(10000, 60, 100, 100, 0, 0, 100)).toBe(100);
  });
  it("Ghost Employee takes priority over score at the inclusive 1.5-par boundary", () => {
    expect(medal(100, 0, 0, 90, 60)).toBe("Ghost Employee");
    expect(medal(20000, 0, 0, 90, 60)).toBe("Ghost Employee");
    expect(medal(9500, 0, 0, 90.001, 60)).toBe("Gold");
    expect(medal(9500, 1, 0, 1, 60)).toBe("Gold");
    expect(medal(9500, 0, 1, 1, 60)).toBe("Gold");
  });
  it.each([
    [9500, "Gold"],
    [9499, "Silver"],
    [6500, "Silver"],
    [6499, "Bronze"],
    [100, "Bronze"],
  ])("score %s earns %s when not eligible for Ghost", (score, expected) => {
    expect(medal(Number(score), 1, 1, 100, 60)).toBe(expected);
  });
});

describe("fresh saves and storage (node-safe mocked localStorage)", () => {
  let data: Map<string, string>;
  let storage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  const key = "office-escape-v1";
  beforeEach(() => {
    data = new Map();
    storage = {
      getItem: vi.fn((k: string) => data.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => {
        data.set(k, String(v));
      }),
      removeItem: vi.fn((k: string) => {
        data.delete(k);
      }),
      clear: vi.fn(() => data.clear()),
    };
    vi.stubGlobal("localStorage", storage);
  });
  it("starts with only floor 1 unlocked, no results, and explicit audio/accessibility defaults", () => {
    expect(freshSave()).toEqual({
      version: 1,
      unlocked: 1,
      bests: {},
      achievements: [],
      settings: {
        music: 0.35,
        sfx: 0.6,
        mute: false,
        reducedMotion: false,
        hitScenes: "brief",
        tips: true,
      },
      dailyBests: {},
    });
  });
  it("allocates independent nested state for every fresh save", () => {
    const a = freshSave(),
      b = freshSave();
    a.settings.mute = true;
    a.settings.music = 0;
    a.achievements.push("ghost");
    a.bests["1"] = result();
    a.dailyBests["2026-10-30"] = 1;
    expect(b).toEqual(freshSave());
    expect(a.settings).not.toBe(b.settings);
    expect(a.bests).not.toBe(b.bests);
    expect(a.dailyBests).not.toBe(b.dailyBests);
    expect(a.achievements).not.toBe(b.achievements);
  });
  it.each([
    null,
    "null",
    "{not json",
    '{"version":2,"unlocked":5}',
    '{"version":0}',
    "[]",
  ])(
    "falls back cleanly for absent/invalid/version-mismatched storage %j",
    (saved) => {
      if (saved !== null) data.set(key, saved);
      expect(load()).toEqual(freshSave());
    },
  );
  it.each([
    [0, 1],
    [-4, 1],
    [99, 5],
    ["4", 4],
    ["invalid", 1],
  ])("normalizes unlocked %j to %s", (unlocked, expected) => {
    data.set(key, JSON.stringify({ version: 1, unlocked }));
    expect(load().unlocked).toBe(expected);
  });
  it("merges partial settings, repairs nullable collections, and restores valid records", () => {
    const best = result();
    data.set(
      key,
      JSON.stringify({
        version: 1,
        unlocked: 3,
        bests: { "1": best },
        settings: { mute: true },
        achievements: ["ghost"],
        dailyBests: { "2026-10-30": 42 },
      }),
    );
    expect(load()).toEqual({
      ...freshSave(),
      unlocked: 3,
      bests: { "1": best },
      settings: { ...freshSave().settings, mute: true },
      achievements: ["ghost"],
      dailyBests: { "2026-10-30": 42 },
    });
    data.set(
      key,
      JSON.stringify({
        version: 1,
        bests: null,
        achievements: "ghost",
        settings: null,
      }),
    );
    expect(load().bests).toEqual({});
    expect(load().achievements).toEqual([]);
    expect(load().settings).toEqual(freshSave().settings);
  });
  it("survives storage access being denied on both read and write", () => {
    storage.getItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    expect(load()).toEqual(freshSave());
    expect(() => persist(freshSave())).not.toThrow();
    const save = freshSave();
    expect(() => record(save, result(), ["ghost"])).not.toThrow();
    expect(save.unlocked).toBe(2);
  });
  it("round-trips without mutating the save or aliasing stored state", () => {
    const save = freshSave();
    const before = structuredClone(save);
    persist(save);
    expect(storage.setItem).toHaveBeenCalledWith(key, JSON.stringify(save));
    expect(save).toEqual(before);
    const restored = load();
    expect(restored).toEqual(save);
    restored.settings.mute = true;
    expect(load().settings.mute).toBe(false);
  });
  it("campaign results unlock the next floor without relocking progress or exceeding floor 5", () => {
    const save = freshSave();
    record(save, result({ level: 3 }), []);
    expect(save.unlocked).toBe(4);
    record(save, result({ level: 1 }), []);
    expect(save.unlocked).toBe(4);
    record(save, result({ level: 5 }), []);
    expect(save.unlocked).toBe(5);
    expect(load()).toEqual(save);
  });
  it("keeps only the highest campaign score per floor, retaining the original result on ties", () => {
    const save = freshSave();
    const first = result({ score: 9000 });
    record(save, first, []);
    record(save, result({ score: 8999, time: 1 }), []);
    record(save, result({ score: 9000, time: 1 }), []);
    expect(save.bests["1"]).toBe(first);
    const better = result({ score: 9001, time: 70 });
    record(save, better, []);
    record(save, result({ level: 2, score: 100 }), []);
    expect(save.bests["1"]).toBe(better);
    expect(save.bests["2"].score).toBe(100);
  });
  it("daily records do not unlock campaign floors or replace campaign bests", () => {
    const save = freshSave();
    record(
      save,
      result({ daily: true, level: 5, seed: "2026-10-30", score: 9000 }),
      ["daily"],
    );
    record(save, result({ daily: true, seed: "2026-10-30", score: 8500 }), [
      "daily",
    ]);
    expect(save.unlocked).toBe(1);
    expect(save.bests).toEqual({});
    expect(save.dailyBests).toEqual({ "2026-10-30": 9000 });
    record(save, result({ daily: true, seed: "2026-10-30", score: 9500 }), []);
    expect(save.dailyBests["2026-10-30"]).toBe(9500);
    expect(save.achievements).toEqual(["daily"]);
  });
  it("retains the latest 31 UTC daily dates, even when records arrive out of order", () => {
    const save = freshSave();
    const dates = Array.from({ length: 40 }, (_, i) =>
      dailySeed(new Date(Date.UTC(2026, 0, i + 1))),
    );
    for (const date of [...dates].reverse())
      record(save, result({ daily: true, seed: date }), []);
    expect(Object.keys(save.dailyBests).sort()).toEqual(dates.slice(-31));
    expect(Object.keys(load().dailyBests)).toHaveLength(31);
  });
  it("returns only new achievements and does not duplicate achievements across runs", () => {
    const save = freshSave();
    expect(record(save, result(), ["ghost", "speed"])).toEqual([
      "ghost",
      "speed",
    ]);
    expect(record(save, result(), ["speed", "laptop"])).toEqual(["laptop"]);
    expect(save.achievements).toEqual(["ghost", "speed", "laptop"]);
    expect(load().achievements).toEqual(save.achievements);
  });
  it("deduplicates repeated achievement IDs in a single earned batch", () => {
    const save = freshSave();
    expect(record(save, result(), ["ghost", "ghost", "speed"])).toEqual([
      "ghost",
      "speed",
    ]);
    expect(save.achievements).toEqual(["ghost", "speed"]);
  });
});
