import type { RaceResult } from "./types";
const KEY = "office-escape-races-v1";
interface RaceSave {
  version: 1;
  bests: Record<string, RaceResult>;
}
function load(): RaceSave {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    if (value?.version === 1 && value.bests && typeof value.bests === "object")
      return value;
  } catch {}
  return { version: 1, bests: {} };
}
export function raceKey(
  result: Pick<RaceResult, "mode" | "courseId" | "day" | "code">,
) {
  return result.mode === "sprint"
    ? "sprint:" + result.courseId
    : "buzzword:" + result.day + ":" + result.code;
}
export function raceBest(
  mode: "sprint" | "buzzword",
  courseId: number,
  day = "",
  code = "",
): RaceResult | null {
  return load().bests[raceKey({ mode, courseId, day, code })] || null;
}
export function recordRace(result: RaceResult): {
  best: RaceResult;
  previous: RaceResult | null;
  improved: boolean;
} {
  const save = load(),
    key = raceKey(result),
    previous = save.bests[key] || null;
  const improved =
    !previous ||
    Math.floor(result.time * 100 + 1e-8) <
      Math.floor(previous.time * 100 + 1e-8);
  const best = improved ? { ...result } : previous;
  if (improved) {
    save.bests[key] = best;
    const daily = Object.keys(save.bests)
      .filter((k) => k.startsWith("buzzword:"))
      .sort();
    for (const old of daily.slice(0, -31)) delete save.bests[old];
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch {
      /* Storage denial never blocks racing. */
    }
  }
  return { best, previous, improved };
}
