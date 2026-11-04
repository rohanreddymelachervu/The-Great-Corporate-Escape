import {
  blocked,
  circleHits,
  clamp,
  dist,
  hash,
  inCone,
  move,
  rng,
  visible,
} from "../game/logic";
import type { Point, Rect } from "../game/types";
import type {
  LetterBadge,
  RaceEvent,
  RaceGuard,
  RaceGuardState,
  RaceHazard,
  RaceHazardState,
  RaceInput,
  RaceOptions,
  RacePhase,
  RaceResult,
  SprintCourse,
  WordEntry,
} from "./types";

export const WORDS: WordEntry[] = [
  { word: "SYNC", joke: "A meeting to plan the next meeting." },
  { word: "PIVOT", joke: "The original plan has left the chat." },
  { word: "SCOPE", joke: "It grew while you were reading this." },
  { word: "ALIGN", joke: "Everyone agreed to disagree in the same font." },
  {
    word: "HUSTLE",
    joke: "Your lunch break has been promoted to a working lunch.",
  },
  { word: "SYNERGY", joke: "Two departments, twice the meetings." },
  { word: "DISRUPT", joke: "The printer was already doing that." },
  { word: "AGILE", joke: "We move fast, mostly between meetings." },
  { word: "ASAP", joke: "Yesterday would have been ideal." },
  { word: "SILOS", joke: "Cross-functional teamwork. In separate buildings." },
  { word: "UPDATE", joke: "No updates. Same time tomorrow?" },
  { word: "IMPACT", joke: "Measured in slides, not outcomes." },
  {
    word: "IDEATE",
    joke: "The verb we use before someone else does the work.",
  },
  { word: "CIRCLE", joke: "We circled back and arrived at another meeting." },
  {
    word: "VALUE",
    joke: "The real value was the invoices we made along the way.",
  },
  { word: "ACTION", joke: "The action item is to identify the action items." },
];

const RADIUS = 11;
const modulo = (n: number, d: number) => ((n % d) + d) % d;
const codeFor = (course: SprintCourse, day?: string) =>
  `${day ?? "SPRINT"}-C${String(course.id).padStart(2, "0")}`;

/** The caller supplies its UTC dailySeed(); this function never reads a clock. */
export function dailyRace(
  day: string,
  courses: SprintCourse[],
): {
  course: SprintCourse;
  word: WordEntry;
  letters: LetterBadge[];
  code: string;
} {
  const legal = (course: SprintCourse) =>
    course.letterSpots.filter(
      (p) =>
        p.x >= RADIUS &&
        p.y >= RADIUS &&
        p.x <= course.width - RADIUS &&
        p.y <= course.height - RADIUS &&
        !blocked(p, RADIUS, [...course.walls, ...course.props]),
    );
  const eligible = courses
    .map((course) => ({ course, spots: legal(course) }))
    .filter((c) => c.spots.length >= 4);
  if (!eligible.length)
    throw new Error(
      "Daily racing needs a course with at least four legal letter spots.",
    );
  const random = rng(hash(`sprint:${day}`));
  const { course, spots } = eligible[Math.floor(random() * eligible.length)];
  const words = WORDS.filter((w) => w.word.length <= spots.length);
  const word = { ...words[Math.floor(random() * words.length)] };
  const shuffled = spots.map((p) => ({ ...p }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // A daily route should sometimes ask more than the pure exit line. Where
  // the authored template has a genuine side pocket, include one such badge.
  const distanceToRoute = (p: Point) =>
    Math.min(
      ...course.route.slice(1).map((b, i) => {
        const a = course.route[i],
          dx = b.x - a.x,
          dy = b.y - a.y,
          den = dx * dx + dy * dy;
        const t = den
          ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / den, 0, 1)
          : 0;
        return dist(p, { x: a.x + dx * t, y: a.y + dy * t });
      }),
    );
  const side = shuffled.filter((p) => distanceToRoute(p) > 45);
  const chosen = shuffled.slice(0, word.word.length);
  if (side.length && !chosen.some((p) => distanceToRoute(p) > 45))
    chosen[chosen.length - 1] = side[0];
  const letters = [...word.word].map((char, index) => ({
    ...chosen[index],
    id: `letter-${index}`,
    index,
    char,
    collected: false,
  }));
  return { course, word, letters, code: codeFor(course, day) };
}

export function raceMedal(
  time: number,
  course: SprintCourse,
): RaceResult["medal"] {
  const ticks = Math.floor(Math.max(0, time) * 100 + 1e-8);
  return ticks <= Math.round(course.gold * 100)
    ? "Gold"
    : ticks <= Math.round(course.silver * 100)
      ? "Silver"
      : "Bronze";
}

/** Fixed minutes:seconds.centiseconds, truncated rather than rounded (00:23.47). */
export function formatRaceTime(seconds: number): string {
  const ticks = Math.floor(
    Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 100 + 1e-8,
  );
  return `${String(Math.floor(ticks / 6000)).padStart(2, "0")}:${String(Math.floor(ticks / 100) % 60).padStart(2, "0")}.${String(ticks % 100).padStart(2, "0")}`;
}

/** Closed route; offset is a normalized fraction of the complete route, not seconds. */
function guardAt(
  guard: RaceGuard,
  elapsed: number,
  fallback: Point,
): RaceGuardState {
  const route = guard.route;
  const lengths = route.map((p, i) => dist(p, route[(i + 1) % route.length]));
  const total = lengths.reduce((a, b) => a + b, 0);
  const base = { id: guard.id, kind: guard.kind, awareness: 0 };
  if (!total) return { ...base, ...(route[0] ?? fallback), angle: 0 };
  let distance = modulo(
    elapsed * Math.max(0, guard.speed) + modulo(guard.offset ?? 0, 1) * total,
    total,
  );
  for (let i = 0; i < route.length; i++) {
    if (lengths[i] > 0 && distance < lengths[i]) {
      const a = route[i],
        b = route[(i + 1) % route.length],
        t = distance / lengths[i];
      return {
        ...base,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    distance -= lengths[i];
  }
  return { ...base, ...route[0], angle: 0 };
}

function hazardAt(h: RaceHazard, elapsed: number): RaceHazardState {
  const cycle = modulo(elapsed + (h.offset ?? 0), Math.max(0.001, h.period));
  const warning = cycle < h.warn;
  const active = cycle >= h.warn && cycle < h.warn + h.active;
  const progress = active && h.active > 0 ? (cycle - h.warn) / h.active : 0;
  const t = h.kind === "meeting" ? 0 : progress;
  return {
    id: h.id,
    kind: h.kind,
    x: h.from.x + (h.to.x - h.from.x) * t,
    y: h.from.y + (h.to.y - h.from.y) * t,
    radius: h.radius,
    w: h.w ?? h.radius * 2,
    h: h.h ?? h.radius * 2,
    warning,
    active,
    from: { ...h.from },
    to: { ...h.to },
    progress,
  };
}

export class SprintRun {
  public course: SprintCourse;
  public options: RaceOptions;
  public phase: RacePhase = "countdown";
  public countdown = 0.9;
  public elapsed = 0;
  public pos: Point;
  public facing: Point = { x: 1, y: 0 };
  public dashLeft = 0;
  public dashCooldown = 0;
  public guards: RaceGuardState[] = [];
  public hazards: RaceHazardState[] = [];
  public letters: LetterBadge[];
  public failureAge = 0;
  public failReason = "";
  public result: RaceResult | null = null;
  private readonly initialLetters: LetterBadge[];
  private readonly word?: WordEntry;
  private dashDirection: Point = { x: 1, y: 0 };
  private lockedUntil = -Infinity;
  private readonly obstacles: Rect[];

  constructor(
    course: SprintCourse,
    options: RaceOptions,
    word?: WordEntry,
    letters: LetterBadge[] = [],
  ) {
    this.course = course;
    this.options = { ...options };
    this.word = word ? { ...word } : undefined;
    this.pos = { ...course.spawn };
    this.initialLetters = letters.map((l) => ({ ...l, collected: false }));
    this.letters = this.initialLetters.map((l) => ({ ...l }));
    this.obstacles = [...course.walls, ...course.props];
    this.patterns(0);
  }

  public retry(): void {
    this.phase = "countdown";
    this.countdown = 0.9;
    this.elapsed = 0;
    this.pos = { ...this.course.spawn };
    this.facing = { x: 1, y: 0 };
    this.dashDirection = { x: 1, y: 0 };
    this.dashLeft = 0;
    this.dashCooldown = 0;
    this.guards = [];
    this.hazards = [];
    this.patterns(0);
    this.letters = this.initialLetters.map((l) => ({ ...l }));
    this.failureAge = 0;
    this.failReason = "";
    this.result = null;
    this.lockedUntil = -Infinity;
  }

  private patterns(time: number): void {
    this.guards = this.course.guards.map((g, i) => ({
      ...guardAt(g, time, this.course.spawn),
      awareness: this.guards[i]?.awareness ?? 0,
    }));
    this.hazards = this.course.hazards.map((h) => hazardAt(h, time));
  }

  private fail(text: string, events: RaceEvent[]): void {
    this.phase = "failed";
    this.failureAge = 0;
    this.failReason = text;
    events.push({ type: "fail", text });
  }

  /**
   * The timer counts every active second, including long browser frames. Physics is
   * limited to 0.25s per call in <=1/60s slices; remaining time is charged but not
   * moved. Patterns resync to the raw clock. Callers implement pause by not ticking.
   * Dash is a one-frame request, never buffered through countdown/failure.
   */
  public tick(dt: number, input: RaceInput): RaceEvent[] {
    const events: RaceEvent[] = [];
    if (!Number.isFinite(dt) || dt <= 0) return events;
    if (this.phase === "finished") return events;
    if (this.phase === "failed") {
      this.failureAge += dt;
      return events;
    }
    let dash = input.dash;
    if (this.phase === "countdown") {
      dash = false;
      const consumed = Math.min(dt, this.countdown);
      this.countdown = Math.max(0, this.countdown - consumed);
      dt -= consumed;
      if (this.countdown > 1e-9) return events;
      this.countdown = 0;
      this.phase = "running";
      events.push({ type: "start", text: "Go!" });
    }
    if (dt <= 0) return events;
    const start = this.elapsed;
    this.elapsed += dt;
    const rawTime = this.elapsed;
    const ix = Number.isFinite(input.x) ? input.x : 0,
      iy = Number.isFinite(input.y) ? input.y : 0;
    const length = Math.hypot(ix, iy);
    const direction =
      length > 0 ? { x: ix / length, y: iy / length } : { x: 0, y: 0 };
    if (dash && this.dashCooldown <= 1e-9) {
      this.dashDirection = length ? { ...direction } : { ...this.facing };
      this.dashLeft = 0.16;
      this.dashCooldown = 1.1;
    }
    let remaining = Math.min(dt, 0.25),
      simulated = 0;
    while (remaining > 1e-9 && this.phase === "running") {
      const step = Math.min(
        remaining,
        1 / 60,
        this.dashLeft > 1e-9 ? this.dashLeft : Infinity,
      );
      const dashing = this.dashLeft > 1e-9;
      const travel = dashing ? this.dashDirection : direction;
      if (travel.x || travel.y) this.facing = { ...travel };
      const speed = dashing ? 430 : input.sprint ? 250 : 185;
      this.pos = move(
        this.pos,
        travel.x * speed * step,
        travel.y * speed * step,
        RADIUS,
        this.obstacles,
      );
      this.pos.x = clamp(
        this.pos.x,
        RADIUS,
        Math.max(RADIUS, this.course.width - RADIUS),
      );
      this.pos.y = clamp(
        this.pos.y,
        RADIUS,
        Math.max(RADIUS, this.course.height - RADIUS),
      );
      simulated += step;
      remaining -= step;
      this.patterns(start + simulated);
      this.dashLeft = Math.max(0, this.dashLeft - step);
      this.dashCooldown = Math.max(0, this.dashCooldown - step);
      for (let i = 0; i < this.guards.length; i++) {
        const g = this.guards[i],
          def = this.course.guards[i];
        if (dashing) {
          g.awareness = 0;
          continue;
        }
        if (dist(g, this.pos) <= 24 && visible(g, this.pos, this.obstacles)) {
          this.fail(
            g.kind === "hr"
              ? "HR accepted your weekend as a team-building opportunity."
              : `${g.kind} booked a surprise catch-up. Escape cancelled.`,
            events,
          );
          break;
        }
        g.awareness = clamp(
          g.awareness +
            (inCone(g, this.pos, g.angle, def.range, def.fov, this.obstacles)
              ? step / 0.65
              : -step * 1.5),
          0,
          1,
        );
        if (g.awareness >= 1 - 1e-9) {
          this.fail(
            `${g.kind} spotted you leaving on time. Bold career move.`,
            events,
          );
          break;
        }
      }
      if (this.phase !== "running") break;
      for (const h of this.hazards) {
        if (!h.active || dashing || !visible(h, this.pos, this.obstacles))
          continue;
        const hit =
          h.kind === "photo"
            ? circleHits(this.pos, RADIUS, {
                x: h.x - h.w / 2,
                y: h.y - h.h / 2,
                w: h.w,
                h: h.h,
              })
            : dist(h, this.pos) <= h.radius + RADIUS;
        if (hit) {
          this.fail(
            h.kind === "photo"
              ? "photo: You were tagged in mandatory office memories."
              : h.kind === "paper"
                ? "paper: An urgent document has claimed your evening."
                : "meeting: This could have been an email.",
            events,
          );
          break;
        }
      }
      if (this.phase !== "running") break;
      if (this.options.mode === "buzzword")
        for (const l of this.letters) {
          if (!l.collected && dist(l, this.pos) <= 24) {
            l.collected = true;
            events.push({ type: "letter", text: l.char });
          }
        }
      if (circleHits(this.pos, RADIUS, this.course.exit)) {
        if (
          this.options.mode === "buzzword" &&
          this.letters.some((l) => !l.collected)
        ) {
          if (start + simulated >= this.lockedUntil) {
            events.push({
              type: "locked",
              text: "Collect every letter before clocking out.",
            });
            this.lockedUntil = start + simulated + 1.5;
          }
        } else {
          this.phase = "finished";
          this.result = {
            mode: this.options.mode,
            courseId: this.course.id,
            time: rawTime,
            medal: raceMedal(rawTime, this.course),
            joke: this.word?.joke ?? this.course.joke,
            code: codeFor(this.course, this.options.day),
            ...(this.word && this.options.mode === "buzzword"
              ? { word: this.word.word }
              : {}),
            ...(this.options.day ? { day: this.options.day } : {}),
          };
          events.push({
            type: "win",
            text: this.result.joke,
            result: this.result,
          });
        }
      }
    }
    // Oversized frames also expire dash/cooldown; never grant extra invulnerability.
    const skipped = Math.max(0, dt - simulated);
    this.dashLeft = Math.max(0, this.dashLeft - skipped);
    this.dashCooldown = Math.max(0, this.dashCooldown - skipped);
    if (this.phase === "running") this.patterns(rawTime);
    return events;
  }
}
