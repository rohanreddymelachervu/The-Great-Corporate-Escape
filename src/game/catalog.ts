import type { Ability, EnemyDef, Kind } from "./types";
export const ENEMIES: Record<Kind, EnemyDef> = {
  manager: {
    name: "The Manager",
    title: "Quick Sync?",
    color: 0xff997e,
    speed: 105,
    range: 190,
    fov: 1.18,
    damage: 25,
    weakness: "Urgent Jira ticket",
    quotes: [
      "Got 2 mins? In meeting-minutes.",
      "Let’s align on why you’re leaving.",
      "One small thing. Six subtasks.",
      "Your manager is typing… still typing.",
      "Quick sync? No agenda. No survivors.",
    ],
  },
  hr: {
    name: "HR",
    title: "Mandatory Fun",
    color: 0xffb8da,
    speed: 98,
    range: 225,
    fov: 1.65,
    damage: 20,
    weakness: "Cake / engagement crisis",
    quotes: [
      "Your smile is a company asset.",
      "Fun is mandatory. Joy is an OKR.",
      "Icebreaker: tell us your weekend PIN.",
      "We noticed you didn’t react to the cake.",
      "The team photo has a retention policy.",
    ],
  },
  intern: {
    name: "The Yappaccino Intern",
    title: "Infinite Yap",
    color: 0xc3a0ff,
    speed: 133,
    range: 165,
    fov: 1.5,
    damage: 15,
    weakness: "Trending GitHub repo",
    quotes: [
      "Bro, I built an agent that builds agents.",
      "Have you tried Rust? For your marriage?",
      "This changes everything. Again.",
      "My MCP server has an MCP server.",
      "Bro, hear me out. Uber for standups.",
    ],
  },
  founder: {
    name: "The Founder",
    title: "We’re a Family",
    color: 0xffcf70,
    speed: 115,
    range: 260,
    fov: 1.3,
    damage: 35,
    weakness: "Investor call",
    quotes: [
      "Work-life balance? We pivoted.",
      "Weekends are a legacy feature.",
      "We’re a family. A Series B family.",
      "The vision deck has 186 slides.",
      "Ownership means owning Friday night.",
    ],
  },
  pm: {
    name: "Product Manager",
    title: "One Small Change",
    color: 0x7ed5ff,
    speed: 103,
    range: 180,
    fov: 1.25,
    damage: 20,
    weakness: "Very detailed roadmap",
    quotes: [
      "Same scope. Different everything.",
      "What if the exit had onboarding?",
      "It’s not a bug. It’s a stretch goal.",
      "Tiny ask: rebuild the elevator.",
      "We need an MVP of your weekend.",
    ],
  },
  gossip: {
    name: "Office Gossip",
    title: "Did You Hear?",
    color: 0xb3e18c,
    speed: 108,
    range: 155,
    fov: 1.8,
    damage: 10,
    weakness: "Fresh ESOP gossip",
    quotes: [
      "I heard the exit has great culture.",
      "ESOPs? More like Aesop’s fables.",
      "Apparently the pantry is a safe space.",
      "I didn’t say you were leaving. Loudly.",
      "The real roadmap is on WhatsApp.",
    ],
  },
};
export const ABILITIES: Record<
  Ability,
  {
    name: string;
    short: string;
    key: string;
    level: number;
    cooldown: number;
    duration: number;
    description: string;
  }
> = {
  coffee: {
    name: "Throw Coffee",
    short: "THROW COFFEE",
    key: "1",
    level: 1,
    cooldown: 5,
    duration: 6,
    description:
      "Throw ahead to lure up to two nearby enemies. A pursuer who can still see you only hesitates. Throw around cover!",
  },
  call: {
    name: "Fake Call",
    short: "FAKE CALL",
    key: "2",
    level: 2,
    cooldown: 24,
    duration: 5,
    description:
      "Managers, HR, PM and gossip defer for 5s. You move slower to sell the call; founder and intern ignore it.",
  },
  slack: {
    name: "Look Busy — stay still",
    short: "LOOK BUSY",
    key: "3",
    level: 3,
    cooldown: 20,
    duration: 5,
    description:
      "Stay completely still and look extremely busy. Movement cancels the bluff.",
  },
  calendar: {
    name: "Meeting Shield",
    short: "MEETING SHIELD",
    key: "4",
    level: 3,
    cooldown: 30,
    duration: 3.5,
    description:
      "All meetings rejected for 3.5s, even while running. Does not erase suspicion.",
  },
  vpn: {
    name: "Office Freeze",
    short: "OFFICE FREEZE",
    key: "5",
    level: 4,
    cooldown: 35,
    duration: 2,
    description:
      "Clear live interference and stun enemies for 2s while the lift keeps coming. IT will definitely notice.",
  },
  wfh: {
    name: "Emergency WFH",
    short: "WFH",
    key: "6",
    level: 4,
    cooldown: 0,
    duration: 999,
    description:
      "A purple house token automatically opens the alternate exit and bypasses the lift wait.",
  },
};
export const ACHIEVEMENTS = [
  {
    id: "tv",
    name: "Company Assets, Personal Weekend",
    text: "Escape with at least one stolen office TV.",
  },
  {
    id: "snacks",
    name: "Snack Equity Vested",
    text: "Steal at least two snack stashes and escape.",
  },
  {
    id: "heist",
    name: "Five-Finger Sprint Planning",
    text: "Escape with at least 1,500 loot points in your bag.",
  },
  {
    id: "ghost",
    name: "Professional Ghost",
    text: "Escape without being spotted.",
  },
  {
    id: "email",
    name: "This Could’ve Been an Email",
    text: "Escape level 1 without being caught or using an interaction other than the lift switch.",
  },
  {
    id: "culture",
    name: "Culture Fit Rejected",
    text: "Escape Mandatory Fun Friday without HR catching you.",
  },
  {
    id: "yap",
    name: "Certified Yappologist",
    text: "Hear all four parts of the intern’s monologue and survive the level.",
  },
  {
    id: "speed",
    name: "Quiet Quitting Speedrun",
    text: "Escape any level in under 45 seconds.",
  },
  {
    id: "founder",
    name: "Founder-Proof",
    text: "Complete the final level without being caught.",
  },
  {
    id: "busy",
    name: "Calendar Says Busy",
    text: "Successfully bluff three different enemy encounters in one run.",
  },
  {
    id: "dodge",
    name: "Culture Dodgeball",
    text: "Dodge three corporate hazards or HR photo charges with SPACE in one escape.",
  },
  { id: "all", name: "Notice Period: Zero", text: "Finish all five floors." },
  {
    id: "laptop",
    name: "Asset Recovery Specialist",
    text: "Recover every optional laptop on a floor.",
  },
  { id: "wfh", name: "Remote Possibility", text: "Escape through a WFH exit." },
  {
    id: "daily",
    name: "Daily Stand-down",
    text: "Complete the daily challenge.",
  },
  {
    id: "kaapi",
    name: "Filter Coffee > Feedback",
    text: "Use three coffee distractions in a run.",
  },
];
export const EVENTS = [
  {
    title: "FRIDAY DEPLOY DETECTED",
    text: "Production is down. Sprint noise is hidden for 9s.",
    type: "noise",
  },
  {
    title: "PIZZA INSTEAD OF APPRAISALS",
    text: "Everyone investigates the pantry. Compensation remains unchanged.",
    type: "pizza",
  },
  {
    title: "YOUR MANAGER IS TYPING…",
    text: "The manager checks Slack. 8 seconds of peace.",
    type: "slack",
  },
  {
    title: "MANDATORY TEAM PHOTO",
    text: "HR puts a fun zone on the floor. Walk around the pink ring.",
    type: "fun",
  },
  {
    title: "SURPRISE TOWN HALL",
    text: "The founder calls All Hands. Everyone gets nosy for 9s.",
    type: "hands",
  },
  {
    title: "ONE SMALL REQUIREMENT",
    text: "PM adds a temporary approval step. Lift delayed 8s.",
    type: "scope",
  },
];
export const VICTORY_LINES = [
  "Your weekend has been successfully deployed.",
  "No meetings were harmed. Several were declined.",
  "You are now offline. Emotionally and on Slack.",
  "Next stop: Silk Board. Somehow still an upgrade.",
  "Your out-of-office has achieved product-market fit.",
];
