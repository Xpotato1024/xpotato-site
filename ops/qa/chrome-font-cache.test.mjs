import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyChromeFontCache } from "./chrome-font-cache.mjs";
import { isolatedChromeEnvironment } from "./chrome-page-ready.mjs";

const root = await mkdtemp(join(tmpdir(), "font-cache-test-"));
const name = "a".repeat(32) + "-le64.cache-12";
after(() => rm(root, { recursive: true, force: true }));
const folder = (prefix) => mkdtemp(join(root, prefix));
async function symbolicLink(t, target, path, type) {
  try {
    await symlink(target, path, type);
    return true;
  } catch (error) {
    if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
      t.skip("OS does not permit this symbolic-link fixture");
      return false;
    }
    throw error;
  }
}

test("copies only generated font data and leaves the source independent of both profiles", async () => {
  const source = await folder("generated-"),
    parent = await folder("profiles-"),
    seed = join(parent, "seed");
  await writeFile(join(source, name), "native font cache fixture");
  await writeFile(join(source, "CACHEDIR.TAG"), "cache metadata fixture");
  const result = await copyChromeFontCache(source, seed, { generated: true });
  assert.deepEqual(result, { files: 1, bytes: 25, versions: [12], ignoredAliases: 0 });
  assert.deepEqual(await readdir(seed), [name]);
  const env = { HOME: "/unchanged-home", XPOTATO_CHROME_FONT_CACHE: seed },
    before = { ...env };
  const [first, second] = await Promise.all(
    ["first", "second"].map((profile) =>
      isolatedChromeEnvironment(join(parent, profile), { env, platform: "linux" }),
    ),
  );
  const firstFile = join(first.XDG_CACHE_HOME, "fontconfig", name),
    secondFile = join(second.XDG_CACHE_HOME, "fontconfig", name),
    seedInfo = await lstat(join(seed, name));
  assert.notEqual((await lstat(firstFile)).ino, seedInfo.ino);
  assert.notEqual((await lstat(secondFile)).ino, seedInfo.ino);
  assert.notEqual((await lstat(firstFile)).ino, (await lstat(secondFile)).ino);
  await writeFile(firstFile, "profile changes stay private");
  assert.equal(await readFile(join(seed, name), "utf8"), "native font cache fixture");
  assert.equal(await readFile(secondFile, "utf8"), "native font cache fixture");
  assert.equal(first.HOME, env.HOME);
  assert.deepEqual(env, before);
});

test("missing generated font cache becomes an explicit empty seed, but a missing exported seed fails", async () => {
  const parent = await folder("empty-");
  assert.deepEqual(
    await copyChromeFontCache(join(parent, "missing"), join(parent, "seed"), { generated: true }),
    { files: 0, bytes: 0, versions: [], ignoredAliases: 0 },
  );
  assert.deepEqual(await readdir(join(parent, "seed")), []);
  await assert.rejects(
    copyChromeFontCache(join(parent, "absent-seed"), join(parent, "destination")),
    /ENOENT/u,
  );
});

test("documented generated aliases are ignored without following them, while exported links are rejected", async (t) => {
  const source = await folder("aliases-"),
    parent = await folder("alias-output-"),
    alias = "a".repeat(32) + "-le64.cache-7";
  await writeFile(join(source, name), "cache");
  if (!(await symbolicLink(t, join(parent, "not-readable"), join(source, alias)))) return;
  const result = await copyChromeFontCache(source, join(parent, "seed"), { generated: true });
  assert.equal(result.ignoredAliases, 1);
  assert.deepEqual(await readdir(join(parent, "seed")), [name]);
  await assert.rejects(copyChromeFontCache(source, join(parent, "consumer")), /regular files/u);
});

for (const fault of ["directory", "symbolic-link", "hard-link", "unknown", "empty"]) {
  test("rejects unsafe exported font cache entry: " + fault, async (t) => {
    const source = await folder(fault + "-"),
      parent = await folder("rejected-");
    if (fault === "directory") await mkdir(join(source, name));
    if (
      fault === "symbolic-link" &&
      !(await symbolicLink(t, join(parent, "missing"), join(source, name)))
    )
      return;
    if (fault === "hard-link") {
      await writeFile(join(parent, "original"), "shared");
      await link(join(parent, "original"), join(source, name));
    }
    if (fault === "unknown") await writeFile(join(source, "Cookies"), "browser data");
    if (fault === "empty") await writeFile(join(source, name), "");
    await assert.rejects(
      copyChromeFontCache(source, join(parent, "copy")),
      /regular files|Unexpected|Invalid/u,
    );
  });
}

test("rejects a source directory link and never overwrites an existing destination", async (t) => {
  const source = await folder("original-"),
    parent = await folder("existing-"),
    alias = join(parent, "alias"),
    destination = join(parent, "destination");
  await writeFile(join(source, name), "cache");
  if (!(await symbolicLink(t, source, alias, process.platform === "win32" ? "junction" : "dir")))
    return;
  await assert.rejects(copyChromeFontCache(alias, destination), /real directory/u);
  await mkdir(destination);
  await writeFile(join(destination, name), "user file");
  await assert.rejects(copyChromeFontCache(source, destination), /EEXIST/u);
  assert.equal(await readFile(join(destination, name), "utf8"), "user file");
});

test("font cache injection is Linux-only and rejects relative configured seeds", async () => {
  const profile = join(await folder("platform-"), "profile"),
    env = { XPOTATO_CHROME_FONT_CACHE: "relative" };
  assert.deepEqual(await isolatedChromeEnvironment(profile, { env, platform: "win32" }), env);
  await assert.rejects(isolatedChromeEnvironment(profile, { env, platform: "linux" }), /absolute/u);
});
