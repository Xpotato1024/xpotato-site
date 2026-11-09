import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { sharpToolchainSha256 } from "@xpotato/media-ingest";
import { homeWorkshopCiCacheKey } from "./ci-cache.js";

const dependencies = ["package-lock.json", "package.json", ".nvmrc", ".node-version", ".npmrc", ".gitattributes",
  ".github/workflows/ci.yml", "tsconfig.base.json", "tools/tsconfig.json", "apps/site/package.json", "apps/site/tsconfig.json",
  "packages/site-validators/package.json", "packages/site-validators/tsconfig.json",
  "tools/build/home-workshop/ci-cache.ts", "tools/build/home-workshop/prepare-home-workshop-media.ts",
  "packages/media-ingest/src/index.ts", "packages/content-contracts/src/index.ts", "packages/site-validators/src/migration/preserved-media-inputs.ts",
  "apps/site/src/lib/home/home-workshop.ts", "apps/site/source-inputs/home-workshop/reviewed-recipe.json",
  "apps/site/source-inputs/media/sha256/source.jpg", "apps/site/src/styles/fonts.css", "apps/site/public/fonts/font.woff2",
  "apps/site/public/xpotato-logo.svg", "docs/migration/media-raw-inventory-v1.json", "docs/migration/media-repository-candidate-v1.json",
  "tests/fixtures/migration/legacy-freeze-baseline.json"];
const fixture = async (run: (workspace: string, commit: () => void) => Promise<void>) => {
  const workspace = await mkdtemp(join(tmpdir(), "workshop-cache-key-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=Cache fixture", "-c", "user.email=fixture@example.invalid", ...args],
    { cwd: workspace, stdio: "pipe" });
  const commit = () => { git("add", "."); git("-c", "commit.gpgSign=false", "commit", "--no-verify", "-qm", "cache fixture"); };
  try {
    git("init", "-q");
    for (const path of dependencies) {
      await mkdir(dirname(join(workspace, path)), { recursive: true });
      await writeFile(join(workspace, path), "fixture\n");
    }
    commit();
    await run(workspace, commit);
  } finally { await rm(workspace, { recursive: true, force: true }); }
};

describe("homepage CI media content key", () => {
  it("binds actual platform, architecture, Node and Sharp without binding the commit SHA", async () => {
    await fixture(async (workspace, commit) => {
      const key = homeWorkshopCiCacheKey(workspace);
      expect(key).toMatch(`home-workshop-public-v1-${process.platform}-${process.arch}-${process.version}-${sharpToolchainSha256()}-`);
      await mkdir(join(workspace, "docs/operations"), { recursive: true });
      await writeFile(join(workspace, "docs/operations/unrelated.md"), "Unrelated commit\n"); commit();
      expect(homeWorkshopCiCacheKey(workspace)).toBe(key);
    });
  });

  it("invalidates each source, recipe, runtime, font, catalog, workflow and helper dependency", async () => {
    await fixture(async (workspace, commit) => {
      let previous = homeWorkshopCiCacheKey(workspace);
      for (const path of dependencies) {
        await writeFile(join(workspace, path), "changed fixture\n"); commit();
        const next = homeWorkshopCiCacheKey(workspace);
        expect(next, path).not.toBe(previous);
        previous = next;
      }
      await writeFile(join(workspace, "packages/media-ingest/src/new-dependency.ts"), "new fixture\n"); commit();
      expect(homeWorkshopCiCacheKey(workspace)).not.toBe(previous);
      previous = homeWorkshopCiCacheKey(workspace);
      await rm(join(workspace, "apps/site/public/fonts/font.woff2")); commit();
      expect(homeWorkshopCiCacheKey(workspace)).not.toBe(previous);
    });
  });

  it("refuses dirty or untracked relevant inputs instead of assigning a stale HEAD key", async () => {
    await fixture(async (workspace, commit) => {
      await writeFile(join(workspace, "apps/site/source-inputs/media/sha256/source.jpg"), "changed source\n");
      expect(() => homeWorkshopCiCacheKey(workspace)).toThrow("clean source inputs"); commit();
      await writeFile(join(workspace, "tools/build/home-workshop/new-dependency.ts"), "untracked source\n");
      expect(() => homeWorkshopCiCacheKey(workspace)).toThrow("clean source inputs");
    });
  });

  it("writes the exact computed key to GITHUB_OUTPUT", async () => {
    await fixture(async workspace => {
      const output = join(workspace, "github-output");
      const loader = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;
      execFileSync(process.execPath, ["--import", loader, fileURLToPath(new URL("./ci-cache.ts", import.meta.url)), "key"], {
        cwd: workspace, env: { ...process.env, GITHUB_OUTPUT: output }, stdio: "pipe",
      });
      expect(await readFile(output, "utf8")).toBe(`key=${homeWorkshopCiCacheKey(workspace)}\n`);
    });
  });
});
