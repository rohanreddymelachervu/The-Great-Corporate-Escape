import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { TEAMS_RINGTONE_BASE64 } from "../src/audio/teams-ringtone";
test("offline ringtone preserves the exact user-uploaded MP3 bytes", () => {
  const mp3 = Buffer.from(TEAMS_RINGTONE_BASE64, "base64");
  expect(mp3.length).toBe(418795);
  expect(createHash("sha256").update(mp3).digest("hex")).toBe(
    "03f47b85c57c3401bbda6ea0f96c8c194d56f4044ed42d794bbb26464aad1374",
  );
});
