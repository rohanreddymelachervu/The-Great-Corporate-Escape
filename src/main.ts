import Phaser from "phaser";
import "./ui/style.css";
import { OfficeScene } from "./game/scene";
import { OfficeAudio } from "./audio/audio";
import {
  ABILITIES,
  ACHIEVEMENTS,
  ENEMIES,
  VICTORY_LINES,
} from "./game/catalog";
import { dailySeed, hash } from "./game/logic";
import { LEVELS } from "./game/levels";
import { load, persist, record } from "./game/progression";
import type { Ability, Result, HitEvent } from "./game/types";
import { playHitScene } from "./ui/hit-scenes";
import { playFunFriday } from "./ui/fun-ui";
import type { FunOutcome } from "./ui/fun-ui";
import { ContextCoach } from "./game/coach";
import { incidentReport } from "./game/report";
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const save = load(),
  audio = new OfficeAudio();
audio.setVolumes(save.settings.music, save.settings.sfx, save.settings.mute);
audio.music("menu");
const scene = new OfficeScene(audio);
scene.reducedMotion =
  save.settings.reducedMotion ||
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  backgroundColor: "#101625",
  pixelArt: true,
  antialias: false,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: { powerPreference: "low-power", transparent: false },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [scene],
  banner: false,
  audio: { noAudio: true },
  input: { activePointers: 4 },
});
function resizeGame() {
  const r = $("#game").getBoundingClientRect();
  const width = Math.floor(r.width),
    height = Math.floor(r.height);
  if (
    width > 0 &&
    height > 0 &&
    (game.scale.width !== width || game.scale.height !== height)
  )
    game.scale.resize(width, height);
}
// Rails can change height when feedback appears. Keep the actual canvas viewport exact.
let resizeFrame = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(resizeGame);
}).observe($("#game"));
let playing = false,
  paused = false,
  modalKind = "",
  lastResult: Result | null = null,
  toastTimer: ReturnType<typeof setTimeout> | null = null;
let cleanupFun: (() => void) | null = null;
function stopFun() {
  cleanupFun?.();
  cleanupFun = null;
}
let cleanupHit: (() => void) | null = null;
function stopHit(resumeWorld = false) {
  const cleanup = cleanupHit;
  if (!cleanup && !scene.cinematic) return;
  cleanupHit = null;
  cleanup?.();
  scene.cinematic = false;
  scene.holdingInteract = false;
  if (resumeWorld) {
    paused = false;
    scene.scene.resume();
    audio.resume();
    scene.keys && Object.values(scene.keys).forEach((k) => k.reset());
    scene.touch = { x: 0, y: 0, sprint: false };
    $("#game").focus();
  }
}
window.addEventListener("office:hit", ((e: CustomEvent<HitEvent>) => {
  if (!playing) return;
  pause();
  audio.resume();
  audio.sfx(e.detail.kind === "allhands" ? "founder" : "caught");
  const sprites: Record<string, CanvasImageSource> = {};
  for (const key of [
    "player",
    "hr",
    "manager",
    "intern",
    "founder",
    "pm",
    "gossip",
    "staff",
  ])
    if (scene.textures.exists(key))
      sprites[key] = scene.textures
        .get(key)
        .getSourceImage() as CanvasImageSource;
  cleanupHit = playHitScene({
    container: $("#game"),
    event: e.detail,
    longHaul: save.settings.hitScenes === "long",
    reducedMotion: scene.reducedMotion,
    sprites,
    onDone: () => stopHit(true),
  });
}) as EventListener);

const touch =
  matchMedia("(pointer:coarse)").matches || navigator.maxTouchPoints > 0;
if (touch) document.body.classList.add("touch");
const formatTime = (s: number) =>
  Math.floor(s / 60)
    .toString()
    .padStart(2, "0") +
  ":" +
  Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
function syncMenu() {
  $("#achievement-count").textContent =
    save.achievements.length + "/" + ACHIEVEMENTS.length;
  $("#play-btn").innerHTML =
    (save.unlocked > 1 ? "CONTINUE ESCAPE" : "CLOCK OUT") + " <span>↗</span>";
  $("#sound-btn").textContent = save.settings.mute ? "MUTED" : "SOUND ON";
}
syncMenu();
let learned: string[] = [];
try {
  const data = JSON.parse(localStorage.getItem("office-coach-v22") || "[]");
  if (Array.isArray(data)) learned = data.filter((x) => typeof x === "string");
} catch {
  /* Optional tips never block play. */
}
const coach = new ContextCoach(learned);
$("#tip-dismiss").onclick = () => {
  $("#toast").hidden = true;
  $("#game").focus();
};
function toast(title: string, text: string, duration = 3.5) {
  if (modalKind === "result") return;
  $("#toast").classList.remove("coach-tip");
  $("#tip-dismiss").hidden = true;
  $("#toast-title").textContent = title;
  $("#toast-text").textContent = text;
  $("#toast").hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, duration * 1000);
}
window.addEventListener("office:toast", ((e: CustomEvent) => {
  if (playing && !paused)
    toast(e.detail.title, e.detail.text, e.detail.duration);
}) as EventListener);
function pause() {
  if (!playing || scene.ended || paused) return;
  paused = true;
  scene.scene.pause();
  audio.suspend();
  scene.touch = { x: 0, y: 0, sprint: false };
  scene.holdingInteract = false;
}
function resume() {
  if (!playing || scene.ended) return;
  paused = false;
  scene.scene.resume();
  audio.resume();
  scene.keys && Object.values(scene.keys).forEach((k) => k.reset());
  scene.touch = { x: 0, y: 0, sprint: false };
  scene.holdingInteract = false;
}
function closeModal() {
  stopFun();
  const kind = modalKind;
  if (playing && scene.ended && lastResult && kind !== "result") {
    showResult(scene.won, lastResult, [], false);
    return;
  }
  $("#modal-root").hidden = true;
  $("#modal-root").innerHTML = "";
  modalKind = "";
  if (kind !== "result") resume();
  $("#game").focus();
}
function modal(kind: string, html: string, small = false) {
  stopHit(true);
  stopFun();
  if (playing && !scene.ended) pause();
  modalKind = kind;
  $("#toast").hidden = true;
  $("#modal-root").innerHTML =
    `<section class="modal ${small ? "modal-small" : ""}" role="dialog" aria-modal="true" aria-label="${kind}">${kind === "result" ? "" : '<button class="close" aria-label="Close">×</button>'}${html}</section>`;
  $("#modal-root").hidden = false;
  $("#modal-root .close")?.addEventListener("click", closeModal);
  if (kind !== "fun")
    requestAnimationFrame(() =>
      $("#modal-root").querySelector<HTMLElement>("button,input")?.focus(),
    );
}
function start(level: number, daily = false, seedOverride?: string) {
  stopHit(false);
  stopFun();
  audio.resume();
  audio.unlock();
  playing = true;
  paused = false;
  modalKind = "";
  lastResult = null;
  $("#modal-root").hidden = true;
  $("#modal-root").innerHTML = "";
  $("#menu").hidden = true;
  $("#hud").hidden = false;
  $("#control-dock").hidden = false;
  $("#pause-btn").hidden = false;
  $("#footer").hidden = true;
  $("#toast").hidden = true;
  document.body.classList.add("playing");
  coach.resetRun();
  buildAbilities(level);
  const seed = seedOverride ?? (daily ? dailySeed() : `${Date.now()}-${level}`);
  scene.scene.restart({ level, daily, seed, preview: false });
  game.scale.refresh();
  requestAnimationFrame(() => {
    resizeGame();
    $("#game").focus();
    scene.resize();
  });
}
function home() {
  if (playing && !scene.ended) {
    pause();
    modal(
      "leave",
      `<div class="modal-eyebrow">YOUR WEEKEND IS STILL PENDING</div><h2>ABANDON THIS RUN?</h2><p>Your floor progress will reset. Unlocked floors, records and achievements are safe.</p><div class="modal-actions"><button class="primary" id="confirm-home">MAIN MENU ↗</button><button class="secondary" id="keep-playing">KEEP ESCAPING</button></div>`,
      true,
    );
    $("#confirm-home").onclick = goHome;
    $("#keep-playing").onclick = closeModal;
  } else goHome();
}
function goHome() {
  stopHit(false);
  stopFun();
  audio.resume();
  playing = false;
  paused = false;
  modalKind = "";
  $("#modal-root").hidden = true;
  $("#modal-root").innerHTML = "";
  $("#menu").hidden = false;
  $("#hud").hidden = true;
  $("#control-dock").hidden = true;
  $("#pause-btn").hidden = true;
  $("#footer").hidden = false;
  $("#toast").hidden = true;
  document.body.classList.remove("playing");
  scene.scene.resume();
  scene.scene.restart({ level: 5, preview: true, seed: "menu" });
  requestAnimationFrame(resizeGame);
  audio.music("menu");
  syncMenu();
}
function buildAbilities(level: number) {
  const primary = (["coffee", "call"] as Ability[]).filter(
    (id) => level >= ABILITIES[id].level,
  );
  $("#ability-bar").style.setProperty(
    "--primary-count",
    String(primary.length + 1 + (level >= 3 ? 1 : 0)),
  );
  $("#ability-bar").innerHTML =
    `<button class="ability dodge-ability" id="dodge-ability" title="Space / DASH: quick dodge. Furniture still blocks you."><kbd>SPACE</kbd><span>DODGE<small id="dash-status">READY</small></span></button>` +
    primary
      .map((id) => {
        const d = ABILITIES[id];
        return `<button class="ability" data-ability="${id}" title="${d.description}" aria-label="${d.name}"><kbd>${d.key}</kbd><span>${d.short}<small id="ability-${id}">READY</small></span></button>`;
      })
      .join("") +
    (level >= 3
      ? '<button class="ability more-tools" id="more-tools" aria-label="More tools"><span>MORE TOOLS<small>OPTIONAL · 3–5</small></span></button>'
      : "");
  $("#dodge-ability").onclick = () => {
    if (!paused) scene.dash();
  };
  document.querySelectorAll<HTMLButtonElement>("[data-ability]").forEach(
    (b) =>
      (b.onclick = () => {
        audio.unlock();
        if (!paused) scene.ability(b.dataset.ability as Ability);
      }),
  );
  if (level >= 3) $("#more-tools").onclick = advancedTools;
}
function advancedTools() {
  const state = scene.snapshot();
  const tools = (["slack", "calendar", "vpn"] as Ability[]).filter(
    (id) => scene.level.id >= ABILITIES[id].level,
  );
  modal(
    "tools",
    `<div class="modal-eyebrow">OFFICE PAUSED · OPTIONAL TOOLS</div><h2>A LITTLE EXTRA<br>UNAVAILABILITY.</h2><p>You can escape with movement, E, Space and your primary tools. These are optional extras; shortcuts 3–5 still work during play.</p><div class="advanced-tool-grid">${tools
      .map((id) => {
        const d = ABILITIES[id],
          cd = state.cooldowns[id] || 0;
        const bulky = id === "slack" && state.lootWeight >= 3;
        return `<button class="advanced-tool" data-use-tool="${id}" ${cd > 0 || bulky ? "disabled" : ""}><strong>${d.key} · ${d.name}</strong><span>${d.description}</span><small>${bulky ? "BULKY LOOT CANNOT LOOK BUSY" : cd > 0 ? Math.ceil(cd) + "s cooldown" : "USE & RETURN TO ESCAPE"}</small></button>`;
      })
      .join(
        "",
      )}</div><div class="modal-actions"><button class="secondary" id="tools-back">BACK WITHOUT USING A TOOL</button></div>`,
    true,
  );
  document.querySelectorAll<HTMLButtonElement>("[data-use-tool]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.useTool as Ability;
        closeModal();
        scene.events.once(Phaser.Scenes.Events.UPDATE, () => {
          if (!scene.ended) scene.ability(id);
        });
      }),
  );
  $("#tools-back").onclick = closeModal;
}
window.addEventListener("office:hud", ((e: CustomEvent) => {
  if (!playing) return;
  const h = e.detail;
  $("#floor-num").textContent =
    "FLOOR " + String(h.level).padStart(2, "0") + " / 05";
  $("#floor-name").textContent = h.name;
  $("#timer").textContent = formatTime(h.elapsed);
  $("#run-mode").textContent = h.daily
    ? "DAILY · " + h.seed
    : "OFFICE ESCAPE · V2.2";
  $("#bs-value").textContent = Math.floor(h.bs) + "%";
  $("#bs-bar").style.width = h.bs + "%";
  $("#bs-bar").style.background = h.bs > 70 ? "#ff667f" : "#ff937f";
  $("#stamina-bar").style.width = h.stamina + "%";
  $("#bag-status").textContent =
    `BAG ${(h.lootValue || 0).toLocaleString()} PTS · ${h.lootCount || 0} ${h.lootCount === 1 ? "ITEM" : "ITEMS"}${h.carryPenalty ? " · −" + h.carryPenalty + "% SPEED" : ""}`;
  $("#stamina-bar").style.background = h.stamina < 18 ? "#ffb28f" : "#a9f4ce";
  const phase = h.phase || "find-lift";
  $("#objectives").innerHTML = h.wfhActive
    ? '<div class="current-objective boarding">WFH APPROVED · PURPLE EXIT</div><small class="phase-hint">The gold arrow has rerouted. Go!</small>'
    : phase === "find-lift"
      ? '<div class="current-objective">1. CALL THE LIFT</div><small class="phase-hint">Gold arrow → doors. Press E.</small>'
      : phase === "waiting"
        ? `<div class="current-objective">2. LIFT IN ${Math.ceil(h.eta)}s</div><small class="phase-hint">Keep moving. SPACE dodges.</small><div class="lift-progress"><span style="width:${Math.max(0, 100 - (h.eta / (20 + (h.level - 1) * 5)) * 100)}%"></span></div>`
        : `<div class="current-objective boarding">3. BOARD NOW · ${Math.ceil(h.doors)}s</div><small class="phase-hint">Doors are open. Gold arrow!</small>`;
  const special = h.hrWindup;
  const incoming = h.incoming;
  const danger = !!special || !!incoming || h.suspicion > 0.25;
  $("#detection").hidden = !danger || h.hidden;
  const cues: Record<string, string> = {
    photo: "PHOTO SWEEP: dodge through or step out of its lane.",
    meeting: "MEETING INVITE: leave the outlined circle before it fills.",
    yap: "INFINITE YAP: leave the outlined zone.",
    paper: "FRIDAY DEPLOY: dodge the paper.",
    allhands: "ALL HANDS: get out of the marked circle.",
  };
  $("#detection").textContent = special
    ? "HR PHOTO CHARGE! SPACE sideways now."
    : incoming
      ? cues[incoming]
      : h.suspicion > 0.9
        ? "YOU WERE SPOTTED. Break sight, then change route."
        : "They are noticing you. Find cover or get moving.";
  $("#dash-status").textContent =
    h.dashCooldown > 0
      ? h.dashCooldown.toFixed(1) + "s"
      : h.stamina < 18
        ? "NEED STAMINA"
        : "READY";
  $("#dodge-ability").classList.toggle(
    "cooling",
    h.dashCooldown > 0 || h.stamina < 18,
  );
  $("#dialogue-box").hidden = !h.dialogue || !!h.context;
  if (h.dialogue) {
    $("#dialogue-speaker").textContent = h.dialogue.speaker;
    $("#dialogue-text").textContent = h.dialogue.text;
    $("#dialogue-speaker").style.color =
      "#" + h.dialogue.color.toString(16).padStart(6, "0");
  }
  $("#field-status").textContent =
    h.context ||
    (h.hidden
      ? "HIDDEN · DECOMPRESSING. −BS."
      : h.active.slack
        ? "LOOK BUSY · stay still. Moving cancels it."
        : h.active.call
          ? "FAKE CLIENT CALL · slower movement; HR and managers defer."
          : h.active.calendar
            ? "MEETING SHIELD · keep moving."
            : h.active.vpn
              ? "OFFICE FREEZE · the lift keeps coming."
              : h.target
                ? "E · " + h.target.toUpperCase()
                : h.wfhActive
                  ? "PURPLE EXIT OPEN. Follow the rerouted gold arrow."
                  : h.ready
                    ? "EXIT IS OPEN. YOUR WEEKEND IS THIS WAY."
                    : phase === "waiting"
                      ? `SPACE dodges · ${h.dodges} close calls · tools can buy time.`
                      : "Gold arrow → lift. E calls it. SPACE dodges HR.");
  for (const [id, d] of Object.entries(ABILITIES) as [
    Ability,
    (typeof ABILITIES)[Ability],
  ][]) {
    const b = document.querySelector<HTMLElement>(`[data-ability="${id}"]`);
    if (!b || h.level < d.level) continue;
    const cd = h.cooldowns[id] || 0,
      active = h.active[id] || 0;
    $("#ability-" + id).textContent =
      active > 0
        ? id === "wfh"
          ? "APPROVED"
          : Math.ceil(active) + "s ACTIVE"
        : cd > 0
          ? Math.ceil(cd) + "s"
          : id === "coffee"
            ? h.coffee + " CUPS"
            : id === "wfh"
              ? h.wfh + " TOKEN" + (h.wfh === 1 ? "" : "S")
              : "READY";
    b.classList.toggle("active", active > 0);
    b.classList.toggle("cooling", cd > 0);
    b.style.setProperty(
      "--cool",
      Math.max(0, 100 - (cd / (d.cooldown || 1)) * 100) + "%",
    );
  }
  const more = document.querySelector<HTMLElement>("#more-tools small");
  if (more) {
    const active = (["slack", "calendar", "vpn"] as Ability[]).find(
      (id) => (h.active[id] || 0) > 0,
    );
    more.textContent = active
      ? "ACTIVE " + Math.ceil(h.active[active]) + "s"
      : "OPTIONAL · 3–5";
  }
  if (
    save.settings.tips &&
    !paused &&
    !scene.ended &&
    !scene.cinematic &&
    !modalKind &&
    $("#toast").hidden
  ) {
    const tip = coach.next({
      elapsed: h.elapsed,
      phase: h.phase,
      coffee: h.coffee,
      suspicion: h.suspicion,
      lootTarget: h.lootTarget,
      hidden: h.hidden,
      danger: danger || h.activeDanger,
    });
    if (tip) {
      toast("TIP · " + tip.title, tip.text, 5);
      $("#toast").classList.add("coach-tip");
      $("#tip-dismiss").hidden = false;
      try {
        localStorage.setItem(
          "office-coach-v22",
          JSON.stringify([...coach.seen]),
        );
      } catch {
        /* No storage is required. */
      }
    }
  }
}) as EventListener);
window.addEventListener("office:end", ((e: CustomEvent) =>
  showResult(
    e.detail.win,
    e.detail.result,
    e.detail.earned,
    e.detail.alt,
  )) as EventListener);
function showResult(
  win: boolean,
  result: Result,
  earned: string[],
  alt: boolean,
) {
  lastResult = result;
  let newly: string[] = [];
  if (win) newly = record(save, result, earned);
  syncMenu();
  const final = win && result.level === 5 && !result.daily;
  const line = final
    ? "The glass doors open. A security guard nods. Outside, an auto driver says “meter plus twenty.” You have never been happier."
    : VICTORY_LINES[hash(result.seed) % VICTORY_LINES.length];
  modal(
    "result",
    `<div class="result-hero"><div class="modal-eyebrow">${result.daily ? "DAILY ESCAPE · " + result.seed : win ? "FRIDAY. FINALLY." : "MEETING ACCEPTED. INVOLUNTARILY."}</div><div class="result-icon ${win ? "" : "fail"}">${win ? "↗" : "∞"}</div><h2>${win ? (final ? "YOU HAVE A LIFE." : "OUT OF OFFICE.") : "PROMOTED TO<br>STAYING LATE."}</h2><p>${win ? line : "Congratulations! You’re now Senior Vice President of Staying Late. Your compensation: exposure to another all-hands."}</p>${win ? `<div class="medal">${result.medal.toUpperCase()}</div><div class="score-large">${result.score.toLocaleString()}<small style="font-size:10px;letter-spacing:1px;margin-left:8px">PTS</small></div>` : '<div class="medal">YOUR WEEKEND DESERVES A RETRY.</div>'}${result.lootValue ? `<p class="result-achievements">${win ? "LOOT BANKED" : "LOOT LOST"} · ${result.lootValue.toLocaleString()} PTS</p>` : ""}${result.dodges ? `<p class="result-achievements">${result.dodges} CLUTCH DODGES · +${result.dodges * 125} POINTS</p>` : ""}${result.funScore ? `<p class="result-achievements">HR FUN BONUS · +${result.funScore * 2} POINTS</p>` : ""}<div class="result-stats"><div><b>${formatTime(result.time)}</b><small>TIME</small></div><div><b>${result.spots}</b><small>SPOTTED</small></div><div><b>${result.bs}%</b><small>FINAL BS</small></div><div><b>${result.collectibles}</b><small>STOLEN ITEMS</small></div></div>${newly.length ? `<div class="result-achievements">${newly.map((id) => "UNLOCKED · " + ACHIEVEMENTS.find((a) => a.id === id)?.name).join("<br>")}</div>` : ""}${alt ? "<p>Purple exit approved. Remote work is a state of escape.</p>" : ""}<div class="modal-actions" style="justify-content:center"><button id="result-primary" class="primary">${!win ? "RETRY INSTANTLY ↻" : result.daily || result.level === 5 ? "PLAY AGAIN ↻" : "NEXT FLOOR ↗"}</button><button id="result-retry" class="secondary">${win ? "REPLAY FLOOR" : "MAIN MENU"}</button>${win ? '<button id="share-btn" class="secondary">SHARE REPORT ↗</button>' : '<button id="result-tip" class="secondary">SURVIVAL TIPS</button>'}<button id="result-home" class="secondary">${win ? "MAIN MENU" : "CHOOSE FLOOR"}</button></div><details class="incident-report"><summary>OFFICIAL INCIDENT REPORT ↓</summary><ul>${incidentReport(
      result,
      win,
    )
      .map((line) => `<li>${escapeHTML(line)}</li>`)
      .join(
        "",
      )}</ul></details><div class="share-status" id="share-status"></div></div>`,
    false,
  );
  $("#result-primary").onclick = () =>
    start(
      win && !result.daily && result.level < 5
        ? result.level + 1
        : result.level,
      result.daily,
      !win ? result.seed : undefined,
    );
  $("#result-retry").onclick = () =>
    win ? start(result.level, result.daily) : goHome();
  $("#result-home").onclick = () => (win ? goHome() : floorSelect());
  if (win) $("#share-btn").onclick = share;
  else $("#result-tip").onclick = () => how(true);
}
function escapeHTML(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
}
function share() {
  if (!lastResult) return;
  const r = lastResult;
  const text = [
    "THE GREAT OFFICE ESCAPE · INCIDENT REPORT",
    ...incidentReport(r, true),
    `${r.medal} · ${r.score.toLocaleString()} pts${r.daily ? " · Daily " + r.seed : ""}`,
  ].join("\n");
  if (navigator.share)
    navigator
      .share({ title: "The Great Office Escape: 4:59 PM", text })
      .then(() => {
        $("#share-status").textContent = "Your weekend has been broadcast.";
      })
      .catch(() => {
        $("#share-status").textContent = text;
      });
  else if (navigator.clipboard)
    navigator.clipboard
      .writeText(text)
      .then(() => {
        $("#share-status").textContent =
          "Result copied. Paste it where the managers can’t see.";
      })
      .catch(() => {
        $("#share-status").textContent = text;
      });
  else $("#share-status").textContent = text;
}
function floorSelect() {
  modal(
    "floors",
    `<div class="modal-eyebrow">FIVE FLOORS BETWEEN YOU AND A LIFE</div><h2>CHOOSE YOUR<br>WORKPLACE HAZARD.</h2><p>Escape each floor to unlock the next. Daily mode lets everyone attempt the same floor and seed.</p><div class="floor-grid">${LEVELS.map((l) => `<button class="floor-card" data-floor="${l.id}" ${l.id > save.unlocked ? "disabled" : ""}><span>0${l.id}</span><div><strong>${l.name}</strong><small>${l.subtitle}</small></div><em>${l.id > save.unlocked ? "LOCKED" : save.bests[`v2-${l.id}`]?.medal || "UNESCAPED"}${save.bests[`v2-${l.id}`] ? "<br>" + save.bests[`v2-${l.id}`].score.toLocaleString() + " pts" : ""}</em></button>`).join("")}</div>`,
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-floor]")
    .forEach((b) => (b.onclick = () => start(Number(b.dataset.floor))));
}
function achievements() {
  modal(
    "achievements",
    `<div class="modal-eyebrow">${save.achievements.length} / ${ACHIEVEMENTS.length} UNLOCKED · SAVED ON THIS DEVICE</div><h2>EXCELLENT AT<br>NOT BEING HERE.</h2><div class="achievement-grid">${ACHIEVEMENTS.map((a) => `<div class="achievement ${save.achievements.includes(a.id) ? "unlocked" : ""}"><b>${save.achievements.includes(a.id) ? "✓" : "□"} ${a.name}</b><p>${a.text}</p><small>${save.achievements.includes(a.id) ? "UNLOCKED" : "KEEP ESCAPING"}</small></div>`).join("")}</div>`,
  );
}
function settings() {
  modal(
    "settings",
    `<div class="modal-eyebrow">YOUR OFFICE. YOUR TERMS.</div><h2>SET BOUNDARIES.</h2><label class="setting-row">Music <input id="music-volume" type="range" min="0" max="1" step="0.05" value="${save.settings.music}" aria-label="Music volume"></label><label class="setting-row">Sound effects <input id="sfx-volume" type="range" min="0" max="1" step="0.05" value="${save.settings.sfx}" aria-label="Sound effects volume"></label><label class="setting-row">Mute all audio <input id="mute-check" type="checkbox" ${save.settings.mute ? "checked" : ""}></label><label class="setting-row">Reduced motion <input id="motion-check" type="checkbox" ${save.settings.reducedMotion ? "checked" : ""}></label><label class="setting-row">Hit scene length <select id="hit-scene-mode" aria-label="Hit scene length"><option value="brief" ${save.settings.hitScenes === "brief" ? "selected" : ""}>Brief · ~1 second</option><option value="long" ${save.settings.hitScenes === "long" ? "selected" : ""}>Long haul · ~3–4 seconds</option></select></label><label class="setting-row">Context tips <input id="tips-check" type="checkbox" ${save.settings.tips ? "checked" : ""}></label><p>Each hit shows its own animated event. The office pauses; E or tap skips.</p><p>Progress is saved locally on this browser. No accounts, trackers, AI calls, or meetings required.</p><div class="modal-actions"><button id="settings-done" class="primary">DONE ↗</button></div>`,
    true,
  );
  $("#music-volume").oninput = () => {
    save.settings.music = Number($<HTMLInputElement>("#music-volume").value);
    applySettings();
  };
  $("#sfx-volume").oninput = () => {
    save.settings.sfx = Number($<HTMLInputElement>("#sfx-volume").value);
    applySettings();
    audio.sfx("item");
  };
  $("#mute-check").onchange = () => {
    save.settings.mute = $<HTMLInputElement>("#mute-check").checked;
    applySettings();
  };
  $("#motion-check").onchange = () => {
    save.settings.reducedMotion = $<HTMLInputElement>("#motion-check").checked;
    scene.reducedMotion = save.settings.reducedMotion;
    persist(save);
  };
  $("#hit-scene-mode").onchange = () => {
    save.settings.hitScenes =
      $<HTMLSelectElement>("#hit-scene-mode").value === "long"
        ? "long"
        : "brief";
    persist(save);
  };
  $("#tips-check").onchange = () => {
    save.settings.tips = $<HTMLInputElement>("#tips-check").checked;
    persist(save);
    if (!save.settings.tips && $("#toast").classList.contains("coach-tip"))
      $("#toast").hidden = true;
  };
  $("#settings-done").onclick = closeModal;
}
function applySettings() {
  audio.setVolumes(save.settings.music, save.settings.sfx, save.settings.mute);
  persist(save);
  syncMenu();
}
function how(afterFail = false) {
  modal(
    "how",
    `<div class="modal-eyebrow">OBJECTIVE: LEAVE. DO NOT EXPLAIN.</div><h2>THE SURVIVAL GUIDE.</h2><div class="guide-grid"><div class="guide-block"><strong>01 · GET OUT</strong><p>Follow the gold arrow. Your own badge is already in your pocket. Press E at the gold elevator doors to call the lift. Dodge the office while it arrives, then board before the 10-second door window ends. Side switches are optional sabotage, not compulsory errands. A purple house token automatically opens the WFH exit—no extra ability activation. The lift still works too.</p></div><div class="guide-block"><strong>02 · DON’T GET PERCEIVED</strong><p>Colored cones show vision. Walls and furniture block sight. All vision cones use the same danger colour. Outlined areas warn; filled areas are active. A filling ring gives you a grace period. Break sight to lose pursuit. Sprinting is loud. Interns are fast, not omniscient.</p></div><div class="guide-block"><strong>03 · BS IS NOT HEALTHCARE</strong><p>Getting caught adds Corporate BS. At 100%, you stay late. House-shaped hiding markers offer six seconds of cover, then need a cooldown. Coffee and pantry breaks reduce BS. After a catch, three seconds of grace let you get moving again.</p></div><div class="guide-block"><strong>04 · USE YOUR TOOLS</strong><p>SPACE is a short dodge, not an interaction. It avoids HR lunges and moving hazard sweeps, but cannot cross furniture. Coffee only lures two colleagues and will not fool a pursuer who can still see you. Coffee and Fake Call are your primary optional tools. More Tools pauses the office and offers Look Busy (stay still), Meeting Shield and Office Freeze. Shortcuts 3–5 still work. A WFH token opens the alternate exit automatically.</p></div><div class="guide-block"><strong>05 · HACK HR’S FUN FRIDAY</strong><p>Find the pink HR Fun Activity booth on floors 2, 4 and 5. Press E and clap in the mint timing zone. Three of five hits reduce BS by 25, refill one coffee and distract HR for 12 seconds. Practice from CLAP PRACTICE in the main menu.</p></div><div class="guide-block"><strong>06 · STEAL THE OFFICE</strong><p>Hold E / ACT beside TVs, keyboards, plants, trophies, laptops or coffee machines. Snacks only need a tap and give recovery. Bulky equipment slows you and attracts attention. Your bag points are banked only by escaping.</p></div><div class="guide-block"><strong>07 · WATCH MEETING DOORS</strong><p>Amber doorway lights warn that a meeting is ending. Colleagues physically walk out, can spot you and alert the manager, then return. Use cover, calls, coffee or a dodge.</p></div></div><p><kbd>WASD</kbd> / arrows: move · <kbd>SHIFT</kbd> sprint · <kbd>SPACE</kbd> dodge · <kbd>E</kbd> use / hold to steal · <kbd>1/2</kbd> primary tools · <kbd>3–5</kbd> optional extras · <kbd>ESC</kbd> pause · <kbd>M</kbd> mute. Touch: drag joystick, hold RUN, tap DASH to evade, ACT to use / hold to steal. Landscape gives a wider view.</p><details><summary style="font-size:10px;color:#a9f4ce;cursor:pointer">KNOW YOUR CORPORATE THREATS ↓</summary>${Object.values(
      ENEMIES,
    )
      .map(
        (d) =>
          `<div class="threat-row" style="border-color:#${d.color.toString(16)}"><b>${d.name} · ${d.title}</b><p>+${d.damage} BS. Weakness: ${d.weakness}. ${d.name === "The Yappaccino Intern" ? "Fast erratic patrols. Nearby yap slows you; hear 12 seconds for Yappologist." : d.name === "Office Gossip" ? "Broadcasts your location to nearby enemies." : d.name === "The Founder" ? "Long sightlines. All Hands expands awareness. Ignores fake calls." : d.name === "HR" ? "Lines up a photo, visibly locks her aim, then lunges. Dodge sideways! Pink photo sweeps cross the office during lift waits." : d.name === "Product Manager" ? "Meeting zones make you move. Getting caught adds a one-time three-second lift delay; sabotage the roadmap or use VPN." : "Investigates badge pings after the lift is called. A caught quick sync adds a one-time four-second lift delay. Fake calls or cover help."}</p></div>`,
      )
      .join(
        "",
      )}</details><div class="modal-actions"><button id="how-done" class="primary">${afterFail ? "RETRY FLOOR ↻" : "GOT IT. LEAVING. ↗"}</button></div>`,
  );
  $("#how-done").onclick = () =>
    afterFail && lastResult
      ? start(lastResult.level, lastResult.daily)
      : closeModal();
}
function pauseMenu() {
  if (!playing || scene.ended) return;
  modal(
    "pause",
    `<div class="modal-eyebrow">TIME IS PAUSED. YOUR MANAGER IS NOT.</div><h2>BRB. DEFINITELY<br>WORKING.</h2><p>No movement, timers, cooldowns, or enemies advance while paused. Your weekend can wait a second.</p><div class="modal-actions"><button id="resume-btn" class="primary">KEEP ESCAPING ↗</button><button id="restart-btn" class="secondary">RESTART FLOOR ↻</button><button id="pause-help" class="secondary">SURVIVAL GUIDE</button><button id="pause-home" class="secondary">MAIN MENU</button></div>`,
    true,
  );
  $("#resume-btn").onclick = closeModal;
  $("#restart-btn").onclick = () =>
    start(scene.level.id, scene.options.daily, scene.options.seed);
  $("#pause-help").onclick = () => how();
  $("#pause-home").onclick = home;
}
function launchFun(practice: boolean, id?: string) {
  modal("fun", '<div id="fun-root"></div>', true);
  let outcome: FunOutcome | null = null;
  const sprite = scene.textures.exists("hr")
    ? scene.textures.getBase64("hr")
    : "";
  cleanupFun = playFunFriday({
    root: $("#fun-root"),
    audio,
    sprite,
    practice,
    onScored: (result, seconds) => {
      outcome = result;
      if (!practice && id) scene.resolveFun(id, result, seconds);
      else {
        try {
          const best = Math.max(
            Number(localStorage.getItem("office-fun-best")) || 0,
            result.score,
          );
          localStorage.setItem("office-fun-best", String(best));
          $("#fun-score").textContent += ` · BEST ${best}`;
        } catch {
          /* Gameplay survives unavailable storage. */
        }
      }
    },
    onReturn: () => {
      closeModal();
      if (!practice && outcome)
        toast(
          outcome.success
            ? "CULTURE SUCCESSFULLY HACKED"
            : "HR HAS NOTED YOUR AUTHENTICITY",
          outcome.success
            ? "−25 BS · +1 coffee · HR distracted for 12s. Get moving."
            : "+8 BS. Nobody can clap product-market fit into existence.",
          4,
        );
    },
  });
}
window.addEventListener("office:fun", ((e: CustomEvent) => {
  if (playing && !paused) launchFun(false, e.detail.id);
}) as EventListener);
$("#fun-btn").onclick = () => start(2);
$("#fun-practice-btn").onclick = () => launchFun(true);
$("#play-btn").onclick = () => start(save.unlocked);
$("#daily-btn").onclick = () => {
  const seed = dailySeed(),
    l = (hash(seed) % 5) + 1;
  modal(
    "daily",
    `<div class="modal-eyebrow">SAME SEED. SAME CHAOS. EVERYONE.</div><h2>THE DAILY<br>STAND-DOWN.</h2><p>${seed} UTC · Floor ${l}: ${LEVELS[l - 1].name}</p><p>Identical starting resources and seeded patrols. No campaign unlocks needed. Share your score to compare with colleagues. Best today: <strong style="color:#a9f4ce">${save.dailyBests[`v2:${seed}`]?.toLocaleString() || "UNESCAPED"}</strong>.</p><p style="font-size:9px">Scores are local and honor-system; no online leaderboard. Different choices naturally change the simulation.</p><div class="modal-actions"><button id="daily-start" class="primary">ATTEMPT TODAY’S ESCAPE ↗</button></div>`,
    true,
  );
  $("#daily-start").onclick = () => start(l, true);
};
$("#floors-btn").onclick = floorSelect;
$("#achievements-btn").onclick = achievements;
$("#how-btn").onclick = () => how();
$("#settings-btn").onclick = settings;
$("#sound-btn").onclick = () => {
  save.settings.mute = !save.settings.mute;
  audio.unlock();
  applySettings();
};
$("#pause-btn").onclick = pauseMenu;
$("#home-link").onclick = (e) => {
  e.preventDefault();
  home();
};
document.addEventListener("pointerdown", () => audio.unlock(), {
  passive: true,
});
document.addEventListener("keydown", (e) => {
  audio.unlock();
  if (e.code === "KeyM" && !e.repeat) {
    save.settings.mute = !save.settings.mute;
    applySettings();
  }
  if (e.code === "Escape") {
    e.preventDefault();
    if (modalKind && modalKind !== "result") closeModal();
    else if (playing && !scene.ended) pauseMenu();
  }
  // Phaser ignores events already prevented by a document listener. Handle the
  // dodge here before preventing browser Space behavior; leave movement keys
  // to Phaser's own capture system so arrows work as well as WASD.
  if (e.code === "Space" && playing && !paused && !scene.ended) {
    e.preventDefault();
    if (!e.repeat) scene.dash();
  }
  if (e.code === "KeyR" && modalKind === "result" && lastResult)
    start(
      lastResult.level,
      lastResult.daily,
      scene.won ? undefined : lastResult.seed,
    );
  if (e.key === "Tab" && modalKind) {
    const nodes = Array.from(
      $("#modal-root").querySelectorAll<HTMLElement>(
        "button:not(:disabled),input,summary",
      ),
    );
    const a = nodes[0],
      b = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === a) {
      e.preventDefault();
      b?.focus();
    } else if (!e.shiftKey && document.activeElement === b) {
      e.preventDefault();
      a?.focus();
    }
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing && !scene.ended && !paused) pauseMenu();
});
window.addEventListener("blur", () => {
  scene.touch = { x: 0, y: 0, sprint: false };
  scene.holdingInteract = false;
  if (playing && !scene.ended && !paused) pauseMenu();
});
$("#touch-dash").onpointerdown = (e) => {
  e.preventDefault();
  if (!paused) scene.dash();
};
const joy = $("#joystick"),
  stick = $("#stick");
let joyPointer = -1;
function resetJoy() {
  joyPointer = -1;
  scene.touch.x = 0;
  scene.touch.y = 0;
  stick.style.transform = "translate(0px,0px)";
}
function updateJoy(e: PointerEvent) {
  const r = joy.getBoundingClientRect(),
    x = e.clientX - r.left - r.width / 2,
    y = e.clientY - r.top - r.height / 2,
    len = Math.hypot(x, y),
    max = r.width * 0.31,
    factor = Math.min(1, max / (len || 1));
  const nx = x * factor,
    ny = y * factor;
  stick.style.transform = `translate(${nx}px,${ny}px)`;
  scene.touch.x = len < 9 ? 0 : nx / max;
  scene.touch.y = len < 9 ? 0 : ny / max;
}
joy.onpointerdown = (e) => {
  e.preventDefault();
  if (paused) return;
  joyPointer = e.pointerId;
  joy.setPointerCapture(e.pointerId);
  updateJoy(e);
};
joy.onpointermove = (e) => {
  if (e.pointerId === joyPointer) {
    e.preventDefault();
    updateJoy(e);
  }
};
joy.onpointerup = resetJoy;
joy.onpointercancel = resetJoy;
joy.onlostpointercapture = resetJoy;
const sprint = $("#touch-sprint");
sprint.onpointerdown = (e) => {
  e.preventDefault();
  sprint.setPointerCapture(e.pointerId);
  scene.touch.sprint = true;
};
sprint.onpointerup = () => {
  scene.touch.sprint = false;
};
sprint.onpointercancel = () => {
  scene.touch.sprint = false;
};
sprint.onlostpointercapture = () => {
  scene.touch.sprint = false;
};
const act = $("#touch-interact");
act.onpointerdown = (e) => {
  e.preventDefault();
  if (!paused) {
    act.setPointerCapture(e.pointerId);
    scene.holdingInteract = true;
    scene.interact();
  }
};
act.onpointerup = () => {
  scene.holdingInteract = false;
};
act.onpointercancel = () => {
  scene.holdingInteract = false;
};
act.onlostpointercapture = () => {
  scene.holdingInteract = false;
};
window.addEventListener("office:toast", () => {
  if (scene.preview) $("#toast").hidden = true;
});
// Read-only state aids reproducible QA without exposing cheats in the shipped build.
const inspection: {
  snapshot: () => unknown;
  ready: () => boolean;
  qa?: unknown;
} = { snapshot: () => scene.snapshot(), ready: () => !!scene.player };
if (import.meta.env.DEV && new URLSearchParams(location.search).has("qa"))
  inspection.qa = {
    start: (level: number, seed?: string) => start(level, false, seed),
    position: (x: number, y: number) => {
      scene.pos = { x, y };
    },
    bs: (v: number) => {
      scene.bs = v;
    },
    ability: (a: Ability) => scene.ability(a),
    interact: () => scene.interact(),
    hit: (kind: HitEvent["kind"], damage = 10) =>
      scene.takeHit(
        kind,
        damage,
        "QA " + kind,
        "Controlled hit-scene integration check",
      ),
  };
Object.defineProperty(window, "__office", {
  value: inspection,
  writable: false,
});
// Display the hand-drawn office immediately; menu never runs an active stealth simulation.
game.events.once("ready", () => {
  scene.scene.restart({ level: 5, preview: true, seed: "menu" });
});
setTimeout(() => {
  if (!playing && scene.scene.isActive() && !scene.preview)
    scene.scene.restart({ level: 5, preview: true, seed: "menu" });
}, 150);
