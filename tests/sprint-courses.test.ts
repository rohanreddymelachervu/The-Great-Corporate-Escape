// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  blocked,
  center,
  dist,
  inCone,
  move,
  Navigator,
} from "../src/game/logic";
import type { Point, Rect } from "../src/game/types";
import { SPRINT_COURSES } from "../src/sprint/courses";
import type { RaceGuard } from "../src/sprint/types";

const expectedNames = [
  "Quick Sync",
  "Reply All",
  "Mandatory Happiness",
  "Scope Creep",
  "The Pivot",
  "Friday Deployment",
  "Bandwidth Issues",
  "Return To Office",
  "Alignment Workshop",
  "Exit Interview",
];
const allowedProps = new Set([
  "desk",
  "plant",
  "sofa",
  "coffee",
  "server",
  "table",
  "balloons",
  "board",
  "shelf",
  "printer",
]);
const routeLength = (route: Point[]) =>
  route.slice(1).reduce((n, b, i) => n + dist(route[i], b), 0);
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Every edge, not just the authored nodes. Half-pixel samples plus the game's
 * own sub-stepped mover catch both corner clipping and accidental solid props. */
function assertClearPath(
  points: Point[],
  radius: number,
  obstacles: Rect[],
  context: string,
) {
  for (let i = 0; i < points.length; i++) {
    expect(blocked(points[i], radius, obstacles), `${context}: node ${i}`).toBe(
      false,
    );
    if (!i) continue;
    const a = points[i - 1],
      b = points[i];
    const steps = Math.max(1, Math.ceil(dist(a, b) * 2));
    for (let j = 0; j <= steps; j++) {
      const p = {
        x: a.x + ((b.x - a.x) * j) / steps,
        y: a.y + ((b.y - a.y) * j) / steps,
      };
      if (blocked(p, radius, obstacles)) {
        throw new Error(
          `${context}: edge ${i - 1} → ${i} collides at ${p.x},${p.y}`,
        );
      }
    }
    const moved = move(a, b.x - a.x, b.y - a.y, radius, obstacles);
    expect(dist(moved, b), `${context}: mover edge ${i}`).toBeLessThan(0.001);
  }
}

function atDistance(route: Point[], distance: number): Point {
  for (let i = 1; i < route.length; i++) {
    const segment = dist(route[i - 1], route[i]);
    if (segment === 0) continue;
    if (distance <= segment) {
      const f = distance / segment;
      return {
        x: route[i - 1].x + (route[i].x - route[i - 1].x) * f,
        y: route[i - 1].y + (route[i].y - route[i - 1].y) * f,
      };
    }
    distance -= segment;
  }
  return route[route.length - 1];
}
function guardAt(g: RaceGuard, seconds: number): Point & { angle: number } {
  const loop = [...g.route, g.route[0]];
  const perimeter = routeLength(loop);
  const distance =
    ((g.offset ?? 0) * perimeter + seconds * g.speed) % perimeter;
  const point = atDistance(loop, distance);
  const ahead = atDistance(loop, (distance + 0.01) % perimeter);
  return { ...point, angle: Math.atan2(ahead.y - point.y, ahead.x - point.x) };
}

describe("the ten authored Clock Out Sprint courses", () => {
  it("has stable unique IDs, exact names, and genuinely distinct static layouts", () => {
    expect(SPRINT_COURSES).toHaveLength(10);
    expect(SPRINT_COURSES.map((c) => c.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(SPRINT_COURSES.map((c) => c.name)).toEqual(expectedNames);
    const signatures = SPRINT_COURSES.map((c) =>
      JSON.stringify({
        width: c.width,
        height: c.height,
        walls: c.walls,
        props: c.props,
      }),
    );
    expect(new Set(signatures).size).toBe(10);
    expect(
      new Set(SPRINT_COURSES.map((c) => JSON.stringify(c.walls.slice(4)))).size,
    ).toBe(10);
  });

  it("introduces the specified patterns without flooding the early courses", () => {
    expect(SPRINT_COURSES[0].guards).toHaveLength(1);
    expect(SPRINT_COURSES[0].hazards).toHaveLength(0);
    expect(SPRINT_COURSES[1].guards.map((g) => g.kind)).toEqual([
      "staff",
      "staff",
    ]);
    expect(SPRINT_COURSES[1].hazards).toHaveLength(0);
    expect(SPRINT_COURSES[2].guards.some((g) => g.kind === "hr")).toBe(true);
    expect(SPRINT_COURSES[2].hazards.some((h) => h.kind === "photo")).toBe(
      true,
    );
    expect(SPRINT_COURSES[3].hazards.some((h) => h.kind === "meeting")).toBe(
      true,
    );
    expect(SPRINT_COURSES[4].guards.some((g) => g.kind === "manager")).toBe(
      true,
    );
    expect(
      SPRINT_COURSES[5].hazards.filter((h) => h.kind === "paper"),
    ).toHaveLength(2);
    expect(SPRINT_COURSES[7].guards.some((g) => g.route.length >= 4)).toBe(
      true,
    );
    expect(SPRINT_COURSES[9].guards).toHaveLength(4);
    expect(new Set(SPRINT_COURSES[9].hazards.map((h) => h.kind)).size).toBe(3);
  });

  for (const c of SPRINT_COURSES)
    describe(`${c.id}: ${c.name}`, () => {
      const obstacles = [...c.walls, ...c.props];
      it("has finite, legal, solid geometry and a continuous 24px perimeter", () => {
        expect(c.width).toBeGreaterThanOrEqual(1200);
        expect(c.width).toBeLessThanOrEqual(1500);
        expect(c.height).toBeGreaterThanOrEqual(650);
        expect(c.height).toBeLessThanOrEqual(900);
        expect(c.walls.slice(0, 4)).toEqual([
          { x: 0, y: 0, w: c.width, h: 24 },
          { x: 0, y: c.height - 24, w: c.width, h: 24 },
          { x: 0, y: 24, w: 24, h: c.height - 48 },
          { x: c.width - 24, y: 24, w: 24, h: c.height - 48 },
        ]);
        for (const r of [...obstacles, ...c.zones, c.exit]) {
          expect([r.x, r.y, r.w, r.h].every(Number.isFinite)).toBe(true);
          expect(r.w).toBeGreaterThan(0);
          expect(r.h).toBeGreaterThan(0);
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(c.width);
          expect(r.y + r.h).toBeLessThanOrEqual(c.height);
        }
        expect(c.props.length).toBeGreaterThanOrEqual(5);
        for (const prop of c.props)
          expect(allowedProps.has(prop.kind)).toBe(true);
        for (const obstacle of obstacles)
          expect(overlaps(c.exit, obstacle), "exit must stay open").toBe(false);
        expect(c.subtitle.length).toBeGreaterThan(10);
        expect(c.joke.length).toBeGreaterThan(15);
        expect(c.zones.length).toBeGreaterThanOrEqual(2);
      });

      it("provides a swept-clear radius-11 guide from spawn through the open exit", () => {
        expect(c.route[0]).toEqual(c.spawn);
        expect(c.route[c.route.length - 1]).toEqual(center(c.exit));
        assertClearPath(c.route, 11, obstacles, `${c.name} guide`);
        // Deliberately authored wide turns; the one express corridor is still 96px.
        assertClearPath(c.route, 40, c.walls, `${c.name} corridor clearance`);
        const length = routeLength(c.route);
        expect(length).toBeGreaterThanOrEqual(2000);
        expect(length).toBeLessThanOrEqual(4500);
        const allowance = c.gold - length / 250;
        expect(allowance).toBeGreaterThanOrEqual(5);
        expect(allowance).toBeLessThanOrEqual(12);
        expect(c.silver).toBeCloseTo(c.gold * 1.4, 2);
        expect(c.gold).toBeGreaterThan(15);
        expect(c.gold).toBeLessThan(32);
      });

      it("can navigate to the exit and every spread-out daily-letter candidate with all props solid", () => {
        const nav = new Navigator(c.width, c.height, obstacles, 11);
        expect(blocked(c.spawn, 11, obstacles)).toBe(false);
        expect(c.letterSpots.length).toBeGreaterThanOrEqual(9);
        expect(new Set(c.letterSpots.map((p) => `${p.x},${p.y}`)).size).toBe(
          c.letterSpots.length,
        );
        for (const [i, target] of [
          center(c.exit),
          ...c.letterSpots,
        ].entries()) {
          expect(blocked(target, 11, obstacles), `target ${i}`).toBe(false);
          const path = nav.path(c.spawn, target);
          expect(path.length, `target ${i} must be reachable`).toBeGreaterThan(
            0,
          );
          expect(path[path.length - 1]).toEqual(target);
          if (i === 0) {
            // Catch accidental giant skips as well as gratuitously padded guides.
            const shortest = routeLength([c.spawn, ...path]);
            expect(shortest).toBeGreaterThan(1500);
            expect(routeLength(c.route)).toBeLessThan(shortest * 1.6);
          }
          assertClearPath(
            [c.spawn, ...path],
            11,
            obstacles,
            `${c.name} Navigator target ${i}`,
          );
        }
        const xs = c.letterSpots.map((p) => p.x),
          ys = c.letterSpots.map((p) => p.y);
        expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
          c.width * 0.55,
        );
        expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(
          c.height * 0.45,
        );
      });

      it("keeps every complete patrol loop radius-16 clear and the opening two seconds welcoming", () => {
        expect(c.guards.length).toBeLessThanOrEqual(4);
        expect(new Set(c.guards.map((g) => g.id)).size).toBe(c.guards.length);
        for (const g of c.guards) {
          expect(["manager", "hr", "intern", "staff"]).toContain(g.kind);
          expect(g.route.length).toBeGreaterThanOrEqual(2);
          expect(g.speed).toBeGreaterThanOrEqual(80);
          expect(g.speed).toBeLessThanOrEqual(125);
          expect(g.range).toBeGreaterThanOrEqual(100);
          expect(g.range).toBeLessThanOrEqual(155);
          expect(g.fov).toBeGreaterThanOrEqual(1);
          expect(g.fov).toBeLessThanOrEqual(1.4);
          expect(g.offset ?? 0).toBeGreaterThanOrEqual(0);
          expect(g.offset ?? 0).toBeLessThanOrEqual(1);
          assertClearPath(
            [...g.route, g.route[0]],
            16,
            obstacles,
            `${c.name} ${g.id}`,
          );
          const initial = guardAt(g, 0);
          expect(dist(c.spawn, initial)).toBeGreaterThanOrEqual(170);
          for (let t = 0; t <= 2; t += 0.05) {
            const patrol = guardAt(g, t);
            // Idle starters and immediately moving 250px/s starters are both safe.
            for (const player of [c.spawn, atDistance(c.route, t * 250)]) {
              expect(
                dist(player, patrol),
                `${g.id}: opening contact at ${t}`,
              ).toBeGreaterThan(27);
              expect(
                inCone(patrol, player, patrol.angle, g.range, g.fov, obstacles),
                `${g.id}: opening detection at ${t}`,
              ).toBe(false);
            }
          }
        }
      });

      it("uses bounded, fully telegraphed periodic hazards with legal entire sweeps", () => {
        expect(c.hazards.length).toBeLessThanOrEqual(3);
        expect(new Set(c.hazards.map((h) => h.id)).size).toBe(c.hazards.length);
        for (const h of c.hazards) {
          expect(h.period).toBeGreaterThanOrEqual(4);
          expect(h.period).toBeLessThanOrEqual(8);
          expect(h.warn).toBeGreaterThanOrEqual(1.2);
          expect(h.warn).toBeLessThanOrEqual(1.8);
          expect(h.active).toBeGreaterThanOrEqual(1.4);
          expect(h.active).toBeLessThanOrEqual(2.8);
          expect(h.warn + h.active).toBeLessThan(h.period);
          expect(h.offset ?? 0).toBeGreaterThanOrEqual(0);
          expect(h.offset ?? 0).toBeLessThan(h.period);
          expect(h.radius).toBe(h.kind === "meeting" ? 50 : 16);
          if (h.kind === "meeting") expect(h.to).toEqual(h.from);
          if (h.kind === "photo") {
            expect(h.w).toBe(18);
            expect(h.h).toBe(120);
          }
          const steps = Math.max(1, Math.ceil(dist(h.from, h.to)));
          for (let i = 0; i <= steps; i++) {
            const q = atDistance(
              [h.from, h.to],
              (dist(h.from, h.to) * i) / steps,
            );
            expect(dist(c.spawn, q)).toBeGreaterThanOrEqual(170);
            if (h.kind === "photo") {
              const beam = {
                x: q.x - h.w! / 2,
                y: q.y - h.h! / 2,
                w: h.w!,
                h: h.h!,
              };
              expect(
                obstacles.some((o) => overlaps(o, beam)),
                `${h.id} beam at ${i}`,
              ).toBe(false);
            } else {
              expect(
                blocked(q, h.radius, obstacles),
                `${h.id} sweep at ${i}`,
              ).toBe(false);
            }
          }
        }
      });
    });
});
