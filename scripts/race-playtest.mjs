// Real keyboard input only. The inspector is read-only, and all courses are selectable.
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
await mkdir("test-results", { recursive: true });
await build({
  entryPoints: ["src/game/logic.ts"],
  outfile: "test-results/race-logic.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { Navigator, dist, blocked, move } = await import(
  pathToFileURL(resolve("test-results/race-logic.mjs"))
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await b.newPage({ viewport: { width: 1280, height: 900 } }),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(
  process.env.DEV_RACE
    ? "http://127.0.0.1:4173"
    : pathToFileURL(resolve("release/office-escape.html")).href,
);
await page.waitForFunction(() => window.__office?.ready());
const state = () => page.evaluate(() => window.__sprint.snapshot());
const held = new Set();
async function keys(wanted) {
  for (const k of [...held])
    if (!wanted.includes(k)) {
      await page.keyboard.up(k);
      held.delete(k);
    }
  for (const k of wanted)
    if (!held.has(k)) {
      await page.keyboard.down(k);
      held.add(k);
    }
}
function control(s, target) {
  let dx = target.x - s.pos.x,
    dy = target.y - s.pos.y,
    dash = false,
    wait = false;
  const danger = s.guards
    .filter((g) => dist(g, s.pos) < 150)
    .sort((a, b) => dist(a, s.pos) - dist(b, s.pos))[0];
  if (
    danger &&
    s.dashCooldown <= 0 &&
    (dist(danger, s.pos) < 55 || danger.awareness > 0.6)
  )
    dash = true;
  for (const h of s.hazards) {
    if (!h.active && !h.warning) continue;
    if (
      h.kind === "photo" &&
      h.active &&
      Math.abs(h.y - s.pos.y) < h.h / 2 + 15 &&
      Math.abs(h.x - s.pos.x) < 65 &&
      s.dashCooldown <= 0
    ) {
      dx = h.x - s.pos.x;
      dy = 0;
      dash = true;
    } else if (h.kind === "meeting" && dist(h, s.pos) < h.radius + 65) {
      const toward = dx * (h.x - s.pos.x) + dy * (h.y - s.pos.y) > 0;
      if (toward && (h.active || h.warning) && dist(h, s.pos) > h.radius + 18)
        wait = true;
      else if (h.active) {
        dx = s.pos.x - h.x;
        dy = s.pos.y - h.y;
        dash = s.dashCooldown <= 0;
      }
    } else if (
      h.kind === "paper" &&
      h.active &&
      dist(h, s.pos) < 50 &&
      s.dashCooldown <= 0
    )
      dash = true;
  }
  let len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const check = move(s.pos, dx * 25, dy * 25, 11, s.obstacles);
  if (dist(check, s.pos) < 3) {
    const alt = [
      { x: -dy, y: dx },
      { x: dy, y: -dx },
    ].find(
      (p) =>
        !blocked(
          { x: s.pos.x + p.x * 25, y: s.pos.y + p.y * 25 },
          12,
          s.obstacles,
        ),
    );
    if (alt) {
      dx = alt.x;
      dy = alt.y;
    }
  }
  const wanted = [];
  if (!wait) {
    if (Math.abs(dx) > 0.16) wanted.push(dx > 0 ? "d" : "a");
    if (Math.abs(dy) > 0.16) wanted.push(dy > 0 ? "s" : "w");
    wanted.push("Shift");
  }
  return { wanted, dash: dash && !wait };
}
async function go(goal) {
  const deadline = Date.now() + 16000;
  let path = [],
    at = 0,
    stuck = 0,
    previous = null;
  while (Date.now() < deadline) {
    const s = await state();
    if (s.phase !== "running") {
      await keys([]);
      return s.phase === "finished";
    }
    if (dist(s.pos, goal) < 14) {
      await keys([]);
      return true;
    }
    if (!path.length) {
      path = new Navigator(s.width, s.height, s.obstacles, 12).path(
        s.pos,
        goal,
      );
      at = 0;
      if (!path.length) throw Error("No race path");
    }
    while (at < path.length - 1 && dist(s.pos, path[at]) < 10) at++;
    const c = control(s, path[at]);
    await keys(c.wanted);
    if (c.dash) await page.keyboard.press("Space");
    await page.waitForTimeout(30);
    if (previous && dist(previous, s.pos) < 0.5) stuck++;
    else stuck = 0;
    previous = s.pos;
    if (stuck > 25) {
      path = [];
      stuck = 0;
    }
  }
  await keys([]);
  return false;
}
async function run(mode, course) {
  let won = false;
  for (let attempt = 1; attempt <= 8; attempt++) {
    await page.waitForFunction(
      () => window.__sprint.snapshot()?.phase === "running",
      {},
      { timeout: 7000 },
    );
    // On a retry, deliberately vary the departure timing as a player would.
    // This costs actual race time and does not alter the course or its patterns.
    if(attempt>1)await page.waitForTimeout((attempt-1)*230);
    const initial = await state();
    let goals = initial.route.slice(1);
    if (mode === "buzzword") {
      const remaining = [...initial.letters];
      goals = [];
      let point = initial.pos;
      while (remaining.length) {
        const nav = new Navigator(
          initial.width,
          initial.height,
          initial.obstacles,
          12,
        );
        const ranked = remaining
          .map((l) => ({ l, path: nav.path(point, l) }))
          .map((x) => ({
            ...x,
            length: x.path.reduce(
              (sum, p, i) => sum + dist(i ? x.path[i - 1] : point, p),
              0,
            ),
          }))
          .sort((a, b) => a.length - b.length);
        const next = ranked[0].l;
        goals.push({ x: next.x, y: next.y });
        point = next;
        remaining.splice(remaining.indexOf(next), 1);
      }
      goals.push({
        x: initial.exit.x + initial.exit.w / 2,
        y: initial.exit.y + initial.exit.h / 2,
      });
    }
    for (const goal of goals) {
      if (!(await go(goal))) break;
    }
    await keys([]);
    let s = await state();
    if (s.phase === "finished") {
      await page.locator("#race-next").waitFor();
      results.push({
        mode,
        courseId: s.courseId,
        attempt,
        time: s.result.time,
        medal: s.result.medal,
        word: s.result.word,
        code: s.result.code,
        realInputsOnly: true,
      });
      console.log("ESCAPED", results.at(-1));
      await page.screenshot({
        path: `test-results/${mode}-${course}-complete.png`,
      });
      won = true;
      break;
    }
    console.log("CAUGHT", mode, course, attempt, s.failReason, s.pos);
    await page.screenshot({
      path: `test-results/${mode}-${course}-attempt-${attempt}.png`,
    });
    // Auto-retry is part of the game. A running timeout is retried through its normal R key.
    if (s.phase === "running") {
      await page.keyboard.press("r");
    } else if (s.phase === "failed" && s.failureAge >= 0.15) {
      await page.keyboard.press("r");
    }
    await page.waitForTimeout(120);
  }
  if (!won)
    throw Error(
      "Could not complete " +
        mode +
        " course " +
        course +
        " within bounded real-input attempts",
    );
}
try {
  await page.locator("#sprint-mode-btn").click();
  const start = Number(process.env.RACE_START || 1),
    end = Number(process.env.RACE_END || 10);
  for (let id = start; id <= end; id++) {
    await page.locator(`[data-race-course="${id}"]`).click();
    await run("sprint", id);
    await page.locator("#race-select").click();
  }
  if (!process.env.SKIP_WORD) {
    await page.locator("#race-switch-daily").click();
    await page.locator("#buzzword-start").click();
    await run("buzzword", "daily");
  }
  await writeFile(
    "test-results/race-playtest.json",
    JSON.stringify({ at: new Date().toISOString(), errors, results }, null, 2),
  );
  if (errors.length) throw Error(errors.join("\n"));
} catch (e) {
  await keys([]);
  console.error(e);
  await page.screenshot({ path: "test-results/race-playtest-failure.png" });
  await writeFile(
    "test-results/race-playtest-failure.json",
    JSON.stringify(await state(), null, 2),
  );
  process.exitCode = 1;
} finally {
  await b.close();
}
