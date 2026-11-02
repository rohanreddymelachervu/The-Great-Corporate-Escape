// Ruleset 2 real-input playtest: no positioning, invulnerability, timer, or win hooks.
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await mkdir("test-results", { recursive: true });
await build({
  entryPoints: ["src/game/logic.ts"],
  outfile: "test-results/playtest-logic.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
await build({
  entryPoints: ["src/game/levels.ts"],
  outfile: "test-results/playtest-levels.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { LEVELS } = await import(
  pathToFileURL(resolve("test-results/playtest-levels.mjs"))
);
const { Navigator, dist, blocked, move } = await import(
  pathToFileURL(resolve("test-results/playtest-logic.mjs"))
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const firstFloor = Number(process.env.PLAYTEST_START || 1);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(
  process.env.DEV_PLAYTEST
    ? "http://127.0.0.1:4173" + (firstFloor > 1 ? "/?qa=1" : "")
    : pathToFileURL(resolve("release/office-escape.html")).href,
);
await page.waitForFunction(() => window.__office?.ready());
if (firstFloor > 1) {
  if (!process.env.DEV_PLAYTEST)
    throw Error("Only focused development playtests may skip unlocks");
  await page.evaluate(
    ({ level, seed }) => window.__office.qa.start(level, seed),
    { level: firstFloor, seed: process.env.PLAYTEST_SEED || "focused-v2" },
  );
} else await page.getByRole("button", { name: "CLOCK OUT" }).click();
const state = () => page.evaluate(() => window.__office.snapshot());
const held = new Set();
let lastAction = -10;
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
function steering(s, target) {
  let dx = target.x - s.pos.x,
    dy = target.y - s.pos.y,
    dash = false;
  const beam = s.incidents.find(
    (h) =>
      h.shape === "beam" &&
      h.age >= h.warn &&
      Math.abs(h.x - s.pos.x) < 65 &&
      Math.abs(h.y - s.pos.y) < h.h / 2 + 10 &&
      !h.hit &&
      !h.dodged,
  );
  if (beam && s.dashCooldown === 0 && s.stamina >= 18) {
    dx = beam.x - s.pos.x;
    dy = 0;
    dash = true;
  } else {
    const circle = s.incidents.find(
      (h) =>
        h.shape !== "beam" &&
        h.age >= h.warn - 0.7 &&
        dist(h, s.pos) < h.radius + 36 &&
        !h.hit &&
        !h.dodged,
    );
    if (circle) {
      dx = s.pos.x - circle.x;
      dy = s.pos.y - circle.y;
      if (Math.hypot(dx, dy) < 5) {
        dx = target.x - s.pos.x;
        dy = target.y - s.pos.y;
      }
      dash =
        circle.age >= circle.warn && s.dashCooldown === 0 && s.stamina >= 18;
    }
  }
  const charge = s.enemies.find(
    (e) => e.specialPhase === "photo-charge" && dist(e, s.pos) < 90,
  );
  const pursuer = s.enemies
    .filter((e) => e.state === "chase" && dist(e, s.pos) < 85)
    .sort((a, b) => dist(a, s.pos) - dist(b, s.pos))[0];
  if ((charge || pursuer) && s.dashCooldown === 0 && s.stamina >= 18) {
    dash = true;
    if (pursuer) {
      dx = s.pos.x - pursuer.x;
      dy = s.pos.y - pursuer.y;
    }
  }
  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;
  let predicted = move(s.pos, dx * 28, dy * 28, 11, s.obstacles);
  if (dist(predicted, s.pos) < 4) {
    const alternatives = [
      { x: -dy, y: dx },
      { x: dy, y: -dx },
      { x: -dx, y: -dy },
    ];
    const alt = alternatives.find(
      (p) =>
        !blocked(
          { x: s.pos.x + p.x * 24, y: s.pos.y + p.y * 24 },
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
  if (Math.abs(dx) > 0.2) wanted.push(dx > 0 ? "d" : "a");
  if (Math.abs(dy) > 0.2) wanted.push(dy > 0 ? "s" : "w");
  return { wanted, dash };
}
async function defend(s) {
  if (s.elapsed < lastAction + 0.7) return;
  const near = s.enemies.filter((e) => dist(e, s.pos) < 155),
    seen = near.some((e) => e.state === "chase");
  if (!seen) return;
  if (
    !process.env.SIMPLE_CONTROLS &&
    s.level >= 4 &&
    !s.cooldowns.vpn &&
    s.incidents.some((h) => h.age >= h.warn)
  ) {
    await page.keyboard.press("5");
    lastAction = s.elapsed;
    return;
  }
  if (
    !process.env.SIMPLE_CONTROLS &&
    s.level >= 3 &&
    !s.cooldowns.calendar &&
    near.some((e) => dist(e, s.pos) < 75)
  ) {
    await page.keyboard.press("4");
    lastAction = s.elapsed;
    return;
  }
  if (
    s.level >= 2 &&
    !s.cooldowns.call &&
    near.some((e) => e.kind !== "intern" && e.kind !== "founder")
  ) {
    await page.keyboard.press("2");
    lastAction = s.elapsed;
    return;
  }
  if (s.coffee > 0 && !s.cooldowns.coffee) {
    await page.keyboard.press("1");
    lastAction = s.elapsed;
  }
}
async function go(goal, { sprint = true, limit = 25000 } = {}) {
  let path = [],
    at = 0,
    lastPos = null,
    stuck = 0,
    detourTicks = 0;
  const end = Date.now() + limit;
  while (Date.now() < end) {
    const s = await state();
    if (s.cinematic) {
      await keys([]);
      await page.waitForSelector(".hit-scene", {
        state: "detached",
        timeout: 6000,
      });
      path = [];
      continue;
    }
    if (s.ended) {
      await keys([]);
      return false;
    }
    if (dist(s.pos, goal) < 22) {
      await keys([]);
      return true;
    }
    if (!path.length || at >= path.length) {
      path = new Navigator(s.width, s.height, s.obstacles, 12).path(
        s.pos,
        goal,
      );
      at = 0;
      if (!path.length) throw Error("No path to " + JSON.stringify(goal));
    }
    while (at < path.length - 1 && dist(s.pos, path[at]) < 10) at++;
    if (lastPos && dist(lastPos, s.pos) < 0.8) stuck++;
    else stuck = 0;
    lastPos = s.pos;
    if (stuck > 12 || detourTicks > 25) {
      path = [];
      stuck = 0;
      detourTicks = 0;
      continue;
    }
    const control = steering(s, path[at]);
    if (control.dash) detourTicks++;
    const wanted = control.wanted;
    if (sprint && s.stamina > 40 && !s.active.call) wanted.push("Shift");
    await keys(wanted);
    if (control.dash) await page.keyboard.press("Space");
    await defend(s);
    await page.waitForTimeout(40);
  }
  await keys([]);
  return false;
}
function safeGoal(s) {
  const exit = s.exit;
  const candidates = [];
  for (let y = 90; y < s.height - 50; y += 100)
    for (let x = 70; x < s.width - 50; x += 110) {
      const p = { x, y };
      if (
        blocked(p, 24, s.obstacles) ||
        dist(p, exit) > 520 ||
        dist(p, s.pos) < 80
      )
        continue;
      const danger = Math.min(...s.enemies.map((e) => dist(e, p)));
      const incidents = s.incidents.reduce(
        (n, h) => n + (dist(h, p) < h.radius + 70 ? 1 : 0),
        0,
      );
      candidates.push({
        p,
        value:
          danger * 0.8 +
          Math.min(180, dist(s.pos, p)) * 0.3 -
          dist(p, exit) * 0.08 -
          incidents * 200,
      });
    }
  return (
    candidates.sort((a, b) => b.value - a.value)[0]?.p || { x: 1030, y: 400 }
  );
}
try {
  const floors = Number(process.env.PLAYTEST_FLOORS || 5);
  const attempts = {};
  for (let level = firstFloor; level <= floors; level++) {
    await page.waitForFunction(
      (l) =>
        window.__office.snapshot().level === l &&
        window.__office.snapshot().elapsed > 0.15,
      level,
    );
    lastAction = -10;
    attempts[level] = (attempts[level] || 0) + 1;
    let s = await state();
    // After a failed attempt, use actual optional sabotage rather than rerolling
    // or mutating health. The game's retry preserves the same opening seed.
    if (attempts[level] > 1) {
      const tool = LEVELS[level - 1].interactions.find(
        (i) => i.type === "switch",
      );
      if (tool) {
        await go(tool, { limit: 12000 });
        await keys([]);
        await page.keyboard.press("e");
      }
    }
    s = await state();
    await go(s.exit, { limit: 40000 });
    await keys([]);
    await page.keyboard.press("e");
    await page.waitForTimeout(80);
    s = await state();
    if (s.phase === "find-lift" && !s.ended) throw Error("Did not call lift");
    const deadline = Date.now() + 100000;
    let coffeeVisit = -100;
    while (Date.now() < deadline) {
      s = await state();
      if (s.ended) break;
      if (s.cinematic) {
        await keys([]);
        await page.waitForSelector(".hit-scene", {
          state: "detached",
          timeout: 6000,
        });
        continue;
      }
      const current = LEVELS[level - 1];
      if (s.wfhActive && current.altExit) {
        await go(
          {
            x: current.altExit.x + current.altExit.w / 2,
            y: current.altExit.y + current.altExit.h / 2,
          },
          { limit: 12000 },
        );
        continue;
      }
      if (s.wfh > 0 && s.bs > 45 && s.eta > 8) {
        await page.keyboard.press("6");
        continue;
      }
      if (s.bs > 35 && s.eta > 9 && s.elapsed - coffeeVisit > 22) {
        const station = current.interactions.find((i) => i.type === "coffee");
        if (station) {
          coffeeVisit = s.elapsed;
          await go(station, { limit: 6000 });
          const latest = await state();
          if (dist(latest.pos, station) < 45) await page.keyboard.press("e");
          continue;
        }
      }
      const close = s.enemies
        .filter((e) => e.state === "chase" && dist(e, s.pos) < 90)
        .sort((a, b) => dist(a, s.pos) - dist(b, s.pos))[0];
      if (close && s.phase === "waiting") {
        const dx = s.pos.x - close.x,
          dy = s.pos.y - close.y,
          len = Math.hypot(dx, dy) || 1;
        const flee = [
          { x: s.pos.x + (dx / len) * 90, y: s.pos.y + (dy / len) * 90 },
          { x: s.pos.x - (dy / len) * 90, y: s.pos.y + (dx / len) * 90 },
          { x: s.pos.x + (dy / len) * 90, y: s.pos.y - (dx / len) * 90 },
        ].find(
          (p) =>
            p.x > 35 &&
            p.x < s.width - 35 &&
            p.y > 35 &&
            p.y < s.height - 35 &&
            !blocked(p, 14, s.obstacles),
        );
        if (flee) {
          await go(flee, { limit: 900 });
          continue;
        }
      }
      if (s.phase === "boarding") {
        await go(s.exit, { sprint: true, limit: 8000 });
      } else if (s.eta < 5.5) {
        const candidates = [
          { x: s.exit.x, y: s.exit.y + 120 },
          { x: s.exit.x - 110, y: s.exit.y + 120 },
          { x: s.exit.x - 140, y: s.exit.y + 40 },
          { x: s.exit.x + 30, y: s.exit.y + 80 },
        ];
        const staging =
          candidates.find((p) => !blocked(p, 22, s.obstacles)) || s.exit;
        if (s.eta > 2.5) await go(staging, { limit: 1800 });
        else await go(s.exit, { limit: 1800 });
      } else {
        await go(safeGoal(s), { sprint: s.stamina > 60, limit: 2200 });
      }
    }
    await keys([]);
    s = await state();
    await page.screenshot({
      path: `test-results/v2-campaign-floor-${level}.png`,
    });
    if (!s.ended || s.bs >= 100) {
      results.push({
        level,
        attempt: attempts[level],
        win: false,
        time: s.elapsed,
        bs: s.bs,
        spots: s.spots,
        hits: s.hits,
        dodges: s.dodges,
        realInputsOnly: true,
      });
      console.log("CAUGHT — RETRYING WITH SABOTAGE", results.at(-1));
      if (s.ended && attempts[level] < 3) {
        await page.getByRole("button", { name: "RETRY INSTANTLY" }).click();
        level--;
        continue;
      }
      throw Error("Campaign failed after bounded attempts on floor " + level);
    }
    await page
      .getByRole("heading", {
        name: level === 5 ? "YOU HAVE A LIFE." : "OUT OF OFFICE.",
      })
      .waitFor();
    results.push({
      level,
      attempt: attempts[level],
      win: true,
      time: s.elapsed,
      bs: s.bs,
      spots: s.spots,
      hits: s.hits,
      dodges: s.dodges,
      route: s.wfhActive ? "WFH" : "lift",
      realInputsOnly: true,
    });
    console.log("ESCAPED", results.at(-1));
    if (level < floors)
      await page.getByRole("button", { name: "NEXT FLOOR" }).click();
  }
  await writeFile(
    "test-results/campaign-playtest.json",
    JSON.stringify(
      {
        ruleset: 2,
        simpleControls: !!process.env.SIMPLE_CONTROLS,
        checkedAt: new Date().toISOString(),
        errors,
        results,
      },
      null,
      2,
    ),
  );
  if (errors.length) throw Error(errors.join("\n"));
} catch (e) {
  await keys([]);
  await page.screenshot({ path: "test-results/v2-campaign-failure.png" });
  await writeFile(
    "test-results/v2-campaign-failure.json",
    JSON.stringify(await state(), null, 2),
  );
  console.error("FAIL", e.message);
  throw e;
} finally {
  await browser.close();
}
