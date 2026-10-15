import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
const publicDir = new URL("../apps/site/public/", import.meta.url);
const logo = await readFile(new URL("xpotato-logo.svg", publicDir), "utf8");
// Existing 553.5 × 375 artwork, centered without stretching or recoloring.
const svg = logo.replace('viewBox="370 440 553.5 375"', 'width="64" height="64" viewBox="346.75 327.5 600 600"')
  .replace(/<title>[^<]*<\/title>/u, "<title>Xpotato</title>").replace(/<desc>[^<]*<\/desc>/u, "");
const sizes = [16, 32, 48, 64];
const images = [];
for (const size of sizes) {
  const rgba = await sharp(Buffer.from(svg)).resize(size, size).ensureAlpha().raw().toBuffer();
  const maskStride = Math.ceil(size / 32) * 4;
  const bitmap = Buffer.alloc(40 + size * size * 4 + maskStride * size);
  bitmap.writeUInt32LE(40, 0); bitmap.writeInt32LE(size, 4); bitmap.writeInt32LE(size * 2, 8);
  bitmap.writeUInt16LE(1, 12); bitmap.writeUInt16LE(32, 14);
  bitmap.writeUInt32LE(size * size * 4 + maskStride * size, 20);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const input = (y * size + x) * 4, output = 40 + ((size - 1 - y) * size + x) * 4;
    bitmap[output] = rgba[input + 2]; bitmap[output + 1] = rgba[input + 1];
    bitmap[output + 2] = rgba[input]; bitmap[output + 3] = rgba[input + 3];
    if (rgba[input + 3] === 0) bitmap[40 + size * size * 4 + (size - 1 - y) * maskStride + (x >> 3)] |= 0x80 >> (x % 8);
  }
  images.push(bitmap);
}
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  header[entry] = size; header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[index].length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}
await writeFile(new URL("favicon.svg", publicDir), svg.trim() + "\n");
await writeFile(new URL("favicon.ico", publicDir), Buffer.concat([header, ...images]));
console.log("Generated square SVG and ICO (16/32/48/64) from the existing Xpotato logo.");
