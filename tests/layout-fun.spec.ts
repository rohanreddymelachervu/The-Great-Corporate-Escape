import { test, expect, Page } from "@playwright/test";
async function load(page: Page) {
  await page.goto("/?qa=1");
  await page.waitForFunction(() => window.__office?.ready());
}
async function clapRound(page: Page, hit = true) {
  await page.waitForFunction(() => {
    const b = document.getElementById("clap-btn") as HTMLButtonElement | null;
    return b && !b.disabled;
  });
  if (hit)
    await page.waitForFunction(() => {
      const b = document.getElementById("clap-btn") as HTMLButtonElement | null;
      const marker = document.getElementById("fun-marker");
      const p = Number.parseFloat(marker?.style.left || "0");
      return b && !b.disabled && p >= 49 && p <= 61;
    });
  await page.keyboard.press("Space");
}
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 960, height: 640 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])
  test(`HUD, map, controls and feedback do not overlap at ${viewport.width}×${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width === 390 || viewport.height === 390,
      hasTouch: viewport.width === 390 || viewport.height === 390,
    });
    const page = await context.newPage();
    await load(page);
    await page.locator("#play-btn").click();
    await page.waitForTimeout(500);
    const layout = await page.evaluate(() => {
      const box = (id: string) => {
        const r = document.querySelector(id)!.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          w: r.width,
          h: r.height,
        };
      };
      const ids = ["#game", "#hud", "#control-dock"];
      const rects = ids.map(box);
      const intersects = (
        a: (typeof rects)[number],
        b: (typeof rects)[number],
      ) =>
        Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
      const canvas = document.querySelector("canvas")!,
        map = box("#game");
      return {
        overlap:
          intersects(rects[0], rects[1]) ||
          intersects(rects[0], rects[2]) ||
          intersects(rects[1], rects[2]),
        map,
        canvas: { w: canvas.width, h: canvas.height },
        objectiveFont: Number.parseFloat(
          getComputedStyle(document.querySelector("#objectives")!).fontSize,
        ),
        buttons: [
          ...document.querySelectorAll<HTMLButtonElement>(".ability"),
        ].map((b) => ({
          w: b.getBoundingClientRect().width,
          h: b.getBoundingClientRect().height,
        })),
        toastInRail: document
          .getElementById("hud")!
          .contains(document.getElementById("toast")),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(layout.overlap).toBe(false);
    expect(layout.toastInRail).toBe(true);
    expect(layout.overflow).toBe(false);
    expect(layout.map.w).toBeGreaterThan(220);
    expect(layout.map.h).toBeGreaterThan(160);
    expect(Math.abs(layout.canvas.w - layout.map.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.canvas.h - layout.map.h)).toBeLessThanOrEqual(1);
    expect(layout.objectiveFont).toBeGreaterThanOrEqual(11);
    for (const b of layout.buttons) {
      expect(b.w).toBeGreaterThanOrEqual(44);
      expect(b.h).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: `test-results/clear-layout-${viewport.width}.png`,
    });
    await context.close();
  });
test("HR bonus game is immediately playable and has real timing, score and best record", async ({
  page,
}) => {
  await load(page);
  await page.getByRole("button", { name: "CLAP PRACTICE" }).click();
  await expect(
    page.getByRole("heading", { name: "CLAP FOR THE CULTURE." }),
  ).toBeVisible();
  const target = await page.locator(".fun-target").boundingBox(),
    track = await page.locator(".fun-track").boundingBox();
  expect(target!.x).toBeGreaterThan(track!.x + track!.width * 0.4);
  await page.getByRole("button", { name: "START ACTIVITY" }).click();
  for (let i = 0; i < 5; i++) await clapRound(page);
  await expect(page.locator("#fun-line")).toHaveText(
    "CULTURE HACKED. WEEKEND PROTECTED.",
  );
  await expect(page.locator("#fun-score")).toContainText("5 / 5");
  expect(
    await page.evaluate(() => Number(localStorage.getItem("office-fun-best"))),
  ).toBeGreaterThan(200);
  await page.getByRole("button", { name: "BACK TO THE OFFICE MENU" }).click();
  await expect(page.locator("#menu")).toBeVisible();
});
test("HR in-world activity pauses pursuit and grants actual BS, coffee and distraction rewards", async ({
  page,
}) => {
  await load(page);
  await page.evaluate(() => window.__office.qa.start(2));
  await page.waitForFunction(() => window.__office.snapshot().level === 2);
  await page.evaluate(() => {
    window.__office.qa.bs(50);
    window.__office.qa.position(350, 600);
  });
  await page.waitForFunction(
    () => window.__office.snapshot().target === "l2-fun-friday",
  );
  await page.keyboard.press("e");
  await expect(page.locator(".fun-stage")).toBeVisible();
  const frozen = await page.evaluate(() => window.__office.snapshot());
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.__office.snapshot())).elapsed).toBe(
    frozen.elapsed,
  );
  await page.getByRole("button", { name: "START ACTIVITY" }).click();
  for (let i = 0; i < 5; i++) await clapRound(page);
  await page.getByRole("button", { name: "RETURN TO YOUR ESCAPE" }).click();
  const after = await page.evaluate(() => window.__office.snapshot());
  expect(after.bs).toBe(25);
  expect(after.coffee).toBe(3);
  expect(after.funScore).toBeGreaterThan(200);
  expect(after.funCompleted).toContain("l2-fun-friday");
  expect(after.enemies.find((e: any) => e.kind === "hr").state).toBe(
    "distracted",
  );
  await page.waitForFunction(
    (t) => window.__office.snapshot().elapsed > t,
    after.elapsed,
  );
  await page.keyboard.press("e");
  await expect(page.locator("#modal-root")).toBeHidden();
  await expect(page.locator("#toast")).toContainText(
    "ENGAGEMENT ALREADY MEASURED",
  );
});
test("missing HR activity beats has a real modest consequence and can be closed safely", async ({
  page,
}) => {
  await load(page);
  await page.evaluate(() => window.__office.qa.start(2));
  await page.waitForFunction(() => window.__office.snapshot().level === 2);
  await page.evaluate(() => {
    window.__office.qa.bs(40);
    window.__office.qa.position(350, 600);
  });
  await page.waitForFunction(
    () => window.__office.snapshot().target === "l2-fun-friday",
  );
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "START ACTIVITY" }).click();
  for (let i = 0; i < 5; i++) await clapRound(page, false);
  await expect(page.locator("#fun-line")).toContainText("GROWTH POTENTIAL");
  await page.getByRole("button", { name: "RETURN TO YOUR ESCAPE" }).click();
  expect((await page.evaluate(() => window.__office.snapshot())).bs).toBe(48);
});
