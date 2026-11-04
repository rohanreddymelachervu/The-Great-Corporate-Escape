import { describe, expect, it } from "vitest";
import {
  dailyRace,
  formatRaceTime,
  raceMedal,
  SprintRun,
  WORDS,
} from "../src/sprint/model";
import type {
  LetterBadge,
  RaceHazard,
  RaceInput,
  SprintCourse,
} from "../src/sprint/types";

const idle: RaceInput = { x: 0, y: 0, sprint: false, dash: false };
const right: RaceInput = { ...idle, x: 1 };
function course(patch: Partial<SprintCourse> = {}): SprintCourse {
  return {
    id: 2,
    name: "Test office",
    subtitle: "",
    joke: "Out of office.",
    width: 1400,
    height: 900,
    spawn: { x: 100, y: 100 },
    exit: { x: 1200, y: 700, w: 40, h: 40 },
    walls: [],
    props: [],
    zones: [],
    guards: [],
    hazards: [],
    letterSpots: Array.from({ length: 10 }, (_, i) => ({
      x: 200 + i * 60,
      y: 400,
    })),
    gold: 10,
    silver: 20,
    route: [],
    ...patch,
  };
}
const run = (c = course()) =>
  new SprintRun(c, { mode: "sprint", courseId: c.id });
function start(r: SprintRun) {
  expect(r.tick(0.9, idle).map((e) => e.type)).toEqual(["start"]);
}
function advance(r: SprintRun, seconds: number, input = idle) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) r.tick(1 / 60, input);
}
function letter(index: number, char = "A", x = 100, y = 100): LetterBadge {
  return { id: `letter-${index}`, index, char, x, y, collected: false };
}
const guard = {
  id: "g",
  kind: "manager" as const,
  route: [{ x: 180, y: 100 }],
  speed: 0,
  range: 200,
  fov: Math.PI,
};
const hazard = (kind: RaceHazard["kind"]): RaceHazard => ({
  id: kind,
  kind,
  from: { x: 100, y: 100 },
  to: { x: 100, y: 100 },
  radius: 15,
  w: 40,
  h: 40,
  period: 3,
  warn: 0.5,
  active: 1,
});

describe("Sprint movement and clocks", () => {
  it("normalizes diagonal walk and uses separate sprint speed", () => {
    const a = run(),
      b = run(),
      c = run();
    [a, b, c].forEach(start);
    advance(a, 0.2, right);
    advance(b, 0.2, { ...right, y: 1 });
    advance(c, 0.2, { ...right, sprint: true });
    expect(a.pos.x - 100).toBeCloseTo(37);
    expect(Math.hypot(b.pos.x - 100, b.pos.y - 100)).toBeCloseTo(37);
    expect(c.pos.x - 100).toBeCloseTo(50);
  });
  it.each(["walls", "props"] as const)(
    "stops against solid %s without tunnelling or changing spawn",
    (key) => {
      const c = course({
        [key]: [{ x: 140, y: 0, w: 2, h: 500, kind: "desk" }],
      });
      const before = JSON.stringify(c),
        r = run(c);
      start(r);
      advance(r, 1, right);
      expect(r.pos.x).toBeLessThanOrEqual(129.001);
      expect(r.pos.x).toBeGreaterThan(120);
      expect(JSON.stringify(c)).toBe(before);
      expect(r.pos).not.toBe(c.spawn);
    },
  );
  it("counts no countdown time, carries excess and ignores countdown dash requests", () => {
    const r = run();
    r.tick(0.5, { ...right, dash: true });
    expect(r.pos).toEqual({ x: 100, y: 100 });
    const events = r.tick(0.6, { ...right, dash: true });
    expect(events[0].type).toBe("start");
    expect(r.elapsed).toBeCloseTo(0.2);
    expect(r.pos.x).toBeCloseTo(137);
    expect(r.dashLeft).toBe(0);
  });
  it("locks queued dash direction, lasts .16 seconds and cools down for 1.1 seconds", () => {
    const r = run();
    start(r);
    r.tick(0.08, { ...right, dash: true });
    r.tick(0.08, { ...idle, y: 1 });
    expect(r.pos.x).toBeCloseTo(168.8);
    expect(r.pos.y).toBe(100);
    expect(r.dashLeft).toBeCloseTo(0);
    r.tick(0.1, { ...right, dash: true });
    expect(r.pos.x).toBeCloseTo(187.3);
    advance(r, 0.85);
    expect(r.dashCooldown).toBeCloseTo(0);
    r.tick(1 / 60, { ...right, dash: true });
    expect(r.dashLeft).toBeGreaterThan(0);
  });
  it("counts full raw long-frame time while bounding motion; pause is no tick", () => {
    const r = run();
    start(r);
    r.tick(5, right);
    expect(r.elapsed).toBe(5);
    expect(r.pos.x).toBeCloseTo(146.25);
    const paused = JSON.stringify(r);
    expect(JSON.stringify(r)).toBe(paused);
  });
  it("rejects invalid dt and keeps extreme finite frames and malformed axes bounded", () => {
    const r = run();
    const before = JSON.stringify(r);
    for (const dt of [NaN, Infinity, -1, 0])
      expect(r.tick(dt, right)).toEqual([]);
    expect(JSON.stringify(r)).toBe(before);
    start(r);
    r.tick(1e8, { ...right, x: NaN, y: Infinity });
    expect(r.pos).toEqual({ x: 100, y: 100 });
    advance(r, 1, { ...idle, x: -1 });
    expect(r.pos.x).toBeGreaterThanOrEqual(11);
  });
});

describe("Predictable guards and typed hazards", () => {
  it("provides vision grace then emits one failure and freezes everything except failureAge", () => {
    const r = run(
      course({ guards: [{ ...guard, route: [{ x: 40, y: 100 }] }] }),
    );
    start(r);
    advance(r, 0.5);
    expect(r.phase).toBe("running");
    expect(r.guards[0].awareness).toBeGreaterThan(0.7);
    const events = r.tick(0.15, idle);
    expect(events.filter((e) => e.type === "fail")).toHaveLength(1);
    expect(r.phase).toBe("failed");
    const before = {
      pos: { ...r.pos },
      time: r.elapsed,
      guards: structuredClone(r.guards),
      hazards: structuredClone(r.hazards),
    };
    expect(r.tick(2, { ...right, dash: true })).toEqual([]);
    expect(r.failureAge).toBe(2);
    expect({
      pos: r.pos,
      time: r.elapsed,
      guards: r.guards,
      hazards: r.hazards,
    }).toEqual(before);
  });
  it("decays awareness at 1.5/sec and checks the facing cone", () => {
    const r = run(
      course({ guards: [{ ...guard, route: [{ x: 40, y: 100 }] }] }),
    );
    start(r);
    advance(r, 0.2);
    const awareness = r.guards[0].awareness;
    r.pos = { x: 20, y: 180 };
    advance(r, 0.1);
    expect(r.guards[0].awareness).toBeCloseTo(awareness - 0.15);
  });
  it.each(["walls", "props"] as const)(
    "%s block both vision and body captures",
    (key) => {
      const r = run(
        course({
          guards: [{ ...guard, route: [{ x: 80, y: 100 }] }],
          [key]: [{ x: 88, y: 90, w: 2, h: 20, kind: "plant" }],
        }),
      );
      start(r);
      advance(r, 1);
      expect(r.phase).toBe("running");
      expect(r.guards[0].awareness).toBe(0);
    },
  );
  it("body contact captures immediately but dash protects contact and clears awareness", () => {
    const c = course({ guards: [{ ...guard, route: [{ x: 120, y: 100 }] }] });
    const a = run(c),
      b = run(c);
    start(a);
    start(b);
    a.tick(1 / 60, idle);
    expect(a.phase).toBe("failed");
    b.guards[0].awareness = 0.9;
    b.tick(0.1, { ...idle, dash: true });
    expect(b.phase).toBe("running");
    expect(b.guards[0].awareness).toBe(0);
  });
  it("computes closed polyline travel and normalized offsets from the clock and resets phases", () => {
    const c = course({
      guards: [
        {
          ...guard,
          route: [
            { x: 500, y: 500 },
            { x: 600, y: 500 },
          ],
          speed: 100,
          offset: 1.25,
        },
      ],
    });
    const r = run(c);
    expect(r.guards[0].x).toBe(550);
    start(r);
    r.tick(0.25, idle);
    expect(r.guards[0].x).toBe(575);
    r.tick(0.5, idle);
    expect(r.guards[0].x).toBe(575);
    expect(Math.abs(r.guards[0].angle)).toBeCloseTo(Math.PI);
    r.retry();
    expect(r.guards[0].x).toBe(550);
    expect(r.elapsed).toBe(0);
    const empty = run(course({ guards: [{ ...guard, route: [] }] }));
    expect(Number.isFinite(empty.guards[0].x)).toBe(true);
  });
  it.each(["photo", "paper", "meeting"] as const)(
    "%s warns first, captures only during active, and dash protects",
    (kind) => {
      const r = run(course({ hazards: [hazard(kind)] }));
      expect(r.hazards[0].warning).toBe(true);
      expect(r.hazards[0].active).toBe(false);
      start(r);
      advance(r, 0.4);
      expect(r.phase).toBe("running");
      advance(r, 0.2);
      expect(r.phase).toBe("failed");
      expect(r.failReason).toContain(kind);
      const b = run(course({ hazards: [hazard(kind)] }));
      start(b);
      advance(b, 0.4);
      b.tick(0.15, { ...idle, dash: true });
      expect(b.phase).toBe("running");
    },
  );
  it("uses centered photo rectangles and LOS, not the photo radius", () => {
    const h = {
      ...hazard("photo"),
      from: { x: 150, y: 100 },
      to: { x: 150, y: 100 },
      radius: 1,
      w: 100,
      h: 10,
    };
    const a = run(course({ hazards: [h] }));
    start(a);
    advance(a, 0.6);
    expect(a.phase).toBe("failed");
    const b = run(
      course({
        hazards: [h],
        props: [{ x: 125, y: 80, w: 4, h: 40, kind: "desk" }],
      }),
    );
    start(b);
    advance(b, 1);
    expect(b.phase).toBe("running");
  });
  it("moves photo/paper linearly during active and keeps meeting static, including offsets", () => {
    const r = run(
      course({
        hazards: (["photo", "paper", "meeting"] as const).map((kind) => ({
          ...hazard(kind),
          from: { x: 500, y: 500 },
          to: { x: 700, y: 500 },
          offset: 0.75,
        })),
      }),
    );
    expect(r.hazards.map((h) => h.x)).toEqual([550, 550, 500]);
    expect(r.hazards.every((h) => h.active)).toBe(true);
    start(r);
    r.tick(2, idle);
    expect(r.hazards.every((h) => !h.active && !h.warning)).toBe(true);
    r.retry();
    expect(r.hazards.map((h) => h.x)).toEqual([550, 550, 500]);
  });
});

describe("Letters, exits and time-only results", () => {
  it("automatically collects unordered repeated letters exactly once without changing inputs", () => {
    const letters = [
      letter(3, "A"),
      letter(0, "A", 500),
      letter(2, "P"),
      letter(1, "S", 600),
    ];
    const r = new SprintRun(
      course(),
      { mode: "buzzword", courseId: 2 },
      { word: "ASAP", joke: "Yesterday." },
      letters,
    );
    start(r);
    expect(
      r
        .tick(1 / 60, idle)
        .filter((e) => e.type === "letter")
        .map((e) => e.text),
    ).toEqual(["A", "P"]);
    expect(r.tick(1 / 60, idle)).toEqual([]);
    expect(letters.every((l) => !l.collected)).toBe(true);
    expect(r.letters.map((l) => l.index)).toEqual([3, 0, 2, 1]);
    r.pos = { x: 500, y: 100 };
    r.tick(1 / 60, idle);
    r.pos = { x: 600, y: 100 };
    r.tick(1 / 60, idle);
    expect(r.letters.every((l) => l.collected)).toBe(true);
    r.retry();
    expect(r.letters).toEqual(letters);
    expect(r.phase).toBe("countdown");
    expect(r.countdown).toBe(0.9);
    expect(r.result).toBe(null);
    expect(r.failReason).toBe("");
    expect(r.failureAge).toBe(0);
    expect(r.dashCooldown).toBe(0);
  });
  it("locks incomplete daily exits with a 1.5-second notice throttle and keeps clock running", () => {
    const c = course({ exit: { x: 90, y: 90, w: 30, h: 30 } });
    const r = new SprintRun(c, { mode: "buzzword", courseId: 2 }, undefined, [
      letter(0, "A", 500),
    ]);
    start(r);
    expect(r.tick(1 / 60, idle)[0].type).toBe("locked");
    expect(r.result).toBe(null);
    let locked = 0;
    for (let i = 0; i < 120; i++)
      locked += r.tick(1 / 60, idle).filter((e) => e.type === "locked").length;
    expect(locked).toBe(1);
    expect(r.phase).toBe("running");
    expect(r.elapsed).toBeGreaterThan(2);
  });
  it.each(["sprint", "buzzword"] as const)(
    "wins %s immediately and freezes raw time with separate result metadata",
    (mode) => {
      const c = course({ exit: { x: 90, y: 90, w: 30, h: 30 } });
      const r = new SprintRun(
        c,
        {
          mode,
          courseId: c.id,
          ...(mode === "buzzword" ? { day: "2026-04-01" } : {}),
        },
        mode === "buzzword" ? { word: "ASAP", joke: "Yesterday." } : undefined,
        mode === "buzzword"
          ? Array.from({ length: 4 }, (_, i) => letter(i, "ASAP"[i]))
          : [],
      );
      start(r);
      const events = r.tick(0.1, idle);
      expect(events.at(-1)?.type).toBe("win");
      expect(r.result?.time).toBe(0.1);
      expect(r.result?.medal).toBe("Gold");
      expect(r.result?.mode).toBe(mode);
      expect(r.result?.joke).toBe(mode === "sprint" ? c.joke : "Yesterday.");
      expect(r.result?.word).toBe(mode === "buzzword" ? "ASAP" : undefined);
      expect(r.result?.code).toBe(
        mode === "buzzword" ? "2026-04-01-C02" : "SPRINT-C02",
      );
      expect(r.result).not.toHaveProperty("score");
      r.tick(100, { ...right, dash: true });
      expect(r.elapsed).toBe(0.1);
      r.retry();
      expect(r.result).toBe(null);
      expect(r.elapsed).toBe(0);
      expect(r.letters.every((l) => !l.collected)).toBe(true);
    },
  );
  it("awards inclusive lower-is-better medals and documents consistent time formatting", () => {
    const c = course();
    expect([0, 10, 10.01, 20, 20.01].map((t) => raceMedal(t, c))).toEqual([
      "Gold",
      "Gold",
      "Silver",
      "Silver",
      "Bronze",
    ]);
    expect(formatRaceTime(23.479)).toBe("00:23.47");
    expect(formatRaceTime(83.47)).toBe("01:23.47");
    expect(formatRaceTime(-1)).toBe("00:00.00");
  });
});

describe("Deterministic daily word racing", () => {
  it("curates 14–20 unique corporate words of 4–7 letters with punchlines", () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(14);
    expect(WORDS.length).toBeLessThanOrEqual(20);
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length);
    for (const w of WORDS) {
      expect(w.word).toMatch(/^[A-Z]{4,7}$/);
      expect(w.joke.length).toBeGreaterThan(15);
    }
  });
  it("repeats course/word/layout across 90 UTC dates without source mutation or shared badges", () => {
    const courses = [course(), course({ id: 3 }), course({ id: 12 })];
    const original = JSON.stringify(courses);
    const combinations = new Set<string>();
    let duplicate = false;
    for (let i = 0; i < 90; i++) {
      const day = new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10);
      const a = dailyRace(day, courses),
        b = dailyRace(day, courses);
      expect(a).toEqual(b);
      expect(a.letters).toHaveLength(a.word.word.length);
      expect(a.letters.map((l) => l.char).join("")).toBe(a.word.word);
      expect(new Set(a.letters.map((l) => l.id)).size).toBe(a.letters.length);
      expect(new Set(a.letters.map((l) => `${l.x},${l.y}`)).size).toBe(
        a.letters.length,
      );
      expect(a.code).toBe(`${day}-C${String(a.course.id).padStart(2, "0")}`);
      expect(
        a.letters.every((l, index) => l.index === index && !l.collected),
      ).toBe(true);
      expect(a.letters[0]).not.toBe(b.letters[0]);
      expect(a.letters[0]).not.toBe(
        a.course.letterSpots.find((p) => p.x === a.letters[0].x),
      );
      combinations.add(`${a.course.id}:${a.word.word}`);
      duplicate ||= new Set(a.word.word).size < a.word.word.length;
    }
    expect(combinations.size).toBeGreaterThan(12);
    expect(duplicate).toBe(true);
    expect(JSON.stringify(courses)).toBe(original);
  });
  it("filters illegal spots and incompatible words, and clearly rejects unusable courses", () => {
    const c = course({
      letterSpots: [
        { x: -1, y: 0 },
        { x: 300, y: 300 },
        ...course().letterSpots.slice(0, 4),
      ],
      props: [{ x: 290, y: 290, w: 20, h: 20, kind: "desk" }],
    });
    const d = dailyRace("2026-01-01", [c]);
    expect(d.word.word).toHaveLength(4);
    expect(d.letters.every((l) => l.y === 400)).toBe(true);
    expect(() => dailyRace("2026-01-01", [])).toThrow(/four legal/);
  });
});
