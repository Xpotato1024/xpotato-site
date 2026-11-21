import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, test } from "node:test";
import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareChromeFontCache } from "./prepare-chrome-font-cache.mjs";
import { hasLiveLinuxGroup } from "../qa/parallel-browser-suites.mjs";

const parent = await mkdtemp(join(tmpdir(), "prepare-font-cache-test-")),
  name = "b".repeat(32) + "-le64.cache-12";
const linuxTest = process.platform === "linux" ? test : test.skip;
after(() => rm(parent, { recursive: true, force: true }));
const rootFor = async () => join(await mkdtemp(join(parent, "case-")), "preparation");
const fixture = (source) => {
  const launches = [];
  return {
    launches,
    launch(executable, args, options) {
      const child = spawn(process.execPath, ["--input-type=module", "-e", source], options);
      launches.push({ executable, args, options, child });
      return child;
    },
  };
};
const createCache = `
  import { mkdir, writeFile } from 'node:fs/promises';
  import { join } from 'node:path';
  const cache = join(process.env.XDG_CACHE_HOME, 'fontconfig');
  await mkdir(cache);
  await writeFile(join(cache, ${JSON.stringify(name)}), 'prepared font data');
`;

linuxTest(
  "one sandboxed preparation exports only font data after its owned browser exits",
  async () => {
    const root = await rootFor(),
      f = fixture(createCache + "console.log('<html><head></head><body></body></html>');"),
      env = { ...process.env, HOME: "/unchanged-home", XPOTATO_CHROME_FONT_CACHE: "/stale-seed" };
    const result = await prepareChromeFontCache({ root, executable: process.execPath, env, ...f });
    assert.equal(f.launches.length, 1);
    const invocation = f.launches[0];
    assert.equal(invocation.executable, process.execPath);
    assert.equal(invocation.options.detached, true);
    assert.equal(invocation.options.env.HOME, env.HOME);
    assert.equal(invocation.options.env.XPOTATO_CHROME_FONT_CACHE, undefined);
    assert.ok(invocation.args.includes("--headless=new"));
    assert.ok(invocation.args.includes("--disable-gpu"));
    assert.deepEqual(invocation.args.slice(-2), ["--dump-dom", "about:blank"]);
    assert.ok(invocation.args.includes("--user-data-dir=" + join(root, "profile")));
    assert.ok(!invocation.args.some((arg) => /no-sandbox|disable-setuid-sandbox/u.test(arg)));
    assert.equal(hasLiveLinuxGroup(invocation.child.pid), false);
    assert.equal(result.files, 1);
    assert.deepEqual(result.versions, [12]);
    assert.equal(await readFile(join(result.cache, name), "utf8"), "prepared font data");
    assert.deepEqual(await readdir(root), ["fontconfig"]);
    assert.equal(env.XPOTATO_CHROME_FONT_CACHE, "/stale-seed");
  },
);

linuxTest(
  "compatible system caches may legitimately leave no private font cache files",
  async () => {
    const root = await rootFor(),
      f = fixture("console.log('<html><head></head><body></body></html>');");
    const result = await prepareChromeFontCache({ root, executable: process.execPath, ...f });
    assert.equal(result.files, 0);
    assert.equal(result.bytes, 0);
    assert.deepEqual(result.versions, []);
    assert.deepEqual(await readdir(result.cache), []);
  },
);

for (const [mode, source, expected] of [
  [
    "exit",
    "console.error('fixture launch failure');process.exitCode=7;",
    /failed \(7\).*fixture launch failure/u,
  ],
  ["document", "console.log('no rendered document');", /did not render/u],
  [
    "cache",
    createCache +
      "await writeFile(join(cache, 'Cookies'), 'private');console.log('<html><body></body></html>');",
    /Unexpected font cache/u,
  ],
]) {
  linuxTest("failed preparation publishes no seed or retained profile: " + mode, async () => {
    const root = await rootFor(),
      f = fixture(source);
    await assert.rejects(
      prepareChromeFontCache({ root, executable: process.execPath, ...f }),
      expected,
    );
    assert.equal(f.launches.length, 1);
    assert.equal(hasLiveLinuxGroup(f.launches[0].child.pid), false);
    await assert.rejects(lstat(root), /ENOENT/u);
  });
}

linuxTest(
  "a stalled setup has one bounded attempt and cleans its owned process group",
  async () => {
    const root = await rootFor(),
      f = fixture("process.on('SIGTERM',()=>{});setInterval(()=>{},1000);");
    const started = performance.now();
    await assert.rejects(
      prepareChromeFontCache({ root, executable: process.execPath, timeoutMs: 150, ...f }),
      /exceeded 150ms/u,
    );
    assert.ok(performance.now() - started < 5000, "Setup and forced cleanup remain bounded");
    assert.equal(f.launches.length, 1);
    assert.equal(hasLiveLinuxGroup(f.launches[0].child.pid), false);
    await assert.rejects(lstat(root), /ENOENT/u);
  },
);

linuxTest(
  "synchronous spawn failure removes only its freshly claimed preparation directory",
  async () => {
    const root = await rootFor(),
      marker = join(parent, "unrelated");
    await writeFile(marker, "keep");
    await assert.rejects(
      prepareChromeFontCache({
        root,
        executable: process.execPath,
        launch: () => {
          throw Error("fixture spawn failure");
        },
      }),
      /fixture spawn failure/u,
    );
    await assert.rejects(lstat(root), /ENOENT/u);
    assert.equal(await readFile(marker, "utf8"), "keep");
  },
);

linuxTest(
  "asynchronous spawn rejection cannot leave a seed or wait for a nonexistent process",
  async () => {
    const root = await rootFor();
    let calls = 0;
    await assert.rejects(
      prepareChromeFontCache({
        root,
        executable: process.execPath,
        launch: (_executable, _args, options) => {
          calls++;
          return spawn(join(parent, "missing-chrome"), [], options);
        },
      }),
      /ENOENT/u,
    );
    assert.equal(calls, 1);
    await assert.rejects(lstat(root), /ENOENT/u);
  },
);

linuxTest(
  "setup cannot reuse an existing preparation root or accept an unbounded timeout",
  async () => {
    const existing = await mkdtemp(join(parent, "existing-"));
    await writeFile(join(existing, "keep"), "original");
    await assert.rejects(
      prepareChromeFontCache({ root: existing, executable: process.execPath }),
      /EEXIST/u,
    );
    for (const timeoutMs of [Infinity, 120001, 1.5, 0, -1]) {
      await assert.rejects(
        prepareChromeFontCache({
          root: await rootFor(),
          executable: process.execPath,
          timeoutMs,
        }),
        /Bounded/u,
      );
    }
    assert.equal(await readFile(join(existing, "keep"), "utf8"), "original");
  },
);
