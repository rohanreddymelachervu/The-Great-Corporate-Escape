import Phaser from "phaser";
import type { EscapeDirector, IncidentKind } from "./director";
import { liftWait } from "./director";
import type { OfficeEnemy } from "./enemy";
import { center, clamp } from "./logic";
import type { OfficeScene } from "./scene";
const COLORS: Record<IncidentKind, number> = {
  photo: 0xff8fc8,
  meeting: 0xffae86,
  yap: 0xbe9cff,
  paper: 0x91dcff,
  allhands: 0xffd76c,
};
const LABELS: Record<IncidentKind, string> = {
  photo: "HR PHOTO · SPACE DODGE",
  meeting: "MEETING INCOMING · MOVE",
  yap: "INFINITE YAP · MOVE OUT",
  paper: "FRIDAY DEPLOY · DODGE",
  allhands: "ALL HANDS · GET OUT",
};
/** Telegraphs live in the world; objectives and instructions stay in the side rail. */
export function drawInterference(
  scene: OfficeScene,
  g: Phaser.GameObjects.Graphics,
  director: EscapeDirector,
  enemies: OfficeEnemy[],
  labels: Map<string, Phaser.GameObjects.Text>,
): void {
  g.clear();
  const ids = new Set(director.incidents.map((h) => h.id));
  for (const [id, label] of labels)
    if (!ids.has(id)) {
      label.destroy();
      labels.delete(id);
    }
  for (const h of director.incidents) {
    const warning = h.age < h.warn,
      color = warning ? 0xffd18a : 0xff7e8c,
      pulse = 0.55 + Math.sin(scene.elapsed * 11) * 0.2;
    if (h.shape === "beam") {
      if (warning) {
        const left = Math.min(h.from.x, h.to.x) - h.w / 2,
          right = Math.max(h.from.x, h.to.x) + h.w / 2;
        g.fillStyle(color, 0.065).fillRect(
          left,
          h.y - h.h / 2,
          right - left,
          h.h,
        );
        g.lineStyle(2, color, pulse).strokeRect(
          left,
          h.y - h.h / 2,
          right - left,
          h.h,
        );
        for (let x = left + 20; x < right - 12; x += 42)
          g.fillStyle(color, 0.7).fillTriangle(
            x,
            h.y - 5,
            x + 9,
            h.y,
            x,
            h.y + 5,
          );
      } else {
        g.fillStyle(color, 0.36).fillRect(
          h.x - h.w / 2,
          h.y - h.h / 2,
          h.w,
          h.h,
        );
        g.lineStyle(3, 0xffdcee, 0.9).strokeRect(
          h.x - h.w / 2,
          h.y - h.h / 2,
          h.w,
          h.h,
        );
        for (let y = h.y - h.h / 2 + 8; y < h.y + h.h / 2; y += 16)
          g.fillStyle(0xffe5f2, 0.8).fillRect(h.x - 2, y, 4, 6);
      }
    } else if (h.shape === "paper") {
      if (warning) {
        g.lineStyle(2, color, pulse).lineBetween(
          h.from.x,
          h.from.y,
          h.to.x,
          h.to.y,
        );
        g.lineStyle(2, color, 0.7).strokeCircle(h.to.x, h.to.y, 22);
      } else {
        g.fillStyle(color, 0.15).fillCircle(h.x, h.y, 23);
        g.fillStyle(0x172238, 1).fillRect(h.x - 13, h.y - 12, 24, 27);
        g.fillStyle(0xe9edf5).fillRect(h.x - 10, h.y - 10, 19, 23);
        g.fillStyle(0x6e8fac)
          .fillRect(h.x - 6, h.y - 5, 11, 2)
          .fillRect(h.x - 6, h.y, 8, 2)
          .fillRect(h.x - 6, h.y + 5, 10, 2);
      }
    } else {
      g.fillStyle(color, warning ? 0.055 : 0.17).fillCircle(h.x, h.y, h.radius);
      g.lineStyle(warning ? 2 : 4, color, warning ? pulse : 0.85).strokeCircle(
        h.x,
        h.y,
        h.radius,
      );
      if (warning) {
        const t = clamp(h.age / h.warn, 0, 1);
        g.lineStyle(3, color, 0.9)
          .beginPath()
          .arc(
            h.x,
            h.y,
            h.radius + 5,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * t,
          )
          .strokePath();
        g.fillStyle(color, 0.7).fillTriangle(
          h.x,
          h.y - 9,
          h.x - 7,
          h.y + 5,
          h.x + 7,
          h.y + 5,
        );
      } else if (h.kind === "yap") {
        g.lineStyle(2, color, 0.7);
        for (let i = 0; i < 3; i++) {
          const y = h.y - 12 + i * 12;
          g.lineBetween(h.x - 24, y, h.x + 24 - i * 8, y);
        }
      }
    }
    let label = labels.get(h.id);
    if (!label) {
      label = scene.add
        .text(0, 0, LABELS[h.kind], {
          fontFamily: "monospace",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#" + color.toString(16),
          backgroundColor: "#172238ee",
          padding: { x: 6, y: 4 },
        })
        .setOrigin(0.5, 1)
        .setDepth(62);
      labels.set(h.id, label);
    }
    label
      .setPosition(
        clamp((h.from.x + h.to.x) / 2, 120, scene.level.width - 120),
        clamp(
          h.y - (h.shape === "beam" ? h.h / 2 : h.radius) - 8,
          42,
          scene.level.height - 30,
        ),
      )
      .setVisible(warning);
  }
  for (const e of enemies) {
    if (e.kind === "hr") {
      // Two small balloons make HR recognisable before the warning even fires.
      g.lineStyle(1, 0xe3b8cf, 0.8)
        .lineBetween(e.x - 10, e.y - 15, e.x - 13, e.y - 37)
        .lineBetween(e.x + 9, e.y - 15, e.x + 13, e.y - 42);
      g.fillStyle(0xffb1d6).fillEllipse(e.x - 13, e.y - 39, 10, 13);
      g.fillStyle(0xa9f4ce).fillEllipse(e.x + 13, e.y - 44, 10, 13);
    }
    if (e.specialPhase === "photo-windup" && e.aim) {
      g.lineStyle(3, 0xffd18a, 0.8).lineBetween(e.x, e.y, e.aim.x, e.aim.y);
      g.lineStyle(3, 0xffd18a).strokeCircle(e.aim.x, e.aim.y, 23);
      g.fillStyle(0xffd18a, 0.08).fillCircle(e.aim.x, e.aim.y, 23);
    }
    if (e.specialPhase === "photo-charge")
      g.lineStyle(3, 0xff7e8c, 0.8).strokeCircle(e.x, e.y, 22);
  }
  const exit = center(scene.level.exit);
  if (director.phase === "waiting") {
    g.lineStyle(3, 0x514959, 0.8).strokeCircle(exit.x, exit.y, 43);
    g.lineStyle(4, 0xffda88, 0.95)
      .beginPath()
      .arc(
        exit.x,
        exit.y,
        43,
        -Math.PI / 2,
        -Math.PI / 2 +
          Math.PI *
            2 *
            clamp(1 - director.eta / liftWait(scene.level.id), 0, 1),
      )
      .strokePath();
  }
  if (director.phase === "boarding") {
    g.fillStyle(0xa9f4ce, 0.12 + Math.sin(scene.elapsed * 10) * 0.04).fillRect(
      scene.level.exit.x,
      scene.level.exit.y,
      scene.level.exit.w,
      scene.level.exit.h,
    );
    g.lineStyle(4, 0xb9ffda, 0.8).strokeRect(
      scene.level.exit.x - 3,
      scene.level.exit.y - 3,
      scene.level.exit.w + 6,
      scene.level.exit.h + 6,
    );
  }
  if (scene.dashLeft > 0)
    g.lineStyle(2, 0xb8ffe0, 0.9).strokeCircle(scene.pos.x, scene.pos.y, 21);
}
