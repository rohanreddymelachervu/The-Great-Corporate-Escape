// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { Navigator, blocked, dist, move, visible } from "../src/game/logic";
import { LEVELS } from "../src/game/levels";
import {
  CHAT_LINES,
  OfficeSocial,
  type SocialActor,
  type SocialEvent,
} from "../src/game/social";
import type { EnemyState, Rect } from "../src/game/types";

function setup(obstacles: Rect[] = []) {
  const actors: SocialActor[] = [
    {
      id: "intern",
      kind: "intern",
      x: 120,
      y: 180,
      state: "patrol",
      awareness: 0,
    },
    {
      id: "founder",
      kind: "founder",
      x: 300,
      y: 180,
      state: "patrol",
      awareness: 0,
    },
  ];
  const input = {
    actors,
    obstacles,
    nav: new Navigator(640, 420, obstacles),
    frozen: false,
  };
  return { social: new OfficeSocial(), input, actors };
}
function arrive(t: ReturnType<typeof setup>) {
  const chat = t.social.active!;
  // Test harness alone places them at arrival; the model must never do this.
  Object.assign(t.actors[0], chat.internSpot);
  Object.assign(t.actors[1], chat.founderSpot);
  return t.social.update(0, t.input);
}
function advance(t: ReturnType<typeof setup>, seconds: number, step = 0.1) {
  const events: SocialEvent[] = [];
  for (let left = seconds; left > 1e-8; left -= step)
    events.push(...t.social.update(Math.min(left, step), t.input));
  return events;
}

describe("office duet selection and safe standing spots", () => {
  it("starts with existing roles, radius-12-clear spots 50–80px apart, without mutating actors", () => {
    const t = setup(),
      before = structuredClone(t.actors);
    const events = t.social.update(1 / 60, t.input),
      chat = t.social.active!;
    expect(events.map((e) => e.type)).toEqual(["start"]);
    expect(chat.phase).toBe("approach");
    expect(chat.age).toBe(0);
    expect(dist(chat.internSpot, chat.founderSpot)).toBeGreaterThanOrEqual(50);
    expect(dist(chat.internSpot, chat.founderSpot)).toBeLessThanOrEqual(80);
    for (const spot of [chat.internSpot, chat.founderSpot])
      expect(blocked(spot, 12, t.input.obstacles)).toBe(false);
    expect(t.actors).toEqual(before);
    expect(t.social.isBusy("intern")).toBe(true);
    expect(t.social.isBusy("founder")).toBe(true);
    expect(t.social.isBusy("manager")).toBe(false);
    // Events are snapshots, not time-travelling references to active state.
    t.social.update(0.5, t.input);
    expect(events[0].chat.age).toBe(0);
  });

  it("does not start through walls, even when a route exists around them", () => {
    const t = setup([{ x: 204, y: 144, w: 12, h: 72 }]);
    expect(t.input.nav.path(t.actors[0], t.actors[1]).length).toBeGreaterThan(
      0,
    );
    expect(t.social.update(1, t.input)).toEqual([]);
    expect(t.social.active).toBeNull();
  });

  it("requires both roles, line of sight, and a distance of at most 220", () => {
    const t = setup();
    t.actors[1].x = 341;
    expect(t.social.update(0, t.input)).toEqual([]);
    t.actors[1].x = 340;
    expect(t.social.update(0, t.input)[0].type).toBe("start");
    const other = setup();
    other.actors[1].kind = "manager";
    expect(other.social.update(1, other.input)).toEqual([]);
  });

  it.each(["chase", "search"] as EnemyState[])(
    "excludes either actor in %s",
    (state) => {
      for (const index of [0, 1]) {
        const t = setup();
        t.actors[index].state = state;
        expect(t.social.update(0, t.input)).toEqual([]);
      }
    },
  );

  it("excludes awareness above .25 or a positive catch cooldown, but not their exact safe boundaries", () => {
    for (const index of [0, 1]) {
      const t = setup();
      t.actors[index].awareness = 0.251;
      expect(t.social.update(1, t.input)).toEqual([]);
      t.actors[index].awareness = 0.25;
      t.actors[index].catchCooldown = 0.01;
      expect(t.social.update(1, t.input)).toEqual([]);
      t.actors[index].catchCooldown = 0;
      expect(t.social.update(1, t.input)[0].type).toBe("start");
    }
  });

  it("lets coffee-distracted and investigating colleagues qualify", () => {
    const t = setup();
    t.actors[0].state = "distracted";
    t.actors[1].state = "investigate";
    expect(t.social.update(0, t.input)[0].type).toBe("start");
  });

  it("requires reachable paths and rejects detours beyond 260px", () => {
    const t = setup();
    vi.spyOn(t.input.nav, "path").mockReturnValue([]);
    expect(t.social.update(0, t.input)).toEqual([]);
    vi.mocked(t.input.nav.path).mockImplementation((a, b) => [
      { x: a.x, y: 410 },
      b,
    ]);
    expect(t.social.update(0, t.input)).toEqual([]);
  });

  it("checks swept radius even if a Navigator returns a bogus corner-clipping path", () => {
    const t = setup([{ x: 400, y: 100, w: 20, h: 100 }]);
    vi.spyOn(t.input.nav, "path").mockImplementation((_a, b) => [
      { x: 410, y: 150 },
      b,
    ]);
    expect(t.social.update(0, t.input)).toEqual([]);
  });

  it("finds a safe pair in the actual Founder Mode doorway without changing its layout", () => {
    const level = LEVELS[4];
    const obs = [
      ...level.walls,
      ...level.props,
      ...level.gates.filter((g) => !g.open),
    ];
    const t = setup(obs);
    t.input.nav = new Navigator(level.width, level.height, obs);
    Object.assign(t.actors[0], { x: 680, y: 210 });
    Object.assign(t.actors[1], { x: 810, y: 210 });
    expect(t.social.update(0, t.input)[0]?.type).toBe("start");
    const chat = t.social.active!;
    expect(visible(chat.internSpot, chat.founderSpot, obs)).toBe(true);
    expect(blocked(chat.internSpot, 12, obs)).toBe(false);
    expect(blocked(chat.founderSpot, 12, obs)).toBe(false);
  });

  it("is deterministic even if the actor array is reordered", () => {
    const a = setup(),
      b = setup();
    const extra: SocialActor = { ...a.actors[0], id: "another-intern" };
    a.actors.push(extra);
    b.actors.unshift({ ...extra });
    b.actors.reverse();
    expect(a.social.update(0, a.input)).toEqual(b.social.update(0, b.input));
  });
});

describe("approach, script, completion and aborts", () => {
  it("waits for both actual arrivals; model updates never teleport or change state", () => {
    const t = setup();
    t.social.update(0, t.input);
    const original = structuredClone(t.actors);
    expect(t.social.update(1, t.input)).toEqual([]);
    expect(t.actors).toEqual(original);
    Object.assign(t.actors[0], t.social.active!.internSpot);
    expect(t.social.update(1, t.input)).toEqual([]);
    expect(t.social.active!.phase).toBe("approach");
    Object.assign(t.actors[1], t.social.active!.founderSpot);
    const lines = t.social.update(0, t.input);
    expect(lines[0]).toMatchObject({
      type: "line",
      speaker: "intern",
      text: CHAT_LINES[0].text,
    });
    expect(t.social.active!.phase).toBe("talking");
    expect(t.social.active!.talkAge).toBe(0);
  });

  it("supports a real collider-safe walking approach via the existing navigation API", () => {
    const t = setup();
    t.social.update(0, t.input);
    for (
      let frame = 0;
      frame < 300 && t.social.active?.phase === "approach";
      frame++
    ) {
      const chat = t.social.active!;
      t.actors.forEach((actor, i) => {
        const goal = i === 0 ? chat.internSpot : chat.founderSpot;
        const next = t.input.nav.path(actor, goal)[0];
        const length = dist(actor, next),
          travel = Math.min(length, 115 / 60);
        if (length)
          Object.assign(
            actor,
            move(
              actor,
              ((next.x - actor.x) / length) * travel,
              ((next.y - actor.y) / length) * travel,
              12,
              t.input.obstacles,
            ),
          );
      });
      const before = structuredClone(t.actors);
      t.social.update(1 / 60, t.input);
      expect(t.actors).toEqual(before);
    }
    expect(t.social.active?.phase).toBe("talking");
    expect(t.social.active!.age).toBeLessThan(5);
  });

  it("emits five alternating lines about every 1.6s, with a full eight-second talking phase", () => {
    const t = setup();
    t.social.update(0, t.input);
    const events = arrive(t);
    for (let i = 1; i <= 4; i++) {
      events.push(...advance(t, 1.6));
      expect(t.social.active!.line).toBe(i);
    }
    expect(t.social.completed).toBe(0);
    events.push(...advance(t, 1.59));
    expect(t.social.active).not.toBeNull();
    events.push(...advance(t, 0.01));
    expect(
      events
        .filter((e) => e.type === "line")
        .map((e) => ({ speaker: e.speaker, text: e.text })),
    ).toEqual(CHAT_LINES);
    expect(events.filter((e) => e.type === "end")).toHaveLength(1);
    expect(t.social.active).toBeNull();
    expect(t.social.completed).toBe(1);
    expect(t.social.isBusy("intern")).toBe(false);
    // No cooldown expiry or giant dt can produce a second encounter this run.
    expect(t.social.update(1000, t.input)).toEqual([]);
    expect(t.social.completed).toBe(1);
  });

  it("caps approach at five seconds and never sticks or retries after a failed approach", () => {
    const t = setup();
    t.social.update(0, t.input);
    expect(t.social.update(4.99, t.input)).toEqual([]);
    const end = t.social.update(0.02, t.input);
    expect(end[0]).toMatchObject({
      type: "end",
      chat: { phase: "approach", age: 5 },
    });
    expect(t.social.active).toBeNull();
    expect(t.social.update(999, t.input)).toEqual([]);
  });

  it("never exceeds thirteen seconds, and long frames emit every crossed line once", () => {
    const t = setup();
    t.social.update(0, t.input);
    t.social.update(4.9, t.input);
    const first = arrive(t);
    const rest = t.social.update(100, t.input);
    expect([...first, ...rest].filter((e) => e.type === "line")).toHaveLength(
      5,
    );
    expect(rest.at(-1)).toMatchObject({ type: "end", chat: { talkAge: 8 } });
    expect(rest.at(-1)!.chat.age).toBeLessThanOrEqual(13);
  });

  it("freezes selection, approach, talking, line cues, and abort checks with no hidden timer progress", () => {
    const t = setup();
    t.input.frozen = true;
    expect(t.social.update(100, t.input)).toEqual([]);
    t.input.frozen = false;
    t.social.update(0, t.input);
    for (const phase of ["approach", "talking"]) {
      if (phase === "talking") arrive(t);
      const before = structuredClone(t.social.active);
      t.input.frozen = true;
      expect(t.social.update(100, t.input)).toEqual([]);
      expect(t.social.active).toEqual(before);
      t.input.frozen = false;
    }
    expect(advance(t, 1.6).map((e) => e.type)).toEqual(["line"]);
    expect(t.social.active!.line).toBe(1);
  });

  it.each(["missing", "chase", "search"])(
    "aborts harmlessly when actors are %s",
    (reason) => {
      for (const talking of [false, true]) {
        const t = setup();
        t.social.update(0, t.input);
        if (talking) arrive(t);
        if (reason === "missing") t.actors.pop();
        else t.actors[1].state = reason as EnemyState;
        const before = structuredClone(t.actors);
        expect(t.social.update(0.1, t.input).map((e) => e.type)).toEqual([
          "end",
        ]);
        expect(t.actors).toEqual(before);
        expect(t.social.isBusy("founder")).toBe(false);
        expect(t.social.update(100, t.input)).toEqual([]);
      }
    },
  );

  it("ignores negative or nonfinite time without corrupting a run", () => {
    const t = setup();
    for (const dt of [-1, Infinity, NaN])
      expect(t.social.update(dt, t.input)).toEqual([]);
    t.social.update(0, t.input);
    const before = structuredClone(t.social.active);
    for (const dt of [-1, Infinity, NaN])
      expect(t.social.update(dt, t.input)).toEqual([]);
    expect(t.social.active).toEqual(before);
  });
});
