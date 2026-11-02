import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ENEMIES, ABILITIES } from "../src/game/catalog";
import { LEVELS } from "../src/game/levels";
import { liftWait } from "../src/game/director";
import { ContextCoach } from "../src/game/coach";
import { incidentReport } from "../src/game/report";
import type { Result } from "../src/game/types";
const baseline = JSON.parse(
  readFileSync("qa-evidence/difficulty-v21.json", "utf8"),
);
describe("difficulty is not raised by the UX/content update", () => {
  it("preserves every enemy speed, vision range, cone width and damage value", () => {
    for (const [k, v] of Object.entries(ENEMIES))
      expect({
        speed: v.speed,
        range: v.range,
        fov: v.fov,
        damage: v.damage,
      }).toEqual(baseline.enemies[k]);
  });
  it("preserves ability cooldowns/durations/unlock floors and all lift waits", () => {
    for (const [k, v] of Object.entries(ABILITIES))
      expect({
        duration: v.duration,
        cooldown: v.cooldown,
        level: v.level,
      }).toEqual(baseline.abilities[k]);
    expect(LEVELS.map((l) => liftWait(l.id))).toEqual(baseline.liftWait);
  });
  it("adds no enemies, staff, harder meeting schedules or changed routes/maps", () =>
    expect(
      LEVELS.map((l) => ({
        id: l.id,
        width: l.width,
        height: l.height,
        enemies: l.enemies,
        rooms: l.rooms,
      })),
    ).toEqual(baseline.worlds));
});
const base = {
  elapsed: 1,
  phase: "find-lift",
  coffee: 2,
  suspicion: 0,
  hidden: false,
  danger: false,
};
describe("brief optional context coaching", () => {
  it("teaches the next relevant step once, not a manual upfront", () => {
    const c = new ContextCoach();
    expect(c.next(base)?.id).toBe("start");
    expect(c.next({ ...base, elapsed: 9 })).toBeNull();
    expect(c.next({ ...base, elapsed: 10, phase: "waiting" })?.id).toBe(
      "coffee",
    );
  });
  it("never covers an urgent danger or hidden-player context", () => {
    const c = new ContextCoach();
    expect(c.next({ ...base, danger: true })).toBeNull();
    expect(c.next({ ...base, hidden: true })).toBeNull();
    expect(c.seen.size).toBe(0);
  });
  it("prioritises boarding and loot at their actual moment", () => {
    expect(
      new ContextCoach().next({ ...base, phase: "boarding", lootTarget: "tv" })
        ?.id,
    ).toBe("board");
    expect(new ContextCoach().next({ ...base, lootTarget: "tv" })?.id).toBe(
      "loot",
    );
  });
  it("reuses saved seen tips and never resets them on a retry", () => {
    const c = new ContextCoach(["start", "coffee"]);
    c.resetRun();
    expect(c.next(base)).toBeNull();
    expect(c.next({ ...base, phase: "waiting" })).toBeNull();
  });
  it("does not emit a fresh tip every HUD tick", () => {
    const c = new ContextCoach();
    c.next(base);
    expect(c.next({ ...base, elapsed: 3, lootTarget: "tv" })).toBeNull();
    expect(c.next({ ...base, elapsed: 9, lootTarget: "tv" })?.id).toBe("loot");
  });
});
const result: Result = {
  level: 5,
  time: 47.5,
  bs: 35,
  spots: 2,
  hits: 1,
  collectibles: 2,
  distractions: 1,
  score: 12000,
  medal: "Gold",
  daily: false,
  seed: "test",
  ruleset: 2,
  dodges: 3,
  stolen: 2,
  lootValue: 900,
};
describe("factual incident report, not a new gameplay rule", () => {
  it("works for older results without a story object", () => {
    const text = incidentReport(result, true).join(" ");
    expect(text).toContain("3 close calls");
    expect(text).toContain("900 loot points");
    expect(text).not.toContain("Founder and intern");
  });
  it("uses only real event counters and loot names supplied by the run", () => {
    const lines = incidentReport(
      {
        ...result,
        story: {
          coffees: 2,
          staffSpots: 1,
          conversations: 1,
          chatStillGoing: true,
          lootNames: ["Office TV", "Snack stash"],
          exit: "wfh",
        },
      },
      true,
    );
    expect(lines.join(" ")).toContain("Office TV, Snack stash");
    expect(lines.join(" ")).toContain("still discussing");
    expect(lines.join(" ")).toContain("Coffee reassigned: 2");
    expect(lines.length).toBeLessThanOrEqual(8);
  });
  it("does not falsely bank a failed bag", () => {
    const text = incidentReport(result, false).join(" ");
    expect(text).toContain("involuntary overtime");
    expect(text).toContain("Assets not banked");
    expect(text).not.toContain("Outcome: out of office");
  });
});
