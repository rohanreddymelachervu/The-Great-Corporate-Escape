import type Phaser from "phaser";
import type { OfficeAudio } from "../audio/audio";
import { dailySeed } from "../game/logic";
import { SPRINT_COURSES } from "./courses";
import { dailyRace, formatRaceTime } from "./model";
import { raceBest, recordRace } from "./progression";
import type { RaceMode, RaceOptions, RaceResult } from "./types";
import type { SprintScene } from "./scene";
import "./style.css";
export interface SprintController {
  isActive: () => boolean;
  stop: () => void;
  pauseExternal: () => void;
  resumeExternal: () => void;
  togglePause: () => void;
  open: (mode: RaceMode) => void;
  start: (options: RaceOptions) => void;
}
const JARGON = [
  "CROSS-FUNCTIONAL ALIGNMENT",
  "LET’S CIRCLE BACK",
  "SYNERGISE THE DELIVERABLES",
  "QUICK SYNC?",
  "ACTION THE ACTION ITEMS",
  "TAKE THIS OFFLINE",
  "INCREASE YOUR BANDWIDTH",
  "DEEP DIVE INTO OWNERSHIP",
  "MANDATORY OPTIONAL FUN",
  "LEVERAGE OUR CORE COMPETENCIES",
  "STAKEHOLDER VISIBILITY",
  "PIVOT THE NORTH STAR",
];
const FAILURE_LINES = [
  "Your weekend has been escalated to a stakeholder.",
  "We need to align on your decision to leave.",
  "This could have been an escape. It is now a meeting.",
  "Congratulations. Your presence exceeded expectations.",
  "Your out-of-office request needs six approvals.",
];
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const escape = (t: string) =>
  t.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
export function setupSprintModes(o: {
  game: Phaser.Game;
  scene: SprintScene;
  audio: OfficeAudio;
  onEnter: () => void;
  onReturn: () => void;
  externalModal: () => boolean;
  reducedMotion: () => boolean;
}): SprintController {
  const { game, scene, audio } = o;
  const top = document.createElement("section");
  top.id = "race-top";
  top.hidden = true;
  top.innerHTML =
    '<div class="race-heading"><small id="race-mode">CLOCK OUT SPRINT</small><strong id="race-course-name"></strong><span id="race-objective"></span></div><div class="race-clock"><small>TIME · LOWER IS BETTER</small><strong id="race-time">00:00.00</strong></div><div class="race-target"><small id="race-gold"></small><span id="race-dash-status">DASH READY</span></div><div id="race-word-row" hidden><span id="race-letter-count"></span><div id="race-letter-slots"></div></div><p id="race-notice" hidden aria-live="polite"></p>';
  const dock = document.createElement("section");
  dock.id = "race-dock";
  dock.hidden = true;
  dock.innerHTML =
    '<div id="race-joystick" aria-label="Sprint movement joystick"><div id="race-stick"></div><small>MOVE</small></div><p class="race-control-guide"><kbd>WASD / ARROWS</kbd> MOVE <kbd>SHIFT</kbd> SPRINT <kbd>SPACE</kbd> DODGE <kbd>R</kbd> RETRY <kbd>ESC</kbd> PAUSE</p><div class="race-touch-actions"><button id="race-touch-run" aria-label="Hold sprint">RUN</button><button id="race-touch-dash" aria-label="Sprint dodge">DASH</button></div>';
  const overlay = document.createElement("div");
  overlay.id = "race-modal";
  overlay.hidden = true;
  $("#stage").append(top, dock, overlay);
  let active = false,
    paused = false,
    external = false,
    screen = "",
    options: RaceOptions = { mode: "sprint", courseId: 1 },
    attempt = 0,
    lastHudPhase = "",
    lastCountdown = 0,
    noticeTimer: ReturnType<typeof setTimeout> | null = null;
  function enter() {
    if (!active) o.onEnter();
    active = true;
    document.body.classList.remove("playing");
    document.body.classList.add("racing");
    document.body.classList.toggle("race-reduced", o.reducedMotion());
    $("#menu").hidden = true;
    $("#hud").hidden = true;
    $("#control-dock").hidden = true;
    $("#footer").hidden = true;
    game.scene.stop("office");
  }
  function panel(html: string, cls = "") {
    overlay.className = cls;
    overlay.innerHTML = `<section class="race-panel ${cls === "race-punishment" ? "race-punishment-panel" : ""}" role="dialog" aria-modal="true">${html}</section>`;
    overlay.hidden = false;
    overlay
      .querySelector(".race-panel")
      ?.setAttribute(
        "aria-label",
        overlay.querySelector("h2")?.textContent?.replace(/\s+/g, " ").trim() ||
          "Race menu",
      );
    requestAnimationFrame(() =>
      overlay.querySelector<HTMLElement>("button")?.focus(),
    );
  }
  function hidePanel() {
    overlay.hidden = true;
    overlay.innerHTML = "";
    overlay.className = "";
    screen = "";
  }
  function start(next: RaceOptions) {
    enter();
    options = {
      ...next,
      day: next.mode === "buzzword" ? next.day || dailySeed() : undefined,
    };
    paused = false;
    external = false;
    screen = "";
    attempt = 0;
    lastHudPhase = "";
    lastCountdown = 0;
    hidePanel();
    top.hidden = false;
    dock.hidden = false;
    $("#pause-btn").hidden = false;
    scene.reducedMotion = o.reducedMotion();
    game.scene.stop("sprint");
    game.scene.start("sprint", options);
    audio.resume();
    audio.unlock();
    requestAnimationFrame(() => {
      const r = $("#game").getBoundingClientRect();
      game.scale.resize(Math.floor(r.width), Math.floor(r.height));
      $("#game").focus();
    });
  }
  function retry() {
    if (!active || !scene.run) return;
    if (scene.run.phase === "failed" && scene.run.failureAge < 0.15) return;
    attempt++;
    paused = false;
    external = false;
    hidePanel();
    lastHudPhase = "";
    lastCountdown = 0;
    scene.resetInput();
    scene.scene.resume();
    scene.scene.restart(options);
    audio.resume();
    $("#game").focus();
  }
  function stop() {
    if (noticeTimer) clearTimeout(noticeTimer);
    active = false;
    paused = false;
    external = false;
    screen = "";
    top.hidden = true;
    dock.hidden = true;
    hidePanel();
    game.scene.stop("sprint");
    document.body.classList.remove("racing");
    $("#pause-btn").hidden = true;
  }
  function back() {
    stop();
    o.onReturn();
  }
  function pauseExternal() {
    if (!active || !scene.run || paused) return;
    external = true;
    paused = true;
    scene.scene.pause();
    scene.resetInput();
    audio.suspend();
  }
  function resumeExternal() {
    if (!active || !external) return;
    external = false;
    paused = false;
    scene.scene.resume();
    audio.resume();
    $("#game").focus();
  }
  function togglePause() {
    if (!active) return;
    if (screen === "courses" || screen === "daily") {
      back();
      return;
    }
    if (scene.run?.phase === "finished") {
      open(options.mode);
      return;
    }
    if (paused) {
      paused = false;
      scene.scene.resume();
      audio.resume();
      hidePanel();
      if (scene.run?.phase === "failed") showFailure(scene.run.failReason);
      $("#game").focus();
      return;
    }
    if (!scene.run) return;
    paused = true;
    scene.scene.pause();
    scene.resetInput();
    audio.suspend();
    screen = "pause";
    panel(
      '<div class="race-eyebrow">CLOCK STOPPED. CORPORATE CHAOS ALSO STOPPED.</div><h2>STRATEGIC<br>UNAVAILABILITY.</h2><p>The race, patrols and cooldowns are paused.</p><div class="race-actions"><button class="race-primary" id="race-resume">RESUME ↗</button><button class="race-secondary" id="race-restart">RETRY COURSE</button><button class="race-secondary" id="race-course-menu">COURSES / DAILY</button><button class="race-secondary" id="race-home">HEIST MENU</button></div>',
    );
    $("#race-resume").onclick = togglePause;
    $("#race-restart").onclick = retry;
    $("#race-course-menu").onclick = () => open(options.mode);
    $("#race-home").onclick = back;
  }
  function open(mode: RaceMode) {
    enter();
    options = { mode, courseId: 1 };
    paused = false;
    external = false;
    game.scene.stop("sprint");
    top.hidden = true;
    dock.hidden = true;
    $("#pause-btn").hidden = true;
    audio.resume();
    audio.music("menu");
    if (mode === "buzzword") {
      const day = dailySeed(),
        d = dailyRace(day, SPRINT_COURSES),
        best = raceBest("buzzword", d.course.id, day, d.code);
      screen = "daily";
      panel(
        `<div class="race-eyebrow">DAILY LETTER RACE · ${day} UTC</div><h2>BUZZWORD<br>RUN.</h2><p>Find ${d.word.word.length} letter badges, then leave. Run over them in any order; no spelling menu, tools or loot.</p><div class="race-preview-word">${Array.from(
          d.word.word,
        )
          .map(() => "<span>?</span>")
          .join(
            "",
          )}</div><p><b>${escape(d.course.name)}</b> · Same layout and patterns for everyone today.<br>Best today: <strong>${best ? formatRaceTime(best.time) : "NOT YET CLOCKED OUT"}</strong></p><div class="race-actions"><button id="buzzword-start" class="race-primary">RACE TODAY’S BUZZWORD ↗</button><button id="race-switch-sprint" class="race-secondary">PURE SPRINT COURSES</button><button id="race-home" class="race-secondary">HEIST MENU</button></div><p class="race-fine">Local records and shareable challenge codes. No online leaderboard or anti-cheat service.</p>`,
      );
      $("#buzzword-start").onclick = () =>
        start({ mode: "buzzword", courseId: d.course.id, day });
      $("#race-switch-sprint").onclick = () => open("sprint");
      $("#race-home").onclick = back;
    } else {
      screen = "courses";
      panel(
        `<div class="race-eyebrow">PURE TIME. ZERO SIDE QUESTS.</div><h2>CLOCK OUT<br>SPRINT.</h2><p>Reach the exit. Move, sprint, dodge. No stolen items, abilities, BS meter or lift wait. A catch means a quick retry of the same pattern.</p><div class="race-course-grid">${SPRINT_COURSES.map(
          (c) => {
            const b = raceBest("sprint", c.id);
            return `<button data-race-course="${c.id}" class="race-course-card"><b>${String(c.id).padStart(2, "0")}</b><span><strong>${escape(c.name)}</strong><small>${escape(c.subtitle)}</small></span><em>${b ? formatRaceTime(b.time) : "UNRUN"}<small>GOLD ${c.gold.toFixed(1)}s</small></em></button>`;
          },
        ).join(
          "",
        )}</div><div class="race-actions"><button id="race-switch-daily" class="race-secondary">DAILY BUZZWORD RUN</button><button id="race-home" class="race-secondary">HEIST MENU</button></div>`,
      );
      overlay.querySelectorAll<HTMLButtonElement>("[data-race-course]").forEach(
        (b) =>
          (b.onclick = () =>
            start({
              mode: "sprint",
              courseId: Number(b.dataset.raceCourse),
            })),
      );
      $("#race-switch-daily").onclick = () => open("buzzword");
      $("#race-home").onclick = back;
    }
  }
  function showFailure(reason: string) {
    screen = "failure";
    const wall = Array.from(
      { length: 30 },
      (_, i) =>
        `<span style="--n:${i}">${JARGON[(i + attempt * 3) % JARGON.length]}</span>`,
    ).join("");
    panel(
      `<div class="race-jargon-wall" aria-hidden="true">${wall}</div><div class="race-failure-copy"><div class="race-eyebrow">UNSCHEDULED CALL · WEEKEND_REQUEST_DENIED</div><h2>LET’S QUICKLY<br>ALIGN ON THIS.</h2><p>${escape(reason)}</p><p>${FAILURE_LINES[attempt % FAILURE_LINES.length]}</p><button id="race-retry-now" class="race-primary">RETRY · R / SPACE ↻</button><small id="race-auto-retry">Automatic quick retry. Same course. Same pattern.</small></div>`,
      "race-punishment",
    );
    $("#race-retry-now").onclick = retry;
  }
  function showWin(r: RaceResult) {
    const rec = recordRace(r);
    screen = "result";
    const review =
      r.medal === "Gold"
        ? "EXCEEDS EXPECTATIONS OF NOT BEING HERE."
        : r.medal === "Silver"
          ? "MEETS MINIMUM PRESENCE REQUIREMENTS."
          : "DEMONSTRATED COMMITMENT TO EVENTUALLY LEAVING.";
    panel(
      `<div class="race-eyebrow">${r.mode === "buzzword" ? "BUZZWORD RUN · " + escape(r.day || "") : "CLOCK OUT SPRINT · COURSE " + r.courseId}</div><div class="race-finish-mark">↗</div><h2>CLOCKED OUT.</h2><div class="race-finish-time">${formatRaceTime(r.time)}</div><div class="race-medal">${r.medal.toUpperCase()} · ${rec.improved ? "NEW PERSONAL BEST" : rec.previous ? "BEST " + formatRaceTime(rec.best.time) : "TIME RECORDED"}</div>${r.word ? `<div class="race-revealed-word">${escape(r.word)}</div>` : ""}<p>${escape(r.joke)}</p><div class="race-review">PERFORMANCE REVIEW<br><b>${review}</b><small>Compensation remains unchanged.</small></div><div class="race-actions"><button id="race-next" class="race-primary">${r.mode === "sprint" && r.courseId < 10 ? "NEXT COURSE ↗" : "RACE AGAIN ↻"}</button><button id="race-replay" class="race-secondary">REPLAY THIS COURSE</button><button id="race-share" class="race-secondary">SHARE TIME</button><button id="race-select" class="race-secondary">${r.mode === "sprint" ? "ALL COURSES" : "TODAY’S CHALLENGE"}</button><button id="race-home" class="race-secondary">HEIST MENU</button></div><p id="race-share-status" class="race-fine" aria-live="polite"></p>`,
    );
    $("#race-next").onclick = () =>
      start(
        r.mode === "sprint" && r.courseId < 10
          ? { mode: "sprint", courseId: r.courseId + 1 }
          : options,
      );
    $("#race-replay").onclick = retry;
    $("#race-select").onclick = () => open(r.mode);
    $("#race-home").onclick = back;
    $("#race-share").onclick = () => {
      const text = `${r.mode === "buzzword" ? "BUZZWORD RUN · " + r.word : "CLOCK OUT SPRINT · " + scene.run.course.name} — ${formatRaceTime(r.time)} — ${r.medal}. ${r.mode === "buzzword" ? "Challenge " + r.code + ". " : ""}THE GREAT OFFICE ESCAPE. ${r.joke}`;
      if (navigator.share)
        navigator
          .share({ title: "The Great Office Escape · Race Time", text })
          .catch(() => {
            $("#race-share-status").textContent = text;
          });
      else if (navigator.clipboard)
        navigator.clipboard
          .writeText(text)
          .then(() => {
            $("#race-share-status").textContent =
              "Time copied. Forward to someone who still schedules Friday meetings.";
          })
          .catch(() => {
            $("#race-share-status").textContent = text;
          });
      else $("#race-share-status").textContent = text;
    };
  }
  window.addEventListener("race:hud", ((event: CustomEvent) => {
    if (!active || !scene.run) return;
    const h = event.detail;
    $("#race-mode").textContent =
      h.mode === "buzzword" ? "BUZZWORD RUN · " + h.day : "CLOCK OUT SPRINT";
    $("#race-course-name").textContent =
      String(h.courseId).padStart(2, "0") + " · " + h.name;
    $("#race-time").textContent = h.time;
    $("#race-gold").textContent = "GOLD TARGET " + h.gold.toFixed(1) + "s";
    $("#race-dash-status").textContent =
      h.dashCooldown > 0
        ? "DASH " + h.dashCooldown.toFixed(1) + "s"
        : "DASH READY";
    $("#race-word-row").hidden = h.mode !== "buzzword";
    $("#race-letter-count").textContent =
      h.letters.filter((l: { collected: boolean }) => l.collected).length +
      "/" +
      h.letters.length +
      " LETTERS";
    $("#race-letter-slots").innerHTML = h.letters
      .map(
        (l: { char: string; collected: boolean }) =>
          `<span class="${l.collected ? "collected" : ""}">${l.collected ? l.char : "_"}</span>`,
      )
      .join("");
    $("#race-objective").textContent =
      h.mode === "buzzword" &&
      h.letters.some((l: { collected: boolean }) => !l.collected)
        ? "Collect the letter badges in any order, then exit."
        : "Follow the gold arrow. The exit is open—keep moving.";
    if (h.phase === "countdown" && !paused && !external) {
      const n = Math.max(1, Math.ceil(h.countdown / 0.3));
      if (lastCountdown !== n) {
        audio.sfx("click");
        lastCountdown = n;
      }
      screen = "countdown";
      overlay.className = "race-countdown";
      overlay.innerHTML = `<div class="race-ready"><b>${n}</b><span>MOVE · SPRINT · DODGE</span></div>`;
      overlay.hidden = false;
    } else if (h.phase === "running" && screen === "countdown") hidePanel();
    if (h.phase === "failed" && screen === "failure")
      $("#race-auto-retry").textContent =
        "RETRYING IN " +
        Math.max(0, 1.1 - h.failureAge).toFixed(1) +
        "s · R / SPACE TO SKIP";
    lastHudPhase = h.phase;
  }) as EventListener);
  window.addEventListener("race:fail", ((e: CustomEvent) => {
    if (active) showFailure(e.detail.reason);
  }) as EventListener);
  window.addEventListener("race:win", ((e: CustomEvent<RaceResult>) => {
    if (active) showWin(e.detail);
  }) as EventListener);
  window.addEventListener("race:auto-retry", () => {
    if (active && !paused && !external) retry();
  });
  window.addEventListener("race:notice", ((e: CustomEvent<string>) => {
    if (!active) return;
    $("#race-notice").textContent = e.detail;
    $("#race-notice").hidden = false;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      $("#race-notice").hidden = true;
    }, 1800);
  }) as EventListener);
  document.addEventListener("keydown", (e) => {
    if (
      !active ||
      !scene.scene.isActive() ||
      o.externalModal() ||
      paused ||
      external ||
      e.repeat ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(
        (e.target as HTMLElement)?.tagName,
      )
    )
      return;
    if (e.code === "KeyR" && scene.run) {
      e.preventDefault();
      retry();
    }
    if (e.code === "Space" && scene.run) {
      if (scene.run.phase === "running") {
        e.preventDefault();
        scene.queueDash();
      } else if (scene.run.phase === "failed") {
        e.preventDefault();
        retry();
      }
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (
      document.hidden &&
      active &&
      !paused &&
      !external &&
      scene.scene.isActive() &&
      scene.run &&
      ["countdown", "running", "failed"].includes(scene.run.phase)
    )
      togglePause();
  });
  window.addEventListener("blur", () => {
    if (
      active &&
      !paused &&
      !external &&
      scene.scene.isActive() &&
      scene.run &&
      ["countdown", "running", "failed"].includes(scene.run.phase)
    )
      togglePause();
  });
  $("#pause-btn").addEventListener("click", () => {
    if (active) togglePause();
  });
  const joy = $("#race-joystick"),
    stick = $("#race-stick");
  let pointer = -1;
  function resetJoy() {
    pointer = -1;
    scene.touch.x = 0;
    scene.touch.y = 0;
    stick.style.transform = "translate(0,0)";
  }
  function moveJoy(e: PointerEvent) {
    const r = joy.getBoundingClientRect(),
      x = e.clientX - r.left - r.width / 2,
      y = e.clientY - r.top - r.height / 2,
      max = r.width * 0.3,
      len = Math.hypot(x, y) || 1,
      f = Math.min(1, max / len);
    scene.touch.x = len < 8 ? 0 : (x * f) / max;
    scene.touch.y = len < 8 ? 0 : (y * f) / max;
    stick.style.transform = `translate(${x * f}px,${y * f}px)`;
  }
  joy.onpointerdown = (e) => {
    e.preventDefault();
    if (paused) return;
    pointer = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    moveJoy(e);
  };
  joy.onpointermove = (e) => {
    if (e.pointerId === pointer) moveJoy(e);
  };
  joy.onpointerup = resetJoy;
  joy.onpointercancel = resetJoy;
  joy.onlostpointercapture = resetJoy;
  const run = $("#race-touch-run");
  run.onpointerdown = (e) => {
    e.preventDefault();
    run.setPointerCapture(e.pointerId);
    scene.touch.sprint = true;
  };
  run.onpointerup = () => {
    scene.touch.sprint = false;
  };
  run.onpointercancel = () => {
    scene.touch.sprint = false;
  };
  run.onlostpointercapture = () => {
    scene.touch.sprint = false;
  };
  $("#race-touch-dash").onpointerdown = (e) => {
    e.preventDefault();
    if (!paused) scene.queueDash();
  };
  $("#sprint-mode-btn").onclick = () => open("sprint");
  $("#buzzword-mode-btn").onclick = () => open("buzzword");
  return {
    isActive: () => active,
    stop,
    pauseExternal,
    resumeExternal,
    togglePause,
    open,
    start,
  };
}
