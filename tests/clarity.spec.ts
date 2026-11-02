import { test, expect, Page } from "@playwright/test";
import { blocked } from "../src/game/logic";
const state = (p: Page) => p.evaluate(() => window.__office.snapshot());
async function ready(p: Page, level = 1, seed = "clarity-v22") {
  await p.goto("/?qa=1");
  await p.waitForFunction(() => window.__office?.ready());
  await p.evaluate(({ level, seed }) => window.__office.qa.start(level, seed), {
    level,
    seed,
  });
  await p.waitForFunction(
    (l) =>
      window.__office.snapshot().level === l &&
      window.__office.snapshot().elapsed > 0.15,
    level,
  );
}
async function pos(p: Page, x: number, y: number) {
  await p.evaluate(([x, y]) => window.__office.qa.position(x, y), [x, y]);
  await p.waitForTimeout(120);
}
test("only primary tools are shown; optional More Tools pauses, explains and activates once", async ({
  page,
}) => {
  await ready(page, 4);
  await expect(page.locator("#ability-bar [data-ability]")).toHaveCount(2);
  await expect(page.locator("#ability-bar")).toContainText("FAKE CALL");
  await expect(page.locator('[data-ability="slack"]')).toHaveCount(0);
  await page.getByRole("button", { name: "More tools", exact: true }).click();
  const before = await state(page);
  await page.waitForTimeout(250);
  expect((await state(page)).elapsed).toBe(before.elapsed);
  await expect(page.locator(".advanced-tool-grid")).toContainText(
    "Look Busy — stay still",
  );
  await expect(page.locator(".advanced-tool-grid")).toContainText(
    "Meeting Shield",
  );
  await expect(page.locator(".advanced-tool-grid")).toContainText(
    "Office Freeze",
  );
  await page.locator('[data-use-tool="vpn"]').click();
  await expect(page.locator("#modal-root")).toBeHidden();
  await page.waitForFunction(() => window.__office.snapshot().active.vpn > 0);
  expect((await state(page)).cooldowns.vpn).toBeGreaterThan(34);
  await expect(page.locator("#more-tools small")).toContainText("ACTIVE");
});
test("advanced shortcuts remain available without opening More Tools", async ({
  page,
}) => {
  await ready(page, 4);
  await page.keyboard.press("4");
  await page.waitForFunction(
    () => window.__office.snapshot().active.calendar > 0,
  );
  expect((await state(page)).active.calendar).toBeLessThanOrEqual(3.5);
  await expect(page.locator("#modal-root")).toBeHidden();
});
test("short context hints can be dismissed without stopping play, and switched off", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator("#tip-dismiss")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#toast")).toContainText("E calls it");
  const before = (await state(page)).elapsed;
  await page.getByRole("button", { name: "Dismiss tip" }).click();
  await page.waitForFunction(
    (t) => window.__office.snapshot().elapsed > t,
    before,
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Context tips").uncheck();
  await page.getByRole("button", { name: "DONE" }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("office-escape-v1")!).settings.tips,
    ),
  ).toBe(false);
});
test("one highlighted loot object has one clear E prompt instead of a screenful of labels", async ({
  page,
}) => {
  await ready(page);
  expect((await state(page)).labelledLoot).toEqual([]);
  const tv = (await state(page)).items.find((i: any) => i.kind === "tv");
  await pos(page, tv.x, tv.y);
  await page.waitForFunction(
    () => window.__office.snapshot().labelledLoot.length === 1,
  );
  const s = await state(page);
  expect(s.labelledLoot).toEqual([tv.id]);
  expect(s.lootTarget).toBe(tv.id);
  await expect(page.locator("#field-status")).toContainText("HOLD E");
  await pos(page, 90, 700);
  await page.waitForFunction(
    () => window.__office.snapshot().labelledLoot.length === 0,
  );
});
test("picking up a WFH token opens its exit automatically with no numbered action", async ({
  page,
}) => {
  await ready(page, 5);
  const token = (await state(page)).items.find((i: any) => i.kind === "wfh");
  await pos(page, token.x, token.y);
  expect((await state(page)).wfhActive).toBe(true);
  await expect(page.locator("#objectives")).toContainText("WFH APPROVED");
  await expect(page.locator('[data-ability="wfh"]')).toHaveCount(0);
  await pos(page, 1035, 705);
  await expect(
    page.getByRole("heading", { name: "YOU HAVE A LIFE." }),
  ).toBeVisible();
});
test("intern and founder naturally meet, animate a conversation, and return to the same office roles", async ({
  page,
}) => {
  await ready(page, 5, "social-natural");
  await page.waitForFunction(
    () => window.__office.snapshot().social?.phase === "talking",
    {},
    { timeout: 20000 },
  );
  let s = await state(page),
    chat = s.social;
  const pair = s.enemies.filter((_: any, i: number) =>
    [chat.internId, chat.founderId].includes(String(i)),
  );
  expect(pair.map((e: any) => e.state)).toEqual(["distracted", "distracted"]);
  const middle = {
    x: (pair[0].x + pair[1].x) / 2,
    y: (pair[0].y + pair[1].y) / 2,
  };
  const point = [
    { x: middle.x, y: middle.y + 85 },
    { x: middle.x, y: middle.y - 85 },
    { x: middle.x + 90, y: middle.y },
  ].find((p) => !blocked(p, 14, s.obstacles));
  expect(point).toBeTruthy();
  await pos(page, point!.x, point!.y);
  await page.waitForFunction(
    () => window.__office.snapshot().chatCaption.length > 0,
  );
  const caption = (await state(page)).chatCaption;
  await page.waitForFunction(
    (old) => {
      const s = window.__office.snapshot();
      return s.chatCaption && s.chatCaption !== old;
    },
    caption,
    { timeout: 5000 },
  );
  await page.screenshot({ path: "test-results/intern-founder-chat.png" });
  await page.waitForFunction(
    () => window.__office.snapshot().social === null,
    {},
    { timeout: 14000 },
  );
  s = await state(page);
  expect(s.conversations).toBe(1);
  expect(
    s.enemies.filter((e: any) => e.kind === "intern" || e.kind === "founder"),
  ).toHaveLength(2);
});
test("incident report is optional after a run and reflects actual events rather than invented actions", async ({
  page,
}) => {
  await ready(page, 5);
  const snack = (await state(page)).items.find((i: any) => i.kind === "snacks");
  await pos(page, snack.x, snack.y);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => window.__office.snapshot().lootValue === 100,
  );
  const token = (await state(page)).items.find((i: any) => i.kind === "wfh");
  await pos(page, token.x, token.y);
  await pos(page, 1035, 705);
  await expect(
    page.getByRole("heading", { name: "YOU HAVE A LIFE." }),
  ).toBeVisible();
  await expect(page.locator(".incident-report")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.locator(".incident-report summary").click();
  await expect(page.locator(".incident-report")).toContainText("Snack stash");
  await expect(page.locator(".incident-report")).toContainText(
    "100 loot points",
  );
  await expect(
    page.getByRole("button", { name: "SHARE REPORT" }),
  ).toBeVisible();
});
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])
  test(`primary tools and optional drawer stay usable at ${viewport.width}×${viewport.height}`, async ({
    browser,
  }) => {
    const c = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    const page = await c.newPage();
    await ready(page, 5);
    const boxes = await page
      .locator("#ability-bar > .ability")
      .evaluateAll((elements) =>
        elements.map((e) => {
          const r = e.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }),
      );
    expect(boxes).toHaveLength(4);
    for (const b of boxes) {
      expect(b.w).toBeGreaterThanOrEqual(44);
      expect(b.h).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "More tools", exact: true }).tap();
    await expect(page.locator(".advanced-tool-grid")).toBeVisible();
    await page.getByRole("button", { name: "BACK WITHOUT USING A TOOL" }).tap();
    await expect(page.locator("#modal-root")).toBeHidden();
    await c.close();
  });
