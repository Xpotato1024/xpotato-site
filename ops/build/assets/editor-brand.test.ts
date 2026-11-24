import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  editorIconPublicObjects,
  assertEditorIconPublicObject,
  assertHomeWorkshopImageReferences,
} from "../../deployment/home-workshop-public-policy.mjs";
import { validateGitMediaAddition } from "../../../packages/site-validators/src/git-media.js";

const directory = new URL("../../../apps/editor/public/", import.meta.url);
const hash = (body: Buffer) => createHash("sha256").update(body).digest("hex");
const approvedVectors = [
  ["xpotato-cms.svg", "7d636961cba1ddc4f7f46c7d3888d43a31c5b032e569a5df726d8f719f8936fb"],
  ["xpotato-cms-small.svg", "ce1590f5aab860ba35f7541e5f9e4321d275cf1a6939a58094a637c051bf466a"],
  ["xpotato-cms-maskable.svg", "9a913e05f90b6647bbac520494c95a6dfcdd6785c73ed49b595ee3001264fe57"],
];

describe("owner-reviewed CMS brand assets", () => {
  it.each(approvedVectors)("preserves the exact approved SVG %s", async (name, sha256) => {
    expect(hash(await readFile(new URL(name, directory)))).toBe(sha256);
  });

  it("admits only the seven exact PNG assets and preserves the raster guard", async () => {
    expect(editorIconPublicObjects.map((row: { path: string }) => row.path)).toEqual(
      [16, 32, 48, 180, 192, 512, "maskable-512"].map(
        (name) => "/editor/xpotato-cms-" + name + ".png",
      ),
    );
    for (const row of editorIconPublicObjects) {
      const name = row.path.slice("/editor/".length);
      const body = await readFile(new URL(name, directory));
      expect(body.length).toBe(row.bytes);
      expect(hash(body)).toBe(row.sha256);
      expect(assertEditorIconPublicObject(row)).toBe(row);
      expect(validateGitMediaAddition("apps/editor/public/" + name).allowed).toBe(true);
      expect(() => assertEditorIconPublicObject({ ...row, sha256: "0".repeat(64) })).toThrow(
        "UNAPPROVED_RASTER",
      );
      expect(() => assertEditorIconPublicObject({ ...row, path: row.path + "?v=1" })).toThrow(
        "UNAPPROVED_RASTER",
      );
      const metadata = await sharp(body).metadata();
      const size = Number(name.match(/(\d+)\.png$/u)![1]);
      expect(metadata).toMatchObject({
        format: "png",
        width: size,
        height: size,
        channels: 3,
        hasAlpha: false,
      });
      const { data, info } = await sharp(body).raw().toBuffer({ resolveWithObject: true });
      expect(Array.from(data.subarray(0, 3))).toEqual([255, 255, 255]);
      expect(Array.from(data.subarray((info.width * info.height - 1) * 3))).toEqual([
        255, 255, 255,
      ]);
      const assets = new Map([[row.path, row]]);
      expect(() =>
        assertHomeWorkshopImageReferences(
          '<img src="' + row.path + '">',
          "/editor/",
          assets,
          "xpotato.net",
        ),
      ).not.toThrow();
      expect(() =>
        assertHomeWorkshopImageReferences(
          '<img src="' + row.path + '?v=1">',
          "/editor/",
          assets,
          "xpotato.net",
        ),
      ).toThrow("UNAPPROVED_IMAGE_REFERENCE");
    }
    for (const path of [
      "apps/editor/public/other.png",
      "apps/editor/public/xpotato-cms-64.png",
      "apps/editor/public/xpotato-cms-maskable-192.png",
    ]) {
      expect(validateGitMediaAddition(path).allowed).toBe(false);
    }
  });

  it("contains all visible maskable pixels within the 80 percent safe circle", async () => {
    const { data, info } = await sharp(
      await readFile(new URL("xpotato-cms-maskable-512.png", directory)),
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    let maxRadius = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const offset = (y * info.width + x) * info.channels;
        if (data[offset] === 255 && data[offset + 1] === 255 && data[offset + 2] === 255) continue;
        for (const dx of [0, 1]) {
          for (const dy of [0, 1])
            maxRadius = Math.max(maxRadius, Math.hypot(x + dx - 256, y + dy - 256));
        }
      }
    }
    expect(maxRadius).toBeGreaterThan(200);
    expect(maxRadius).toBeLessThanOrEqual(204.8);
  });
});
