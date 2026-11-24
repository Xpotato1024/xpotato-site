import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const directory = new URL("../../../apps/editor/public/", import.meta.url);
// These SVGs are the approved geometry. Only rasterization is allowed here.
for (const [variant, sizes] of [
  ["", [512, 192, 180]],
  ["-small", [48, 32, 16]],
  ["-maskable", [512]],
]) {
  const svg = await readFile(new URL("xpotato-cms" + variant + ".svg", directory));
  for (const size of sizes) {
    const suffix = variant === "-maskable" ? variant : "";
    const name = "xpotato-cms" + suffix + "-" + size + ".png";
    const png = await sharp(svg)
      .resize(size, size)
      .flatten({ background: "#FFFFFF" })
      .removeAlpha()
      .png()
      .toBuffer();
    await writeFile(new URL(name, directory), png);
  }
}
console.log("Generated the seven CMS icon PNGs from the approved SVGs.");
