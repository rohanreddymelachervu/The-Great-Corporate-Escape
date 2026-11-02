import type { Result } from "./types";
/** Deterministic recap of actual run counters, never invented player actions. */
export function incidentReport(r: Result, win: boolean): string[] {
  const story = r.story;
  const lines = [
    win
      ? "Outcome: out of office. Technically still available."
      : "Outcome: involuntary overtime. Compensation: exposure.",
    `Time on the clock: ${r.time.toFixed(1)}s · Corporate BS: ${r.bs}%.`,
    `${r.dodges || 0} close calls dodged · ${r.spots} sightings · ${r.hits} interruptions.`,
  ];
  if (r.stolen)
    lines.push(
      `${win ? "Assets relocated" : "Assets not banked"}: ${r.stolen} item${r.stolen === 1 ? "" : "s"}, ${(r.lootValue || 0).toLocaleString()} loot points.`,
    );
  if (story?.lootNames.length)
    lines.push("Bag manifest: " + story.lootNames.join(", ") + ".");
  if (story?.coffees)
    lines.push(
      `Coffee reassigned: ${story.coffees} cup${story.coffees === 1 ? "" : "s"}. A productive spill.`,
    );
  if (story?.conversations)
    lines.push(
      story.chatStillGoing
        ? "Founder and intern: still discussing another AI agent."
        : "Founder and intern: successfully occupied by their own conversation.",
    );
  if (story?.staffSpots)
    lines.push(
      `Meeting-room witnesses: ${story.staffSpots}. “Just one quick question.”`,
    );
  if (story?.exit === "wfh" && win)
    lines.push("Exit strategy: work from literally anywhere else.");
  return lines.slice(0, 8);
}
