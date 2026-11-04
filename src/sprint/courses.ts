import type { Point, Prop, Rect, Zone } from "../game/types";
import type { RaceGuard, RaceHazard, SprintCourse } from "./types";

const p = (x: number, y: number): Point => ({ x, y });
const rect = (x: number, y: number, w: number, h: number): Rect => ({
  x,
  y,
  w,
  h,
});
const prop = (
  kind: Prop["kind"],
  x: number,
  y: number,
  w: number,
  h: number,
): Prop => ({ kind, x, y, w, h });
const zone = (
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color = 0x183e49,
): Zone => ({ label, x, y, w, h, color });
const guard = (
  id: string,
  kind: RaceGuard["kind"],
  route: Point[],
  speed = 95,
  range = 120,
  fov = 1.1,
  offset = 0,
): RaceGuard => ({ id, kind, route, speed, range, fov, offset });
const hazard = (
  id: string,
  kind: RaceHazard["kind"],
  from: Point,
  to: Point,
  period = 6,
  offset = 0,
): RaceHazard => ({
  id,
  kind,
  from,
  to,
  radius: kind === "meeting" ? 50 : 16,
  ...(kind === "photo" ? { w: 18, h: 120 } : {}),
  period,
  warn: 1.5,
  active: 2,
  offset,
});

/** A continuous enclosure, including behind the permanently open exit marker. */
function boundary(width: number, height: number): Rect[] {
  return [
    rect(0, 0, width, 24),
    rect(0, height - 24, width, 24),
    rect(0, 24, 24, height - 48),
    rect(width - 24, 24, 24, height - 48),
  ];
}

function length(route: Point[]): number {
  return route
    .slice(1)
    .reduce(
      (sum, to, i) => sum + Math.hypot(to.x - route[i].x, to.y - route[i].y),
      0,
    );
}

/** Arc-length spacing keeps daily-word candidates distributed, not bunched at turns. */
function letters(route: Point[]): Point[] {
  const total = length(route);
  return Array.from({ length: 11 }, (_, i) => {
    let remaining = (total * (i + 1)) / 12;
    for (let j = 1; j < route.length; j++) {
      const a = route[j - 1],
        b = route[j];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (remaining <= distance) {
        return p(
          a.x + ((b.x - a.x) * remaining) / distance,
          a.y + ((b.y - a.y) * remaining) / distance,
        );
      }
      remaining -= distance;
    }
    return { ...route[route.length - 1] };
  });
}

type CoursePlan = Omit<
  SprintCourse,
  "spawn" | "exit" | "letterSpots" | "gold" | "silver"
> & {
  /** Authored clear detour floor, in addition to the eleven route samples. */
  detours?: Point[];
  /** Waiting/reading allowance above a clean 250px/s line. */
  allowance: number;
};
function course({
  detours = [],
  allowance,
  ...plan
}: CoursePlan): SprintCourse {
  const end = plan.route[plan.route.length - 1];
  const gold = Math.round((length(plan.route) / 250 + allowance) * 10) / 10;
  return {
    ...plan,
    walls: [...boundary(plan.width, plan.height), ...plan.walls],
    spawn: { ...plan.route[0] },
    exit: rect(end.x - 34, end.y - 34, 68, 68),
    letterSpots: [...letters(plan.route), ...detours],
    gold,
    silver: Math.round(gold * 1.4 * 100) / 100,
  };
}

/** Hand-authored routes are QA guides, not invisible rails or moving gates.
 * All props below are solid; labels/zones are decoration only.
 * Guards always loop along the listed straight segments, including last → first.
 */
export const SPRINT_COURSES: SprintCourse[] = [
  course({
    id: 1,
    name: "Quick Sync",
    subtitle: "One colleague. One very avoidable conversation.",
    joke: "Your manager asked for two minutes. You gave them none.",
    width: 1280,
    height: 720,
    allowance: 10,
    route: [p(100, 600), p(1130, 600), p(1130, 110), p(100, 110)],
    walls: [rect(24, 300, 1000, 24)],
    props: [
      prop("desk", 300, 480, 120, 55),
      prop("desk", 570, 480, 120, 55),
      prop("plant", 870, 480, 36, 36),
      prop("sofa", 280, 200, 150, 48),
      prop("table", 600, 190, 100, 58),
      prop("board", 900, 205, 85, 28),
    ],
    zones: [
      zone("No Agenda", 70, 390, 940, 270),
      zone("Two Minutes™", 70, 60, 940, 200, 0x224f50),
    ],
    guards: [
      guard(
        "sync-manager",
        "manager",
        [p(1100, 380), p(1100, 500)],
        80,
        100,
        1,
      ),
    ],
    hazards: [],
    detours: [p(500, 220), p(770, 420)],
  }),
  course({
    id: 2,
    name: "Reply All",
    subtitle: "Cross the thread without joining it.",
    joke: "You successfully removed yourself from this conversation. Physically.",
    width: 1400,
    height: 780,
    allowance: 10,
    route: [p(110, 110), p(110, 650), p(700, 650), p(700, 110), p(1280, 110)],
    walls: [rect(400, 24, 24, 560), rect(970, 220, 24, 536)],
    props: [
      prop("desk", 220, 280, 110, 58),
      prop("shelf", 200, 470, 100, 38),
      prop("plant", 470, 230, 35, 35),
      prop("board", 830, 250, 75, 26),
      prop("sofa", 1100, 470, 160, 48),
      prop("table", 1130, 280, 90, 70),
    ],
    zones: [
      zone("CC Country", 60, 60, 300, 660),
      zone("Thread Crossing", 460, 280, 470, 300, 0x224f50),
      zone("Unsubscribe", 1040, 60, 300, 630, 0x39434e),
    ],
    guards: [
      guard(
        "reply-east-west",
        "staff",
        [p(560, 400), p(850, 400)],
        90,
        110,
        1.05,
      ),
      guard(
        "reply-north-south",
        "staff",
        [p(700, 260), p(700, 540)],
        90,
        110,
        1.05,
        0.5,
      ),
    ],
    hazards: [],
    detours: [p(280, 650), p(1180, 620)],
  }),
  course({
    id: 3,
    name: "Mandatory Happiness",
    subtitle: "Smile only when the camera is resting.",
    joke: "Your absence has been recorded as enthusiastic participation.",
    width: 1320,
    height: 840,
    allowance: 9,
    route: [
      p(100, 110),
      p(1180, 110),
      p(1180, 420),
      p(130, 420),
      p(130, 720),
      p(1200, 720),
    ],
    walls: [rect(24, 260, 1040, 24), rect(280, 560, 1016, 24)],
    props: [
      prop("balloons", 380, 185, 42, 42),
      prop("table", 600, 180, 120, 50),
      prop("board", 370, 490, 95, 26),
      prop("sofa", 820, 480, 130, 45),
      prop("plant", 210, 640, 35, 35),
      prop("desk", 620, 620, 120, 50),
    ],
    zones: [
      zone("Joy Intake", 60, 50, 950, 170, 0x39434e),
      zone("Candid Corridor", 300, 310, 930, 220),
      zone("Fun Debrief", 60, 620, 1180, 170, 0x224f50),
    ],
    guards: [
      guard("happiness-hr", "hr", [p(700, 360), p(700, 485)], 90, 125, 1.15),
    ],
    hazards: [hazard("team-photo", "photo", p(1160, 350), p(1160, 480), 6)],
    detours: [p(100, 205), p(1000, 650)],
  }),
  course({
    id: 4,
    name: "Scope Creep",
    subtitle: "The short branch has one small recurring meeting.",
    joke: "You delivered exactly one exit. Additional exits are out of scope.",
    width: 1400,
    height: 800,
    allowance: 11,
    route: [
      p(100, 100),
      p(100, 680),
      p(530, 680),
      p(1180, 680),
      p(1180, 400),
      p(1280, 400),
    ],
    walls: [rect(350, 24, 24, 550), rect(650, 220, 400, 340)],
    props: [
      prop("desk", 190, 270, 100, 55),
      prop("plant", 220, 470, 36, 36),
      prop("board", 470, 270, 75, 26),
      prop("sofa", 760, 140, 150, 44),
      prop("table", 1180, 180, 100, 55),
      prop("plant", 1260, 600, 36, 36),
    ],
    zones: [
      zone("Original Ask", 55, 60, 260, 660),
      zone("Phase Two", 420, 60, 690, 120, 0x39434e),
      zone("Tiny Addition", 440, 600, 690, 140, 0x224f50),
    ],
    guards: [
      guard(
        "scope-reviewer",
        "staff",
        [p(1180, 260), p(1180, 530)],
        100,
        120,
        1.1,
      ),
    ],
    hazards: [
      hazard("scope-standup", "meeting", p(850, 680), p(850, 680), 6.5, 0.4),
    ],
    // The top branch avoids the meeting, at a cost of roughly 580 pixels.
    detours: [p(530, 110), p(1100, 110)],
  }),
  course({
    id: 5,
    name: "The Pivot",
    subtitle: "A hairpin is just a strategy with a deadline.",
    joke: "You pivoted from employee to former location.",
    width: 1200,
    height: 900,
    allowance: 10,
    route: [p(120, 120), p(120, 770), p(350, 770), p(350, 120), p(1080, 120)],
    walls: [rect(220, 24, 24, 650), rect(460, 240, 24, 636)],
    props: [
      prop("plant", 70, 400, 35, 35),
      prop("board", 265, 250, 50, 26),
      prop("desk", 580, 330, 130, 60),
      prop("desk", 840, 330, 130, 60),
      prop("sofa", 580, 680, 150, 50),
      prop("table", 900, 630, 110, 80),
    ],
    zones: [
      zone("Old Strategy", 50, 65, 140, 760),
      zone("New Old Strategy", 265, 65, 170, 760, 0x224f50),
      zone("Pivot Parking", 520, 265, 620, 560, 0x39434e),
    ],
    guards: [
      guard(
        "pivot-manager",
        "manager",
        [p(285, 390), p(410, 390)],
        90,
        125,
        1.15,
      ),
      guard(
        "pivot-intern",
        "intern",
        [p(850, 180), p(1050, 180)],
        105,
        105,
        1.05,
      ),
    ],
    hazards: [],
    detours: [p(600, 520), p(1050, 770)],
  }),
  course({
    id: 6,
    name: "Friday Deployment",
    subtitle: "Three lanes. Two printers. Zero rollback plan.",
    joke: "Deployment complete. You are now running outside production.",
    width: 1500,
    height: 820,
    allowance: 8,
    route: [
      p(100, 100),
      p(1350, 100),
      p(1350, 400),
      p(150, 400),
      p(150, 710),
      p(1380, 710),
    ],
    walls: [rect(24, 260, 1190, 24), rect(300, 540, 1176, 24)],
    props: [
      prop("server", 450, 175, 70, 55),
      prop("server", 750, 175, 70, 55),
      prop("printer", 730, 300, 44, 40),
      prop("desk", 1000, 465, 130, 50),
      prop("printer", 940, 590, 44, 40),
      prop("sofa", 400, 610, 150, 45),
      prop("plant", 1260, 620, 36, 36),
    ],
    zones: [
      zone("Works On My Desk", 60, 50, 1120, 180),
      zone("Print Queue", 340, 305, 1080, 205, 0x39434e),
      zone("Rollback Runway", 60, 590, 1360, 180, 0x224f50),
    ],
    guards: [
      guard("deploy-ops", "staff", [p(400, 330), p(400, 480)], 100, 120, 1.1),
      guard(
        "deploy-intern",
        "intern",
        [p(1200, 650), p(1200, 750)],
        110,
        110,
        1.1,
      ),
    ],
    hazards: [
      hazard("middle-paper", "paper", p(800, 320), p(800, 480), 5.5),
      hazard("release-notes", "paper", p(1000, 620), p(1000, 750), 7, 2.3),
    ],
    detours: [p(250, 180), p(700, 760)],
  }),
  course({
    id: 7,
    name: "Bandwidth Issues",
    subtitle: "Take the express lane, or buy yourself some space.",
    joke: "You reduced office traffic by one entire person.",
    width: 1440,
    height: 800,
    allowance: 11,
    route: [
      p(110, 650),
      p(110, 110),
      p(500, 110),
      p(500, 620),
      p(1240, 620),
      p(1320, 620),
      p(1320, 650),
    ],
    walls: [
      rect(350, 220, 24, 556),
      rect(650, 24, 500, 550),
      rect(650, 670, 500, 24),
    ],
    props: [
      prop("desk", 200, 300, 100, 55),
      prop("plant", 240, 530, 36, 36),
      prop("board", 405, 300, 55, 26),
      prop("server", 1260, 270, 60, 80),
      prop("plant", 1280, 430, 36, 36),
      prop("coffee", 500, 710, 45, 40),
    ],
    zones: [
      zone("Buffering", 60, 60, 255, 660),
      zone("Single File Transfer", 650, 580, 500, 84, 0x224f50),
      zone("Premium Bandwidth", 600, 705, 600, 64, 0x39434e),
    ],
    guards: [
      guard(
        "bandwidth-bottleneck",
        "staff",
        [p(820, 620), p(1000, 620)],
        85,
        100,
        1,
      ),
    ],
    hazards: [
      hazard("packet-loss", "paper", p(1100, 598), p(1100, 645), 5.5, 1),
    ],
    // A continuous 106px-wide lower bypass; neither branch ever closes statically.
    detours: [p(610, 735), p(900, 735), p(1200, 735)],
  }),
  course({
    id: 8,
    name: "Return To Office",
    subtitle: "A predictable lap around an unnecessary destination.",
    joke: "You have fulfilled the return part. The office part is over.",
    width: 1360,
    height: 880,
    allowance: 10,
    route: [p(110, 110), p(1190, 110), p(1190, 750), p(110, 750)],
    // The west connector prevents a 980px left-side skip around the island.
    walls: [rect(340, 250, 680, 380), rect(24, 430, 316, 24)],
    props: [
      prop("sofa", 430, 790, 150, 45),
      prop("plant", 850, 40, 36, 36),
      prop("desk", 60, 270, 120, 55),
      prop("board", 1030, 340, 26, 100),
      prop("table", 650, 810, 110, 35),
      prop("plant", 1050, 790, 36, 36),
    ],
    zones: [
      zone("Commute Simulator", 60, 55, 1210, 170),
      zone("Culture Loop", 1050, 260, 220, 410, 0x39434e),
      zone("Presence Achieved", 60, 660, 1210, 180, 0x224f50),
    ],
    guards: [
      guard(
        "rto-lap",
        "manager",
        [p(1080, 690), p(1280, 690), p(1280, 190), p(1080, 190)],
        100,
        130,
        1.2,
      ),
      guard(
        "rto-welcome",
        "intern",
        [p(1210, 350), p(1210, 550)],
        110,
        110,
        1.1,
      ),
    ],
    hazards: [
      hazard("culture-circle", "meeting", p(700, 750), p(700, 750), 7, 1.8),
    ],
    detours: [p(260, 350), p(110, 550)],
  }),
  course({
    id: 9,
    name: "Alignment Workshop",
    subtitle: "Their schedules align. Yours does not have to.",
    joke: "All stakeholders are aligned on your absence.",
    width: 1480,
    height: 880,
    allowance: 9,
    route: [
      p(110, 110),
      p(110, 720),
      p(550, 720),
      p(550, 140),
      p(930, 140),
      p(930, 720),
      p(1350, 720),
      p(1350, 110),
    ],
    walls: [
      rect(350, 24, 24, 570),
      rect(730, 280, 24, 576),
      rect(1110, 24, 24, 570),
    ],
    props: [
      prop("desk", 190, 320, 100, 55),
      prop("board", 440, 260, 75, 26),
      prop("sofa", 440, 810, 150, 35),
      prop("table", 810, 470, 75, 70),
      prop("plant", 1020, 640, 36, 36),
      prop("desk", 1190, 280, 110, 55),
    ],
    zones: [
      zone("Pre-Alignment", 60, 65, 250, 735),
      zone("Breakout A", 410, 65, 275, 735, 0x224f50),
      zone("Breakout B", 790, 65, 275, 735),
      zone("Parking Lot", 1170, 65, 250, 735, 0x39434e),
    ],
    guards: [
      guard("align-a", "staff", [p(480, 450), p(650, 450)], 100, 120, 1.15),
      guard("align-b", "hr", [p(850, 350), p(1030, 350)], 100, 130, 1.2, 0.5),
      guard("align-c", "staff", [p(1250, 620), p(1250, 780)], 105, 120, 1.15),
    ],
    hazards: [
      hazard("alignment-portrait", "photo", p(930, 100), p(930, 190), 6, 0.7),
      hazard("breakout-circle", "meeting", p(550, 720), p(550, 720), 6, 3),
    ],
    detours: [p(250, 730), p(1320, 810)],
  }),
  course({
    id: 10,
    name: "Exit Interview",
    subtitle: "Everything you learned, and nothing you need to explain.",
    joke: "Your feedback was received. You were not.",
    width: 1500,
    height: 900,
    allowance: 11,
    route: [
      p(110, 110),
      p(110, 740),
      p(650, 740),
      p(650, 530),
      p(980, 530),
      p(980, 120),
      p(1320, 120),
      p(1320, 780),
    ],
    walls: [
      rect(400, 24, 24, 610),
      rect(424, 400, 450, 24),
      rect(1100, 220, 24, 656),
      rect(780, 640, 220, 180),
    ],
    props: [
      prop("desk", 200, 280, 120, 60),
      prop("plant", 250, 520, 36, 36),
      prop("board", 480, 280, 95, 26),
      prop("sofa", 500, 810, 150, 45),
      prop("printer", 530, 630, 44, 40),
      prop("table", 790, 200, 110, 60),
      prop("desk", 1200, 300, 80, 55),
      prop("plant", 1410, 650, 36, 36),
    ],
    zones: [
      zone("Last Day Energy", 60, 60, 300, 760),
      zone("Feedback Funnel", 460, 450, 580, 150, 0x224f50),
      zone("Retention Strategy", 460, 60, 580, 290, 0x39434e),
      zone("Actually Outside Soon", 1170, 60, 270, 770),
    ],
    guards: [
      guard(
        "exit-manager",
        "manager",
        [p(300, 700), p(300, 800)],
        95,
        125,
        1.2,
      ),
      guard("exit-hr", "hr", [p(940, 300), p(1040, 300)], 105, 135, 1.25),
      guard(
        "exit-staff",
        "staff",
        [p(1230, 450), p(1400, 450)],
        110,
        120,
        1.15,
      ),
      guard("exit-intern", "intern", [p(650, 480), p(800, 480)], 100, 110, 1.1),
    ],
    hazards: [
      hazard("exit-photo", "photo", p(1320, 640), p(1320, 750), 7, 0.6),
      hazard("final-paperwork", "paper", p(600, 660), p(700, 660), 5.5, 2),
      hazard("counter-offer", "meeting", p(980, 170), p(980, 170), 6.5, 1.5),
    ],
    detours: [p(550, 610), p(1420, 800)],
  }),
];
