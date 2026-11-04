import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const url = pathToFileURL(resolve("release/office-escape.html")).href;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
await mkdir("test-results", { recursive: true });
const reports = [];
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  const mobile = viewport.width === 390 || viewport.height === 390;
  const context = await browser.newContext({
    viewport,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.setOffline(true);
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__office?.ready());
  if (await page.evaluate(() => !!window.__office.qa))
    throw Error("Development helpers leaked into production");
  await page.screenshot({
    path: `test-results/release-menu-${viewport.width}.png`,
  });
  await page.locator("#play-btn").click();
  await page.waitForFunction(() => window.__office.snapshot().elapsed > 0.4);
  const state = () => page.evaluate(() => window.__office.snapshot()),
    before = await state();
  if (!mobile) {
    await page.keyboard.down("d");
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () => window.__office.snapshot().dashCooldown > 0,
    );
    await page.waitForFunction(() => !window.__office.snapshot().dashing);
    await page.keyboard.up("d");
  } else {
    const joy = await page.locator("#joystick").boundingBox();
    if (!joy) throw Error("Joystick missing");
    await page.mouse.move(joy.x + joy.width / 2 + 28, joy.y + joy.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(180);
    await page.locator("#touch-dash").tap();
    await page.waitForTimeout(250);
    await page.mouse.up();
  }
  const after = await state();
  if (after.pos.x - before.pos.x < 60)
    throw Error("Actual directional dodge did not move far enough");
  await page.locator('[data-ability="coffee"]').click();
  if ((await state()).coffee !== 1) throw Error("Coffee charge not consumed");
  await page.getByRole("button", { name: "Pause game" }).click();
  const frozen = (await state()).elapsed;
  await page.waitForTimeout(150);
  if ((await state()).elapsed !== frozen)
    throw Error("Pause advanced simulation");
  await page.getByRole("button", { name: "KEEP ESCAPING" }).click();
  await page.screenshot({
    path: `test-results/release-game-${viewport.width}.png`,
  });
  const layout = await page.evaluate(() => {
    const r = document.querySelector("#game").getBoundingClientRect(),
      c = document.querySelector("canvas");
    return {
      canvasMatchesViewport:
        Math.abs(c.width - r.width) <= 1 && Math.abs(c.height - r.height) <= 1,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  reports.push({
    viewport,
    mobile,
    dodgeDistance: after.pos.x - before.pos.x,
    coffeeConsumed: true,
    phase: (await state()).phase,
    qaAvailable: false,
    ...layout,
    errors,
  });
  await context.close();
}
await browser.close();
const summary = {
  ruleset: 2,
  url,
  checkedAt: new Date().toISOString(),
  reports,
};
await writeFile(
  "test-results/offline-release.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
if (
  reports.some(
    (r) => r.errors.length || !r.canvasMatchesViewport || r.pageOverflow,
  )
)
  process.exit(1);
