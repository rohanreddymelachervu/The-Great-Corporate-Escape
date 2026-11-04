import type { Point, Rect, Prop, Zone } from "../game/types";
export type RaceMode = "sprint" | "buzzword";
export type RacePhase = "countdown" | "running" | "failed" | "finished";
export interface RaceGuard {
  id: string;
  kind: "manager" | "hr" | "intern" | "staff";
  route: Point[];
  speed: number;
  range: number;
  fov: number;
  offset?: number;
}
export interface RaceHazard {
  id: string;
  kind: "photo" | "paper" | "meeting";
  from: Point;
  to: Point;
  radius: number;
  w?: number;
  h?: number;
  period: number;
  warn: number;
  active: number;
  offset?: number;
}
export interface SprintCourse {
  id: number;
  name: string;
  subtitle: string;
  joke: string;
  width: number;
  height: number;
  spawn: Point;
  exit: Rect;
  walls: Rect[];
  props: Prop[];
  zones: Zone[];
  guards: RaceGuard[];
  hazards: RaceHazard[];
  letterSpots: Point[];
  gold: number;
  silver: number;
  route: Point[];
}
export interface WordEntry {
  word: string;
  joke: string;
}
export interface LetterBadge extends Point {
  id: string;
  index: number;
  char: string;
  collected: boolean;
}
export interface RaceOptions {
  mode: RaceMode;
  courseId: number;
  day?: string;
}
export interface RaceGuardState extends Point {
  id: string;
  kind: RaceGuard["kind"];
  angle: number;
  awareness: number;
}
export interface RaceHazardState extends Point {
  id: string;
  kind: RaceHazard["kind"];
  radius: number;
  w: number;
  h: number;
  warning: boolean;
  active: boolean;
  from: Point;
  to: Point;
  progress: number;
}
export interface RaceInput {
  x: number;
  y: number;
  sprint: boolean;
  dash: boolean;
}
export interface RaceResult {
  mode: RaceMode;
  courseId: number;
  time: number;
  medal: "Gold" | "Silver" | "Bronze";
  word?: string;
  joke: string;
  day?: string;
  code: string;
}
export interface RaceEvent {
  type: "start" | "letter" | "locked" | "fail" | "win";
  text: string;
  result?: RaceResult;
}
