import { describe, it, expect, vi } from "vitest";
import { OfficeEnemy, type EnemyContext } from "../src/game/enemy";
import { Navigator, dist, rng } from "../src/game/logic";
import { ENEMIES } from "../src/game/catalog";
import type { Kind } from "../src/game/types";
function fakeObject(): any {
  const obj: any = {};
  for (const m of [
    "setScale",
    "setDepth",
    "setOrigin",
    "setVisible",
    "setText",
    "setColor",
    "setPosition",
    "setFlipX",
    "setAlpha",
  ])
    obj[m] = () => obj;
  return obj;
}
function setup(kind: Kind = "manager") {
  const scene: any = { add: { image: fakeObject, text: fakeObject } },
    enemy = new OfficeEnemy(
      scene,
      {
        kind,
        x: 100,
        y: 100,
        route: [
          { x: 500, y: 100 },
          { x: 100, y: 100 },
        ],
      },
      rng(5),
    );
  enemy.angle = 0;
  const context: EnemyContext = {
    dt: 1 / 60,
    time: 0,
    player: { x: 180, y: 100 },
    hidden: false,
    camouflaged: false,
    sprinting: false,
    quiet: false,
    call: false,
    calendar: false,
    stunned: false,
    alertBoost: false,
    obstacles: [],
    nav: new Navigator(1120, 800, []),
    random: rng(6),
    spot: vi.fn(),
    catch: vi.fn(),
    broadcast: vi.fn(),
    bluff: vi.fn(),
  };
  return { enemy, context };
}
function tick(e: OfficeEnemy, c: EnemyContext, n: number) {
  for (let i = 0; i < n; i++) {
    c.time += c.dt;
    e.update(c);
  }
}
describe("enemy finite-state machine", () => {
  it("gives a readable detection grace period before a chase", () => {
    const { enemy: e, context: c } = setup();
    e.idle = 10;
    tick(e, c, 50);
    expect(e.awareness).toBeGreaterThan(0.5);
    expect(c.spot).not.toHaveBeenCalled();
    tick(e, c, 40);
    expect(c.spot).toHaveBeenCalledTimes(1);
    expect(e.state).toBe("chase");
  });
  it("does not see through walls", () => {
    const { enemy: e, context: c } = setup();
    e.idle = 20;
    c.obstacles = [{ x: 130, y: 40, w: 20, h: 160 }];
    c.nav = new Navigator(1120, 800, c.obstacles);
    tick(e, c, 180);
    expect(e.awareness).toBe(0);
    expect(c.spot).not.toHaveBeenCalled();
  });
  it("hidden employees break pursuit, trigger searching, then return to patrol", () => {
    const { enemy: e, context: c } = setup();
    e.state = "chase";
    e.stateTime = 3;
    e.lastSeen = { ...c.player };
    c.hidden = true;
    tick(e, c, 1);
    expect(e.state).toBe("search");
    tick(e, c, 250);
    expect(e.state).toBe("patrol");
    expect(c.catch).not.toHaveBeenCalled();
  });
  it("hears nearby sprinting and investigates, unless masked by production noise", () => {
    const a = setup();
    a.context.sprinting = true;
    tick(a.enemy, a.context, 1);
    expect(a.enemy.state).toBe("investigate");
    const b = setup();
    b.context.sprinting = true;
    b.context.quiet = true;
    tick(b.enemy, b.context, 1);
    expect(b.enemy.state).toBe("patrol");
  });
  it.each<Kind>(["manager", "hr", "pm", "gossip"])(
    "fake calls protect against %s",
    (kind) => {
      const { enemy: e, context: c } = setup(kind);
      c.player = { x: 140, y: 100 };
      c.call = true;
      e.idle = 10;
      tick(e, c, 180);
      expect(c.spot).not.toHaveBeenCalled();
      expect(c.catch).not.toHaveBeenCalled();
      expect(c.bluff).toHaveBeenCalledTimes(1);
    },
  );
  it.each<Kind>(["intern", "founder"])(
    "%s ignores fake client calls",
    (kind) => {
      const { enemy: e, context: c } = setup(kind);
      e.idle = 10;
      c.call = true;
      tick(e, c, 150);
      expect(c.spot).toHaveBeenCalled();
    },
  );
  it("calendar blocks catches without erasing suspicion", () => {
    const { enemy: e, context: c } = setup();
    e.state = "chase";
    e.stateTime = 8;
    c.player = { x: 120, y: 100 };
    c.calendar = true;
    tick(e, c, 60);
    expect(c.catch).not.toHaveBeenCalled();
    expect(e.state).toBe("chase");
    c.calendar = false;
    tick(e, c, 1);
    expect(c.catch).toHaveBeenCalled();
  });
  it("stationary camouflage bluffs while moving cancellation is handled by the scene", () => {
    const { enemy: e, context: c } = setup();
    e.idle = 5;
    c.player = { x: 130, y: 100 };
    c.camouflaged = true;
    tick(e, c, 120);
    expect(c.bluff).toHaveBeenCalledTimes(1);
    expect(c.spot).not.toHaveBeenCalled();
  });
  it("VPN stun freezes movement and detection", () => {
    const { enemy: e, context: c } = setup();
    const start = { x: e.x, y: e.y };
    c.stunned = true;
    tick(e, c, 180);
    expect({ x: e.x, y: e.y }).toEqual(start);
    expect(e.awareness).toBe(0);
    expect(c.catch).not.toHaveBeenCalled();
  });
  it("a gossip sighting broadcasts the location exactly when pursuit starts", () => {
    const { enemy: e, context: c } = setup("gossip");
    e.idle = 10;
    tick(e, c, 100);
    expect(c.broadcast).toHaveBeenCalledTimes(1);
    expect(c.broadcast).toHaveBeenCalledWith(c.player);
  });
  it("distractions genuinely override pursuit, suppress sight, and expire", () => {
    const { enemy: e, context: c } = setup();
    e.state = "chase";
    e.awareness = 1;
    e.investigate({ x: 400, y: 150 }, 2, true);
    expect(e.state).toBe("distracted");
    expect(e.awareness).toBe(0);
    tick(e, c, 90);
    expect(c.spot).not.toHaveBeenCalled();
    tick(e, c, 40);
    expect(e.state).not.toBe("distracted");
  });
  it("catching deals the personality-specific damage through the callback and gives a cooldown", () => {
    const { enemy: e, context: c } = setup("founder");
    e.state = "chase";
    e.stateTime = 4;
    c.player = { x: 115, y: 100 };
    tick(e, c, 1);
    expect(c.catch).toHaveBeenCalledTimes(1);
    expect(e.catchCooldown).toBe(7);
    expect(e.state).toBe("distracted");
    tick(e, c, 120);
    expect(c.catch).toHaveBeenCalledTimes(1);
    expect(ENEMIES.founder.damage).toBe(35);
  });
  it("intern patrols are genuinely faster than manager patrols", () => {
    const a = setup("manager"),
      b = setup("intern");
    for (const s of [a, b]) {
      s.context.player = { x: 900, y: 700 };
      s.enemy.routeIndex = 0;
      s.enemy.target = { x: 500, y: 100 };
      s.context.random = () => 0.9;
    }
    tick(a.enemy, a.context, 60);
    tick(b.enemy, b.context, 60);
    expect(dist({ x: 100, y: 100 }, b.enemy)).toBeGreaterThan(
      dist({ x: 100, y: 100 }, a.enemy) + 20,
    );
  });
});

describe("pursuit and counterplay", () => {
  it.each<Kind>(["manager", "hr", "pm", "gossip", "founder", "intern"])(
    "%s still needs more than 0.8 seconds of directional detection",
    (kind) => {
      const { enemy: e, context: c } = setup(kind);
      e.idle = 10;
      tick(e, c, 48);
      expect(e.awareness).toBeGreaterThan(0);
      expect(e.awareness).toBeLessThan(1);
      expect(c.spot).not.toHaveBeenCalled();
      expect(c.catch).not.toHaveBeenCalled();
    },
  );
  it("turns toward a close body with a readable grace period instead of walking through it", () => {
    const { enemy: e, context: c } = setup();
    e.idle = 10;
    c.player = { x: 60, y: 100 };
    tick(e, c, 50);
    expect(e.awareness).toBeCloseTo(2 / 3);
    expect(c.spot).not.toHaveBeenCalled();
    expect(Math.abs(e.angle)).toBeCloseTo(Math.PI);
    tick(e, c, 26);
    expect(c.spot).toHaveBeenCalledTimes(1);
    expect(e.state).toBe("chase");
  });
  it("investigates outside personal space long enough to actually notice a stationary employee", () => {
    const { enemy: e, context: c } = setup("hr");
    c.player = { x: 160, y: 100 };
    e.investigate(c.player, 6);
    tick(e, c, 60);
    expect(dist(e, c.player)).toBeGreaterThan(29);
    expect(c.catch).not.toHaveBeenCalled();
    tick(e, c, 80);
    expect(c.spot).toHaveBeenCalled();
    expect(c.catch).toHaveBeenCalled();
  });
  it("proximity awareness does not penetrate walls", () => {
    const { enemy: e, context: c } = setup();
    e.idle = 10;
    c.player = { x: 60, y: 100 };
    c.obstacles = [{ x: 75, y: 40, w: 10, h: 120 }];
    tick(e, c, 180);
    expect(e.awareness).toBe(0);
    expect(c.spot).not.toHaveBeenCalled();
  });
  it.each(["hidden", "camouflaged", "call"] as const)(
    "%s still protects against proximity awareness",
    (protection) => {
      const { enemy: e, context: c } = setup();
      e.idle = 10;
      c.player = { x: 60, y: 100 };
      c[protection] = true;
      tick(e, c, 90);
      expect(e.awareness).toBe(0);
      expect(c.spot).not.toHaveBeenCalled();
      expect(c.catch).not.toHaveBeenCalled();
    },
  );
  it.each<Kind>(["manager", "hr", "pm", "gossip", "founder", "intern"])(
    "%s uses its catalog speed with faster pursuit",
    (kind) => {
      const { enemy: e, context: c } = setup(kind);
      e.state = "chase";
      e.stateTime = 4;
      c.player = { x: 600, y: 100 };
      e.target = { ...c.player };
      c.dt = 0.1;
      tick(e, c, 1);
      expect(e.x - 100).toBeCloseTo(
        ENEMIES[kind].speed * (kind === "intern" ? 1.35 : 1.45) * c.dt,
      );
    },
  );
  it.each<Kind>(["manager", "founder"])(
    "%s gets a small catalog-based walking boost",
    (kind) => {
      const { enemy: e, context: c } = setup(kind);
      e.routeIndex = 0;
      c.player = { x: 900, y: 700 };
      c.dt = 0.1;
      tick(e, c, 1);
      expect(e.x - 100).toBeCloseTo(ENEMIES[kind].speed * 1.05 * c.dt);
    },
  );
  it.each<Kind>(["manager", "intern"])(
    "%s does not randomly stop or reroute every frame",
    (kind) => {
      const { enemy: e, context: c } = setup(kind);
      e.routeIndex = 0;
      e.talkCooldown = 100;
      c.player = { x: 900, y: 700 };
      c.random = vi.fn(() => 0);
      const path = vi.spyOn(c.nav, "path");
      tick(e, c, 60);
      expect(e.x).toBeGreaterThan(180);
      expect(e.routeIndex).toBe(0);
      expect(e.idle).toBe(0);
      expect(path).toHaveBeenCalledTimes(1);
      expect(c.random).not.toHaveBeenCalled();
    },
  );
  it("searches the last seen position and fairly reacquires a visible player", () => {
    const { enemy: e, context: c } = setup();
    e.state = "chase";
    e.stateTime = 0.01;
    e.lastSeen = { x: 180, y: 100 };
    e.awareness = 0.5;
    e.idle = 10;
    c.player = { x: 900, y: 700 };
    tick(e, c, 1);
    expect(e.state).toBe("search");
    expect(e.target).toEqual(e.lastSeen);
    c.player = { x: 180, y: 100 };
    tick(e, c, 30);
    expect(e.state).toBe("search");
    expect(c.spot).not.toHaveBeenCalled();
    tick(e, c, 10);
    expect(e.state).toBe("chase");
    expect(c.spot).toHaveBeenCalledTimes(1);
    expect(e.target).toEqual(c.player);
  });
  it("dashing prevents ordinary catches as well as photo catches", () => {
    const { enemy: e, context: c } = setup();
    e.state = "chase";
    e.stateTime = 4;
    c.player = { x: 115, y: 100 };
    c.dashing = true;
    tick(e, c, 10);
    expect(c.catch).not.toHaveBeenCalled();
    c.dashing = false;
    tick(e, c, 1);
    expect(c.catch).toHaveBeenCalledTimes(1);
  });
  it("close pursuit resists coffee, hesitates for 0.4 seconds, then resumes", () => {
    const { enemy: e, context: c } = setup();
    e.state = "chase";
    e.stateTime = 4;
    e.awareness = 1;
    e.target = { ...c.player };
    expect(e.softDistract({ x: 400, y: 200 }, 7, c.player, [])).toBe(false);
    expect(e.state).toBe("chase");
    expect(e.awareness).toBe(1);
    expect(e.idle).toBe(0.4);
    expect(e.target).toEqual(c.player);
    c.dt = 0.2;
    tick(e, c, 1);
    expect(e.x).toBe(100);
    tick(e, c, 1);
    expect(e.x).toBeGreaterThan(100);
    expect(e.state).toBe("chase");
  });
  it("coffee cannot blind a close visible pursuer merely by moving behind it", () => {
    const { enemy: e } = setup();
    e.state = "chase";
    expect(e.softDistract({ x: 400, y: 200 }, 7, { x: 60, y: 100 }, [])).toBe(
      false,
    );
    expect(e.state).toBe("chase");
  });
  it.each(["patrol", "far", "wall"])(
    "coffee can divert an enemy when %s rather than visible close pursuit",
    (reason) => {
      const { enemy: e, context: c } = setup();
      if (reason !== "patrol") e.state = "chase";
      if (reason === "far") c.player = { x: 400, y: 100 };
      if (reason === "wall") c.obstacles = [{ x: 130, y: 50, w: 20, h: 100 }];
      const spill = { x: 400, y: 200 };
      expect(e.softDistract(spill, 7, c.player, c.obstacles)).toBe(true);
      expect(e.state).toBe("distracted");
      expect(e.awareness).toBe(0);
      expect(e.stateTime).toBe(7);
      expect(e.target).toEqual(spill);
      expect(e.target).not.toBe(spill);
    },
  );
});

function photoSetup() {
  const s = setup("hr");
  s.enemy.state = "chase";
  s.enemy.stateTime = 4;
  s.context.player = { x: 260, y: 100 };
  s.context.threat = vi.fn();
  s.context.dodge = vi.fn();
  return s;
}
function startCharge(e: OfficeEnemy, c: EnemyContext) {
  tick(e, c, 1);
  expect(e.specialPhase).toBe("photo-windup");
  tick(e, c, 54);
  expect(e.specialPhase).toBe("photo-charge");
}
describe("HR's team photo lunge", () => {
  it("exposes inactive telegraph fields and does not require new context callbacks", () => {
    const { enemy: e, context: c } = setup("hr");
    expect(e.specialPhase).toBe("none");
    expect(e.specialLeft).toBe(0);
    expect(e.specialCooldown).toBe(0);
    expect(e.aim).toBeNull();
    e.state = "chase";
    e.stateTime = 4;
    c.player = { x: 260, y: 100 };
    c.dashing = true;
    startCharge(e, c);
    c.dt = 0.75;
    expect(() => tick(e, c, 1)).not.toThrow();
    expect(c.catch).not.toHaveBeenCalled();
  });
  it("telegraphs once, stops for 0.9 seconds, and faces a snapshot of the aim", () => {
    const { enemy: e, context: c } = photoSetup();
    e.talkCooldown = 0;
    tick(e, c, 1);
    expect(e.specialPhase).toBe("photo-windup");
    expect(e.specialLeft).toBe(0.9);
    expect(e.aim).toEqual({ x: 260, y: 100 });
    expect(e.aim).not.toBe(c.player);
    expect(e.angle).toBe(0);
    expect(e.path).toEqual([]);
    const text = "TEAM PHOTO! Nobody blink. Or leave.";
    expect(e.quote).toBe(text);
    expect(c.threat).toHaveBeenCalledExactlyOnceWith(e, text);
    // Mutate the player's existing point to prove this is a lock, not an alias.
    c.player.x = 190;
    c.player.y = 200;
    tick(e, c, 53);
    expect(e.specialPhase).toBe("photo-windup");
    expect(e.specialLeft).toBeCloseTo(1 / 60);
    expect({ x: e.x, y: e.y }).toEqual({ x: 100, y: 100 });
    expect(e.aim).toEqual({ x: 260, y: 100 });
    expect(e.angle).toBe(0);
    expect(c.catch).not.toHaveBeenCalled();
    expect(c.threat).toHaveBeenCalledTimes(1);
    expect(e.quote).toBe(text);
    tick(e, c, 1);
    expect(e.specialPhase).toBe("photo-charge");
    expect(e.specialLeft).toBe(0.75);
    expect(e.x).toBe(100);
  });
  it("charges at 285 px/s toward the locked aim, never homing, then recovers", () => {
    const { enemy: e, context: c } = photoSetup();
    startCharge(e, c);
    c.player = { x: 190, y: 200 };
    tick(e, c, 10);
    expect(e.x).toBeCloseTo(147.5);
    expect(e.y).toBe(100);
    expect(e.aim).toEqual({ x: 260, y: 100 });
    tick(e, c, 24);
    expect(e.x).toBeCloseTo(260);
    expect(e.y).toBe(100);
    expect(e.specialPhase).toBe("none");
    expect(e.specialLeft).toBe(0);
    expect(e.aim).toBeNull();
    expect(e.idle).toBe(0.5);
    expect(e.specialCooldown).toBe(6.5);
    expect(c.catch).not.toHaveBeenCalled();
    tick(e, c, 20);
    expect(e.x).toBeCloseTo(260);
    expect(e.y).toBe(100);
  });
  it("caps charge duration at 0.75 seconds, including on a long frame", () => {
    const { enemy: e, context: c } = photoSetup();
    c.player = { x: 330, y: 100 };
    startCharge(e, c);
    c.player = { x: 500, y: 300 };
    c.dt = 2;
    tick(e, c, 1);
    expect(e.x).toBeCloseTo(100 + 285 * 0.75);
    expect(e.y).toBe(100);
    expect(e.specialPhase).toBe("none");
    expect(e.specialCooldown).toBe(6.5);
    expect(e.idle).toBe(0.5);
  });
  it.each([
    "patrol",
    "distracted",
    "stunned",
    "call",
    "calendar",
    "hidden",
    "camouflaged",
    "wall",
    "too close",
    "too far",
  ])("does not start a photo while %s", (reason) => {
    const { enemy: e, context: c } = photoSetup();
    if (reason === "patrol" || reason === "distracted") e.state = reason;
    if (
      reason === "stunned" ||
      reason === "call" ||
      reason === "calendar" ||
      reason === "hidden" ||
      reason === "camouflaged"
    )
      c[reason] = true;
    if (reason === "wall") {
      c.obstacles = [{ x: 180, y: 40, w: 20, h: 160 }];
      c.nav = new Navigator(1120, 800, c.obstacles);
    }
    if (reason === "too close") c.player.x = 160;
    if (reason === "too far") c.player.x = 331;
    tick(e, c, 1);
    expect(e.specialPhase).toBe("none");
    expect(e.aim).toBeNull();
    expect(c.threat).not.toHaveBeenCalled();
  });
  it("does not catch a player who walks into HR during the windup", () => {
    const { enemy: e, context: c } = photoSetup();
    tick(e, c, 1);
    c.player = { x: 115, y: 100 };
    tick(e, c, 53);
    expect(e.specialPhase).toBe("photo-windup");
    expect(e.x).toBe(100);
    expect(c.catch).not.toHaveBeenCalled();
  });
  it("catches during the charge, applies the normal cooldown, and cancels the special", () => {
    const { enemy: e, context: c } = photoSetup();
    startCharge(e, c);
    c.dt = 0.75;
    tick(e, c, 1);
    expect(c.catch).toHaveBeenCalledExactlyOnceWith(e);
    expect(e.state).toBe("distracted");
    expect(e.catchCooldown).toBe(7);
    expect(e.specialPhase).toBe("none");
    expect(e.aim).toBeNull();
    expect(e.specialCooldown).toBe(6.5);
    expect(e.target).toBeNull();
    expect(e.path).toEqual([]);
  });
  it("stops safely on a newly closed wall, even on a long charge frame", () => {
    const { enemy: e, context: c } = photoSetup();
    startCharge(e, c);
    c.obstacles = [{ x: 165, y: 40, w: 10, h: 160 }];
    c.dt = 1;
    tick(e, c, 1);
    expect(e.x).toBeGreaterThan(140);
    expect(e.x + 11).toBeLessThanOrEqual(165);
    expect(e.y).toBe(100);
    expect(e.specialPhase).toBe("none");
    expect(e.specialCooldown).toBe(6.5);
    expect(c.catch).not.toHaveBeenCalled();
  });
  it("never catches or awards a dodge through a wall during a charge", () => {
    for (const dashing of [false, true]) {
      const { enemy: e, context: c } = photoSetup();
      startCharge(e, c);
      c.player = { x: 128, y: 100 };
      c.obstacles = [{ x: 116, y: 40, w: 5, h: 160 }];
      c.dashing = dashing;
      c.dt = 0.75;
      tick(e, c, 1);
      expect(e.x + 11).toBeLessThanOrEqual(116);
      expect(c.catch).not.toHaveBeenCalled();
      expect(c.dodge).not.toHaveBeenCalled();
    }
  });
  it("awards one swept dash dodge per charge and cannot relunge for 6.5 seconds", () => {
    const { enemy: e, context: c } = photoSetup();
    c.dashing = true;
    startCharge(e, c);
    c.dt = 0.75;
    tick(e, c, 1);
    expect(e.x).toBeCloseTo(260);
    expect(c.dodge).toHaveBeenCalledExactlyOnceWith(e);
    expect(c.catch).not.toHaveBeenCalled();
    expect(e.specialCooldown).toBe(6.5);
    // Hold position with an empty path, not an idle guard, to exercise cooldown.
    e.x = 100;
    vi.spyOn(c.nav, "path").mockReturnValue([]);
    c.dt = 0.25;
    tick(e, c, 25);
    expect(e.idle).toBe(0);
    expect(e.specialCooldown).toBe(0.25);
    expect(e.specialPhase).toBe("none");
    expect(c.threat).toHaveBeenCalledTimes(1);
    tick(e, c, 1);
    expect(e.specialPhase).toBe("photo-windup");
    expect(c.threat).toHaveBeenCalledTimes(2);
    tick(e, c, 4);
    expect(e.specialPhase).toBe("photo-charge");
    c.dt = 0.75;
    tick(e, c, 1);
    expect(c.dodge).toHaveBeenCalledTimes(2);
    expect(c.catch).not.toHaveBeenCalled();
  });
  it.each(["photo-windup", "photo-charge"] as const)(
    "VPN cancels %s instead of releasing a paused lunge after stun",
    (phase) => {
      const { enemy: e, context: c } = photoSetup();
      if (phase === "photo-charge") startCharge(e, c);
      else tick(e, c, 1);
      const start = { x: e.x, y: e.y },
        awareness = e.awareness;
      c.stunned = true;
      c.call = true;
      c.player = { x: 115, y: 100 };
      tick(e, c, 1);
      expect(e.specialPhase).toBe("none");
      expect(e.aim).toBeNull();
      expect(e.specialCooldown).toBe(6.5);
      tick(e, c, 300);
      expect({ x: e.x, y: e.y }).toEqual(start);
      expect(e.awareness).toBe(awareness);
      expect(c.bluff).not.toHaveBeenCalled();
      expect(c.catch).not.toHaveBeenCalled();
      expect(c.dodge).not.toHaveBeenCalled();
      c.stunned = false;
      c.call = false;
      c.player = { x: 260, y: 100 };
      tick(e, c, 1);
      expect(e.specialPhase).toBe("none");
      expect({ x: e.x, y: e.y }).toEqual(start);
      expect(c.threat).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["call", "calendar", "hidden", "camouflaged"] as const)(
    "%s cancels active windup/charge without a catch",
    (protection) => {
      for (const charge of [false, true]) {
        const { enemy: e, context: c } = photoSetup();
        if (charge) startCharge(e, c);
        else tick(e, c, 1);
        c[protection] = true;
        c.player = { x: 115, y: 100 };
        tick(e, c, 1);
        expect(e.specialPhase).toBe("none");
        expect(e.x).toBe(100);
        expect(c.catch).not.toHaveBeenCalled();
        if (protection === "call" || protection === "camouflaged") {
          expect(c.bluff).toHaveBeenCalledTimes(1);
          expect(e.state).toBe("patrol");
        }
        if (protection === "hidden") expect(e.state).toBe("search");
      }
    },
  );
  it("hard tools override HR pursuit, but coffee only interrupts with a hesitation", () => {
    for (const charge of [false, true]) {
      const hard = photoSetup();
      if (charge) startCharge(hard.enemy, hard.context);
      else tick(hard.enemy, hard.context, 1);
      hard.enemy.investigate({ x: 400, y: 300 }, 7, true);
      expect(hard.enemy.state).toBe("distracted");
      expect(hard.enemy.specialPhase).toBe("none");
      expect(hard.enemy.awareness).toBe(0);
      expect(hard.enemy.aim).toBeNull();
      const soft = photoSetup();
      if (charge) startCharge(soft.enemy, soft.context);
      else tick(soft.enemy, soft.context, 1);
      expect(
        soft.enemy.softDistract({ x: 400, y: 300 }, 7, soft.context.player, []),
      ).toBe(false);
      expect(soft.enemy.state).toBe("chase");
      expect(soft.enemy.specialPhase).toBe("none");
      expect(soft.enemy.idle).toBe(0.4);
      expect(soft.enemy.specialCooldown).toBe(6.5);
    }
  });
});
