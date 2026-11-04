import Phaser from "phaser";
import { createTextures, renderOffice } from "../art/art";
import { OfficeAudio } from "../audio/audio";
import {
  Navigator,
  center,
  clamp,
  dist,
  visible,
  blocked,
} from "../game/logic";
import type { Level, Point } from "../game/types";
import { SPRINT_COURSES } from "./courses";
import { SprintRun, dailyRace, formatRaceTime } from "./model";
import type { RaceOptions, RaceResult } from "./types";
export const raceEmit = (name: string, detail: unknown) =>
  window.dispatchEvent(new CustomEvent("race:" + name, { detail }));
export class SprintScene extends Phaser.Scene {
  audio: OfficeAudio;
  run!: SprintRun;
  nav!: Navigator;
  player!: Phaser.GameObjects.Image;
  art!: Phaser.GameObjects.Graphics;
  exitText!: Phaser.GameObjects.Text;
  guards = new Map<string, Phaser.GameObjects.Image>();
  letters = new Map<string, Phaser.GameObjects.Container>();
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  touch = { x: 0, y: 0, sprint: false };
  dashQueued = false;
  lastNow = 0;
  hudAt = 0;
  stepAt = 0;
  autoSent = false;
  reducedMotion = false;
  hint: Point | null = null;
  hintAt = 0;
  constructor(audio: OfficeAudio) {
    super("sprint");
    this.audio = audio;
  }
  init(options: RaceOptions) {
    const base =
      SPRINT_COURSES.find((c) => c.id === options.courseId) ||
      SPRINT_COURSES[0];
    if (options.mode === "buzzword") {
      const day = options.day || new Date().toISOString().slice(0, 10),
        daily = dailyRace(day, SPRINT_COURSES);
      const course = {
        ...daily.course,
        gold: daily.course.gold + daily.word.word.length * 2,
        silver: daily.course.silver + daily.word.word.length * 3,
      };
      this.run = new SprintRun(
        course,
        { ...options, day, courseId: course.id },
        daily.word,
        daily.letters,
      );
    } else
      this.run = new SprintRun(base, { mode: "sprint", courseId: base.id });
    this.guards = new Map();
    this.letters = new Map();
    this.touch = { x: 0, y: 0, sprint: false };
    this.dashQueued = false;
    this.hudAt = 0;
    this.stepAt = 0;
    this.autoSent = false;
    this.hintAt = 0;
    this.hint = null;
  }
  create() {
    const c = this.run.course;
    createTextures(this);
    const background: Level = {
      id: 1000 + c.id,
      name: c.name,
      subtitle: c.subtitle,
      brief: "",
      tip: "",
      width: c.width,
      height: c.height,
      spawn: c.spawn,
      exit: c.exit,
      walls: c.walls,
      props: c.props,
      zones: c.zones,
      items: [],
      interactions: [],
      gates: [],
      enemies: [],
      required: [],
      par: c.gold,
      event: "",
    };
    renderOffice(this, background);
    this.nav = new Navigator(c.width, c.height, [...c.walls, ...c.props]);
    this.art = this.add.graphics().setDepth(18);
    this.player = this.add
      .image(this.run.pos.x, this.run.pos.y, "player")
      .setScale(1.45)
      .setDepth(45);
    for (const g of c.guards)
      this.guards.set(
        g.id,
        this.add.image(0, 0, g.kind).setScale(1.35).setDepth(40),
      );
    for (const letter of this.run.letters) {
      const plate = this.add
        .graphics()
        .fillStyle(0x142437, 0.95)
        .fillRoundedRect(-17, -19, 34, 38, 4)
        .lineStyle(2, 0xffdf91)
        .strokeRoundedRect(-17, -19, 34, 38, 4);
      const text = this.add
        .text(0, -1, letter.char, {
          fontFamily: "monospace",
          fontSize: "25px",
          fontStyle: "bold",
          color: "#ffe7a8",
        })
        .setOrigin(0.5);
      this.letters.set(
        letter.id,
        this.add.container(letter.x, letter.y, [plate, text]).setDepth(25),
      );
    }
    const e = center(c.exit);
    this.exitText = this.add
      .text(e.x, e.y - 9, "EXIT →", {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#b8ffdc",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(26);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    const key = (event: KeyboardEvent) => {
      if (
        event.code === "Space" &&
        !event.repeat &&
        this.run.phase === "running"
      )
        this.queueDash();
    };
    this.input.keyboard!.on("keydown", key);
    const resumed = () => {
      this.lastNow = performance.now();
      this.resetInput();
    };
    this.events.on("resume", resumed);
    this.events.once("shutdown", () => {
      this.audio.stopCallRingtone();
      this.input.keyboard?.off("keydown", key);
      this.events.off("resume", resumed);
      this.scale.off("resize", this.resize, this);
    });
    this.scale.on("resize", this.resize, this);
    this.resize();
    this.lastNow = performance.now();
    this.audio.music("game");
    this.audio.sfx("click");
    this.publish();
  }
  resetInput() {
    this.touch = { x: 0, y: 0, sprint: false };
    this.dashQueued = false;
    if (this.keys) Object.values(this.keys).forEach((k) => k.reset());
  }
  queueDash() {
    if (this.run?.phase === "running" && !this.scene.isPaused())
      this.dashQueued = true;
  }
  resize() {
    if (!this.player) return;
    const c = this.cameras.main,
      course = this.run.course,
      w = this.scale.width,
      h = this.scale.height;
    const small = w < 700 || matchMedia("(pointer:coarse)").matches;
    const zoom = small
      ? w < 500
        ? 1.02
        : 1.0
      : Math.min(
          1.15,
          Math.max(0.75, Math.min(w / course.width, h / course.height)),
        );
    c.setZoom(zoom).setBackgroundColor("#101625");
    if (small) {
      c.setBounds(0, 0, course.width, course.height);
      c.startFollow(this.player, true, 0.15, 0.15);
    } else {
      c.stopFollow();
      c.removeBounds();
      c.centerOn(course.width / 2, course.height / 2);
    }
  }
  update() {
    if (!this.run) return;
    const now = performance.now(),
      dt = Math.max(0, (now - this.lastNow) / 1000);
    this.lastNow = now;
    const before = { ...this.run.pos },
      wasDash = this.run.dashLeft > 0;
    const x =
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) -
      (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0) +
      this.touch.x;
    const y =
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) -
      (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0) +
      this.touch.y;
    const events = this.run.tick(dt, {
      x,
      y,
      sprint: this.keys.SHIFT.isDown || this.touch.sprint,
      dash: this.dashQueued,
    });
    this.dashQueued = false;
    for (const e of events) {
      if (e.type === "start") this.audio.sfx("ability");
      if (e.type === "letter") this.audio.sfx("item");
      if (e.type === "locked") raceEmit("notice", e.text);
      if (e.type === "fail") {
        if (this.run.options.mode === "sprint") this.audio.startCallRingtone();
        else this.audio.sfx("meeting-call");
        if (!this.reducedMotion) this.cameras.main.shake(100, 0.002);
        raceEmit("fail", {
          reason: e.text,
          course: this.run.course,
          mode: this.run.options.mode,
        });
      }
      if (e.type === "win" && e.result) {
        this.audio.sfx("exit");
        this.audio.music("victory");
        this.tweens.add({
          targets: this.player,
          alpha: 0,
          scaleX: 0.6,
          scaleY: 0.6,
          duration: this.reducedMotion ? 0 : 350,
        });
        raceEmit("win", e.result);
      }
    }
    if (this.run.dashLeft > 0 && !wasDash) {
      this.audio.sfx("ability");
      if (!this.reducedMotion)
        for (let n = 1; n <= 3; n++) {
          const ghost = this.add
            .image(
              before.x - this.run.facing.x * n * 9,
              before.y - this.run.facing.y * n * 9,
              "player",
            )
            .setScale(1.45)
            .setTint(0xa9f4ce)
            .setAlpha(0.3 - n * 0.05)
            .setDepth(42);
          this.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 160 + n * 35,
            onComplete: () => ghost.destroy(),
          });
        }
    }
    if (dist(before, this.run.pos) > 1 && this.run.elapsed > this.stepAt) {
      this.audio.sfx("step");
      this.stepAt = this.run.elapsed + 0.25;
    }
    if (
      this.run.options.mode === "buzzword" &&
      this.run.phase === "failed" &&
      this.run.failureAge >= 1.1 &&
      !this.autoSent
    ) {
      this.autoSent = true;
      raceEmit("auto-retry", {});
    }
    this.renderRun();
    if (now >= this.hudAt) {
      this.publish();
      this.hudAt = now + 40;
    }
  }
  renderRun() {
    const r = this.run,
      g = this.art,
      c = r.course;
    g.clear();
    const obs = [...c.walls, ...c.props];
    const exit = center(c.exit),
      open = r.options.mode === "sprint" || r.letters.every((l) => l.collected);
    g.fillStyle(0x17263a).fillRoundedRect(
      c.exit.x - 5,
      c.exit.y - 5,
      c.exit.w + 10,
      c.exit.h + 10,
      4,
    );
    g.fillStyle(open ? 0x315e55 : 0x5c4b45).fillRect(
      c.exit.x,
      c.exit.y,
      c.exit.w,
      c.exit.h,
    );
    g.lineStyle(3, open ? 0xa9f4ce : 0xffd18a, 1).strokeRect(
      c.exit.x,
      c.exit.y,
      c.exit.w,
      c.exit.h,
    );
    g.lineStyle(2, 0x162735).lineBetween(
      exit.x,
      c.exit.y,
      exit.x,
      c.exit.y + c.exit.h,
    );
    this.exitText
      .setText(open ? "EXIT →" : "LETTERS\nFIRST")
      .setColor(open ? "#b8ffdc" : "#ffe3a0");
    for (const h of r.hazards) {
      if (!h.warning && !h.active) continue;
      const color = h.warning ? 0xffd18a : 0xff7e8c;
      if (h.kind === "photo") {
        if (h.warning) {
          const left = Math.min(h.from.x, h.to.x) - h.w / 2,
            right = Math.max(h.from.x, h.to.x) + h.w / 2;
          g.lineStyle(2, color, 0.7).strokeRect(
            left,
            h.y - h.h / 2,
            right - left,
            h.h,
          );
          for (let xx = left + 18; xx < right; xx += 40)
            g.fillStyle(color, 0.55).fillTriangle(
              xx,
              h.y - 4,
              xx + 8,
              h.y,
              xx,
              h.y + 4,
            );
        } else
          g.fillStyle(color, 0.3)
            .fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h)
            .lineStyle(3, 0xffd3dc)
            .strokeRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);
      } else if (h.kind === "paper") {
        if (h.warning)
          g.lineStyle(2, color, 0.7).lineBetween(
            h.from.x,
            h.from.y,
            h.to.x,
            h.to.y,
          );
        else {
          g.fillStyle(color, 0.15).fillCircle(h.x, h.y, h.radius + 4);
          g.fillStyle(0xe9e7df).fillRect(h.x - 10, h.y - 13, 20, 26);
          g.fillStyle(0x5d7892)
            .fillRect(h.x - 6, h.y - 7, 12, 2)
            .fillRect(h.x - 6, h.y - 1, 8, 2)
            .fillRect(h.x - 6, h.y + 5, 10, 2);
        }
      } else {
        g.lineStyle(h.active ? 4 : 2, color, 0.85).strokeCircle(
          h.x,
          h.y,
          h.radius,
        );
        if (h.active) g.fillStyle(color, 0.18).fillCircle(h.x, h.y, h.radius);
      }
    }
    for (const guard of r.guards) {
      const def = c.guards.find((d) => d.id === guard.id)!,
        sprite = this.guards.get(guard.id)!;
      sprite
        .setPosition(guard.x, guard.y + Math.sin(r.elapsed * 11) * 0.8)
        .setFlipX(Math.cos(guard.angle) < 0);
      const pts: { x: number; y: number }[] = [guard];
      for (
        let a = guard.angle - def.fov / 2;
        a < guard.angle + def.fov / 2 + 0.01;
        a += def.fov / 20
      ) {
        let range = def.range;
        for (let d = 10; d < def.range; d += 10)
          if (
            blocked(
              { x: guard.x + Math.cos(a) * d, y: guard.y + Math.sin(a) * d },
              1,
              obs,
            )
          ) {
            range = d - 3;
            break;
          }
        pts.push({
          x: guard.x + Math.cos(a) * range,
          y: guard.y + Math.sin(a) * range,
        });
      }
      g.fillStyle(0xff7e8c, 0.09 + guard.awareness * 0.1).fillPoints(pts, true);
      if (guard.awareness > 0.03)
        g.lineStyle(3, 0xffd18a, 0.9)
          .beginPath()
          .arc(
            guard.x,
            guard.y,
            23,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * guard.awareness,
          )
          .strokePath();
    }
    for (const letter of r.letters) {
      const node = this.letters.get(letter.id)!;
      node.setVisible(!letter.collected);
      if (!letter.collected)
        node.setY(letter.y + Math.sin(r.elapsed * 3 + letter.index) * 2);
    }
    if (r.phase !== "finished")
      this.player
        .setPosition(
          r.pos.x,
          r.pos.y +
            (r.phase === "running" && dist(r.pos, c.spawn) > 1
              ? Math.sin(r.elapsed * 13)
              : 0),
        )
        .setFlipX(r.facing.x < 0)
        .setTint(r.phase === "failed" ? 0xff8b9e : 0xffffff);
    if (r.dashLeft > 0)
      g.lineStyle(2, 0xb9ffe0, 0.9).strokeCircle(r.pos.x, r.pos.y, 22);
    const choices = r.letters.filter((l) => !l.collected);
    const goal: Point = choices.length
      ? choices.reduce((a, b) => (dist(r.pos, a) < dist(r.pos, b) ? a : b))
      : exit;
    if (r.elapsed >= this.hintAt || !this.hint) {
      const path = this.nav.path(r.pos, goal);
      let next = path[0] || goal;
      for (const p of path.slice(0, 8)) {
        if (!visible(r.pos, p, obs)) break;
        next = p;
        if (dist(r.pos, p) > 90) break;
      }
      this.hint = next;
      this.hintAt = r.elapsed + 0.35;
    }
    if (dist(r.pos, goal) > 55 && this.hint) {
      const a = Math.atan2(this.hint.y - r.pos.y, this.hint.x - r.pos.x),
        x = r.pos.x + Math.cos(a) * 35,
        y = r.pos.y + Math.sin(a) * 35;
      g.fillStyle(0xffdda0, 0.9).fillTriangle(
        x + Math.cos(a) * 7,
        y + Math.sin(a) * 7,
        x + Math.cos(a + 2.5) * 6,
        y + Math.sin(a + 2.5) * 6,
        x + Math.cos(a - 2.5) * 6,
        y + Math.sin(a - 2.5) * 6,
      );
    }
  }
  publish() {
    const r = this.run;
    raceEmit("hud", {
      mode: r.options.mode,
      courseId: r.course.id,
      name: r.course.name,
      phase: r.phase,
      countdown: r.countdown,
      elapsed: r.elapsed,
      time: formatRaceTime(r.elapsed),
      gold: r.course.gold,
      silver: r.course.silver,
      dashCooldown: r.dashCooldown,
      letters: r.letters.map((l) => ({
        index: l.index,
        char: l.char,
        collected: l.collected,
      })),
      failureAge: r.failureAge,
      day: r.options.day,
    });
  }
  snapshot() {
    if (!this.run) return null;
    const r = this.run;
    return {
      mode: r.options.mode,
      courseId: r.course.id,
      name: r.course.name,
      phase: r.phase,
      countdown: r.countdown,
      elapsed: r.elapsed,
      pos: { ...r.pos },
      facing: { ...r.facing },
      dashLeft: r.dashLeft,
      dashCooldown: r.dashCooldown,
      failureAge: r.failureAge,
      failReason: r.failReason,
      guards: r.guards.map((g) => ({ ...g })),
      hazards: r.hazards.map((h) => ({ ...h })),
      letters: r.letters.map((l) => ({ ...l })),
      exit: { ...r.course.exit },
      gold: r.course.gold,
      silver: r.course.silver,
      width: r.course.width,
      height: r.course.height,
      obstacles: [...r.course.walls, ...r.course.props],
      route: r.course.route.map((p) => ({ ...p })),
      result: r.result,
      options: { ...r.options },
    };
  }
}
