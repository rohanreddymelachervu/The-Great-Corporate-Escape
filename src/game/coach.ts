export type CoachTopic = "start" | "coffee" | "loot" | "board";
export interface CoachTip {
  id: CoachTopic;
  title: string;
  text: string;
}
export interface CoachState {
  elapsed: number;
  phase: string;
  coffee: number;
  suspicion: number;
  lootTarget?: string;
  hidden: boolean;
  danger: boolean;
}
const TIPS: Record<CoachTopic, Omit<CoachTip, "id">> = {
  start: {
    title: "ONE JOB: GET OUT",
    text: "Move: WASD / arrows / joystick. Gold arrow → lift. E calls it.",
  },
  coffee: {
    title: "A CLEAN WAY OUT",
    text: "Break sight behind furniture, then 1 throws coffee ahead to lure colleagues away.",
  },
  loot: {
    title: "OPTIONAL: TAKE SOMETHING",
    text: "Hold E / ACT to steal highlighted loot. Let the ring fill. Escape to bank points.",
  },
  board: {
    title: "YOUR RIDE IS HERE",
    text: "The doors are open. Follow the gold arrow and walk inside. Nothing else is required.",
  },
};
/** Advice only: never changes timing, enemies, health or player input. */
export class ContextCoach {
  readonly seen: Set<string>;
  private nextAt = 0;
  constructor(seen: string[] = []) {
    this.seen = new Set(seen);
  }
  next(s: CoachState): CoachTip | null {
    if (s.hidden || s.danger || s.elapsed < this.nextAt) return null;
    const id: CoachTopic | undefined =
      s.phase === "boarding"
        ? "board"
        : s.lootTarget
          ? "loot"
          : s.phase === "waiting" && s.coffee > 0
            ? "coffee"
            : s.phase === "find-lift" && s.elapsed > 0.4
              ? "start"
              : undefined;
    if (!id || this.seen.has(id)) return null;
    this.seen.add(id);
    this.nextAt = s.elapsed + 7;
    return { id, ...TIPS[id] };
  }
  resetRun() {
    this.nextAt = 0;
  }
}
