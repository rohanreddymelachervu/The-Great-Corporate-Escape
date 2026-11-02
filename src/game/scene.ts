import Phaser from "phaser";
import { createTextures, renderOffice } from "../art/art";
import { createLootTextures } from "../art/loot";
import {
  LOOT,
  isStealable,
  carryMultiplier,
  LootBag,
  TheftAction,
} from "./loot";
import { MeetingTraffic } from "./traffic";
import { OfficeSocial } from "./social";
import { drawOfficeChat } from "./render-social";
import { drawMeetingTraffic } from "./render-traffic";
import { OfficeAudio } from "../audio/audio";
import { LEVELS } from "./levels";
import { ABILITIES, ENEMIES } from "./catalog";
import {
  Navigator,
  blocked,
  center,
  clamp,
  dist,
  hash,
  medal,
  move,
  rng,
  scoreRun,
  visible,
} from "./logic";
import { OfficeEnemy } from "./enemy";
import { EscapeDirector } from "./director";
import type { DirectorEvent } from "./director";
import { drawInterference } from "./render-incidents";
import type { FunFriday } from "./fun";
import type {
  Ability,
  Interaction,
  Item,
  Level,
  Point,
  Rect,
  Result,
  HitKind,
  HitEvent,
  Kind,
} from "./types";
export const emit = (name: string, detail: unknown) =>
  window.dispatchEvent(new CustomEvent("office:" + name, { detail }));
export interface RunOptions {
  level: number;
  daily: boolean;
  seed: string;
  preview?: boolean;
}
export class OfficeScene extends Phaser.Scene {
  level!: Level;
  options!: RunOptions;
  audio: OfficeAudio;
  random: () => number = Math.random;
  director!: EscapeDirector;
  traffic!: MeetingTraffic;
  social = new OfficeSocial();
  socialArt!: Phaser.GameObjects.Graphics;
  socialLabels = new Map<string, Phaser.GameObjects.Text>();
  conversations = 0;
  staffSpots = 0;
  trafficArt!: Phaser.GameObjects.Graphics;
  staffSprites = new Map<string, Phaser.GameObjects.Image>();
  doorLabels = new Map<string, Phaser.GameObjects.Text>();
  bag = new LootBag();
  theft = new TheftAction();
  lootTarget: Item | null = null;
  holdingInteract = false;
  carriedTV!: Phaser.GameObjects.Image;
  cinematic = false;
  lastHit: HitEvent | null = null;
  routeHint: Point | null = null;
  routeAt = 0;
  coneAt = 0;
  incidentArt!: Phaser.GameObjects.Graphics;
  incidentLabels = new Map<string, Phaser.GameObjects.Text>();
  liftLabel!: Phaser.GameObjects.Text;
  dashLeft = 0;
  dashCooldown = 0;
  dashDirection: Point = { x: 1, y: 0 };
  hideLeft = 0;
  outOfBreath = false;
  dodgeCount = 0;
  managerDelayed = false;
  pmDelayed = false;
  lastThreatAt = 0;
  lastThreat = "";
  obstacles: Rect[] = [];
  nav!: Navigator;
  enemies: OfficeEnemy[] = [];
  player!: Phaser.GameObjects.Image;
  fx!: Phaser.GameObjects.Graphics;
  cones!: Phaser.GameObjects.Graphics;
  markers!: Phaser.GameObjects.Graphics;
  pos: Point = { x: 0, y: 0 };
  facing: Point = { x: 1, y: 0 };
  elapsed = 0;
  bs = 0;
  stamina = 100;
  spots = 0;
  hits = 0;
  collectibles = 0;
  distractions = 0;
  coffee = 2;
  wfh = 0;
  wfhActive = false;
  hidden = false;
  invulnerable = 0;
  active: Partial<Record<Ability, number>> = {};
  cooldowns: Partial<Record<Ability, number>> = {};
  collected = new Set<string>();
  used = new Set<string>();
  stationTimes: Record<string, number> = {};
  enemiesHit = new Set<string>();
  bluffedEnemies = new Set<OfficeEnemy>();
  accumulator = 0;
  bluffs = 0;
  coffeeUsed = 0;
  funScore = 0;
  funCompleted = new Set<string>();
  internTime = 0;
  listenStep = 0;
  nonRequiredInteractions = 0;
  won = false;
  ended = false;
  preview = false;
  eventType = "";
  eventUntil = 0;
  hudAt = 0;
  stepAt = 0;
  target: Interaction | null = null;
  hintText = "";
  exitObjects: Phaser.GameObjects.GameObject[] = [];
  itemObjects = new Map<string, Phaser.GameObjects.Container>();
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  touch = { x: 0, y: 0, sprint: false };
  reducedMotion = false;
  lastSprinting = false;
  constructor(audio: OfficeAudio) {
    super("office");
    this.audio = audio;
  }
  init(data: Partial<RunOptions>) {
    this.options = {
      level: data.level || 1,
      daily: !!data.daily,
      seed: data.seed || "menu",
      preview: !!data.preview,
    };
    this.level = LEVELS[this.options.level - 1];
    this.preview = !!data.preview;
    this.random = rng(hash(this.options.seed + ":" + this.level.id));
    this.enemies = [];
    this.director = new EscapeDirector(this.level, this.options.seed);
    this.traffic = new MeetingTraffic(this.level, this.options.seed);
    this.social = new OfficeSocial();
    this.socialLabels = new Map();
    this.conversations = 0;
    this.staffSpots = 0;
    this.staffSprites = new Map();
    this.doorLabels = new Map();
    this.bag = new LootBag();
    this.theft = new TheftAction();
    this.lootTarget = null;
    this.holdingInteract = false;
    this.cinematic = false;
    this.lastHit = null;
    this.routeHint = null;
    this.routeAt = 0;
    this.coneAt = 0;
    this.incidentLabels = new Map();
    this.dashLeft = 0;
    this.dashCooldown = 0;
    this.hideLeft = 0;
    this.outOfBreath = false;
    this.dodgeCount = 0;
    this.managerDelayed = false;
    this.pmDelayed = false;
    this.lastThreatAt = 0;
    this.lastThreat = "";
    this.elapsed = 0;
    this.bs = 0;
    this.stamina = 100;
    this.spots = 0;
    this.hits = 0;
    this.collectibles = 0;
    this.distractions = 0;
    this.coffee = 2;
    this.wfh = 0;
    this.wfhActive = false;
    this.hidden = false;
    this.invulnerable = 0;
    this.active = {};
    this.cooldowns = {};
    this.collected = new Set();
    this.used = new Set();
    this.stationTimes = {};
    this.enemiesHit = new Set();
    this.bluffedEnemies = new Set();
    this.accumulator = 0;
    this.bluffs = 0;
    this.coffeeUsed = 0;
    this.funScore = 0;
    this.funCompleted = new Set();
    this.internTime = 0;
    this.listenStep = 0;
    this.nonRequiredInteractions = 0;
    this.won = false;
    this.ended = false;
    this.eventType = "";
    this.eventUntil = 0;
    this.hudAt = 0;
    this.stepAt = 0;
    this.target = null;
    this.hintText = "";
    this.itemObjects = new Map();
    this.exitObjects = [];
    this.touch = { x: 0, y: 0, sprint: false };
    this.pos = { ...this.level.spawn };
  }
  create() {
    createTextures(this);
    createLootTextures(this);
    renderOffice(this, this.level);
    this.obstacles = [
      ...this.level.walls,
      ...this.level.props,
      ...this.level.gates.filter((g) => !g.open),
    ];
    this.nav = new Navigator(
      this.level.width,
      this.level.height,
      this.obstacles,
    );
    this.cones = this.add.graphics().setDepth(15);
    this.markers = this.add.graphics().setDepth(20);
    this.fx = this.add.graphics().setDepth(51);
    this.incidentArt = this.add.graphics().setDepth(24);
    this.trafficArt = this.add.graphics().setDepth(16);
    this.socialArt = this.add.graphics().setDepth(53);
    this.drawExit(this.level.exit, false);
    if (this.level.altExit) this.drawExit(this.level.altExit, true);
    for (const item of this.level.items) this.drawItem(item);
    for (const point of this.level.interactions.filter(
      (i) => i.type === "fun",
    )) {
      this.add
        .text(point.x, point.y - 35, "HR FUN ACTIVITY", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#ffd1ea",
          backgroundColor: "#35283f",
          padding: { x: 6, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(23);
    }
    for (const gate of this.level.gates) {
      const obj = this.add
        .rectangle(
          gate.x + gate.w / 2,
          gate.y + gate.h / 2,
          gate.w,
          gate.h,
          0xcf7e8e,
          0.7,
        )
        .setStrokeStyle(2, 0xfaa6b7)
        .setDepth(12);
      obj.setName(gate.id);
    }
    this.carriedTV = this.add
      .image(0, 0, "loot-tv")
      .setScale(0.66)
      .setVisible(false)
      .setDepth(48);
    this.player = this.add
      .image(this.pos.x, this.pos.y, "player")
      .setScale(1.45)
      .setDepth(45);
    this.add
      .text(this.pos.x, this.pos.y + 27, "YOU", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#b6f9d8",
        backgroundColor: "#142b32",
        padding: { x: 5, y: 4 },
      })
      .setOrigin(0.5)
      .setName("spawnLabel")
      .setDepth(62);
    this.enemies = this.level.enemies.map(
      (e) => new OfficeEnemy(this, e, this.random),
    );
    const shortNames = {
      manager: "MANAGER",
      hr: "HR",
      intern: "INTERN",
      founder: "FOUNDER",
      pm: "PM",
      gossip: "GOSSIP",
    };
    this.enemies.forEach((e) =>
      e.label.setText(shortNames[e.kind]).setFontSize(11),
    );
    if (this.preview)
      this.enemies.forEach((e) => {
        e.label.setVisible(false);
        e.bubble.setVisible(false);
      });
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    const keyHandler = (e: KeyboardEvent) => {
      if (this.preview || this.ended || this.scene.isPaused()) return;
      if (e.repeat) return;
      if (e.code === "KeyE") {
        e.preventDefault();
        this.interact();
      }
      if (e.code === "Space") {
        e.preventDefault();
        this.dash();
      }
      const index = Number(e.key) - 1;
      if (index >= 0 && index < 6)
        this.ability((Object.keys(ABILITIES) as Ability[])[index]);
    };
    this.input.keyboard!.on("keydown", keyHandler);
    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown", keyHandler);
      this.scale.off("resize", this.resize, this);
    });
    this.scale.on("resize", this.resize, this);
    this.resize();
    this.cameras.main.setBackgroundColor("#101625");
    if (this.preview) this.audio.music("menu");
    if (!this.preview) {
      this.cameras.main.fadeIn(this.reducedMotion ? 0 : 450, 16, 22, 37);
      this.audio.music(this.level.id === 5 ? "final" : "game");
    }
    this.updateHud();
  }
  resize() {
    const c = this.cameras.main,
      w = this.scale.width,
      h = this.scale.height;
    const follow = !this.preview;
    const zoom = this.preview
      ? Math.max(w / this.level.width, h / this.level.height)
      : w < 650
        ? 1.0
        : Math.min(1.25, Math.max(1.04, Math.min(w / 1000, h / 650)));
    c.setZoom(zoom);
    if (follow && !this.preview) {
      c.setBounds(0, 0, this.level.width, this.level.height);
      c.startFollow(this.player, true, 0.1, 0.1);
    } else {
      c.stopFollow();
      c.removeBounds();
      c.centerOn(this.level.width / 2, this.level.height / 2);
    }
  }
  drawExit(r: Rect, alt: boolean) {
    const color = alt ? 0xb99cff : 0xa7f4c8,
      c = center(r);
    const g = this.add.graphics().setDepth(11);
    g.fillStyle(0x10182b).fillRoundedRect(
      r.x - 6,
      r.y - 6,
      r.w + 12,
      r.h + 12,
      4,
    );
    g.fillStyle(alt ? 0x4e416e : 0x365b58).fillRect(r.x, r.y, r.w, r.h);
    g.lineStyle(3, color).strokeRect(r.x, r.y, r.w, r.h);
    g.lineStyle(2, 0x152838).lineBetween(c.x, r.y, c.x, r.y + r.h);
    g.fillStyle(color).fillRect(r.x + 6, r.y + 6, r.w - 12, 5);
    this.add
      .text(c.x, r.y - 22, alt ? "WFH EXIT" : "ELEVATOR →", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: alt ? "#cebbff" : "#baffd6",
        backgroundColor: "#172b34",
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(alt);
    const status = this.add
      .text(c.x, c.y, alt ? "REMOTE" : "E · CALL LIFT", {
        fontFamily: "monospace",
        fontSize: "11px",
        fontStyle: "bold",
        align: "center",
        color: "#f1ffdf",
      })
      .setOrigin(0.5)
      .setDepth(28);
    if (!alt) {
      this.liftLabel = status;
      status.setPosition(c.x, r.y - 22);
    }
    this.exitObjects.push(g);
  }
  drawItem(item: Item) {
    if (isStealable(item.kind)) {
      const def = LOOT[item.kind],
        glow = this.add
          .graphics()
          .lineStyle(1, 0xa9f4ce, 0.65)
          .strokeCircle(0, 1, item.kind === "tv" ? 25 : 19);
      const sprite = this.add
        .image(0, 0, "loot-" + item.kind)
        .setScale(item.kind === "tv" ? 1.2 : 1);
      const label = this.add
        .text(0, 24, def.name.toUpperCase() + " +" + def.points, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#dfeddf",
          backgroundColor: "#172238dd",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 0)
        .setVisible(false);
      const object = this.add
        .container(item.x, item.y, [glow, sprite, label])
        .setDepth(22);
      this.itemObjects.set(item.id, object);
      return;
    }
    const g = this.add.graphics();
    const c =
      item.kind === "badge"
        ? 0xffda83
        : item.kind === "wfh"
          ? 0xbd9dff
          : item.kind === "coffee"
            ? 0xf3bc8c
            : 0x8dd7f5;
    g.fillStyle(0x142237, 0.9).fillCircle(0, 0, 14);
    g.lineStyle(1, c).strokeCircle(0, 0, 14);
    if (item.kind === "badge") {
      g.fillStyle(c).fillRoundedRect(-6, -7, 12, 15, 2);
      g.fillStyle(0x24354b).fillRect(-3, -4, 6, 4).fillRect(-3, 3, 6, 1);
      g.lineStyle(2, c).lineBetween(0, -12, 0, -8);
    } else if (item.kind === "coffee") {
      g.fillStyle(c).fillRect(-5, -5, 10, 10);
      g.lineStyle(2, c).strokeRect(4, -3, 4, 5);
      g.lineStyle(1, 0xffffff)
        .lineBetween(-2, -9, -1, -7)
        .lineBetween(2, -11, 3, -8);
    } else {
      g.fillStyle(c).fillTriangle(-8, 0, 0, -7, 8, 0);
      g.fillRect(-5, 0, 10, 8);
      g.fillStyle(0x342b53).fillRect(-1, 3, 3, 5);
    }
    const label = this.add
      .text(
        0,
        19,
        item.kind === "badge"
          ? "BADGE"
          : item.kind === "wfh"
            ? "WFH TOKEN"
            : "",
        {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#ffe4a2",
          backgroundColor: "#172238",
          padding: { x: 3, y: 2 },
        },
      )
      .setOrigin(0.5, 0);
    const cont = this.add.container(item.x, item.y, [g, label]).setDepth(22);
    label.setVisible(item.kind === "badge" || item.kind === "wfh");
    this.itemObjects.set(item.id, cont);
  }
  update(time: number, delta: number) {
    if (this.ended || this.cinematic) return;
    this.accumulator += Math.min(delta / 1000, 0.1);
    let steps = 0;
    while (this.accumulator >= 1 / 60 && steps++ < 6 && !this.cinematic) {
      this.tick(time, 1000 / 60);
      this.accumulator -= 1 / 60;
    }
  }
  tick(_time: number, delta: number) {
    if (this.ended || this.cinematic) return;
    const dt = delta / 1000;
    if (this.preview) {
      this.elapsed += dt;
      this.enemies.forEach((e, i) => {
        e.sprite.y = e.y + Math.sin(this.elapsed * 2 + i);
      });
      return;
    }
    this.elapsed += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.dashLeft = Math.max(0, this.dashLeft - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.hidden) {
      this.hideLeft = Math.max(0, this.hideLeft - dt);
      if (this.hideLeft === 0) {
        this.hidden = false;
        this.invulnerable = Math.max(this.invulnerable, 0.8);
        emit("toast", {
          title: "YOUR HIDING SPOT GOT BOOKED",
          text: "Six seconds of silence used up. Keep moving. E can hide again after cooldown.",
          duration: 3,
        });
      }
    }
    for (const k of Object.keys(this.active) as Ability[])
      this.active[k] = Math.max(0, (this.active[k] || 0) - dt);
    for (const k of Object.keys(this.cooldowns) as Ability[])
      this.cooldowns[k] = Math.max(0, (this.cooldowns[k] || 0) - dt);
    let dx =
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) -
      (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0) +
      this.touch.x;
    let dy =
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) -
      (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0) +
      this.touch.y;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    const dashing = this.dashLeft > 0;
    if (dashing) {
      dx = this.dashDirection.x;
      dy = this.dashDirection.y;
    }
    const moving = length > 0.12 || dashing;
    if (this.stamina < 8) this.outOfBreath = true;
    if (this.stamina > 30) this.outOfBreath = false;
    const sprint =
      !this.outOfBreath &&
      moving &&
      (this.keys.SHIFT.isDown || this.touch.sprint) &&
      this.stamina > 8 &&
      !dashing;
    this.lastSprinting = sprint;
    const yapping = this.enemies.some(
      (e) =>
        e.kind === "intern" &&
        dist(e, this.pos) < 95 &&
        !this.hidden &&
        visible(e, this.pos, this.obstacles) &&
        e.state !== "distracted",
    );
    if (moving) {
      this.hidden = false;
      this.active.slack = 0;
      const directionLength = Math.hypot(dx, dy) || 1;
      this.facing = { x: dx / directionLength, y: dy / directionLength };
      const speed = dashing
        ? 450
        : (sprint ? 232 : 155) *
          (yapping ? 0.72 : 1) *
          (this.active.call ? 0.84 : 1) *
          carryMultiplier(this.bag.weight);
      this.pos = move(
        this.pos,
        dx * speed * dt,
        dy * speed * dt,
        11,
        this.obstacles,
      );
      if (this.elapsed > this.stepAt) {
        this.audio.sfx("step");
        this.stepAt = this.elapsed + (sprint ? 0.22 : 0.36);
      }
      const label = this.children.getByName(
        "spawnLabel",
      ) as Phaser.GameObjects.Text;
      label?.setVisible(this.elapsed < 3);
    }
    this.stamina = clamp(
      this.stamina + (sprint ? -27 : dashing ? 0 : 23) * dt,
      0,
      100,
    );
    if (this.theft.id) {
      const id = this.theft.id,
        item = this.level.items.find((i) => i.id === id);
      const result = this.theft.tick(dt, {
        holding: this.keys.E.isDown || this.holdingInteract,
        moving,
        inRange: !!item && dist(this.pos, item) < 48,
      });
      if (result === "complete" && item) this.claimLoot(item);
    }
    this.applyDirectorEvents(
      this.director.update(dt, {
        player: this.pos,
        dashing,
        hidden: this.hidden,
        shield: !!this.active.calendar || this.invulnerable > 0,
        vpn: !!this.active.vpn,
      }),
    );
    if (this.cinematic) return;
    this.updateSocial(dt);
    if (this.hidden) this.bs = Math.max(0, this.bs - dt * 1.4);
    if (yapping) {
      this.internTime += dt;
      const step = Math.floor(this.internTime / 3);
      if (step > this.listenStep && step <= 4) {
        this.listenStep = step;
        const intern = this.enemies.find(
          (e) => e.kind === "intern" && dist(e, this.pos) < 95,
        );
        intern?.say(
          [
            "Bro, first the agent opens an agent…",
            "Then MCP makes it enterprise-ready…",
            "Then we add another abstraction…",
            "Anyway, it’s a todo app. With a moat.",
          ][step - 1],
          this.elapsed,
          3,
        );
      }
    }
    this.enemies.forEach(
      (e) =>
        !this.cinematic &&
        e.update({
          dt,
          time: this.elapsed,
          player: this.pos,
          hidden: this.hidden,
          dashing,
          dodge: () => this.awardDodge("HR PHOTO DODGED"),
          threat: (_enemy, text) => {
            this.lastThreat = text;
            this.lastThreatAt = this.elapsed + 3;
            emit("toast", {
              title: "HR IS LINING UP A PHOTO",
              text: "The aim line is locked. SPACE dodge sideways when HR charges!",
              duration: 3,
            });
          },
          camouflaged: !!this.active.slack && !moving && this.bag.weight < 3,
          sprinting: sprint,
          quiet: this.eventType === "noise" && this.elapsed < this.eventUntil,
          call: !!this.active.call,
          calendar: !!this.active.calendar,
          stunned: !!this.active.vpn,
          alertBoost:
            (this.eventType === "hands" && this.elapsed < this.eventUntil) ||
            this.bag.weight >= 3,
          obstacles: this.obstacles,
          nav: this.nav,
          random: this.random,
          spot: (enemy) => {
            this.spots++;
            this.audio.sfx(enemy.kind === "founder" ? "founder" : "alert");
          },
          catch: (e) => this.caught(e),
          broadcast: (p) => {
            this.enemies
              .filter((o) => o !== e && dist(o, e) < 320 && !this.chatBusy(o))
              .forEach((o) => o.investigate(p, 7));
            emit("toast", {
              title: "LOCATION LEAKED",
              text: "Gossip has @channel’d your weekend.",
              duration: 3,
            });
          },
          bluff: (enemy) => {
            if (!this.bluffedEnemies.has(enemy)) {
              this.bluffedEnemies.add(enemy);
              this.bluffs++;
            }
            this.audio.sfx("ability");
          },
        }),
    );
    if (this.cinematic) return;
    const trafficEvents = this.traffic.update(dt, {
      player: this.pos,
      hidden: this.hidden,
      protected:
        !!this.active.call ||
        !!this.active.calendar ||
        (!!this.active.slack && this.bag.weight < 3),
      dashing,
      stunned: !!this.active.vpn,
      obstacles: this.obstacles,
      nav: this.nav,
    });
    for (const event of trafficEvents) {
      if (event.type === "warning" && dist(this.pos, event.point) < 420) {
        emit("toast", { title: event.title, text: event.text, duration: 2.5 });
      }
      if (event.type === "spot") {
        this.spots++;
        this.staffSpots++;
        this.audio.sfx("alert");
        this.enemies
          .filter((e) => dist(e, event.point) < 440 && !this.chatBusy(e))
          .forEach((e) => e.investigate(event.point, 6));
        emit("toast", { title: event.title, text: event.text, duration: 3 });
      }
      if (event.type === "hit")
        this.takeHit("door", event.damage || 10, event.title, event.text, 2);
    }
    if (this.cinematic) return;
    const readableEnemies = [...this.enemies]
      .sort((a, b) => dist(a, this.pos) - dist(b, this.pos))
      .slice(0, 2);
    for (const enemy of this.enemies) {
      enemy.bubble.setVisible(false);
      enemy.sprite.setAngle(0).setScale(1.35);
      enemy.label.setVisible(
        (readableEnemies.includes(enemy) || enemy.kind === "hr") &&
          dist(enemy, this.pos) < 330,
      );
    }
    for (const item of this.level.items) {
      if (
        !isStealable(item.kind) &&
        !this.collected.has(item.id) &&
        dist(this.pos, item) < 27
      ) {
        this.collected.add(item.id);
        this.itemObjects.get(item.id)?.destroy();
        if (item.kind === "coffee") {
          this.coffee = Math.min(5, this.coffee + 1);
          this.bs = Math.max(0, this.bs - 8);
        } else if (item.kind === "wfh") {
          this.wfhActive = true;
          this.wfh = 0;
          this.active.wfh = 999;
          emit("toast", {
            title: "WFH EXIT OPEN",
            text: "The purple house token opened your alternate exit automatically. Follow the rerouted gold arrow, or keep using the lift.",
            duration: 5,
          });
        } else {
          emit("toast", {
            title: "LOST ID RECOVERED · OPTIONAL",
            text: "Someone else escaped first. You already have your own ID; keep heading to the lift.",
            duration: 3,
          });
        }
        this.audio.sfx("item");
      }
    }
    this.target =
      this.level.interactions
        .filter((i) => dist(this.pos, i) < 49)
        .sort((a, b) => dist(this.pos, a) - dist(this.pos, b))[0] || null;
    this.lootTarget =
      this.level.items
        .filter(
          (i) =>
            isStealable(i.kind) &&
            !this.collected.has(i.id) &&
            dist(this.pos, i) < 48,
        )
        .sort((a, b) => dist(this.pos, a) - dist(this.pos, b))[0] || null;
    const atExit = dist(this.pos, center(this.level.exit)) < 44;
    const atAlt =
      !!this.level.altExit && dist(this.pos, center(this.level.altExit)) < 44;
    if (this.bs >= 100) {
      this.finish(false);
      return;
    }
    if (
      (atExit && this.director.phase === "boarding") ||
      (atAlt && this.wfhActive)
    ) {
      this.finish(true, atAlt);
      return;
    }
    const bob = moving
      ? Math.sin(this.elapsed * (sprint ? 19 : 13)) * 1.5
      : Math.sin(this.elapsed * 3) * 0.5;
    this.player
      .setPosition(this.pos.x, this.pos.y + bob)
      .setFlipX(this.facing.x < 0)
      .setAlpha(
        this.hidden
          ? 0.25
          : !!this.active.slack
            ? 0.5
            : this.invulnerable > 0
              ? Math.sin(this.elapsed * 20) > 0.0
                ? 0.3
                : 1
              : 1,
      );
    this.player.setDepth(45 + this.pos.y / 1000);
    this.carriedTV
      .setVisible(this.bag.hasTV)
      .setPosition(this.pos.x + 17, this.pos.y - 8)
      .setDepth(46 + this.pos.y / 1000);
    // Context belongs in the information rail, never over sprites or cones.
    const focusLoot = this.focusedLoot;
    this.hintText = this.theft.id
      ? `STEALING ${LOOT[this.level.items.find((i) => i.id === this.theft.id)!.kind as keyof typeof LOOT].name.toUpperCase()} · ${Math.round(this.theft.progress * 100)}% · hold E / ACT`
      : focusLoot
        ? `${LOOT[focusLoot.kind as keyof typeof LOOT].hold ? "HOLD" : "TAP"} E · ${LOOT[focusLoot.kind as keyof typeof LOOT].name} +${LOOT[focusLoot.kind as keyof typeof LOOT].points} bag points`
        : this.hidden
          ? `HIDDEN · ${Math.ceil(this.hideLeft)}s breath left. E to leave.`
          : atExit
            ? this.director.phase === "find-lift"
              ? "E · CALL THE LIFT. Then stay mobile."
              : this.director.phase === "waiting"
                ? `Lift in ${Math.ceil(this.director.eta)}s. Dodge HR; don't stand here.`
                : `BOARD NOW! Doors close in ${Math.ceil(this.director.boardLeft)}s.`
            : atAlt
              ? this.wfhActive
                ? "Purple exit approved. Walk in."
                : "Find a purple house token to open this exit automatically."
              : this.target
                ? this.used.has(this.target.id)
                  ? "✓ " + this.target.label
                  : this.target.type === "fun"
                    ? "E · HR activity (optional)"
                    : "E · " + this.target.label
                : this.lastThreatAt > this.elapsed
                  ? this.lastThreat
                  : "";
    (
      this.children.getByName("spawnLabel") as Phaser.GameObjects.Text
    )?.setVisible(this.elapsed < 2.5);
    this.drawEffects();
    drawOfficeChat(
      this,
      this.socialArt,
      this.social.active,
      this.enemies.map((e, i) => ({
        id: String(i),
        x: e.x,
        y: e.y,
        sprite: e.sprite,
      })),
      this.socialLabels,
      this.reducedMotion,
    );
    drawMeetingTraffic(
      this,
      this.trafficArt,
      this.traffic,
      this.staffSprites,
      this.doorLabels,
    );
    drawInterference(
      this,
      this.incidentArt,
      this.director,
      this.enemies,
      this.incidentLabels,
    );
    this.liftLabel
      .setText(
        this.director.phase === "find-lift"
          ? "E · CALL LIFT"
          : this.director.phase === "waiting"
            ? "LIFT · " + Math.ceil(this.director.eta) + "s"
            : "OPEN · " + Math.ceil(this.director.boardLeft) + "s",
      )
      .setColor(this.director.phase === "boarding" ? "#b7ffd6" : "#ffe2a4");
    if (this.elapsed > this.hudAt) {
      this.updateHud();
      this.hudAt = this.elapsed + 0.075;
    }
  }
  get focusedLoot(): Item | null {
    if (this.hidden || dist(this.pos, center(this.level.exit)) < 70)
      return null;
    const loot = this.lootTarget;
    return loot &&
      (!this.target || dist(this.pos, loot) < dist(this.pos, this.target))
      ? loot
      : null;
  }
  chatBusy(enemy: OfficeEnemy) {
    return this.social.isBusy(String(this.enemies.indexOf(enemy)));
  }
  updateSocial(dt: number) {
    const events = this.social.update(dt, {
      actors: this.enemies.map((e, i) => ({
        id: String(i),
        kind: e.kind,
        x: e.x,
        y: e.y,
        state: e.state,
        awareness: e.awareness,
        catchCooldown: e.catchCooldown,
      })),
      obstacles: this.obstacles,
      nav: this.nav,
      frozen: !!this.active.vpn || this.cinematic,
    });
    for (const event of events) {
      const chat = event.chat,
        intern = this.enemies[Number(chat.internId)],
        founder = this.enemies[Number(chat.founderId)];
      if (event.type === "start") {
        intern.investigate(chat.internSpot, 15, true);
        founder.investigate(chat.founderSpot, 15, true);
        if (Math.min(dist(intern, this.pos), dist(founder, this.pos)) < 450)
          emit("toast", {
            title: "THEY FOUND EACH OTHER",
            text: "The intern is pitching the founder. Both are occupied—your chance to slip past.",
            duration: 4,
          });
      }
      if (event.type === "line") {
        if (chat.line === 0) this.conversations++;
        const speaker = event.speaker === "intern" ? intern : founder;
        speaker?.say(event.text || "", this.elapsed, 1.8);
      }
      if (event.type === "end")
        for (const actor of [intern, founder])
          if (actor && actor.state === "distracted") {
            actor.state = "patrol";
            actor.stateTime = 0;
            actor.target = null;
            actor.path = [];
            actor.repath = 0;
            actor.idle = 0.4;
          }
    }
    if (this.social.active)
      this.director.incidents = this.director.incidents.filter(
        (h) => h.kind !== "yap" && h.kind !== "allhands",
      );
  }
  dash() {
    if (
      this.preview ||
      this.ended ||
      this.scene.isPaused() ||
      this.dashCooldown > 0 ||
      this.stamina < 18
    )
      return;
    let x =
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) -
      (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0) +
      this.touch.x;
    let y =
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) -
      (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0) +
      this.touch.y;
    const length = Math.hypot(x, y);
    this.dashDirection =
      length > 0.1 ? { x: x / length, y: y / length } : { ...this.facing };
    this.dashLeft = 0.19;
    this.dashCooldown = 1.7;
    this.stamina -= 18;
    this.hidden = false;
    this.active.slack = 0;
    if (!this.reducedMotion)
      for (let i = 1; i <= 3; i++) {
        const ghost = this.add
          .image(
            this.pos.x - this.dashDirection.x * i * 10,
            this.pos.y - this.dashDirection.y * i * 10,
            "player",
          )
          .setScale(1.45)
          .setTint(0xa9f4ce)
          .setAlpha(0.28 - i * 0.05)
          .setDepth(42);
        this.tweens.add({
          targets: ghost,
          alpha: 0,
          duration: 180 + i * 40,
          onComplete: () => ghost.destroy(),
        });
      }
    this.audio.sfx("ability");
    this.updateHud();
  }
  awardDodge(title = "MEETING DECLINED") {
    this.dodgeCount++;
    this.audio.sfx("item");
    this.invulnerable = Math.max(this.invulnerable, 0.35);
    emit("toast", {
      title: `${title} · +125`,
      text: `${this.dodgeCount} interference${this.dodgeCount === 1 ? "" : "s"} dodged. Your weekend has momentum.`,
      duration: 2,
    });
  }
  applyDirectorEvents(events: DirectorEvent[]) {
    for (const event of events) {
      if (
        this.social.active &&
        (event.kind === "yap" ||
          event.kind === "allhands" ||
          (event.type === "rally" && event.who === "founder"))
      )
        continue;
      if (event.type === "hit") {
        const kind = event.kind || "meeting";
        if (
          this.takeHit(kind, event.damage || 0, event.title, event.text, 1.2) &&
          kind === "photo"
        )
          this.enemiesHit.add("hr");
      }
      if (event.type === "dodge") {
        this.awardDodge(event.title);
        continue;
      }
      if (event.type === "rally" && event.point) {
        const point = event.point;
        const chosen = this.enemies.filter(
          (e) => !event.who || e.kind === event.who,
        );
        chosen
          .filter((e) => !this.chatBusy(e))
          .forEach((e) => e.investigate(point, 6));
        if (event.kind === "allhands" || event.who === "founder") {
          this.eventType = "hands";
          this.eventUntil = this.elapsed + 6;
          this.audio.sfx("founder");
          this.enemies
            .filter((e) => !this.chatBusy(e))
            .forEach((e) => e.investigate(point, 5));
        }
      }
      if (event.type === "arrived") {
        this.audio.sfx("exit");
        this.lastThreat =
          "THE LIFT IS OPEN. Follow the gold arrow and board now.";
        this.lastThreatAt = this.elapsed + 10;
      }
      if (event.type === "notice" || event.type === "hit") {
        this.lastThreat = event.text;
        this.lastThreatAt = this.elapsed + 4;
      }
      // A rally already accompanies a clear notice; do not spam the feedback rail twice.
      if (
        event.type !== "rally" ||
        !events.some(
          (e) =>
            e.type === "notice" || e.type === "arrived" || e.type === "hit",
        )
      )
        emit("toast", {
          title: event.title,
          text: event.text,
          duration: event.type === "arrived" ? 6 : 3.5,
        });
    }
  }
  interact() {
    if (this.ended || this.preview || this.scene.isPaused()) return;
    if (this.hidden) {
      this.hidden = false;
      this.audio.sfx("click");
      return;
    }
    if (dist(this.pos, center(this.level.exit)) < 70) {
      if (this.director.phase === "find-lift") {
        this.applyDirectorEvents(this.director.callLift());
        this.audio.sfx("founder");
        this.updateHud();
      } else
        emit("toast", {
          title:
            this.director.phase === "waiting"
              ? "LIFT IS ON ITS WAY"
              : "DOORS OPEN",
          text:
            this.director.phase === "waiting"
              ? `Arrives in ${Math.ceil(this.director.eta)}s. Move away from HR and return when it opens.`
              : "Walk inside. Your weekend is right there.",
          duration: 3,
        });
      return;
    }
    const loot = this.focusedLoot;
    if (
      loot &&
      (!this.target || dist(this.pos, loot) < dist(this.pos, this.target))
    ) {
      if (isStealable(loot.kind) && LOOT[loot.kind].hold === 0)
        this.claimLoot(loot);
      else {
        this.theft.start(loot);
        this.hidden = false;
        this.updateHud();
      }
      return;
    }
    const i = this.target;
    if (!i) {
      emit("toast", {
        title: "NOTHING TO INTERACT WITH",
        text: "E calls the lift or uses a glowing tool. SPACE dodges; it does not interact.",
        duration: 2,
      });
      return;
    }
    if (i.type === "fun") {
      if (this.used.has(i.id)) {
        emit("toast", {
          title: "ENGAGEMENT ALREADY MEASURED",
          text: "HR says five claps per employee per floor. Budget constraints.",
          duration: 3,
        });
        return;
      }
      this.used.add(i.id);
      this.nonRequiredInteractions++;
      emit("fun", { id: i.id });
    } else if (i.type === "hide") {
      if ((this.stationTimes[i.id] || 0) > this.elapsed) {
        emit("toast", {
          title: "SOMEONE BOOKED THIS SPOT",
          text: `Hide again in ${Math.ceil(this.stationTimes[i.id] - this.elapsed)}s. Keep moving or dodge.`,
          duration: 2,
        });
        return;
      }
      this.stationTimes[i.id] = this.elapsed + 14;
      this.hideLeft = 6;
      this.hidden = true;
      this.nonRequiredInteractions++;
      this.audio.sfx("ability");
      emit("toast", {
        title: "PROFESSIONALLY UNAVAILABLE",
        text: "Six seconds of cover. BS slowly fades. E or move to leave; then find a new route.",
        duration: 3,
      });
    } else if (i.type === "switch") {
      if (this.used.has(i.id)) return;
      this.used.add(i.id);
      this.collected.add(i.id);
      if (i.opens) {
        this.obstacles = this.obstacles.filter(
          (o) => !(this.level.gates.find((g) => g.id === i.opens) === o),
        );
        this.nav = new Navigator(
          this.level.width,
          this.level.height,
          this.obstacles,
        );
        this.children.getByName(i.opens)?.destroy();
        this.enemies.forEach((e) => (e.repath = 0));
      }
      const cut = this.director.expedite();
      const targets = {
        1: "manager",
        2: "hr",
        3: "intern",
        4: "founder",
        5: "pm",
      };
      this.enemies
        .filter(
          (e) => e.kind === targets[this.level.id as 1] && !this.chatBusy(e),
        )
        .forEach((e) => e.investigate(i, 8, true));
      const cancel = {
        1: "meeting",
        2: "photo",
        3: "yap",
        4: "allhands",
        5: "meeting",
      };
      this.director.incidents = this.director.incidents.filter(
        (h) => h.kind !== cancel[this.level.id as 1],
      );
      this.distractions++;
      this.audio.sfx("item");
      emit("toast", {
        title: "OFFICE SABOTAGED",
        text: `${i.label}. Nuisance distracted for 8s.${cut > 0 ? " Lift " + cut + "s sooner." : ""}`,
        duration: 4,
      });
    } else if (i.type === "coffee") {
      if ((this.stationTimes[i.id] || 0) > this.elapsed) {
        emit("toast", {
          title: "COFFEE IS BREWING",
          text:
            "Even escape fuel needs " +
            Math.ceil(this.stationTimes[i.id] - this.elapsed) +
            "s.",
          duration: 2,
        });
        return;
      }
      this.stationTimes[i.id] = this.elapsed + 22;
      this.coffee = Math.min(5, this.coffee + 1);
      this.bs = Math.max(0, this.bs - 18);
      this.stamina = 100;
      this.nonRequiredInteractions++;
      this.audio.sfx("coffee");
      emit("toast", {
        title: "FILTER COFFEE > FEEDBACK",
        text: "−18 BS · +1 distraction cup · stamina full.",
        duration: 3,
      });
    } else if (i.type === "distraction") {
      if (this.used.has(i.id)) {
        emit("toast", {
          title: "THE BIT IS EXHAUSTED",
          text: "Corporate distraction is a non-renewable resource.",
          duration: 2,
        });
        return;
      }
      this.used.add(i.id);
      this.nonRequiredInteractions++;
      this.distractions++;
      this.bs = Math.max(0, this.bs - 5);
      this.enemies
        .filter((e) => e.kind === i.target && !this.chatBusy(e))
        .forEach((e) => {
          e.investigate(i, 10, true);
          e.say(ENEMIES[e.kind].weakness + "? On my way.", this.elapsed);
        });
      this.audio.sfx("ability");
      emit("toast", {
        title: "DISTRACTION SENT",
        text: i.label + " · target occupied for 10 seconds.",
        duration: 3,
      });
    }
    this.updateHud();
  }
  resolveFun(id: string, outcome: FunFriday["result"], seconds: number) {
    if (!this.used.has(id) || this.funCompleted.has(id)) return;
    this.funCompleted.add(id);
    this.elapsed += clamp(seconds, 0, 30);
    this.bs = clamp(this.bs + outcome.bsChange, 0, 100);
    this.coffee = Math.min(5, this.coffee + outcome.coffee);
    this.funScore += outcome.score;
    if (outcome.success) {
      this.distractions++;
      const station = this.level.interactions.find((i) => i.id === id)!;
      this.enemies
        .filter((e) => e.kind === "hr")
        .forEach((e) => {
          const standby =
            [
              { x: station.x + 70, y: station.y },
              { x: station.x - 70, y: station.y },
              { x: station.x, y: station.y - 70 },
              { x: station.x, y: station.y + 70 },
            ].find((p) => !blocked(p, 14, this.obstacles)) || station;
          e.investigate(standby, outcome.distractSeconds, true);
          e.say("That clap has leadership potential.", this.elapsed, 4);
        });
    }
    this.updateHud();
  }
  ability(a: Ability) {
    if (this.ended || this.preview || this.scene.isPaused()) return;
    const def = ABILITIES[a];
    if (this.level.id < def.level) return;
    if ((this.cooldowns[a] || 0) > 0) return;
    if (a === "coffee") {
      if (this.coffee <= 0) {
        emit("toast", {
          title: "OUT OF COFFEE",
          text: "Find a cup or refill at a pantry station.",
          duration: 3,
        });
        return;
      }
      this.coffee--;
      this.coffeeUsed++;
      let target = {
        x: this.pos.x + this.facing.x * 155,
        y: this.pos.y + this.facing.y * 155,
      };
      target.x = clamp(target.x, 36, this.level.width - 36);
      target.y = clamp(target.y, 36, this.level.height - 36);
      for (let t = 1; t >= 0; t -= 0.1) {
        const p = {
          x: this.pos.x + (target.x - this.pos.x) * t,
          y: this.pos.y + (target.y - this.pos.y) * t,
        };
        if (
          !blocked(p, 8, this.obstacles) &&
          visible(this.pos, p, this.obstacles)
        ) {
          target = p;
          break;
        }
      }
      let fooled = 0;
      this.enemies
        .filter((e) => dist(e, target) < 260 && !this.chatBusy(e))
        .sort((a, b) => dist(a, target) - dist(b, target))
        .slice(0, 2)
        .forEach((e) => {
          if (e.softDistract(target, 6, this.pos, this.obstacles)) {
            fooled++;
            e.say("A spill! Finally, a concrete deliverable.", this.elapsed, 2);
          } else
            e.say(
              "I can see you. The coffee is not a disguise.",
              this.elapsed,
              2,
            );
        });
      const staffFooled = this.traffic.distract(target, 4);
      fooled += staffFooled;
      this.distractions += fooled;
      emit("toast", {
        title: fooled ? "COFFEE DISTRACTION" : "THEY SAW THE TRICK",
        text: fooled
          ? `${fooled} colleague${fooled === 1 ? "" : "s"} investigating for 6s. Move!`
          : "Chasers who still see you only hesitate. Break sight, then throw around cover.",
        duration: 3,
      });
      this.add
        .circle(target.x, target.y, 17, 0xbd8d6e, 0.8)
        .setDepth(18)
        .setName("spill-" + this.elapsed);
      this.audio.sfx("coffee");
    } else if (a === "wfh") {
      emit("toast", {
        title: this.wfhActive
          ? "WFH IS ALREADY APPROVED"
          : "WFH NEEDS A HOUSE TOKEN",
        text: this.wfhActive
          ? "The purple exit is open. Follow the gold arrow; the lift still works too."
          : "Pick up the purple house token. It opens the alternate exit automatically—no extra button.",
        duration: 3,
      });
      return;
    } else {
      if (a === "slack" && this.bag.weight >= 3) {
        emit("toast", {
          title: "THAT TV IS NOT A SPREADSHEET",
          text: "Bulky stolen equipment makes Slack camouflage unconvincing. Try cover, a call or a dodge.",
          duration: 3,
        });
        return;
      }
      this.active[a] = def.duration;
      this.hidden = false;
      if (a === "vpn") {
        this.eventUntil = 0;
        emit("toast", {
          title: "VPN DISCONNECTED",
          text: "Hazards cleared. Enemies freeze 2s. The lift keeps coming. “ISP issue.”",
          duration: 3,
        });
      } else
        emit("toast", {
          title: def.name.toUpperCase(),
          text:
            a === "call"
              ? "You: “Yes, valued client.” Intern and founder don’t care."
              : a === "slack"
                ? "Stay STILL. Moving cancels the performance."
                : "3.5 seconds of meeting immunity. Use the window; keep moving.",
          duration: 3,
        });
      this.audio.sfx("ability");
    }
    this.cooldowns[a] = def.cooldown;
    this.updateHud();
  }
  takeHit(
    kind: HitKind,
    damage: number,
    title: string,
    text: string,
    grace = 1.2,
  ): boolean {
    if (
      this.invulnerable > 0 ||
      this.cinematic ||
      this.active.calendar ||
      this.ended
    )
      return false;
    this.bs = clamp(this.bs + damage, 0, 100);
    this.hits++;
    this.invulnerable = grace;
    this.stamina = Math.max(45, this.stamina);
    this.theft.cancel();
    this.holdingInteract = false;
    this.lastHit = { kind, damage, title, text };
    this.cinematic = true;
    this.updateHud();
    emit("hit", this.lastHit);
    return true;
  }
  caught(e: OfficeEnemy) {
    if (this.invulnerable > 0 || this.cinematic) return;
    if (
      e.kind === "manager" &&
      this.director.phase === "waiting" &&
      !this.managerDelayed
    ) {
      this.director.eta += 4;
      this.managerDelayed = true;
    }
    if (
      e.kind === "pm" &&
      this.director.phase === "waiting" &&
      !this.pmDelayed
    ) {
      this.director.eta += 3;
      this.pmDelayed = true;
    }
    this.enemiesHit.add(e.kind);
    const kinds: Record<Kind, HitKind> = {
      manager: "meeting",
      hr: "photo",
      intern: "yap",
      founder: "allhands",
      pm: "scope",
      gossip: "gossip",
    };
    this.takeHit(
      kinds[e.kind],
      ENEMIES[e.kind].damage,
      ENEMIES[e.kind].name.toUpperCase(),
      ENEMIES[e.kind].quotes[
        Math.floor(this.random() * ENEMIES[e.kind].quotes.length)
      ],
      3,
    );
  }
  claimLoot(item: Item) {
    const reward = this.bag.claim(item);
    if (!reward) return;
    this.collected.add(item.id);
    this.collectibles = this.bag.count;
    this.bs = Math.max(0, this.bs - reward.bsRecovery);
    this.stamina = Math.min(100, this.stamina + reward.stamina);
    const object = this.itemObjects.get(item.id);
    if (object) {
      this.itemObjects.delete(item.id);
      this.tweens.add({
        targets: object,
        x: this.pos.x,
        y: this.pos.y,
        scaleX: 0.3,
        scaleY: 0.3,
        alpha: 0,
        duration: this.reducedMotion ? 1 : 220,
        onComplete: () => object.destroy(),
      });
    }
    if (reward.noise > 0) {
      this.enemies
        .filter((e) => dist(e, item) < reward.noise && !this.chatBusy(e))
        .slice(0, 3)
        .forEach((e) => e.investigate(item, 6));
      this.lastThreat =
        "Equipment alarm: they know where the theft happened. Move!";
      this.lastThreatAt = this.elapsed + 4;
    }
    this.audio.sfx("item");
    emit("toast", {
      title: `${reward.name.toUpperCase()} · +${reward.points} BAG PTS`,
      text:
        reward.quip +
        (reward.weight >= 3
          ? " Bulky loot: slower movement, easier to notice."
          : "") +
        " Bank it by escaping.",
      duration: 4,
    });
    this.updateHud();
  }
  drawEffects() {
    const g = this.cones;
    // Logic stays at 60 Hz; clipped decorative cones redraw at 20 Hz.
    if (this.elapsed >= this.coneAt) {
      this.coneAt = this.elapsed + 0.05;
      g.clear();
      for (const e of this.enemies) {
        if (this.active.vpn || e.state === "distracted") continue;
        const d = ENEMIES[e.kind],
          range =
            d.range *
            ((this.eventType === "hands" && this.elapsed < this.eventUntil) ||
            this.bag.weight >= 3
              ? 1.2
              : 1);
        const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(e.x, e.y)];
        for (
          let a = e.angle - d.fov / 2;
          a <= e.angle + d.fov / 2 + 0.01;
          a += d.fov / 30
        ) {
          let max = range;
          for (let r = 12; r < range; r += 9) {
            const p = { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r };
            if (blocked(p, 1, this.obstacles)) {
              max = r - 5;
              break;
            }
          }
          pts.push(
            new Phaser.Math.Vector2(
              e.x + Math.cos(a) * max,
              e.y + Math.sin(a) * max,
            ),
          );
        }
        g.fillStyle(0xff7e8c, e.awareness > 0.1 ? 0.17 : 0.075);
        g.fillPoints(pts, true);
        if (e.awareness > 0.03) {
          g.lineStyle(3, e.awareness > 0.65 ? 0xff7379 : 0xffd580, 0.9);
          g.beginPath();
          g.arc(
            e.x,
            e.y,
            25,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * e.awareness,
          );
          g.strokePath();
        }
      }
    }
    const m = this.markers;
    m.clear();
    for (const i of this.level.interactions) {
      const used = this.used.has(i.id),
        color = 0xa9f4ce;
      m.lineStyle(
        used ? 1 : 2,
        color,
        used ? 0.25 : 0.55 + Math.sin(this.elapsed * 3) * 0.12,
      ).strokeCircle(i.x, i.y, i.type === "hide" ? 20 : 16);
      m.lineStyle(2, color, used ? 0.3 : 1);
      if (i.type === "switch") {
        m.strokeRect(i.x - 5, i.y - 6, 10, 12);
        m.lineBetween(i.x, i.y - 3, i.x, i.y + 3);
      } else if (i.type === "hide") {
        m.lineBetween(i.x - 6, i.y, i.x, i.y - 5)
          .lineBetween(i.x, i.y - 5, i.x + 6, i.y)
          .strokeRect(i.x - 4, i.y, 8, 7);
      } else if (i.type === "coffee") {
        m.strokeRect(i.x - 5, i.y - 5, 8, 10).strokeRect(
          i.x + 3,
          i.y - 3,
          4,
          5,
        );
      } else if (i.type === "fun") {
        m.strokeRect(i.x - 8, i.y - 7, 5, 12)
          .strokeRect(i.x + 3, i.y - 7, 5, 12)
          .lineBetween(i.x - 1, i.y - 10, i.x + 1, i.y - 15);
      } else {
        m.strokeCircle(i.x, i.y - 3, 4).lineBetween(i.x, i.y + 3, i.x, i.y + 6);
      }
    }
    const ready = this.director.phase === "boarding";
    const ec = center(this.level.exit);
    m.lineStyle(
      3,
      ready ? 0xa7ffcc : 0xffcc79,
      0.6 + Math.sin(this.elapsed * 4) * 0.25,
    ).strokeRoundedRect(
      this.level.exit.x - 5,
      this.level.exit.y - 5,
      this.level.exit.w + 10,
      this.level.exit.h + 10,
      4,
    );
    this.fx.clear();
    if (
      this.active.call ||
      this.active.calendar ||
      this.active.slack ||
      this.active.vpn
    ) {
      this.fx
        .lineStyle(
          2,
          this.active.vpn
            ? 0x91cbff
            : this.active.calendar
              ? 0xffd584
              : 0xb0f9d0,
          0.8,
        )
        .strokeCircle(this.pos.x, this.pos.y, 26);
    }
    if (this.lastSprinting) {
      this.fx
        .lineStyle(1, 0xe6e6d4, 0.4)
        .lineBetween(
          this.pos.x - this.facing.x * 18,
          this.pos.y - this.facing.y * 18,
          this.pos.x - this.facing.x * 30,
          this.pos.y - this.facing.y * 30,
        );
    }
    const destination =
      this.wfhActive && this.level.altExit ? center(this.level.altExit) : ec;
    if (this.elapsed >= this.routeAt) {
      const path = this.nav.path(this.pos, destination);
      let next = path[0] || destination;
      for (const point of path.slice(0, 8)) {
        if (!visible(this.pos, point, this.obstacles)) break;
        next = point;
        if (dist(this.pos, point) > 110) break;
      }
      this.routeHint = next;
      this.routeAt = this.elapsed + 0.4;
    }
    const goal: Point = this.routeHint || destination;
    if (this.theft.id) {
      const item = this.level.items.find((i) => i.id === this.theft.id);
      if (item)
        this.fx
          .lineStyle(4, 0xa9f4ce, 1)
          .beginPath()
          .arc(
            item.x,
            item.y,
            26,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * this.theft.progress,
          )
          .strokePath();
    }
    if (dist(this.pos, destination) > 75) {
      const a = Math.atan2(goal.y - this.pos.y, goal.x - this.pos.x),
        x = this.pos.x + Math.cos(a) * 40,
        y = this.pos.y + Math.sin(a) * 40;
      this.fx
        .fillStyle(0xfce2a0, 0.9)
        .fillTriangle(
          x + Math.cos(a) * 7,
          y + Math.sin(a) * 7,
          x + Math.cos(a + 2.5) * 6,
          y + Math.sin(a + 2.5) * 6,
          x + Math.cos(a - 2.5) * 6,
          y + Math.sin(a - 2.5) * 6,
        );
    }
    for (const [id, obj] of this.itemObjects) {
      if (this.collected.has(id)) continue;
      const item = this.level.items.find((i) => i.id === id)!;
      obj.setY(item.y + Math.sin(this.elapsed * 3 + id.length) * 2);
      if (isStealable(item.kind)) {
        const focus = id === this.focusedLoot?.id || id === this.theft.id;
        (obj.list[2] as Phaser.GameObjects.Text).setVisible(focus);
        (obj.list[0] as Phaser.GameObjects.Graphics).setAlpha(focus ? 1 : 0.35);
      }
    }
  }
  updateHud() {
    const phase = this.director.phase;
    const objectives = [
      {
        id: "call-lift",
        label: "Find the gold lift. E to call.",
        done: phase !== "find-lift",
      },
      {
        id: "survive",
        label: `DODGE THE OFFICE · lift in ${Math.ceil(this.director.eta)}s`,
        done: phase === "boarding",
      },
      {
        id: "board",
        label: `BOARD NOW · doors close in ${Math.ceil(this.director.boardLeft)}s`,
        done: false,
      },
    ];
    emit("hud", {
      level: this.level.id,
      name: this.level.name,
      elapsed: this.elapsed,
      bs: this.bs,
      stamina: this.stamina,
      coffee: this.coffee,
      wfh: this.wfh,
      wfhActive: this.wfhActive,
      hidden: this.hidden,
      active: { ...this.active },
      cooldowns: { ...this.cooldowns },
      objectives,
      spots: this.spots,
      collectibles: this.collectibles,
      lootValue: this.bag.value,
      lootCount: this.bag.count,
      carryPenalty: Math.round((1 - carryMultiplier(this.bag.weight)) * 100),
      theftProgress: this.theft.progress,
      ready: phase === "boarding",
      phase,
      hrWindup: this.enemies.some((e) => e.specialPhase === "photo-windup"),
      incoming: this.director.incidents.find(
        (h) => h.age < h.warn && dist(h, this.pos) < 380,
      )?.kind,
      eta: this.director.eta,
      doors: this.director.boardLeft,
      dodges: this.dodgeCount,
      dashCooldown: this.dashCooldown,
      hideLeft: this.hideLeft,
      target: this.target?.label || "",
      lootTarget: this.focusedLoot?.id,
      activeDanger: this.director.incidents.some(
        (h) =>
          h.age >= h.warn &&
          h.age < h.life &&
          !h.hit &&
          dist(h, this.pos) < 180,
      ),
      suspicion: Math.max(
        0,
        ...this.enemies.map((e) => e.awareness),
        ...this.traffic.staff.map((e) => e.awareness),
      ),
      daily: this.options.daily,
      seed: this.options.seed,
      context: this.hintText,
      dialogue:
        this.enemies
          .filter(
            (e) =>
              this.elapsed < e.quoteUntil &&
              dist(e, this.pos) < 260 &&
              !this.chatBusy(e),
          )
          .sort((a, b) => dist(a, this.pos) - dist(b, this.pos))
          .map((e) => ({
            speaker: ENEMIES[e.kind].name,
            text: e.quote,
            color: ENEMIES[e.kind].color,
          }))[0] || null,
    });
  }
  finish(win: boolean, alt = false) {
    if (this.ended) return;
    this.ended = true;
    this.won = win;
    this.audio.sfx(win ? "exit" : "fail");
    if (win) this.audio.music("victory");
    const score =
      scoreRun(
        this.elapsed,
        this.level.par,
        this.spots,
        this.hits,
        0,
        this.distractions,
        this.bs,
      ) +
      this.funScore * 2 +
      this.dodgeCount * 125 +
      this.bag.value;
    const result: Result = {
      level: this.level.id,
      time: Math.round(this.elapsed * 10) / 10,
      bs: Math.round(this.bs),
      spots: this.spots,
      hits: this.hits,
      collectibles: this.collectibles,
      distractions: this.distractions,
      score,
      funScore: this.funScore,
      dodges: this.dodgeCount,
      ruleset: 2,
      lootValue: this.bag.value,
      stolen: this.bag.count,
      medal: medal(score, this.spots, this.hits, this.elapsed, this.level.par),
      daily: this.options.daily,
      seed: this.options.seed,
      story: {
        coffees: this.coffeeUsed,
        staffSpots: this.staffSpots,
        conversations: this.conversations,
        chatStillGoing: this.social.active?.phase === "talking",
        lootNames: [...new Set(this.bag.taken.values())].map(
          (k) => LOOT[k].name,
        ),
        exit: alt ? "wfh" : "lift",
      },
    };
    const earned: string[] = [];
    if (this.spots === 0) earned.push("ghost");
    if (this.bag.hasTV) earned.push("tv");
    if (this.bag.countKind("snacks") >= 2) earned.push("snacks");
    if (this.bag.value >= 1500) earned.push("heist");
    if (this.dodgeCount >= 3) earned.push("dodge");
    if (
      this.level.id === 1 &&
      this.hits === 0 &&
      this.nonRequiredInteractions === 0
    )
      earned.push("email");
    if (this.level.id === 2 && !this.enemiesHit.has("hr"))
      earned.push("culture");
    if (this.internTime >= 12) earned.push("yap");
    if (this.elapsed < 45) earned.push("speed");
    if (this.level.id === 5 && this.hits === 0) earned.push("founder");
    if (this.bluffs >= 3) earned.push("busy");
    if (this.level.id === 5) earned.push("all");
    if (
      this.level.items
        .filter((i) => i.kind === "laptop")
        .every((i) => this.collected.has(i.id))
    )
      earned.push("laptop");
    if (alt) earned.push("wfh");
    if (this.options.daily) earned.push("daily");
    if (this.coffeeUsed >= 3) earned.push("kaapi");
    if (win) {
      const r = alt ? this.level.altExit! : this.level.exit;
      const c = center(r);
      for (let i = 0; i < 36; i++) {
        const pixel = this.add
          .rectangle(
            c.x,
            c.y,
            4 + this.random() * 4,
            4,
            [0xa6f4cd, 0xffd682, 0xbd9bfc][i % 3],
          )
          .setDepth(100);
        this.tweens.add({
          targets: pixel,
          x: c.x + (this.random() - 0.5) * 240,
          y: c.y + (this.random() - 0.5) * 220,
          angle: 180,
          alpha: 0,
          duration: this.reducedMotion ? 10 : 900,
          onComplete: () => pixel.destroy(),
        });
      }
      this.tweens.add({
        targets: this.player,
        x: c.x,
        y: c.y,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: this.reducedMotion ? 10 : 600,
      });
    } else {
      this.player.setTint(0xff8a91);
      if (!this.reducedMotion) this.cameras.main.shake(350, 0.006);
    }
    this.time.delayedCall(win && !this.reducedMotion ? 850 : 250, () =>
      emit("end", { win, result, earned: win ? earned : [], alt }),
    );
    this.updateHud();
  }
  snapshot() {
    return {
      level: this.level.id,
      seed: this.options.seed,
      pos: { ...this.pos },
      width: this.level.width,
      height: this.level.height,
      cinematic: this.cinematic,
      lastHit: this.lastHit,
      lootValue: this.bag.value,
      lootCount: this.bag.count,
      lootWeight: this.bag.weight,
      theft: { id: this.theft.id, progress: this.theft.progress },
      lootTarget: this.focusedLoot?.id,
      labelledLoot: [...this.itemObjects]
        .filter(([id, obj]) => {
          const item = this.level.items.find((i) => i.id === id);
          return (
            item &&
            isStealable(item.kind) &&
            (obj.list[2] as Phaser.GameObjects.Text).visible
          );
        })
        .map(([id]) => id),
      items: this.level.items
        .filter((i) => !this.collected.has(i.id))
        .map((i) => ({ ...i })),
      staff: this.traffic.staff.map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        angle: e.angle,
        phase: e.phase,
        awareness: e.awareness,
      })),
      meetingDoors: this.traffic.doors.map((d) => ({ ...d })),
      elapsed: this.elapsed,
      bs: this.bs,
      stamina: this.stamina,
      spots: this.spots,
      hits: this.hits,
      hidden: this.hidden,
      ended: this.ended,
      collected: [...this.collected],
      used: [...this.used],
      coffee: this.coffee,
      wfh: this.wfh,
      wfhActive: this.wfhActive,
      funScore: this.funScore,
      funCompleted: [...this.funCompleted],
      active: { ...this.active },
      cooldowns: { ...this.cooldowns },
      target: this.target?.id,
      exit: center(this.level.exit),
      phase: this.director.phase,
      eta: this.director.eta,
      doors: this.director.boardLeft,
      dashing: this.dashLeft > 0,
      dashCooldown: this.dashCooldown,
      dodges: this.dodgeCount,
      hideLeft: this.hideLeft,
      incidents: this.director.incidents.map((h) => ({ ...h })),
      enemies: this.enemies.map((e) => ({
        kind: e.kind,
        x: e.x,
        y: e.y,
        state: e.state,
        angle: e.angle,
        poseAngle: e.sprite.angle,
        awareness: e.awareness,
        specialPhase: e.specialPhase,
        aim: e.aim,
      })),
      social: this.social.active ? { ...this.social.active } : null,
      conversations: this.conversations,
      chatCaption:
        [...this.socialLabels.values()].find((t) => t.visible)?.text || "",
      objectives: this.level.required,
      obstacles: this.obstacles.map((o) => ({ ...o })),
    };
  }
}
