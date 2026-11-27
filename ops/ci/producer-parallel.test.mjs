import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runNpmScript } from "./ci-source.mjs";
import { producerPhases, runProducerPhase } from "./producer-parallel.mjs";

const quiet = { log() {}, error() {} };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

for (const phase of Object.keys(producerPhases)) {
  test(`${phase} starts both independent lanes and waits for both before advancing`, async () => {
    const waits = producerPhases[phase].map(deferred),
      started = [];
    let complete = false;
    const result = runProducerPhase(
      phase,
      (script) => {
        started.push(script);
        return waits[producerPhases[phase].indexOf(script)].promise;
      },
      quiet,
    ).then(() => {
      complete = true;
    });
    assert.deepEqual(started, producerPhases[phase]);
    waits[0].resolve();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(complete, false);
    waits[1].resolve();
    await result;
    assert.equal(complete, true);
  });

  test(`${phase} preserves sibling cleanup and rejects either failed lane`, async () => {
    for (const failed of producerPhases[phase]) {
      const cleanup = deferred(),
        events = [];
      const result = runProducerPhase(
        phase,
        async (script) => {
          if (script === failed) {
            throw Error("required lane failed");
          }
          await cleanup.promise;
          events.push("cleanup finished");
        },
        quiet,
      ).then(
        () => events.push("ADVANCE"),
        (error) => {
          assert.match(error.message, /required lane failed/);
          assert.ok(error.errors.some((failure) => failure.message.startsWith(failed + ":")));
          events.push("failed");
        },
      );
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(events, []);
      cleanup.resolve();
      await result;
      assert.deepEqual(events, ["cleanup finished", "failed"]);
    }
  });
}

test("launch failures settle every required lane and retain both causes", async () => {
  const started = [];
  await assert.rejects(
    runProducerPhase(
      "prepare",
      (script) => {
        started.push(script);
        throw Error("spawn failed for " + script);
      },
      quiet,
    ),
    (error) => error instanceof AggregateError && error.errors.length === 2,
  );
  assert.deepEqual(started, producerPhases.prepare);
});

test("unknown phases cannot select partial validation or start any command", async () => {
  for (const phase of ["", undefined, "all", "webkit", "__proto__", "constructor"]) {
    await assert.rejects(
      runProducerPhase(phase, () => assert.fail("unknown phase started a command"), quiet),
      /Expected producer phase/,
    );
  }
});

test("both phases report measured starts and settlements, including a failed lane", async () => {
  const lines = [];
  let tick = 0;
  await assert.rejects(
    runProducerPhase(
      "validate",
      async (script) => {
        if (script === "quality:webkit:hosted") {
          throw Error("layout mismatch");
        }
      },
      { log: (line) => lines.push(line), error: (line) => lines.push(line), now: () => tick++ },
    ),
    /layout mismatch/,
  );
  assert.equal(lines.filter((line) => line.endsWith(" START")).length, 2);
  assert.equal(lines.filter((line) => / END status=PASS elapsedMs=\d+$/u.test(line)).length, 1);
  assert.equal(lines.filter((line) => / END status=FAIL elapsedMs=\d+$/u.test(line)).length, 1);
});

test("producer CLI propagates an actual child exit and still waits for sibling completion", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "producer-phase-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const npm = join(root, "fake-npm.mjs");
  await writeFile(
    npm,
    "if (process.argv[2] !== 'run') process.exit(91); process.exit(process.argv[3] === 'quality:webkit:hosted' ? 7 : 0);\n",
  );
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./producer-parallel.mjs", import.meta.url)), "validate"],
    { cwd: root, env: { ...process.env, npm_execpath: npm }, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /ci:final:public END status=PASS elapsedMs=\d+/u);
  assert.match(result.stderr, /quality:webkit:hosted END status=FAIL elapsedMs=\d+/u);
  assert.match(result.stderr, /quality:webkit:hosted failed \(exit 7\)/u);
});

test(
  "a terminated child is a failure, never a successful producer phase",
  { skip: process.platform === "win32" ? "POSIX child signal semantics" : false },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), "producer-signal-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const npm = join(root, "fake-npm.mjs");
    await writeFile(npm, "process.kill(process.pid, 'SIGTERM');\n");
    await assert.rejects(
      runProducerPhase(
        "prepare",
        (script) => runNpmScript(script, { cwd: root, env: { ...process.env, npm_execpath: npm } }),
        quiet,
      ),
      (error) =>
        error instanceof AggregateError &&
        error.errors.length === 2 &&
        error.errors.every((failure) => /failed \(SIGTERM\)/u.test(failure.message)),
    );
  },
);
