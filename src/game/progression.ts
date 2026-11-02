import type { Result, SaveData } from "./types";
const KEY = "office-escape-v1";
export const freshSave = (): SaveData => ({
  version: 1,
  unlocked: 1,
  bests: {},
  achievements: [],
  settings: {
    music: 0.35,
    sfx: 0.6,
    mute: false,
    reducedMotion: false,
    hitScenes: "brief",
    tips: true,
  },
  dailyBests: {},
});
export function load(): SaveData {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!s || s.version !== 1) return freshSave();
    return {
      ...freshSave(),
      ...s,
      unlocked: Math.max(1, Math.min(5, Number(s.unlocked) || 1)),
      settings: { ...freshSave().settings, ...s.settings },
      bests: s.bests || {},
      achievements: Array.isArray(s.achievements) ? s.achievements : [],
    };
  } catch {
    return freshSave();
  }
}
export function persist(s: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* Private browsing/storage quotas never block gameplay. */
  }
}
export function record(s: SaveData, r: Result, earned: string[]): string[] {
  if (!r.daily) {
    s.unlocked = Math.min(5, Math.max(s.unlocked, r.level + 1));
    const key = r.ruleset === 2 ? `v2-${r.level}` : String(r.level);
    if (!s.bests[key] || s.bests[key].score < r.score) s.bests[key] = r;
  } else {
    const dailyKey = r.ruleset === 2 ? `v2:${r.seed}` : r.seed;
    s.dailyBests[dailyKey] = Math.max(s.dailyBests[dailyKey] || 0, r.score);
    const days = Object.keys(s.dailyBests).sort();
    for (const k of days.slice(0, -31)) delete s.dailyBests[k];
  }
  const unlocked = [...new Set(earned)].filter(
    (a) => !s.achievements.includes(a),
  );
  s.achievements.push(...unlocked);
  persist(s);
  return unlocked;
}
