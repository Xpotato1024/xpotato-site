import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bundledOutlineFont } from "./bundled-outline-font.js";

describe("bundled font admission", () => {
  it("rejects absent faces and changed font bytes without host-font fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "social-font-"));
    try {
      const fonts = join(root, "apps/site/public/fonts"), styles = join(root, "apps/site/src/styles");
      await mkdir(fonts, { recursive: true }); await mkdir(styles, { recursive: true });
      await writeFile(join(fonts, "zenkakugothicnew-OFL.txt"), await readFile(resolve("apps/site/public/fonts/zenkakugothicnew-OFL.txt")));
      await writeFile(join(styles, "fonts.css"), "");
      expect(() => bundledOutlineFont(root)).toThrow("CARD_FONT_MISSING");
      const css = await readFile(resolve("apps/site/src/styles/fonts.css"), "utf8");
      const block = css.match(/@font-face\s*\{[^}]+\}/gu)!.find(value => value.includes("font-family: 'Zen Kaku Gothic New'") && value.includes("font-weight: 500;"))!;
      const file = /url\(\/fonts\/(font-[a-f0-9]{16}\.woff2)\)/u.exec(block)![1]!;
      await writeFile(join(styles, "fonts.css"), block);
      await writeFile(join(fonts, file), "modified subset");
      expect(() => bundledOutlineFont(root)).toThrow("CARD_FONT_HASH_INVALID");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
