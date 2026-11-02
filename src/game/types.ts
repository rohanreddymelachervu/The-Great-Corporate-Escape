export type Kind = "manager" | "hr" | "intern" | "founder" | "pm" | "gossip";
export type Point = { x: number; y: number };
export type Rect = Point & { w: number; h: number; kind?: string };
export type Prop = Rect & {
  kind:
    | "desk"
    | "plant"
    | "sofa"
    | "coffee"
    | "server"
    | "table"
    | "balloons"
    | "board"
    | "shelf"
    | "printer";
  color?: number;
};
export type LootKind =
  "tv" | "snacks" | "keyboard" | "plant" | "trophy" | "coffee-machine";
export type Item = Point & {
  id: string;
  kind: "badge" | "laptop" | "coffee" | "wfh" | LootKind;
};
export interface MeetingRoom {
  id: string;
  name: string;
  area: Rect;
  door: Point;
  inside: Point;
  hall: Point;
  initialDelay: number;
  interval: number;
  crowd: number;
}
export type HitKind =
  | "photo"
  | "meeting"
  | "yap"
  | "paper"
  | "allhands"
  | "scope"
  | "gossip"
  | "door";
export interface HitEvent {
  kind: HitKind;
  damage: number;
  title: string;
  text: string;
}
export type Interaction = Point & {
  id: string;
  type: "hide" | "coffee" | "distraction" | "switch" | "fun";
  label: string;
  hint: string;
  target?: Kind;
  opens?: string;
};
export type Gate = Rect & { id: string; label: string; open?: boolean };
export type Zone = Rect & { label: string; color: number };
export type EnemySpawn = Point & { kind: Kind; route: Point[] };
export interface Level {
  id: number;
  name: string;
  subtitle: string;
  brief: string;
  tip: string;
  width: number;
  height: number;
  spawn: Point;
  exit: Rect;
  altExit?: Rect;
  walls: Rect[];
  props: Prop[];
  zones: Zone[];
  items: Item[];
  interactions: Interaction[];
  gates: Gate[];
  enemies: EnemySpawn[];
  required: string[];
  par: number;
  event: string;
  rooms?: MeetingRoom[];
}
export type Ability = "coffee" | "call" | "slack" | "calendar" | "vpn" | "wfh";
export type EnemyState =
  "patrol" | "investigate" | "chase" | "search" | "distracted";
export interface EnemyDef {
  name: string;
  title: string;
  color: number;
  speed: number;
  range: number;
  fov: number;
  damage: number;
  quotes: string[];
  weakness: string;
}
export interface RunStory {
  coffees: number;
  staffSpots: number;
  conversations: number;
  chatStillGoing: boolean;
  lootNames: string[];
  exit: "lift" | "wfh";
}
export interface Result {
  level: number;
  time: number;
  bs: number;
  spots: number;
  hits: number;
  collectibles: number;
  distractions: number;
  score: number;
  medal: string;
  funScore?: number;
  dodges?: number;
  ruleset?: number;
  lootValue?: number;
  stolen?: number;
  story?: RunStory;
  daily: boolean;
  seed: string;
}
export interface SaveData {
  version: number;
  unlocked: number;
  bests: Record<string, Result>;
  achievements: string[];
  settings: {
    music: number;
    sfx: number;
    mute: boolean;
    reducedMotion: boolean;
    hitScenes: "brief" | "long";
    tips: boolean;
  };
  dailyBests: Record<string, number>;
}
