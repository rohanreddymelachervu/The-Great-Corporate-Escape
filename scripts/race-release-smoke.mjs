import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
await mkdir("test-results", { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const reports = [];
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  const mobile = viewport.width === 390 || viewport.height === 390,
    c = await b.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await c.setOffline(true);
  const p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(pathToFileURL(resolve("release/office-escape.html")).href);
  await p.waitForFunction(() => window.__office?.ready());
  if (await p.evaluate(() => !!window.__office.qa || !!window.__sprint.qa))
    throw Error("QA helper leaked");
  await p.locator("#sprint-mode-btn").click();
  await p.locator('[data-race-course="1"]').click();
  await p.waitForFunction(
    () => window.__sprint.snapshot()?.phase === "running",
  );
  const before = await p.evaluate(() => window.__sprint.snapshot().pos.x);
  if (mobile) {
    const j = await p.locator("#race-joystick").boundingBox();
    await p.mouse.move(j.x + j.width / 2 + 25, j.y + j.height / 2);
    await p.mouse.down();
    await p.waitForTimeout(160);
    await p.locator("#race-touch-dash").tap();
    await p.waitForTimeout(180);
    await p.mouse.up();
  } else {
    await p.keyboard.down("d");
    await p.keyboard.press("Space");
    await p.waitForTimeout(180);
    await p.keyboard.up("d");
  }
  const after = await p.evaluate(() => window.__sprint.snapshot().pos.x);
  if (after - before < 50)
    throw Error("Racing dodge/movement did not work offline");
  await p.keyboard.down("d");
  await p.keyboard.down("Shift");
  await p.waitForFunction(() => window.__sprint.snapshot().pos.x > 1090);
  await p.keyboard.up("d");
  await p.keyboard.down("w");
  await p.waitForFunction(
    () => window.__sprint.snapshot().phase === "failed",
    {},
    { timeout: 5000 },
  );
  await p.keyboard.up("w");
  await p.keyboard.up("Shift");
  if (!(await p.locator(".race-punishment").isVisible()))
    throw Error("No red corporate punishment");
  const time = await p.evaluate(() => window.__sprint.snapshot().elapsed);
  await p.waitForFunction(() => window.__sprint.audio().playing);
  const ringtone = await p.evaluate(() => window.__sprint.audio());
  if (ringtone.duration < 25 || !ringtone.loop)
    throw Error("Uploaded MP3 not looping");
  await p.waitForTimeout(viewport.width === 1280 ? 28000 : 2200);
  if (!(await p.evaluate(() => window.__sprint.audio().playing)))
    throw Error("Ringtone stopped without a choice");
  if ((await p.evaluate(() => window.__sprint.snapshot().elapsed)) !== time)
    throw Error("Failed race clock advanced");
  await p.screenshot({
    path: `test-results/race-offline-loss-${viewport.width}.png`,
  });
  if ((await p.evaluate(() => window.__sprint.snapshot().phase)) !== "failed")
    throw Error("Sprint failure screen dismissed itself");
  await p.locator("#race-retry-now").click();
  await p.waitForFunction(
    () => window.__sprint.snapshot().phase === "countdown",
    {},
    { timeout: 2500 },
  );
  if (await p.evaluate(() => window.__sprint.audio().requested))
    throw Error("Ringtone leaked into restart");
  await p.locator("#home-link").click();
  await p.locator("#buzzword-mode-btn").click();
  await p.locator("#buzzword-start").click();
  await p.waitForFunction(
    () => window.__sprint.snapshot()?.phase === "running",
  );
  const s = await p.evaluate(() => window.__sprint.snapshot());
  if (s.mode !== "buzzword" || s.letters.length < 4)
    throw Error("Daily letters not loaded");
  const bounds = await p.evaluate(() => {
    const r = document.querySelector("#game").getBoundingClientRect(),
      c = document.querySelector("canvas");
    return {
      match:
        Math.abs(c.width - r.width) <= 1 && Math.abs(c.height - r.height) <= 1,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  await p.screenshot({
    path: `test-results/race-offline-daily-${viewport.width}.png`,
  });
  reports.push({
    viewport,
    mobile,
    dodgeDistance: after - before,
    redLoss: true,
    clockFrozen: true,
    persistentFailure: true,
    uploadedRingtone: true,
    waitedThroughFullLoop: viewport.width === 1280,
    explicitRestart: true,
    wordBadges: s.letters.length,
    canvasMatchesViewport: bounds.match,
    pageOverflow: bounds.overflow,
    qaAvailable: false,
    errors,
  });
  await c.close();
}
await b.close();
await writeFile(
  "test-results/race-offline.json",
  JSON.stringify({ at: new Date().toISOString(), reports }, null, 2),
);
console.log(JSON.stringify(reports, null, 2));
if (
  reports.some(
    (r) => r.errors.length || !r.canvasMatchesViewport || r.pageOverflow,
  )
)
  process.exit(1);
