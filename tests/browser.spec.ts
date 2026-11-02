import { test, expect, Page } from "@playwright/test";
import { LEVELS } from "../src/game/levels";
import { EscapeDirector } from "../src/game/director";
import { blocked, visible } from "../src/game/logic";
declare global {
  interface Window {
    __office: any;
  }
}
const state = (p: Page) => p.evaluate(() => window.__office.snapshot());
async function ready(p: Page, clock = false) {
  if (clock) await p.clock.install();
  await p.goto("/?qa=1");
  await p.waitForFunction(() => window.__office?.ready());
}
async function start(p: Page, level = 1, seed = "browser-v2") {
  await p.evaluate(({ level, seed }) => window.__office.qa.start(level, seed), {
    level,
    seed,
  });
  await p.waitForFunction(
    (l) =>
      window.__office.snapshot().level === l &&
      window.__office.snapshot().elapsed > 0.1,
    level,
  );
}
async function position(p: Page, x: number, y: number) {
  await p.evaluate(([x, y]) => window.__office.qa.position(x, y), [x, y]);
  await p.waitForTimeout(60);
}
async function atLift(p: Page) {
  const e = (await state(p)).exit;
  await position(p, e.x, e.y);
}
function photoSeed() {
  for (let i = 0; i < 30; i++) {
    const seed = "photo-test-" + i,
      d = new EscapeDirector(LEVELS[0], seed);
    d.callLift();
    d.update(0, {
      player: { x: 1015, y: 100 },
      dashing: false,
      hidden: false,
      shield: false,
      vpn: false,
    });
    if (d.incidents[0]?.kind === "photo") return seed;
  }
  throw Error("No photo seed");
}

test("menu explains the real loop and HR quick play starts an actual office escape", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".escape-route")).toContainText("Call the lift");
  await page.getByRole("button", { name: "HOW TO ESCAPE" }).click();
  await expect(page.locator("#modal-root")).toContainText(
    "not compulsory errands",
  );
  await page.getByRole("button", { name: "GOT IT. LEAVING." }).click();
  await page.getByRole("button", { name: "ACHIEVEMENTS" }).click();
  await expect(page.locator(".achievement")).toHaveCount(16);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "DODGE HR" }).click();
  await page.waitForFunction(() => window.__office.snapshot().level === 2);
  await expect(page.locator("#objectives")).toContainText("CALL THE LIFT");
  expect((await state(page)).enemies.some((e: any) => e.kind === "hr")).toBe(
    true,
  );
});

test("movement, short directional dodge, stamina and walls are functional", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(150);
  const before = await state(page);
  await page.keyboard.press("Space");
  await page.waitForFunction(() => window.__office.snapshot().dashCooldown > 0);
  await page.waitForFunction(() => !window.__office.snapshot().dashing);
  await page.keyboard.up("d");
  const after = await state(page);
  expect(after.pos.x - before.pos.x).toBeGreaterThan(65);
  expect(after.stamina).toBeLessThan(99);
  expect(after.dashCooldown).toBeGreaterThan(1);
  await position(page, 40, 700);
  await page.waitForTimeout(1600);
  await page.keyboard.down("a");
  await page.keyboard.press("Space");
  await page.waitForTimeout(220);
  await page.keyboard.up("a");
  expect((await state(page)).pos.x).toBeGreaterThanOrEqual(34);
  const atWall = (await state(page)).pos.x;
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(220);
  await page.keyboard.up("ArrowRight");
  expect((await state(page)).pos.x).toBeGreaterThan(atWall + 20);
});

test("calling the lift starts a wait, not an instant badge-and-switch victory; pause freezes it", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await atLift(page);
  expect((await state(page)).phase).toBe("find-lift");
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => window.__office.snapshot().phase === "waiting",
  );
  expect((await state(page)).eta).toBeGreaterThan(18);
  expect((await state(page)).ended).toBe(false);
  await expect(page.locator("#objectives")).toContainText("LIFT IN");
  await page.keyboard.press("Escape");
  const frozen = await state(page);
  await page.waitForTimeout(500);
  expect((await state(page)).eta).toBe(frozen.eta);
  await page.getByRole("button", { name: "RESTART FLOOR" }).click();
  await page.waitForFunction(
    () => window.__office.snapshot().phase === "find-lift",
  );
  expect((await state(page)).coffee).toBe(2);
  expect((await state(page)).bs).toBe(0);
});

test("early interference gives warning before damage and punishes camping at the lift", async ({
  page,
}) => {
  await ready(page, true);
  await start(page, 1, photoSeed());
  await atLift(page);
  await page.keyboard.press("e");
  await page.clock.runFor(700);
  let s = await state(page);
  expect(s.incidents.length).toBeGreaterThan(0);
  expect(s.bs).toBe(0);
  expect(s.incidents[0].age).toBeLessThan(s.incidents[0].warn);
  await page.clock.runFor(8000);
  s = await state(page);
  expect(s.bs).toBeGreaterThan(0);
  expect(s.phase).toBe("waiting");
  expect(
    s.hits > 0 ||
      s.spots > 0 ||
      s.enemies.some(
        (e: any) => e.state === "chase" || e.specialPhase !== "none",
      ),
  ).toBe(true);
});

test("SPACE can dodge an actual moving HR photo sweep and earns a real score bonus", async ({
  page,
}) => {
  await ready(page, true);
  await start(page, 1, photoSeed());
  await atLift(page);
  await page.keyboard.press("e");
  await page.clock.runFor(2400);
  const before = await state(page),
    beam = before.incidents.find((h: any) => h.kind === "photo");
  expect(beam).toBeTruthy();
  await position(page, beam.x + 70, beam.y);
  await page.keyboard.down("a");
  await page.clock.runFor(16);
  await page.keyboard.press("Space");
  await page.clock.runFor(190);
  await page.keyboard.up("a");
  const after = await state(page);
  expect(after.dodges).toBeGreaterThanOrEqual(1);
  expect(after.bs).toBe(before.bs);
  expect(after.dashCooldown).toBeGreaterThan(1);
});

test("HR visibly locks a photo-charge aim and a real dodge can evade the lunge", async ({
  page,
}) => {
  await ready(page, true);
  await start(page, 1, "hr-lunge");
  const s = await state(page),
    hr = s.enemies.find((e: any) => e.kind === "hr");
  const candidates = [0, 0.2, -0.2, 0.45, -0.45].map((a) => ({
    x: hr.x + Math.cos(hr.angle + a) * 210,
    y: hr.y + Math.sin(hr.angle + a) * 210,
  }));
  const p = candidates.find(
    (p) =>
      p.x > 35 &&
      p.x < s.width - 35 &&
      p.y > 35 &&
      p.y < s.height - 35 &&
      !blocked(p, 13, s.obstacles) &&
      visible(hr, p, s.obstacles),
  );
  expect(p).toBeTruthy();
  await position(page, p!.x, p!.y);
  for (let i = 0; i < 30; i++) {
    await page.clock.runFor(100);
    if (
      (await state(page)).enemies.find((e: any) => e.kind === "hr")
        .specialPhase === "photo-windup"
    )
      break;
  }
  const tell = (await state(page)).enemies.find((e: any) => e.kind === "hr");
  expect(tell.specialPhase).toBe("photo-windup");
  expect(tell.aim).toBeTruthy();
  await page.keyboard.down("d");
  await page.keyboard.press("Space");
  await page.clock.runFor(250);
  await page.keyboard.up("d");
  const moved = await state(page);
  expect(moved.enemies.find((e: any) => e.kind === "hr").aim).toEqual(tell.aim);
  await page.clock.runFor(1500);
  expect((await state(page)).hits).toBe(0);
});

test("the lift opens after the real countdown and boards without fetch requirements (QA positioning isolates integration)", async ({
  page,
}) => {
  await ready(page, true);
  await start(page);
  await atLift(page);
  await page.keyboard.press("e");
  const safe = [
    { x: 90, y: 700 },
    { x: 650, y: 650 },
    { x: 1040, y: 720 },
    { x: 330, y: 240 },
  ];
  for (let i = 0; i < 18; i++) {
    const s = await state(page);
    if (s.phase === "boarding") break;
    await position(page, safe[i % 4].x, safe[i % 4].y);
    await page.clock.runFor(2000);
  }
  expect((await state(page)).phase).toBe("boarding");
  await atLift(page);
  await page.clock.runFor(1000);
  await expect(
    page.getByRole("heading", { name: "OUT OF OFFICE." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "NEXT FLOOR" }).click();
  await page.waitForFunction(() => window.__office.snapshot().level === 2);
});

test("hiding buys six seconds, then expires and cannot be immediately camped again", async ({
  page,
}) => {
  await ready(page, true);
  await start(page);
  await position(page, 190, 450);
  await page.keyboard.press("e");
  expect((await state(page)).hidden).toBe(true);
  await page.clock.runFor(6200);
  expect((await state(page)).hidden).toBe(false);
  await page.keyboard.press("e");
  expect((await state(page)).hidden).toBe(false);
  await expect(page.locator("#toast")).toContainText("BOOKED");
});

test("side switches are optional sabotage and actually bring the lift sooner", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await position(page, 650, 650);
  await page.keyboard.press("e");
  expect((await state(page)).used).toContain("l1-lift-switch");
  expect((await state(page)).phase).toBe("find-lift");
  await atLift(page);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => window.__office.snapshot().phase === "waiting",
  );
  expect((await state(page)).eta).toBeLessThan(14);
  expect((await state(page)).eta).toBeGreaterThan(10);
});

test("coffee recovery and limited ability effects work without permanent immunity", async ({
  page,
}) => {
  await ready(page);
  await start(page, 4);
  await page.keyboard.press("2");
  expect((await state(page)).active.call).toBeGreaterThan(4);
  await page.keyboard.press("3");
  await page.keyboard.down("d");
  await page.waitForTimeout(100);
  await page.keyboard.up("d");
  expect((await state(page)).active.slack).toBe(0);
  await page.keyboard.press("5");
  const stopped = (await state(page)).enemies;
  await page.waitForTimeout(300);
  expect((await state(page)).enemies.map((e: any) => [e.x, e.y])).toEqual(
    stopped.map((e: any) => [e.x, e.y]),
  );
  await page.keyboard.press("4");
  expect((await state(page)).active.calendar).toBeLessThanOrEqual(3.5);
  await page.evaluate(() => window.__office.qa.bs(50));
  await position(page, 970, 680);
  await page.keyboard.press("e");
  expect((await state(page)).bs).toBeLessThan(40);
});

test("WFH remains a real creative alternative to waiting for the lift", async ({
  page,
}) => {
  await ready(page);
  await start(page, 5);
  await position(page, 1000, 440);
  expect((await state(page)).wfhActive).toBe(true);
  await expect(page.locator("#objectives")).toContainText("PURPLE EXIT");
  await page.keyboard.press("6");
  expect((await state(page)).wfhActive).toBe(true);
  await position(page, 1035, 705);
  await expect(
    page.getByRole("heading", { name: "YOU HAVE A LIFE." }),
  ).toBeVisible();
  await expect(page.locator(".result-achievements")).toContainText(
    "Remote Possibility",
  );
});

test("100 BS causes an actual loss and immediate retry resets the new loop", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await page.evaluate(() => window.__office.qa.bs(100));
  await expect(
    page.getByRole("heading", { name: "PROMOTED TO STAYING LATE." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "RETRY INSTANTLY" }).click();
  await page.waitForFunction(
    () =>
      window.__office.snapshot().bs === 0 && !window.__office.snapshot().ended,
  );
  expect((await state(page)).phase).toBe("find-lift");
  expect((await state(page)).dashCooldown).toBe(0);
  expect((await state(page)).seed).toBe("browser-v2");
});

test("sound settings persist and the daily uses the same UTC seed without an online leaderboard", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Music volume").fill("0.2");
  await page.getByLabel("Mute all audio").check();
  await page.getByRole("button", { name: "DONE" }).click();
  await page.reload();
  await expect(page.locator("#sound-btn")).toHaveText("MUTED");
  await page.getByRole("button", { name: "DAILY ESCAPE" }).click();
  await expect(page.locator("#modal-root")).toContainText("honor-system");
  await page.getByRole("button", { name: "ATTEMPT TODAY" }).click();
  await expect(page.locator("#run-mode")).toContainText(
    new Date().toISOString().slice(0, 10),
  );
});

test("portrait touch joystick, DASH and coffee are usable without covering the map", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await ready(page);
  await start(page);
  const r = await page.locator("#joystick").boundingBox();
  const before = await state(page);
  await page.mouse.move(r!.x + r!.width / 2 + 28, r!.y + r!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.locator("#touch-dash").tap();
  await page.waitForTimeout(160);
  await page.mouse.up();
  const after = await state(page);
  expect(after.pos.x - before.pos.x).toBeGreaterThan(50);
  await page.locator('[data-ability="coffee"]').tap();
  expect((await state(page)).coffee).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
