import { blocked, dist, segmentHits, visible } from "./logic";
import type { Navigator } from "./logic";
import type { EnemyState, Kind, Point, Rect } from "./types";

export interface SocialActor {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  state: EnemyState;
  awareness: number;
  catchCooldown?: number;
}
export interface OfficeChat {
  id: string;
  internId: string;
  founderId: string;
  internSpot: Point;
  founderSpot: Point;
  phase: "approach" | "talking";
  age: number;
  talkAge: number;
  line: number;
}
export interface SocialEvent {
  type: "start" | "line" | "end";
  chat: OfficeChat;
  speaker?: "intern" | "founder";
  text?: string;
}

/** Five beats, each held for 1.6 seconds. Also the renderer's only script. */
export const CHAT_LINES: { speaker: "intern" | "founder"; text: string }[] = [
  { speaker: "intern", text: "Bro, my agent schedules other agents." },
  { speaker: "founder", text: "Can it generate Series B revenue?" },
  { speaker: "intern", text: "It generated three more meetings." },
  { speaker: "founder", text: "We're buying it." },
  { speaker: "intern", text: "Great. Your agent can meet my agent's agent." },
];

const eligible = (a: SocialActor) =>
  a.state !== "chase" &&
  a.state !== "search" &&
  a.awareness <= 0.25 &&
  !(a.catchCooldown && a.catchCooldown > 0);
const snapshot = (chat: OfficeChat): OfficeChat => ({
  ...chat,
  internSpot: { ...chat.internSpot },
  founderSpot: { ...chat.founderSpot },
});

/** Validate the actual swept radius, including A*'s start/end connectors.
 * Navigator can snap to a nearby grid cell; a nonempty path alone is not proof
 * that its first/last legs are safe for this actor. No actor is ever moved here.
 */
function reachable(a: Point, b: Point, nav: Navigator, obs: Rect[]): boolean {
  const inside = (p: Point) =>
    p.x >= 12 &&
    p.y >= 12 &&
    p.x <= nav.width - 12 &&
    p.y <= nav.height - 12 &&
    !blocked(p, 12, obs);
  if (!inside(a) || !inside(b)) return false;
  const path = nav.path(a, b);
  if (!path.length || dist(path[path.length - 1], b) > 0.01) return false;
  let previous = a,
    length = 0;
  for (const p of path) {
    if (
      !inside(p) ||
      obs.some((r) =>
        segmentHits(previous, p, {
          x: r.x - 12,
          y: r.y - 12,
          w: r.w + 24,
          h: r.h + 24,
        }),
      )
    )
      return false;
    length += dist(previous, p);
    previous = p;
  }
  return length <= 260 && length <= dist(a, b) + 80;
}

function standingSpots(
  a: SocialActor,
  b: SocialActor,
  nav: Navigator,
  obs: Rect[],
) {
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const direction = Math.atan2(b.y - a.y, b.x - a.x);
  // Prefer the existing line between them, then try nearby free floor. Fixed
  // ordering keeps both actor selection and spot selection deterministic.
  for (const [ox, oy] of [
    [0, 0],
    [0, 24],
    [0, -24],
    [24, 0],
    [-24, 0],
    [24, 24],
    [-24, -24],
    [24, -24],
    [-24, 24],
    [0, 48],
    [0, -48],
  ]) {
    for (const turn of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
      const dx = Math.cos(direction + turn) * 32;
      const dy = Math.sin(direction + turn) * 32;
      const internSpot = { x: middle.x + ox - dx, y: middle.y + oy - dy };
      const founderSpot = { x: middle.x + ox + dx, y: middle.y + oy + dy };
      if (
        visible(internSpot, founderSpot, obs) &&
        reachable(a, internSpot, nav, obs) &&
        reachable(b, founderSpot, nav, obs)
      )
        return { internSpot, founderSpot };
    }
  }
  return null;
}

/** One optional, harmless breather per model/run. The caller drives the existing
 * enemy FSM toward start.chat's spots (hard distraction, 15s); this model owns
 * neither movement nor combat. An aborted attempt is consumed, never retried.
 */
export class OfficeSocial {
  active: OfficeChat | null = null;
  completed = 0;
  private started = false;

  isBusy(id: string): boolean {
    return (
      !!this.active &&
      (this.active.internId === id || this.active.founderId === id)
    );
  }

  update(
    dt: number,
    input: {
      actors: SocialActor[];
      obstacles: Rect[];
      nav: Navigator;
      frozen: boolean;
    },
  ): SocialEvent[] {
    if (input.frozen || !Number.isFinite(dt) || dt < 0) return [];
    const events: SocialEvent[] = [];
    const finish = () => {
      if (this.active)
        events.push({ type: "end", chat: snapshot(this.active) });
      this.active = null;
      this.completed = 1;
    };
    const line = (chat: OfficeChat) =>
      events.push({
        type: "line",
        chat: snapshot(chat),
        ...CHAT_LINES[chat.line],
      });
    if (!this.active) {
      if (this.started) return [];
      const actors = [...input.actors].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      );
      for (const intern of actors.filter(
        (a) => a.kind === "intern" && eligible(a),
      )) {
        for (const founder of actors.filter(
          (a) => a.kind === "founder" && eligible(a),
        )) {
          if (
            intern.id === founder.id ||
            dist(intern, founder) > 220 ||
            !visible(intern, founder, input.obstacles)
          )
            continue;
          const spots = standingSpots(
            intern,
            founder,
            input.nav,
            input.obstacles,
          );
          if (!spots) continue;
          this.active = {
            id: `office-chat:${intern.id}:${founder.id}`,
            internId: intern.id,
            founderId: founder.id,
            ...spots,
            phase: "approach",
            age: 0,
            talkAge: 0,
            line: 0,
          };
          this.started = true;
          return [{ type: "start", chat: snapshot(this.active) }];
        }
      }
      return [];
    }
    const chat = this.active;
    const intern = input.actors.find(
      (a) => a.id === chat.internId && a.kind === "intern",
    );
    const founder = input.actors.find(
      (a) => a.id === chat.founderId && a.kind === "founder",
    );
    if (
      !intern ||
      !founder ||
      intern.state === "chase" ||
      founder.state === "chase" ||
      intern.state === "search" ||
      founder.state === "search"
    ) {
      finish();
      return events;
    }
    if (chat.phase === "approach") {
      chat.age = Math.min(5, chat.age + dt);
      if (
        dist(intern, chat.internSpot) <= 18 &&
        dist(founder, chat.founderSpot) <= 18
      ) {
        chat.phase = "talking";
        line(chat);
      } else if (chat.age >= 5) finish();
      return events;
    }
    const advance = Math.min(dt, 8 - chat.talkAge);
    chat.age += advance;
    chat.talkAge = Math.min(8, chat.talkAge + advance);
    const current = Math.min(
      CHAT_LINES.length - 1,
      Math.floor((chat.talkAge + 1e-9) / 1.6),
    );
    while (chat.line < current) {
      chat.line++;
      line(chat);
    }
    if (chat.talkAge >= 8 - 1e-9) finish();
    return events;
  }
}
