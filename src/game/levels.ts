import type { Level, Rect } from "./types";

// All coordinates are world pixels. Doorways are deliberately broad: even the
// narrowest patrol lane leaves a radius-11 player another 16px of clearance.
// Gates are shortcuts, never the only route to a required interaction or exit.
const boundary = (): Rect[] => [
  { x: 0, y: 0, w: 1120, h: 24 },
  { x: 0, y: 776, w: 1120, h: 24 },
  { x: 0, y: 24, w: 24, h: 752 },
  { x: 1096, y: 24, w: 24, h: 752 },
];

export const LEVELS: Level[] = [
  {
    id: 1,
    name: "The Quick Sync",
    subtitle: "One tiny sync. One very large escape plan.",
    brief:
      "Collect your badge in reception. Release the lift from the pantry, then leave.",
    tip: "Your first 100px are meeting-free. Follow RECEPTION → PANTRY → LIFT. The manager cannot resist a “quick blocker”.",
    event: "4:59 PM: Your manager has discovered a spare five minutes.",
    width: 1120,
    height: 800,
    spawn: { x: 90, y: 700 },
    exit: { x: 970, y: 65, w: 90, h: 70 },
    par: 65,
    required: ["l1-badge", "l1-lift-switch"],
    zones: [
      {
        x: 24,
        y: 24,
        w: 336,
        h: 280,
        label: "1 · RECEPTION — badge pickup",
        color: 0xc5e6db,
      },
      {
        x: 24,
        y: 304,
        w: 336,
        h: 472,
        label: "START HERE ↑ Reception",
        color: 0xe4efcf,
      },
      {
        x: 380,
        y: 24,
        w: 364,
        h: 496,
        label: "QUICK SYNC · allegedly 5 minutes",
        color: 0xf2ddbd,
      },
      {
        x: 380,
        y: 540,
        w: 364,
        h: 236,
        label: "2 · PANTRY — lift release",
        color: 0xc9e3eb,
      },
      {
        x: 764,
        y: 24,
        w: 332,
        h: 752,
        label: "3 · LIFT ↑ Freedom, ground floor",
        color: 0xdcd8ef,
      },
    ],
    walls: [
      ...boundary(),
      { x: 360, y: 24, w: 20, h: 160 },
      { x: 360, y: 304, w: 20, h: 272 },
      { x: 360, y: 696, w: 20, h: 80 },
      { x: 744, y: 24, w: 20, h: 300 },
      { x: 744, y: 444, w: 20, h: 206 },
      { x: 380, y: 520, w: 244, h: 20 },
    ],
    props: [
      { x: 80, y: 100, w: 180, h: 58, kind: "desk" },
      { x: 80, y: 360, w: 160, h: 54, kind: "sofa" },
      { x: 280, y: 460, w: 30, h: 30, kind: "plant" },
      { x: 55, y: 530, w: 160, h: 24, kind: "board" },
      { x: 440, y: 120, w: 180, h: 58, kind: "desk" },
      { x: 440, y: 340, w: 180, h: 58, kind: "desk" },
      { x: 450, y: 630, w: 60, h: 44, kind: "coffee" },
      { x: 850, y: 560, w: 150, h: 50, kind: "sofa" },
      { x: 850, y: 160, w: 160, h: 40, kind: "shelf" },
    ],
    items: [
      { id: "l1-badge", kind: "badge", x: 220, y: 240 },
      { id: "l1-coffee-reception", kind: "coffee", x: 210, y: 650 },
      { id: "l1-laptop-onboarding", kind: "laptop", x: 130, y: 470 },
      { id: "l1-coffee-lift", kind: "coffee", x: 890, y: 430 },
      { id: "l1-laptop-admin", kind: "laptop", x: 980, y: 260 },
    ],
    interactions: [
      {
        id: "l1-hide",
        type: "hide",
        x: 190,
        y: 450,
        label: "Onboarding invisibility",
        hint: "E · Hide beside the sofa. Even HR forgot this seat.",
      },
      {
        id: "l1-filter",
        type: "coffee",
        x: 550,
        y: 652,
        label: "Filter coffee, not feedback",
        hint: "E · A small cup of Bangalore courage.",
      },
      {
        id: "l1-blocker",
        type: "distraction",
        x: 300,
        y: 270,
        label: "A quick blocker!",
        hint: "E · Lure the manager for 10s and reduce pressure.",
        target: "manager",
      },
      {
        id: "l1-lift-switch",
        type: "switch",
        x: 650,
        y: 650,
        label: "Release the lift",
        hint: "E · Required. Open the sync-room shortcut; the lower passage is always open.",
        opens: "l1-sync-gate",
      },
    ],
    gates: [
      {
        id: "l1-sync-gate",
        x: 744,
        y: 344,
        w: 20,
        h: 80,
        label: "Sync shortcut",
      },
    ],
    enemies: [
      {
        kind: "manager",
        x: 610,
        y: 240,
        route: [
          { x: 410, y: 240 },
          { x: 680, y: 240 },
          { x: 680, y: 460 },
          { x: 410, y: 460 },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "Mandatory Fun Friday",
    subtitle: "Attendance optional. Except it is not.",
    brief:
      "Recover your badge by the fun desk. Stop the playlist and reach the lift.",
    tip: "The two doorways in each party divider connect every room. “Anonymous culture feedback” buys 10 seconds from HR.",
    event: "4:59 PM: HR queues one final team-bonding activity.",
    width: 1120,
    height: 800,
    spawn: { x: 90, y: 700 },
    exit: { x: 980, y: 60, w: 90, h: 70 },
    par: 75,
    required: ["l2-badge", "l2-playlist-switch"],
    zones: [
      {
        x: 24,
        y: 24,
        w: 556,
        h: 226,
        label: "CULTURE LAB · joy is an OKR",
        color: 0xefcfdc,
      },
      {
        x: 600,
        y: 24,
        w: 496,
        h: 226,
        label: "RECEPTION / LIFT · leave quietly",
        color: 0xc9e0ec,
      },
      {
        x: 24,
        y: 270,
        w: 420,
        h: 240,
        label: "FUN DESK · badge confiscation",
        color: 0xe8dfb3,
      },
      {
        x: 444,
        y: 270,
        w: 652,
        h: 240,
        label: "DANCE FLOOR · compulsory vibes",
        color: 0xe5d4ef,
      },
      {
        x: 24,
        y: 530,
        w: 700,
        h: 246,
        label: "PANTRY · snacks are compensation",
        color: 0xcce6d9,
      },
      {
        x: 724,
        y: 530,
        w: 372,
        h: 246,
        label: "GOSSIP CORNER · unofficial minutes",
        color: 0xf1d8bb,
      },
    ],
    walls: [
      ...boundary(),
      { x: 24, y: 250, w: 300, h: 20 },
      { x: 444, y: 250, w: 400, h: 20 },
      { x: 964, y: 250, w: 132, h: 20 },
      { x: 24, y: 510, w: 160, h: 20 },
      { x: 304, y: 510, w: 420, h: 20 },
      { x: 844, y: 510, w: 252, h: 20 },
      { x: 580, y: 24, w: 20, h: 106 },
    ],
    props: [
      { x: 210, y: 100, w: 160, h: 50, kind: "table" },
      { x: 750, y: 100, w: 140, h: 55, kind: "desk" },
      { x: 1020, y: 200, w: 30, h: 30, kind: "plant" },
      { x: 460, y: 350, w: 180, h: 40, kind: "table" },
      { x: 990, y: 350, w: 32, h: 50, kind: "balloons" },
      { x: 420, y: 620, w: 180, h: 60, kind: "desk" },
      { x: 80, y: 580, w: 100, h: 50, kind: "sofa" },
      { x: 650, y: 560, w: 50, h: 42, kind: "coffee" },
    ],
    items: [
      { id: "l2-badge", kind: "badge", x: 200, y: 410 },
      { id: "l2-coffee-snacks", kind: "coffee", x: 250, y: 680 },
      { id: "l2-laptop-payroll", kind: "laptop", x: 680, y: 650 },
      { id: "l2-coffee-party", kind: "coffee", x: 990, y: 470 },
      { id: "l2-laptop-culture", kind: "laptop", x: 860, y: 190 },
    ],
    interactions: [
      {
        id: "l2-hide",
        type: "hide",
        x: 230,
        y: 580,
        label: "The introvert bench",
        hint: "E · Hide beside the sofa; do not make eye contact with a tambourine.",
      },
      {
        id: "l2-filter",
        type: "coffee",
        x: 610,
        y: 580,
        label: "Emergency kaapi",
        hint: "E · Refuel before the icebreaker.",
      },
      {
        id: "l2-feedback",
        type: "distraction",
        x: 400,
        y: 470,
        label: "Anonymous culture feedback",
        hint: "E · Lure HR for 10s and reduce pressure.",
        target: "hr",
      },
      {
        id: "l2-rumour",
        type: "distraction",
        x: 980,
        y: 310,
        label: "Did you hear about ESOPs?",
        hint: "E · Lure gossip for 10s and reduce pressure.",
        target: "gossip",
      },
      {
        id: "l2-playlist-switch",
        type: "switch",
        x: 740,
        y: 400,
        label: "Stop the party playlist",
        hint: "E · Required. Release the lift and culture-lab shortcut.",
        opens: "l2-culture-gate",
      },
    ],
    gates: [
      {
        id: "l2-culture-gate",
        x: 580,
        y: 150,
        w: 20,
        h: 80,
        label: "Culture lab shortcut",
      },
    ],
    enemies: [
      {
        kind: "hr",
        x: 220,
        y: 190,
        route: [
          { x: 90, y: 190 },
          { x: 500, y: 190 },
          { x: 500, y: 70 },
          { x: 90, y: 70 },
        ],
      },
      {
        kind: "manager",
        x: 650,
        y: 430,
        route: [
          { x: 350, y: 430 },
          { x: 790, y: 430 },
          { x: 790, y: 310 },
          { x: 350, y: 310 },
        ],
      },
      {
        kind: "gossip",
        x: 980,
        y: 700,
        route: [
          { x: 900, y: 700 },
          { x: 1030, y: 700 },
          { x: 1030, y: 580 },
          { x: 900, y: 580 },
        ],
      },
    ],
  },
  {
    id: 3,
    name: "The Yappening",
    subtitle: "Two interns. Six questions. No mute button.",
    brief:
      "Find your badge at reception. Mute the demo stream from the south desk. Escape upstairs.",
    tip: "Use the wide gaps between desk bays, not the desks themselves. “Free pizza in prod” distracts both interns for 10 seconds.",
    event: "4:59 PM: The intern demo has entered its question-and-answer era.",
    width: 1120,
    height: 800,
    spawn: { x: 90, y: 700 },
    exit: { x: 980, y: 90, w: 90, h: 70 },
    par: 85,
    required: ["l3-badge", "l3-mute-switch"],
    zones: [
      {
        x: 24,
        y: 24,
        w: 1072,
        h: 176,
        label: "RECEPTION / LIFT · demos end here",
        color: 0xc7e2e9,
      },
      {
        x: 24,
        y: 220,
        w: 240,
        h: 340,
        label: "INTERN BAY A · what is a branch?",
        color: 0xf0dfb5,
      },
      {
        x: 284,
        y: 220,
        w: 420,
        h: 340,
        label: "DEMO PIT · please unshare screen",
        color: 0xd8d4ed,
      },
      {
        x: 724,
        y: 220,
        w: 372,
        h: 340,
        label: "INTERN BAY B · one last question",
        color: 0xf0d1d9,
      },
      {
        x: 24,
        y: 580,
        w: 240,
        h: 196,
        label: "QUIET NOOK · temporarily",
        color: 0xd5e8ce,
      },
      {
        x: 284,
        y: 580,
        w: 420,
        h: 196,
        label: "PANTRY / DEMO CONTROLS",
        color: 0xc7e4d9,
      },
      {
        x: 724,
        y: 580,
        w: 372,
        h: 196,
        label: "OVERFLOW · standing-room feedback",
        color: 0xe9ddcb,
      },
    ],
    walls: [
      ...boundary(),
      { x: 24, y: 200, w: 240, h: 20 },
      { x: 384, y: 200, w: 340, h: 20 },
      { x: 844, y: 200, w: 252, h: 20 },
      { x: 264, y: 320, w: 20, h: 240 },
      { x: 264, y: 680, w: 20, h: 96 },
      { x: 704, y: 220, w: 20, h: 140 },
      { x: 704, y: 480, w: 20, h: 180 },
      { x: 284, y: 560, w: 300, h: 20 },
      { x: 844, y: 560, w: 252, h: 20 },
    ],
    props: [
      { x: 90, y: 370, w: 90, h: 55, kind: "desk" },
      { x: 70, y: 590, w: 100, h: 35, kind: "shelf" },
      { x: 210, y: 700, w: 30, h: 30, kind: "plant" },
      { x: 380, y: 290, w: 180, h: 50, kind: "desk" },
      { x: 480, y: 410, w: 140, h: 50, kind: "desk" },
      { x: 850, y: 300, w: 150, h: 50, kind: "desk" },
      { x: 850, y: 450, w: 150, h: 50, kind: "desk" },
      { x: 480, y: 80, w: 300, h: 55, kind: "table" },
      { x: 400, y: 650, w: 50, h: 40, kind: "coffee" },
    ],
    items: [
      { id: "l3-badge", kind: "badge", x: 140, y: 110 },
      { id: "l3-coffee-intern", kind: "coffee", x: 130, y: 290 },
      { id: "l3-laptop-demo", kind: "laptop", x: 430, y: 375 },
      { id: "l3-coffee-overflow", kind: "coffee", x: 930, y: 640 },
      { id: "l3-laptop-controls", kind: "laptop", x: 580, y: 630 },
    ],
    interactions: [
      {
        id: "l3-hide-nook",
        type: "hide",
        x: 210,
        y: 610,
        label: "Documentation nobody opens",
        hint: "E · Hide beside the shelf, not inside the furniture.",
      },
      {
        id: "l3-hide-desk",
        type: "hide",
        x: 1045,
        y: 500,
        label: "Camera-off corner",
        hint: "E · Hide at the edge of the demo bay.",
      },
      {
        id: "l3-filter",
        type: "coffee",
        x: 365,
        y: 670,
        label: "Production-grade filter coffee",
        hint: "E · More reliable than the demo build.",
      },
      {
        id: "l3-pizza",
        type: "distraction",
        x: 620,
        y: 170,
        label: "Free pizza in prod!",
        hint: "E · Lure interns for 10s and reduce pressure.",
        target: "intern",
      },
      {
        id: "l3-hot-take",
        type: "distraction",
        x: 780,
        y: 600,
        label: "The CEO liked whose post?",
        hint: "E · Lure gossip for 10s and reduce pressure.",
        target: "gossip",
      },
      {
        id: "l3-mute-switch",
        type: "switch",
        x: 620,
        y: 700,
        label: "Mute the demo stream",
        hint: "E · Required. Release the lift and east-bay shortcut; the upper and lower routes stay open.",
        opens: "l3-demo-gate",
      },
    ],
    gates: [
      {
        id: "l3-demo-gate",
        x: 704,
        y: 380,
        w: 20,
        h: 80,
        label: "Demo bay shortcut",
      },
    ],
    enemies: [
      {
        kind: "intern",
        x: 220,
        y: 480,
        route: [
          { x: 220, y: 290 },
          { x: 220, y: 510 },
          { x: 60, y: 510 },
          { x: 60, y: 290 },
        ],
      },
      {
        kind: "intern",
        x: 1040,
        y: 390,
        route: [
          { x: 800, y: 390 },
          { x: 1040, y: 390 },
          { x: 1040, y: 260 },
          { x: 800, y: 260 },
        ],
      },
      {
        kind: "manager",
        x: 650,
        y: 250,
        route: [
          { x: 340, y: 250 },
          { x: 650, y: 250 },
          { x: 650, y: 510 },
          { x: 340, y: 510 },
        ],
      },
      {
        kind: "gossip",
        x: 940,
        y: 150,
        route: [
          { x: 900, y: 80 },
          { x: 1040, y: 80 },
          { x: 1040, y: 150 },
          { x: 900, y: 150 },
        ],
      },
    ],
  },
  {
    id: 4,
    name: "The All-Hands Ambush",
    subtitle: "All hands on deck. Your feet near the door.",
    brief:
      "Take your badge from reception and end the livestream at the east console. Find the lift—or a rare WFH pass.",
    tip: "The boardroom has a southern bypass. A WFH pass unlocks the home exit near your start, even without the main-exit checklist.",
    event: "4:59 PM: The founder adds a surprise AMA after the closing slide.",
    width: 1120,
    height: 800,
    spawn: { x: 100, y: 690 },
    exit: { x: 980, y: 70, w: 90, h: 70 },
    altExit: { x: 40, y: 680, w: 80, h: 60 },
    par: 90,
    required: ["l4-badge", "l4-stream-switch"],
    zones: [
      {
        x: 24,
        y: 24,
        w: 296,
        h: 752,
        label: "RECEPTION / HOME EXIT · WFH pass only",
        color: 0xc7e4dc,
      },
      {
        x: 340,
        y: 24,
        w: 440,
        h: 206,
        label: "GREEN ROOM · founder thoughts loading",
        color: 0xe9d6bc,
      },
      {
        x: 340,
        y: 250,
        w: 440,
        h: 300,
        label: "ALL-HANDS · no hard stop",
        color: 0xd9d5ed,
      },
      {
        x: 340,
        y: 570,
        w: 440,
        h: 206,
        label: "SCRUM LOUNGE · parking lot for ideas",
        color: 0xd7e5c7,
      },
      {
        x: 800,
        y: 24,
        w: 296,
        h: 326,
        label: "LIFT / LEADERSHIP · badge privilege",
        color: 0xc6dfeb,
      },
      {
        x: 800,
        y: 350,
        w: 296,
        h: 426,
        label: "PANTRY / LIVESTREAM CONSOLE",
        color: 0xeed3d3,
      },
    ],
    walls: [
      ...boundary(),
      { x: 320, y: 24, w: 20, h: 206 },
      { x: 320, y: 350, w: 20, h: 300 },
      { x: 780, y: 24, w: 20, h: 206 },
      { x: 780, y: 350, w: 20, h: 300 },
      { x: 340, y: 230, w: 140, h: 20 },
      { x: 620, y: 230, w: 160, h: 20 },
      { x: 340, y: 550, w: 140, h: 20 },
      { x: 620, y: 550, w: 160, h: 20 },
    ],
    props: [
      { x: 80, y: 470, w: 130, h: 50, kind: "sofa" },
      { x: 90, y: 230, w: 140, h: 60, kind: "desk" },
      { x: 80, y: 70, w: 100, h: 24, kind: "board" },
      { x: 880, y: 370, w: 130, h: 60, kind: "desk" },
      { x: 880, y: 660, w: 60, h: 44, kind: "coffee" },
      { x: 450, y: 350, w: 220, h: 70, kind: "table" },
      { x: 450, y: 80, w: 60, h: 60, kind: "shelf" },
      { x: 480, y: 630, w: 140, h: 40, kind: "desk" },
    ],
    items: [
      { id: "l4-badge", kind: "badge", x: 170, y: 150 },
      { id: "l4-laptop-reception", kind: "laptop", x: 230, y: 600 },
      { id: "l4-coffee-boardroom", kind: "coffee", x: 420, y: 300 },
      { id: "l4-coffee-stream", kind: "coffee", x: 950, y: 560 },
      { id: "l4-laptop-scrum", kind: "laptop", x: 700, y: 740 },
      { id: "l4-wfh", kind: "wfh", x: 950, y: 170 },
    ],
    interactions: [
      {
        id: "l4-hide-reception",
        type: "hide",
        x: 250,
        y: 480,
        label: "Not in the headcount",
        hint: "E · Hide beside reception seating.",
      },
      {
        id: "l4-hide-stage",
        type: "hide",
        x: 725,
        y: 440,
        label: "Off-camera",
        hint: "E · Hide beside the boardroom table.",
      },
      {
        id: "l4-filter",
        type: "coffee",
        x: 970,
        y: 680,
        label: "Post-AMA resuscitation",
        hint: "E · Filter coffee has a better exit strategy.",
      },
      {
        id: "l4-investor",
        type: "distraction",
        x: 570,
        y: 300,
        label: "Investor on line two!",
        hint: "E · Lure the founder for 10s and reduce pressure.",
        target: "founder",
      },
      {
        id: "l4-roadmap",
        type: "distraction",
        x: 1040,
        y: 580,
        label: "Someone moved the roadmap",
        hint: "E · Lure the PM for 10s and reduce pressure.",
        target: "pm",
      },
      {
        id: "l4-stream-switch",
        type: "switch",
        x: 980,
        y: 630,
        label: "End the livestream",
        hint: "E · Required for the lift. Open the reception shortcut too.",
        opens: "l4-boardroom-gate",
      },
    ],
    gates: [
      {
        id: "l4-boardroom-gate",
        x: 320,
        y: 250,
        w: 20,
        h: 80,
        label: "Boardroom shortcut",
      },
    ],
    enemies: [
      {
        kind: "founder",
        x: 550,
        y: 175,
        route: [
          { x: 550, y: 100 },
          { x: 720, y: 100 },
          { x: 720, y: 175 },
          { x: 550, y: 175 },
        ],
      },
      {
        kind: "pm",
        x: 380,
        y: 670,
        route: [
          { x: 380, y: 600 },
          { x: 730, y: 600 },
          { x: 730, y: 720 },
          { x: 380, y: 720 },
        ],
      },
      {
        kind: "manager",
        x: 395,
        y: 295,
        route: [
          { x: 395, y: 295 },
          { x: 725, y: 295 },
          { x: 725, y: 495 },
          { x: 395, y: 495 },
        ],
      },
      {
        kind: "hr",
        x: 1040,
        y: 280,
        route: [
          { x: 840, y: 280 },
          { x: 1040, y: 280 },
          { x: 1040, y: 520 },
          { x: 840, y: 520 },
        ],
      },
    ],
  },
  {
    id: 5,
    name: "Founder Mode",
    subtitle: "Everyone is a stakeholder. Nobody is going home.",
    brief:
      "Retrieve the badge and freeze the roadmap at the south console. Reach the lift, or find WFH and use the east fire exit.",
    tip: "The middle runway links four offset doors. Cut through it instead of dead-ending at desks. WFH bypasses the lift checklist.",
    event:
      "4:59 PM: Founder mode enabled. Work-life balance is now a stretch goal.",
    width: 1120,
    height: 800,
    spawn: { x: 80, y: 700 },
    exit: { x: 1000, y: 65, w: 70, h: 70 },
    altExit: { x: 1000, y: 670, w: 70, h: 70 },
    par: 100,
    required: ["l5-badge", "l5-roadmap-switch"],
    zones: [
      {
        x: 24,
        y: 24,
        w: 336,
        h: 336,
        label: "RECEPTION · please return your badge",
        color: 0xd7e8d3,
      },
      {
        x: 380,
        y: 24,
        w: 360,
        h: 336,
        label: "BUILD PIT · shipping our feelings",
        color: 0xe9d7bd,
      },
      {
        x: 760,
        y: 24,
        w: 336,
        h: 336,
        label: "FOUNDER SUITE / LIFT",
        color: 0xdad2ea,
      },
      {
        x: 24,
        y: 380,
        w: 1072,
        h: 120,
        label: "THE RUNWAY → no standing meetings",
        color: 0xc7e2ea,
      },
      {
        x: 24,
        y: 520,
        w: 336,
        h: 256,
        label: "WELLNESS NOOK · breathe on your own time",
        color: 0xcbe4da,
      },
      {
        x: 380,
        y: 520,
        w: 360,
        h: 256,
        label: "WAR ROOM · roadmap freeze console",
        color: 0xf0d1cb,
      },
      {
        x: 760,
        y: 520,
        w: 336,
        h: 256,
        label: "PANTRY / FIRE EXIT · WFH pass only",
        color: 0xe9e0b9,
      },
    ],
    walls: [
      ...boundary(),
      { x: 24, y: 360, w: 256, h: 20 },
      { x: 400, y: 360, w: 320, h: 20 },
      { x: 840, y: 360, w: 256, h: 20 },
      { x: 24, y: 500, w: 116, h: 20 },
      { x: 260, y: 500, w: 320, h: 20 },
      { x: 700, y: 500, w: 396, h: 20 },
      { x: 360, y: 24, w: 20, h: 216 },
      { x: 740, y: 24, w: 20, h: 96 },
      { x: 740, y: 240, w: 20, h: 120 },
      { x: 360, y: 520, w: 20, h: 116 },
      { x: 360, y: 752, w: 20, h: 24 },
      { x: 740, y: 520, w: 20, h: 116 },
    ],
    props: [
      { x: 100, y: 200, w: 160, h: 55, kind: "desk" },
      { x: 470, y: 100, w: 150, h: 55, kind: "desk" },
      { x: 470, y: 260, w: 150, h: 40, kind: "table" },
      { x: 860, y: 150, w: 150, h: 55, kind: "desk" },
      { x: 80, y: 580, w: 130, h: 55, kind: "sofa" },
      { x: 430, y: 580, w: 60, h: 70, kind: "server" },
      { x: 570, y: 570, w: 120, h: 50, kind: "desk" },
      { x: 870, y: 580, w: 140, h: 50, kind: "desk" },
      { x: 880, y: 680, w: 55, h: 35, kind: "coffee" },
    ],
    items: [
      { id: "l5-badge", kind: "badge", x: 220, y: 100 },
      { id: "l5-coffee-wellness", kind: "coffee", x: 300, y: 580 },
      { id: "l5-laptop-build", kind: "laptop", x: 530, y: 190 },
      { id: "l5-coffee-founder", kind: "coffee", x: 820, y: 300 },
      { id: "l5-laptop-fire-exit", kind: "laptop", x: 1010, y: 680 },
      { id: "l5-wfh", kind: "wfh", x: 1000, y: 440 },
    ],
    interactions: [
      {
        id: "l5-hide-wellness",
        type: "hide",
        x: 250,
        y: 610,
        label: "Wellness in stealth mode",
        hint: "E · Hide beside the sofa. Mindfulness is not billable.",
      },
      {
        id: "l5-hide-server",
        type: "hide",
        x: 530,
        y: 600,
        label: "Beep convincingly",
        hint: "E · Hide beside the server rack.",
      },
      {
        id: "l5-filter",
        type: "coffee",
        x: 975,
        y: 710,
        label: "Last kaapi before freedom",
        hint: "E · One for the road, not the roadmap.",
      },
      {
        id: "l5-term-sheet",
        type: "distraction",
        x: 810,
        y: 100,
        label: "A term sheet just dropped",
        hint: "E · Lure the founder for 10s and reduce pressure.",
        target: "founder",
      },
      {
        id: "l5-jira",
        type: "distraction",
        x: 640,
        y: 440,
        label: "Jira says all tickets are done",
        hint: "E · Lure the PM for 10s and reduce pressure.",
        target: "pm",
      },
      {
        id: "l5-appraisal",
        type: "distraction",
        x: 100,
        y: 440,
        label: "Appraisal forms are live",
        hint: "E · Lure the manager for 10s and reduce pressure.",
        target: "manager",
      },
      {
        id: "l5-roadmap-switch",
        type: "switch",
        x: 650,
        y: 680,
        label: "Freeze the roadmap",
        hint: "E · Required for the lift. Open the reception-to-build shortcut.",
        opens: "l5-focus-gate",
      },
    ],
    gates: [
      {
        id: "l5-focus-gate",
        x: 360,
        y: 260,
        w: 20,
        h: 80,
        label: "Focus room shortcut",
      },
    ],
    enemies: [
      {
        kind: "manager",
        x: 300,
        y: 150,
        route: [
          { x: 60, y: 150 },
          { x: 300, y: 150 },
          { x: 300, y: 300 },
          { x: 60, y: 300 },
        ],
      },
      {
        kind: "hr",
        x: 450,
        y: 420,
        route: [
          { x: 80, y: 420 },
          { x: 660, y: 420 },
          { x: 660, y: 460 },
          { x: 80, y: 460 },
        ],
      },
      {
        kind: "intern",
        x: 680,
        y: 210,
        route: [
          { x: 420, y: 210 },
          { x: 680, y: 210 },
          { x: 680, y: 330 },
          { x: 420, y: 330 },
        ],
      },
      {
        kind: "founder",
        x: 1040,
        y: 80,
        route: [
          { x: 810, y: 80 },
          { x: 1040, y: 80 },
          { x: 1040, y: 290 },
          { x: 810, y: 290 },
        ],
      },
      {
        kind: "pm",
        x: 650,
        y: 730,
        route: [
          { x: 530, y: 680 },
          { x: 680, y: 680 },
          { x: 680, y: 730 },
          { x: 530, y: 730 },
        ],
      },
      {
        kind: "gossip",
        x: 1040,
        y: 550,
        route: [
          { x: 810, y: 550 },
          { x: 1040, y: 550 },
          { x: 1040, y: 745 },
          { x: 810, y: 745 },
        ],
      },
    ],
  },
];

// Optional HR activities are real mini-games, not compulsory fetch objectives.
// Their locations are in open, collision-tested pantry/wellness spaces.
const funStations: Record<number, { x: number; y: number }> = {
  2: { x: 350, y: 600 },
  4: { x: 250, y: 600 },
  5: { x: 280, y: 680 },
};
for (const level of LEVELS) {
  const point = funStations[level.id];
  if (point)
    level.interactions.push({
      id: `l${level.id}-fun-friday`,
      type: "fun",
      ...point,
      label: "HR Fun Friday · Clap for the Culture",
      hint: "E · HR activity. 3 good claps = −25 BS, +1 coffee, 12s distraction.",
    });
}

// Ruleset 2: escape the people, not a badge-and-switch fetch checklist.
// Switches remain useful optional sabotage/priority tools; every lift can be called.
const briefs = [
  "Call the lift with E. HR will try to rope you into a team photo while it arrives. SPACE dodges.",
  "HR is already looking for you. Call the lift, dodge the photo sweeps, and board before the doors close.",
  "Two interns. Too many agents. Call the lift and keep moving through the purple yap zones.",
  "Call the lift before the founder calls All Hands. Sabotage the stream or use VPN to buy breathing room.",
  "Everyone wants your Friday. Call the lift, survive the final office hunt, or find a WFH token and use the purple exit.",
];
for (const level of LEVELS) {
  level.required = [];
  level.brief = briefs[level.id - 1];
  level.tip =
    "Gold arrow → lift. E to call. SPACE dodges. Outlined shapes warn; filled areas are dangerous. Cover, coffee and side switches are real counterplay.";
  level.par = 50 + level.id * 10;
  for (const i of level.interactions)
    if (i.type === "switch") {
      i.hint =
        "E · Optional sabotage. Bring the lift 7s sooner and distract this floor’s main nuisance.";
      if (level.id === 1) i.label = "Priority lift override";
    }
}
LEVELS[0].enemies.push({
  kind: "hr",
  x: 1040,
  y: 500,
  route: [
    { x: 820, y: 400 },
    { x: 1040, y: 400 },
    { x: 1040, y: 720 },
    { x: 820, y: 720 },
  ],
});
// Cover close to the lift is useful, but hiding lasts six seconds, not forever.
LEVELS[0].interactions.push({
  id: "l1-coat-hide",
  type: "hide",
  x: 1040,
  y: 240,
  label: "Behind the reception coat rack",
  hint: "E · Hide briefly. You can hold your breath for six seconds.",
});
// A snack refill replaces the old compulsory badge pickup. The engineer is already wearing ID.
for (const level of LEVELS)
  for (const item of level.items)
    if (item.kind === "badge") item.kind = "coffee";

// Ruleset 3 annexes are added to the authored cores, not scaled copies. Old
// pickups, hide spots, sabotage stations, WFH exits and furniture stay put.
// The former perimeter becomes short divider islands with several 176px+
// crossings; both the east and south wings are part of the same office.
type AnnexPlan = {
  rooms: { name: string; area: Rect; doorSide: "west" | "north" }[];
  lounge: Rect;
  pantry: Rect;
  bottomDivider: number;
};
const annexPlans: AnnexPlan[] = [
  {
    rooms: [
      {
        name: "Quick Sync · no hard stop",
        area: { x: 1240, y: 244, w: 336, h: 256 },
        doorSide: "west",
      },
      {
        name: "Alignment · the follow-up",
        area: { x: 1240, y: 700, w: 336, h: 256 },
        doorSide: "west",
      },
    ],
    lounge: { x: 48, y: 832, w: 608, h: 240 },
    pantry: { x: 704, y: 832, w: 400, h: 240 },
    bottomDivider: 880,
  },
  {
    rooms: [
      {
        name: "Culture Council · mandatory joy",
        area: { x: 1240, y: 276, w: 336, h: 256 },
        doorSide: "west",
      },
      {
        name: "Retro · feelings on a sticky note",
        area: { x: 624, y: 832, w: 432, h: 264 },
        doorSide: "north",
      },
    ],
    lounge: { x: 48, y: 832, w: 528, h: 240 },
    pantry: { x: 1240, y: 580, w: 336, h: 208 },
    bottomDivider: 400,
  },
  {
    rooms: [
      {
        name: "Demo Debrief · one more question",
        area: { x: 1240, y: 248, w: 336, h: 272 },
        doorSide: "west",
      },
      {
        name: "Rubber Duck · explain it again",
        area: { x: 352, y: 832, w: 432, h: 264 },
        doorSide: "north",
      },
    ],
    lounge: { x: 832, y: 832, w: 352, h: 240 },
    pantry: { x: 1240, y: 600, w: 336, h: 200 },
    bottomDivider: 928,
  },
  {
    rooms: [
      {
        name: "Investor Relations · pre-AMA",
        area: { x: 1240, y: 320, w: 336, h: 256 },
        doorSide: "west",
      },
      {
        name: "Scope Review · the parking lot",
        area: { x: 1240, y: 744, w: 336, h: 256 },
        doorSide: "west",
      },
    ],
    lounge: { x: 48, y: 832, w: 608, h: 240 },
    pantry: { x: 704, y: 832, w: 400, h: 240 },
    bottomDivider: 880,
  },
  {
    rooms: [
      {
        name: "Board of Stakeholders · founder only",
        area: { x: 1240, y: 224, w: 336, h: 288 },
        doorSide: "west",
      },
      {
        name: "War Room II · infinite runway",
        area: { x: 640, y: 832, w: 464, h: 264 },
        doorSide: "north",
      },
    ],
    lounge: { x: 48, y: 832, w: 544, h: 240 },
    pantry: { x: 1240, y: 600, w: 336, h: 192 },
    bottomDivider: 384,
  },
];

function appendMeetingRoom(
  level: Level,
  plan: AnnexPlan["rooms"][number],
  index: number,
): void {
  const { area, name, doorSide } = plan;
  const { x, y, w, h } = area;
  // A real four-sided room with one permanently OPEN 120px doorway. There is
  // deliberately no Gate here: amber warnings announce people, never a wall.
  const west = doorSide === "west";
  if (west) {
    level.walls.push(
      { x, y, w, h: 16 },
      { x, y: y + h - 16, w, h: 16 },
      { x: x + w - 16, y: y + 16, w: 16, h: h - 32 },
      { x, y: y + 16, w: 16, h: h / 2 - 76 },
      { x, y: y + h / 2 + 60, w: 16, h: h / 2 - 76 },
    );
  } else {
    level.walls.push(
      { x, y, w: 16, h },
      { x: x + w - 16, y, w: 16, h },
      { x: x + 16, y: y + h - 16, w: w - 32, h: 16 },
      { x: x + 16, y, w: w / 2 - 76, h: 16 },
      { x: x + w / 2 + 60, y, w: w / 2 - 76, h: 16 },
    );
  }
  const id = `l${level.id}-meeting-${index + 1}`;
  level.rooms!.push({
    id,
    name,
    area,
    door: west ? { x: x + 8, y: y + h / 2 } : { x: x + w / 2, y: y + 8 },
    inside: west ? { x: x + 72, y: y + h / 2 } : { x: x + w / 2, y: y + 72 },
    hall: west ? { x: x - 64, y: y + h / 2 } : { x: x + w / 2, y: y - 64 },
    initialDelay: 4.5 + ((level.id + index * 2) % 5),
    interval: 11 + ((level.id + index * 3) % 7),
    crowd: level.id >= 4 || index === 1 ? 2 : 1,
  });
  level.zones.push({
    x: x + 16,
    y: y + 16,
    w: w - 32,
    h: h - 32,
    label: `${name.toUpperCase()} · AMBER = STAFF EXIT`,
    color: index === 0 ? 0xe8d6ba : 0xd9d4e9,
  });
  // The table is physical cover; loot is on free floor beside it. In
  // particular, a TV is itself an object, NOT a point buried in a shelf.
  level.props.push(
    west
      ? { x: x + 144, y: y + h / 2 - 28, w: 104, h: 56, kind: "table" }
      : { x: x + w / 2 - 58, y: y + 140, w: 116, h: 54, kind: "table" },
    { x: x + 40, y: y + 32, w: 104, h: 20, kind: "board" },
  );
  level.items.push(
    {
      id: `${id}-tv`,
      kind: "tv",
      x: x + w - 64,
      y: west ? y + 56 : y + h - 56,
    },
    {
      id: `${id}-${index === 0 ? "keyboard" : "trophy"}`,
      kind: index === 0 ? "keyboard" : "trophy",
      x: west ? x + 182 : x + 64,
      y: y + h - 52,
    },
  );
}

for (const [index, level] of LEVELS.entries()) {
  const plan = annexPlans[index];
  level.width = 1600;
  level.height = 1120;
  level.exit = { x: 1490, y: 90, w: 80, h: 70 };
  // The first four walls were the OLD 1120×800 outer boundary. Replacing all
  // four also extends the north/west edges; no old full-height edge can seal
  // the annex. The following short pieces preserve the old office outline.
  level.walls.splice(
    0,
    4,
    { x: 0, y: 0, w: level.width, h: 24 },
    { x: 0, y: level.height - 24, w: level.width, h: 24 },
    { x: 0, y: 24, w: 24, h: level.height - 48 },
    { x: level.width - 24, y: 24, w: 24, h: level.height - 48 },
  );
  level.walls.push(
    { x: 1096, y: 24, w: 24, h: 72 },
    { x: 1096, y: 280, w: 24, h: 72 },
    { x: 1096, y: 536, w: 24, h: 72 },
    { x: 24, y: 776, w: 96, h: 24 },
    { x: plan.bottomDivider, y: 776, w: 128, h: 24 },
  );
  // Retire old lift labels without touching any authored core zone geometry.
  for (const zone of level.zones)
    zone.label = zone.label.replace(/LIFT/g, "EAST WING →");
  level.zones.push(
    {
      x: 1120,
      y: 24,
      w: 456,
      h: 184,
      label: "MAIN LIFT · CALL → SURVIVE → BOARD",
      color: 0xcbdfea,
    },
    {
      x: 1120,
      y: 208,
      w: 120,
      h: 792,
      label: "SERVICE CORRIDOR · TWO WAYS ROUND",
      color: 0xd4e3dc,
    },
    { ...plan.lounge, label: "QUIET LOUNGE · CAMERA OFF", color: 0xd8e5c9 },
    {
      ...plan.pantry,
      label: "PANTRY · TAKE A SNACK, NOT A MEETING",
      color: 0xcbe5e0,
    },
  );
  level.rooms = [];
  plan.rooms.forEach((room, roomIndex) =>
    appendMeetingRoom(level, room, roomIndex),
  );

  const lounge = plan.lounge,
    pantry = plan.pantry;
  level.props.push(
    { x: 1280, y: 92, w: 128, h: 44, kind: "sofa" },
    { x: 1416, y: 48, w: 28, h: 28, kind: "plant" },
    {
      x: lounge.x + 36,
      y: lounge.y + lounge.h - 92,
      w: 160,
      h: 48,
      kind: "sofa",
    },
    {
      x: lounge.x + lounge.w - 144,
      y: lounge.y + lounge.h - 108,
      w: 80,
      h: 40,
      kind: "table",
    },
    { x: lounge.x + 36, y: lounge.y + 28, w: 140, h: 20, kind: "board" },
    {
      x: pantry.x + 32,
      y: pantry.y + pantry.h - 68,
      w: 120,
      h: 32,
      kind: "shelf",
    },
    {
      x: pantry.x + pantry.w - 92,
      y: pantry.y + 40,
      w: 60,
      h: 44,
      kind: "coffee",
    },
    { x: 1160, y: 1040, w: 56, h: 40, kind: "printer" },
  );
  // Nine optional steals: three risky TVs, two quiet path-side snacks, and
  // keyboard/trophy/plant/coffee-machine. None adds a mandatory fetch step.
  level.items.push(
    {
      id: `l${level.id}-lounge-tv`,
      kind: "tv",
      x: lounge.x + lounge.w - 60,
      y: lounge.y + 72,
    },
    {
      id: `l${level.id}-lounge-plant`,
      kind: "plant",
      x: lounge.x + lounge.w - 56,
      y: lounge.y + lounge.h - 44,
    },
    {
      id: `l${level.id}-pantry-coffee-machine`,
      kind: "coffee-machine",
      x: pantry.x + 76,
      y: pantry.y + 64,
    },
    { id: `l${level.id}-snacks-east`, kind: "snacks", x: 1176, y: 624 },
    { id: `l${level.id}-snacks-south`, kind: "snacks", x: 240, y: 844 },
  );
  // Existing coffee/hiding interactions remain verbatim. New cover also makes
  // the distant lift's wait a small loop rather than a featureless dead end.
  level.interactions.push({
    id: `l${level.id}-annex-hide`,
    type: "hide",
    x: 1350,
    y: 176,
    label: "The unbooked waiting area",
    hint: "E · Hide beside the lift lounge sofa. Amber room lights mean staff are leaving.",
  });
  // Extend one established roamer into the wing without removing any core
  // patrol nodes. All legs use the same collision-aware Navigator as pursuit.
  const roamer = level.enemies.find(
    (enemy) =>
      enemy.kind === (level.id === 1 || level.id === 4 ? "hr" : "gossip"),
  )!;
  roamer.route.push(
    { x: 1176, y: 660 },
    { x: 1176, y: 180 },
    { x: 1392, y: 180 },
    { x: 1460, y: 210 },
  );
  level.tip +=
    " The east and south annexes connect through broad passages. Meeting doors stay open; AMBER warns of staff walking out. TVs are optional risky detours.";
}
