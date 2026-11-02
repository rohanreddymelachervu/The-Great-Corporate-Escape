import { circleHits, clamp, dist, hash, rng, visible } from "./logic";
import type { Kind, Level, Point, Rect } from "./types";

export type IncidentKind = "photo" | "meeting" | "yap" | "paper" | "allhands";

/** All positions are centers, including the two endpoints of a moving hazard. */
export interface Incident {
  id: string;
  kind: IncidentKind;
  shape: "beam" | "circle" | "paper";
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  from: Point;
  to: Point;
  age: number;
  warn: number;
  /** Total lifetime, INCLUDING the warning. */
  life: number;
  hit: boolean;
  dodged: boolean;
}

export interface DirectorEvent {
  type: "notice" | "rally" | "hit" | "dodge" | "arrived" | "left";
  title: string;
  text: string;
  damage?: number;
  kind?: IncidentKind;
  point?: Point;
  who?: Kind;
}

type DirectorInput = {
  player: Point;
  dashing: boolean;
  hidden: boolean;
  shield: boolean;
  vpn: boolean;
};

const PLAYER_RADIUS = 11;
const EPSILON = 1e-9;
const WAIT = [20, 26, 30, 34, 38] as const;
const DAMAGE: Record<IncidentKind, number> = {
  photo: 12,
  meeting: 16,
  yap: 8,
  paper: 10,
  allhands: 20,
};

// Authored rotations guarantee variety, rather than rolling the same attack
// indefinitely. The seed chooses the opening beat, cadence, and paper diagonal.
const PATTERNS: readonly (readonly IncidentKind[])[] = [
  ["photo", "meeting"],
  ["photo", "paper", "meeting"],
  ["yap", "photo", "paper"],
  ["meeting", "allhands", "paper"],
  ["photo", "meeting", "yap", "paper", "allhands"],
];
const COPY: Record<IncidentKind, { title: string; text: string }> = {
  photo: {
    title: "HR TEAM PHOTO",
    text: "A photo sweep is lining up. SPACE dodge through it, or step aside.",
  },
  meeting: {
    title: "QUICK SYNC",
    text: "Calendar circle locked on your last position. Step out before the meeting starts.",
  },
  yap: {
    title: "INTERN Q&A",
    text: "One more question is loading. Leave the ring, or SPACE through the chatter.",
  },
  paper: {
    title: "PRINTER PANIC",
    text: "Paperwork is crossing your lane. Step aside or SPACE through the stack.",
  },
  allhands: {
    title: "SURPRISE ALL-HANDS",
    text: "All-hands circle incoming. Step out before the outlined area fills.",
  },
};

function floorIndex(level: number): number {
  return clamp(Number.isFinite(level) ? Math.trunc(level) : 1, 1, 5) - 1;
}

export function liftWait(level: number): number {
  return WAIT[floorIndex(level)];
}

/**
 * Geometry only: callers must check warn <= age < life themselves.
 * Match the game's radius-11 player, not a misleading center-point test.
 */
export function incidentContains(incident: Incident, p: Point): boolean {
  if (incident.shape === "beam") {
    return circleHits(p, PLAYER_RADIUS, {
      x: incident.x - incident.w / 2,
      y: incident.y - incident.h / 2,
      w: incident.w,
      h: incident.h,
    });
  }
  return dist(incident, p) < incident.radius + PLAYER_RADIUS;
}

/**
 * Pure encounter clock. No health, rendering, world movement, or real timers.
 * A rally is a snapshot to investigate, never a continuous chase target.
 */
export class EscapeDirector {
  phase: "find-lift" | "waiting" | "boarding" = "find-lift";
  elapsed = 0;
  eta = 0;
  boardLeft = 0;
  incidents: Incident[] = [];
  dodges = 0;
  hits = 0;
  expedited = false;

  private readonly random: () => number;
  private readonly obstacles: Rect[];
  private readonly pattern: readonly IncidentKind[];
  private readonly responders: Kind[];
  private beat: number;
  private serial = 0;
  private rallyBeat = 0;
  private waveLeft: number;
  private rallyLeft = Infinity;
  private credit = 0;
  private vpnHeld = false;
  private lastPlayer: Point;

  constructor(
    private readonly level: Level,
    seed: string,
  ) {
    this.random = rng(hash(`${seed}:office-director:${level.id}`));
    this.pattern = PATTERNS[floorIndex(level.id)];
    this.beat = Math.floor(this.random() * this.pattern.length);
    this.obstacles = [...level.walls, ...level.props]; // Gates are scene-owned.
    this.responders = [...new Set(level.enemies.map((enemy) => enemy.kind))];
    if (!this.responders.length)
      this.responders.push(
        level.id === 3 ? "intern" : level.id >= 4 ? "founder" : "hr",
      );
    this.lastPlayer = this.officePoint(level.spawn);
    // Culture Friday and intern demos begin before the player finds the lift.
    this.waveLeft = level.id === 2 || level.id === 3 ? 6 : Infinity;
  }

  callLift(): DirectorEvent[] {
    if (this.phase !== "find-lift") return [];
    this.phase = "waiting";
    this.eta = Math.max(6, liftWait(this.level.id) - this.credit);
    this.boardLeft = 0;
    // Spawn on the next update (even update(0)), using that frame's player.
    this.waveLeft = 0;
    this.rallyLeft = 8;
    return [
      {
        type: "notice",
        title: "LIFT CALLED",
        text: `Lift arriving in ${this.eta} seconds. Stay mobile until the doors open.`,
      },
      this.rally("hr"),
    ];
  }

  /** One use, including a stored seven-second credit before calling the lift. */
  expedite(): number {
    if (this.expedited) return 0;
    this.expedited = true;
    if (this.phase === "find-lift") return (this.credit = 7);
    if (this.phase !== "waiting") return 0;
    const cut = Math.min(7, Math.max(0, this.eta - 6));
    this.eta -= cut;
    return cut;
  }

  update(dt: number, input: DirectorInput): DirectorEvent[] {
    if (!Number.isFinite(dt) || dt < 0) return [];
    const events: DirectorEvent[] = [];
    this.lastPlayer = this.officePoint(input.player);
    if (input.vpn && !this.vpnHeld) {
      this.incidents = [];
      events.push({
        type: "notice",
        title: "VPN: OFF THE GRID",
        text: "Live corporate hazards disconnected. The lift is still on its way.",
      });
    }
    this.vpnHeld = input.vpn;
    this.due(events, input.vpn);
    this.collisions(input, events);

    // Small simulation slices stop a moving beam/paper tunnelling on a long
    // frame. Clock boundaries are exact so excess dt survives every phase change.
    let remaining = dt;
    while (remaining > EPSILON) {
      const phaseLeft =
        this.phase === "waiting"
          ? this.eta
          : this.phase === "boarding"
            ? this.boardLeft
            : Infinity;
      const nextWave = this.waveLeft > EPSILON ? this.waveLeft : Infinity;
      const nextRally = this.rallyLeft > EPSILON ? this.rallyLeft : Infinity;
      const step = Math.min(remaining, 1 / 60, phaseLeft, nextWave, nextRally);
      this.elapsed += step;
      if (this.phase === "waiting") this.eta = Math.max(0, this.eta - step);
      if (this.phase === "boarding")
        this.boardLeft = Math.max(0, this.boardLeft - step);
      this.waveLeft = Math.max(0, this.waveLeft - step);
      this.rallyLeft = Math.max(0, this.rallyLeft - step);
      this.advanceIncidents(step);
      this.collisions(input, events);
      this.due(events, input.vpn);
      remaining -= step;
    }
    return events;
  }

  private officePoint(point: Point): Point {
    return {
      x: clamp(
        Number.isFinite(point.x) ? point.x : this.level.spawn.x,
        0,
        this.level.width,
      ),
      y: clamp(
        Number.isFinite(point.y) ? point.y : this.level.spawn.y,
        0,
        this.level.height,
      ),
    };
  }

  private rally(who: Kind): DirectorEvent {
    return {
      type: "rally",
      who,
      point: { ...this.lastPlayer },
      title: "BADGE PING",
      text: "Your badge ping revealed a last known position. Move before they investigate that spot.",
    };
  }

  private due(events: DirectorEvent[], vpn: boolean): void {
    if (this.phase === "waiting" && this.eta <= EPSILON) {
      this.phase = "boarding";
      this.eta = 0;
      this.boardLeft = 10;
      this.waveLeft = this.rallyLeft = Infinity;
      events.push({
        type: "arrived",
        title: "LIFT ARRIVED",
        text: "Doors open for ten seconds. Reach the lift to board.",
      });
    } else if (this.phase === "boarding" && this.boardLeft <= EPSILON) {
      this.phase = "waiting";
      this.boardLeft = 0;
      this.eta = 14;
      this.waveLeft = 0;
      this.rallyLeft = 8;
      events.push(
        {
          type: "left",
          title: "MISSED THE LIFT",
          text: "The doors closed, not your escape route. Survive fourteen seconds for the next lift.",
        },
        this.rally("hr"),
      );
    }
    if (this.phase === "waiting" && this.rallyLeft <= EPSILON) {
      events.push(
        this.rally(this.responders[this.rallyBeat++ % this.responders.length]),
      );
      this.rallyLeft = 8;
    }
    if (this.waveLeft <= EPSILON && !vpn && this.phase !== "boarding") {
      if (this.incidents.length < 4) this.spawn(events);
      this.waveLeft = 4 + this.random() * 2;
    }
    // While VPN is held a due wave stays pending, not a backlog of waves.
  }

  private spawn(events: DirectorEvent[]): void {
    const kind = this.pattern[this.beat++ % this.pattern.length];
    const target = { ...this.lastPlayer };
    const warn =
      kind === "photo" || kind === "meeting"
        ? 1.5
        : kind === "allhands"
          ? 1.8
          : 1.3;
    const duration = kind === "photo" ? 2.6 : kind === "paper" ? 3 : 4;
    const radius =
      kind === "meeting"
        ? 72
        : kind === "yap"
          ? 60
          : kind === "allhands"
            ? 105
            : kind === "paper"
              ? 18
              : 0;
    let from = { ...target };
    let to = { ...target };
    if (kind === "photo") {
      const halfW = Math.min(10, this.level.width / 2);
      const halfH = Math.min(100, this.level.height / 2);
      const y = clamp(target.y, halfH, this.level.height - halfH);
      from = { x: clamp(target.x - 150, halfW, this.level.width - halfW), y };
      to = { x: clamp(target.x + 150, halfW, this.level.width - halfW), y };
      // At the left edge, start on the far side instead of arming on top of
      // the player. The return sweep still intersects their original lane.
      if (
        Math.abs(from.x - target.x) < halfW + PLAYER_RADIUS &&
        Math.abs(to.x - target.x) > Math.abs(from.x - target.x)
      )
        [from, to] = [to, from];
    } else if (kind === "paper") {
      // Shorten the diagonal symmetrically along its ray, rather than clamping
      // axes separately and accidentally missing a stationary edge player.
      const slope = this.random() < 0.5 ? -1 : 1;
      const before = Math.min(
        130,
        target.x,
        slope > 0 ? target.y : this.level.height - target.y,
      );
      const after = Math.min(
        130,
        this.level.width - target.x,
        slope > 0 ? this.level.height - target.y : target.y,
      );
      from = { x: target.x - before, y: target.y - slope * before };
      to = { x: target.x + after, y: target.y + slope * after };
    }
    const incident: Incident = {
      id: `incident-${this.level.id}-${++this.serial}`,
      kind,
      shape: kind === "photo" ? "beam" : kind === "paper" ? "paper" : "circle",
      x: from.x,
      y: from.y,
      w: kind === "photo" ? Math.min(20, this.level.width) : radius * 2,
      h: kind === "photo" ? Math.min(200, this.level.height) : radius * 2,
      radius,
      from,
      to,
      age: 0,
      warn,
      life: warn + duration,
      hit: false,
      dodged: false,
    };
    this.incidents.push(incident);
    events.push({ type: "notice", kind, ...COPY[kind], point: { ...from } });
    if (kind === "allhands" && this.responders.includes("founder"))
      events.push(this.rally("founder"));
  }

  private advanceIncidents(dt: number): void {
    for (const incident of this.incidents) {
      incident.age += dt;
      if (Math.abs(incident.age - incident.warn) < EPSILON)
        incident.age = incident.warn;
      if (Math.abs(incident.age - incident.life) < EPSILON)
        incident.age = incident.life;
      const progress = clamp(
        (incident.age - incident.warn) / (incident.life - incident.warn),
        0,
        1,
      );
      incident.x =
        incident.from.x + (incident.to.x - incident.from.x) * progress;
      incident.y =
        incident.from.y + (incident.to.y - incident.from.y) * progress;
    }
    this.incidents = this.incidents.filter(
      (incident) => incident.age < incident.life,
    );
  }

  private collisions(input: DirectorInput, events: DirectorEvent[]): void {
    if (input.hidden || input.vpn) return;
    for (const incident of this.incidents) {
      if (
        incident.age < incident.warn ||
        incident.age >= incident.life ||
        !incidentContains(incident, this.lastPlayer) ||
        !visible(incident, this.lastPlayer, this.obstacles)
      )
        continue;
      if (input.dashing) {
        if (!incident.dodged && !incident.hit) {
          incident.dodged = true;
          this.dodges++;
          events.push({
            type: "dodge",
            kind: incident.kind,
            title: "CORPORATE DODGE",
            text: "Dodged the actual hazard. Keep moving when your dash ends.",
            point: { ...this.lastPlayer },
          });
        }
      } else if (!input.shield && !incident.hit) {
        // A dash is immunity only WHILE dashing. Remaining in an active circle
        // afterwards can still hurt; neither a near miss nor a shield is a dodge.
        incident.hit = true;
        this.hits++;
        events.push({
          type: "hit",
          kind: incident.kind,
          damage: DAMAGE[incident.kind],
          title: COPY[incident.kind].title,
          text: "Caught in corporate crossfire. Leave the marked danger zone.",
          point: { ...this.lastPlayer },
        });
      }
    }
  }
}
