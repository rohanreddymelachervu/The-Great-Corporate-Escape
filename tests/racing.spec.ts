import { test, expect, Page } from "@playwright/test";
declare global {
  interface Window {
    __sprint: any;
  }
}
import { SPRINT_COURSES } from "../src/sprint/courses";
import { dailyRace, formatRaceTime, SprintRun } from "../src/sprint/model";
async function ready(p: Page) {
  await p.goto("/?qa=1");
  await p.waitForFunction(() => window.__office?.ready());
}
async function start(
  p: Page,
  mode: "sprint" | "buzzword" = "sprint",
  courseId = 1,
  day = "2026-11-04",
) {
  await p.evaluate((o) => window.__sprint.qa.start(o), { mode, courseId, day });
  await p.waitForFunction(
    () =>
      window.__sprint.ready() && window.__sprint.snapshot().phase === "running",
  );
}
const state = (p: Page) => p.evaluate(() => window.__sprint.snapshot());
async function pos(p: Page, x: number, y: number) {
  await p.evaluate(([x, y]) => window.__sprint.qa.position(x, y), [x, y]);
  await p.waitForTimeout(45);
}
test("both racing modes are separate, visible and all ten sprint courses are selectable", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Clock Out Sprint", exact: true })
    .click();
  await expect(page.locator("[data-race-course]")).toHaveCount(10);
  await expect(page.locator("#race-modal")).toContainText("No stolen items");
  await page.locator('[data-race-course="10"]').click();
  await page.waitForFunction(
    () => window.__sprint.snapshot()?.phase === "running",
  );
  expect((await state(page)).courseId).toBe(10);
  await expect(page.locator("#hud")).toBeHidden();
  await expect(page.locator("#control-dock")).toBeHidden();
  await expect(page.locator("#race-top")).toBeVisible();
  expect((await state(page)).letters).toEqual([]);
});
test("sprint movement and Space dodge work, and there is no health/stamina/loot score", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await page.keyboard.down("d");
  const before = await state(page);
  await page.keyboard.press("Space");
  await page.waitForFunction(() => window.__sprint.snapshot().dashCooldown > 0);
  await page.waitForTimeout(180);
  await page.keyboard.up("d");
  const after = await state(page);
  expect(after.pos.x - before.pos.x).toBeGreaterThan(55);
  expect(after).not.toHaveProperty("bs");
  expect(after).not.toHaveProperty("stamina");
  expect(after).not.toHaveProperty("lootValue");
  expect(after.elapsed).toBeGreaterThan(before.elapsed);
});
test("capture shows a real red jargon punishment, stops race time and resets same patterns quickly", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  const before = await state(page),
    g = before.guards[0];
  await pos(page, g.x, g.y);
  await expect(page.locator(".race-punishment")).toBeVisible();
  await expect(page.locator(".race-jargon-wall")).toContainText("CIRCLE BACK");
  await expect(page.locator("#race-modal")).toContainText("QUICKLY");
  const frozen = (await state(page)).elapsed;
  await page.waitForTimeout(200);
  expect((await state(page)).elapsed).toBe(frozen);
  await page.waitForFunction(
    () => window.__sprint.snapshot().phase === "countdown",
    {},
    { timeout: 2500 },
  );
  expect((await state(page)).elapsed).toBe(0);
  expect((await state(page)).courseId).toBe(1);
  expect((await state(page)).guards[0].x).toBeCloseTo(
    new SprintRun(SPRINT_COURSES[0], { mode: "sprint", courseId: 1 }).guards[0]
      .x,
    6,
  );
});
test("pause, shared sound settings and focus loss do not advance the stopwatch", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await page.keyboard.press("Escape");
  const frozen = (await state(page)).elapsed;
  await page.waitForTimeout(250);
  expect((await state(page)).elapsed).toBe(frozen);
  await page.locator("#race-resume").click();
  await page.waitForTimeout(80);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settingsTime = (await state(page)).elapsed;
  await page.waitForTimeout(250);
  expect((await state(page)).elapsed).toBe(settingsTime);
  await page.getByLabel("Mute all audio").check();
  await page.getByRole("button", { name: "DONE", exact: false }).click();
  await page.waitForFunction(
    (t) => window.__sprint.snapshot().elapsed > t,
    settingsTime,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurred = (await state(page)).elapsed;
  await page.waitForTimeout(180);
  expect((await state(page)).elapsed).toBe(blurred);
  await expect(page.locator("#race-resume")).toBeVisible();
});
test("an open sprint exit finishes immediately and stores only a raw time in racing records", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  const s = await state(page);
  await pos(page, s.exit.x + s.exit.w / 2, s.exit.y + s.exit.h / 2);
  await expect(page.locator("#race-next")).toBeVisible();
  const result = (await state(page)).result;
  expect(result).not.toHaveProperty("score");
  expect(result.mode).toBe("sprint");
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("office-escape-races-v1")!).bests[
        "sprint:1"
      ],
  );
  expect(saved.time).toBe(result.time);
  await expect(page.locator(".race-finish-time")).toHaveText(
    formatRaceTime(result.time),
  );
  await expect(page.locator(".race-review")).toContainText(
    "Compensation remains unchanged",
  );
  await page.locator("#race-next").click();
  await page.waitForFunction(
    () =>
      window.__sprint.snapshot().courseId === 2 &&
      window.__sprint.snapshot().phase === "running",
  );
});
test("Buzzword Run is UTC-daily, collects automatically in any order and refuses an incomplete exit", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-04T10:00:00Z") });
  await ready(page);
  await page.getByRole("button", { name: "Buzzword Run", exact: true }).click();
  await expect(page.locator("#race-modal")).toContainText("letter badges");
  await page.locator("#buzzword-start").click();
  await page.waitForFunction(
    () => window.__sprint.snapshot()?.phase === "running",
  );
  let s = await state(page),
    day = "2026-11-04";
  const d = dailyRace(day, SPRINT_COURSES);
  expect(s.options.day).toBe(day);
  expect(s.letters.map((l: any) => l.char).join("")).toBe(d.word.word);
  await pos(page, s.exit.x + s.exit.w / 2, s.exit.y + s.exit.h / 2);
  expect((await state(page)).phase).toBe("running");
  await expect(page.locator("#race-notice")).toContainText(
    "Collect every letter",
  );
  for (const letter of [...s.letters].reverse()) {
    await pos(page, letter.x, letter.y);
  }
  s = await state(page);
  expect(s.letters.every((l: any) => l.collected)).toBe(true);
  await expect(page.locator("#race-letter-count")).toContainText(
    `${s.letters.length}/${s.letters.length}`,
  );
  await pos(page, s.exit.x + s.exit.w / 2, s.exit.y + s.exit.h / 2);
  await expect(page.locator(".race-revealed-word")).toHaveText(d.word.word);
  await expect(page.locator("#race-modal")).toContainText(d.word.joke);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("office-escape-races-v1")!).bests,
  );
  expect(Object.keys(saved)).toHaveLength(1);
  expect(Object.keys(saved)[0]).toContain("buzzword:");
});
test("Buzzword retry clears letters and clock but preserves that day’s layout and word", async ({
  page,
}) => {
  await ready(page);
  await start(page, "buzzword");
  const before = await state(page),
    l = before.letters[0];
  await pos(page, l.x, l.y);
  expect((await state(page)).letters[0].collected).toBe(true);
  await page.keyboard.press("r");
  await page.waitForFunction(
    () => window.__sprint.snapshot().phase === "countdown",
  );
  const after = await state(page);
  expect(after.elapsed).toBe(0);
  expect(
    after.letters.map((l: any) => ({ x: l.x, y: l.y, char: l.char })),
  ).toEqual(before.letters.map((l: any) => ({ x: l.x, y: l.y, char: l.char })));
  expect(after.letters.some((l: any) => l.collected)).toBe(false);
});
test("switching races back to the existing heist preserves its controls, progress and difficulty", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await page.locator("#home-link").click();
  await expect(page.locator("#menu")).toBeVisible();
  await page.locator("#play-btn").click();
  await page.waitForFunction(
    () =>
      window.__office.snapshot().level === 1 &&
      window.__office.snapshot().elapsed > 0.3 &&
      document.body.classList.contains("playing"),
  );
  expect((await page.evaluate(() => window.__office.snapshot())).width).toBe(
    1600,
  );
  await page.keyboard.down("d");
  await page.keyboard.press("Space");
  await page.waitForTimeout(220);
  await page.keyboard.up("d");
  expect(
    (await page.evaluate(() => window.__office.snapshot())).dashCooldown,
  ).toBeGreaterThan(0);
  await expect(page.locator("#race-top")).toBeHidden();
  await expect(page.locator("#hud")).toBeVisible();
});
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])
  test(`racing HUD, touch input and red retry are usable at ${viewport.width}×${viewport.height}`, async ({
    browser,
  }) => {
    const c = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    const page = await c.newPage();
    await ready(page);
    await start(page);
    const before = await state(page),
      joy = await page.locator("#race-joystick").boundingBox();
    expect(joy).not.toBeNull();
    await page.mouse.move(
      joy!.x + joy!.width / 2 + 24,
      joy!.y + joy!.height / 2,
    );
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.locator("#race-touch-dash").tap();
    await page.waitForTimeout(190);
    await page.mouse.up();
    expect((await state(page)).pos.x - before.pos.x).toBeGreaterThan(50);
    const layout = await page.evaluate(() => {
      const boxes = ["#race-top", "#game", "#race-dock"].map((s) =>
        document.querySelector(s)!.getBoundingClientRect(),
      );
      const overlap = (a: DOMRect, b: DOMRect) =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      return {
        overlap: overlap(boxes[0], boxes[1]) || overlap(boxes[1], boxes[2]),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(layout.overlap).toBe(false);
    expect(layout.overflow).toBe(false);
    const s = await state(page);
    await pos(page, s.guards[0].x, s.guards[0].y);
    await expect(page.locator(".race-punishment")).toBeVisible();
    const retry = await page.locator("#race-retry-now").boundingBox();
    expect(retry!.height).toBeGreaterThanOrEqual(44);
    expect(retry!.x).toBeGreaterThanOrEqual(0);
    expect(retry!.x + retry!.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: `test-results/race-mobile-${viewport.width}.png`,
    });
    await c.close();
  });

test("losing focus during countdown or a punishment screen cannot advance time or auto-retry unseen", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.__sprint.qa.start({ mode: "sprint", courseId: 1 }),
  );
  await page.waitForFunction(
    () =>
      window.__sprint.ready() &&
      window.__sprint.snapshot().phase === "countdown",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const count = (await state(page)).countdown;
  await page.waitForTimeout(400);
  expect((await state(page)).countdown).toBe(count);
  expect((await state(page)).elapsed).toBe(0);
  await page.locator("#race-resume").click();
  await page.waitForFunction(
    () => window.__sprint.snapshot().phase === "running",
  );
  const g = (await state(page)).guards[0];
  await pos(page, g.x, g.y);
  await expect(page.locator(".race-punishment")).toBeVisible();
  await page.getByRole("button", { name: "Pause game" }).click();
  const age = (await state(page)).failureAge;
  await page.waitForTimeout(1300);
  expect((await state(page)).phase).toBe("failed");
  expect((await state(page)).failureAge).toBe(age);
  await page.locator("#race-resume").click();
  await page.waitForFunction(
    () => window.__sprint.snapshot().phase === "countdown",
    {},
    { timeout: 3000 },
  );
});
