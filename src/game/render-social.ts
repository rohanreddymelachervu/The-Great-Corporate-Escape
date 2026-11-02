import type Phaser from "phaser";
import { clamp } from "./logic";
import { CHAT_LINES } from "./social";
import type { OfficeChat } from "./social";

// Original 3x5 pixel lettering: no textures, emoji, DOM overlay or new actors.
const AGENT = [
  ["010", "101", "111", "101", "101"],
  ["111", "100", "101", "101", "111"],
  ["111", "100", "110", "100", "111"],
  ["101", "111", "111", "111", "101"],
  ["111", "010", "010", "010", "010"],
];
function agentWord(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0xc5eddd, 1);
  AGENT.forEach((letter, n) =>
    letter.forEach((row, j) => {
      for (let i = 0; i < row.length; i++)
        if (row[i] === "1") g.fillRect(x + n * 4 + i, y + j, 1, 1);
    }),
  );
}

/** Draw over the actual office avatars. The scene owns/clears this graphics
 * layer and resets base sprite angles each frame. We never touch world actors,
 * physics, camera, speeds, health, or sprite positions/scales.
 */
export function drawOfficeChat(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  chat: OfficeChat | null,
  enemies: {
    id: string;
    x: number;
    y: number;
    sprite: Phaser.GameObjects.Image;
  }[],
  labels: Map<string, Phaser.GameObjects.Text>,
  reducedMotion: boolean,
): void {
  g.clear();
  // One reusable caption, and no stale captions after an abort or floor change.
  for (const label of labels.values()) label.setVisible(false).setText("");
  if (!chat) return;
  const intern = enemies.find((e) => e.id === chat.internId);
  const founder = enemies.find((e) => e.id === chat.founderId);
  if (!intern || !founder) return;
  const x = (intern.x + founder.x) / 2;
  const y = Math.min(intern.y, founder.y);
  const facing = founder.x >= intern.x ? 1 : -1;
  intern.sprite.setFlipX(facing < 0);
  founder.sprite.setFlipX(facing > 0);
  g.setDepth(63);

  if (chat.phase === "approach") {
    // They are still physically walking, not performing a fake cutaway.
    for (const actor of [intern, founder]) {
      g.fillStyle(0xd8d0ec, 0.85);
      for (let i = -1; i <= 1; i++)
        g.fillRect(actor.x + i * 5 - 1, actor.y - 30, 2, 2);
    }
    return;
  }

  const beat = clamp(chat.line, 0, CHAT_LINES.length - 1);
  // Only model time drives motion, so pause/VPN freeze cannot secretly animate.
  const wave = reducedMotion ? 0 : Math.sin(chat.talkAge * 8);
  const tap = reducedMotion ? 0 : Math.floor(chat.talkAge * 5) % 2;
  const speaking = CHAT_LINES[beat];
  intern.sprite.setAngle(beat === 0 || beat === 2 ? -facing * (2 + wave) : 0);
  founder.sprite.setAngle(
    beat === 3 ? facing * (3 + wave * 2) : beat === 1 ? facing * 2 : 0,
  );

  const ink = 0x283044,
    skin = 0xe4c6b0;
  const arm = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    color: number,
  ) => {
    g.lineStyle(4, color, 1).lineBetween(
      Math.round(ax),
      Math.round(ay),
      Math.round(bx),
      Math.round(by),
    );
    g.fillStyle(skin, 1).fillRect(Math.round(bx) - 2, Math.round(by) - 2, 4, 4);
  };
  const ix = intern.x,
    iy = intern.y,
    fx = founder.x,
    fy = founder.y;
  // Intern: palm-up pitch -> point at screen -> frantic typing -> present ->
  // point to the recursively subcontracted agent. Hoodie stays lavender.
  const handY = beat === 0 ? iy - 10 - tap * 2 : beat === 2 ? iy + 2 : iy - 3;
  arm(ix + facing * 9, iy + 1, ix + facing * 20, handY, 0xb49ad8);
  arm(ix - facing * 8, iy + 1, ix + facing * 6, iy + 10, 0xb49ad8);
  const tx = ix + facing * 10;
  g.fillStyle(ink, 1).fillRect(tx - 7, iy + 2, 15, 12);
  g.fillStyle(0xbce5d5, 1).fillRect(tx - 5, iy + 4, 11, 7);
  g.fillStyle(0x6c7196, 1).fillRect(tx - 3, iy + 6 + tap, 7, 1);
  // Founder: skeptical hand at chin, then crossed arms, then an open-palmed
  // acquisition pitch. These marks augment the existing black tee/beard.
  if (beat === 1) {
    arm(fx - facing * 9, fy + 1, fx - facing * 5, fy - 9, 0x434154);
    arm(fx + facing * 9, fy + 1, fx, fy + 7, 0x434154);
  } else if (beat === 3) {
    arm(fx - facing * 9, fy, fx - facing * 22, fy - 7 - tap * 2, 0x434154);
    arm(fx + facing * 9, fy, fx + facing * 16, fy + 6, 0x434154);
  } else {
    arm(fx - 10, fy + 1, fx + 6, fy + 6, 0x434154);
    arm(fx + 10, fy + 1, fx - 6, fy + 8, 0x434154);
  }
  // A tiny in-world demo above the intern, not a window or a HUD. The graph
  // changes meaning with the joke: agents, revenue?, three meetings, sold,
  // then one agent delegating to an even smaller agent.
  const sx = Math.round(ix - 22),
    sy = Math.round(iy - 51);
  g.fillStyle(ink, 0.94).fillRoundedRect(sx, sy, 44, 20, 3);
  g.lineStyle(1, 0xc3a0ff, 0.9).strokeRoundedRect(sx, sy, 44, 20, 3);
  agentWord(g, sx + 12, sy + 3);
  g.lineStyle(1, 0xc5eddd, 1).lineBetween(sx + 22, sy + 9, sx + 22, sy + 12);
  const nodes = beat === 0 ? 2 : beat === 1 ? 1 : 3;
  for (let i = 0; i < nodes; i++) {
    const nx = sx + 6 + i * 12;
    g.lineStyle(1, 0xb5a2d3, 1).lineBetween(sx + 22, sy + 11, nx + 4, sy + 13);
    g.fillStyle(beat === 2 ? 0xd8cfeb : 0xbce5d5, 1).fillRect(
      nx,
      sy + 13,
      8,
      5,
    );
    g.fillStyle(ink, 1).fillRect(nx + 2, sy + 14, 4, 1);
    if (beat === 2) g.fillRect(nx + 2, sy + 16, 4, 1); // calendar pages
  }
  if (beat === 1) {
    // revenue chart stays stubbornly flat
    g.lineStyle(1, 0xffcf70, 1).lineBetween(sx + 21, sy + 16, sx + 37, sy + 16);
  } else if (beat === 3) {
    g.lineStyle(2, 0xc5eddd, 1)
      .lineBetween(sx + 28, sy + 8, sx + 32, sy + 11)
      .lineBetween(sx + 32, sy + 11, sx + 38, sy + 5);
  } else if (beat === 4) {
    g.fillStyle(ink, 1).fillRect(sx + 32, sy + 13, 6, 5);
    g.fillStyle(0xc3a0ff, 1).fillRect(sx + 33, sy + 14, 4, 3);
    g.fillStyle(ink, 1).fillRect(sx + 34, sy + 15, 2, 1);
  }

  const view = scene.cameras.main.worldView;
  if (
    !view.contains(x, y) ||
    (!view.contains(intern.x, intern.y) && !view.contains(founder.x, founder.y))
  )
    return;
  let label = labels.get("office-chat");
  if (!label) {
    label = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#263347",
        backgroundColor: "#dcefe8",
        align: "center",
        padding: { x: 8, y: 6 },
        wordWrap: { width: 216, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 1)
      .setDepth(65);
    labels.set("office-chat", label);
  }
  const captionX = clamp(
    x,
    view.left + 120,
    Math.max(view.left + 120, view.right - 120),
  );
  const captionY = Math.max(view.top + 60, y - 65);
  label
    .setText(
      `${speaking.speaker === "intern" ? "INTERN" : "FOUNDER"}: ${speaking.text}`,
    )
    .setBackgroundColor(speaking.speaker === "intern" ? "#e5ddf3" : "#dcefe8")
    .setPosition(captionX, captionY)
    .setVisible(true);
  // A quiet speech-tail identifies the speaker without duplicate captions.
  const speaker = speaking.speaker === "intern" ? intern : founder;
  g.lineStyle(1, 0xb8c8cb, 0.8).lineBetween(
    captionX,
    captionY + 2,
    speaker.x,
    speaker.y - 24,
  );
}
