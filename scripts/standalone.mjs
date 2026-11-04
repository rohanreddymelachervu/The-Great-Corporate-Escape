import { readFile, writeFile, mkdir } from "node:fs/promises";
let html = await readFile("dist/index.html", "utf8");
html = html.replace(
  /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
  (_, p) => `<script type="module">${"__BUNDLE__"}</script>`,
);
const js = (await readFile("dist/assets/game.js", "utf8")).replace(
  /<\/(script|body|head|html)/gi,
  "<\\/$1",
);
html = html.replace("__BUNDLE__", () => js);
const cssMatch = html.match(
  /<link rel="stylesheet" crossorigin href="([^"]+)">/,
);
if (cssMatch) {
  const css = await readFile(
    "dist/" + cssMatch[1].replace(/^\.\//, ""),
    "utf8",
  );
  html = html.replace(cssMatch[0], () => `<style>${css}</style>`);
}
const notices = await Promise.all(
  [
    "Barlow-Condensed-OFL.txt",
    "IBM-Plex-Mono-OFL.txt",
    "Phaser-MIT.txt",
    "USER-SUPPLIED-AUDIO.txt",
  ].map((name) => readFile("licenses/" + name, "utf8")),
);
html +=
  "\n<!-- Bundled third-party notices\n" + notices.join("\n\n") + "\n-->\n";
await mkdir("release", { recursive: true });
await writeFile("release/office-escape.html", html);
// GitHub Pages can publish main /docs without workflow-token permissions.
await mkdir("docs", { recursive: true });
await writeFile("docs/index.html", html);
await writeFile("docs/.nojekyll", "");
console.log(
  "Self-contained release:",
  Buffer.byteLength(html),
  "bytes. No network dependencies.",
);
