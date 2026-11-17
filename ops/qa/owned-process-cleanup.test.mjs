import assert from "node:assert/strict";
import { test } from "node:test";
import { stopOwnedProcess } from "./owned-process-cleanup.mjs";
const child = () => ({ pid: 1234, exitCode: null, signalCode: null, kill: () => true });
test("does not terminate an already exited or signalled child", async () => {
  for (const value of [
    { ...child(), exitCode: 0 },
    { ...child(), signalCode: "SIGTERM" },
    { pid: undefined, exitCode: null },
  ])
    await stopOwnedProcess(value, {
      platform: "win32",
      killTree: () => assert.fail("must not kill"),
    });
});
test("Windows cleanup acts on only the exact owned PID", async () => {
  const seen = [];
  await stopOwnedProcess(child(), { platform: "win32", killTree: (pid) => seen.push(pid) });
  assert.deepEqual(seen, [1234]);
});
test("accepts a child that exits concurrently with taskkill", async () => {
  const value = child();
  await stopOwnedProcess(value, {
    platform: "win32",
    killTree: () => {
      throw Error("not found");
    },
    settle: async () => {
      value.exitCode = 0;
    },
    exists: () => assert.fail("no extra query required"),
  });
});
test("accepts independently confirmed absence without killing any replacement tree", async () => {
  const seen = [];
  await stopOwnedProcess(child(), {
    platform: "win32",
    killTree: (pid) => {
      seen.push(pid);
      throw Error("not found");
    },
    settle: async () => {},
    exists: (pid) => {
      assert.equal(pid, 1234);
      return false;
    },
  });
  assert.deepEqual(seen, [1234]);
});
test("retains a real cleanup failure when the owned process is still alive", async () => {
  await assert.rejects(
    stopOwnedProcess(child(), {
      platform: "win32",
      killTree: () => {
        throw Error("access denied");
      },
      settle: async () => {},
      exists: () => true,
    }),
    /access denied/,
  );
});
test("POSIX sends SIGTERM rather than invoking a Windows command", async () => {
  const value = child(),
    signals = [];
  value.kill = (signal) => {
    signals.push(signal);
    return true;
  };
  await stopOwnedProcess(value, { platform: "linux", killTree: () => assert.fail("Windows only") });
  assert.deepEqual(signals, ["SIGTERM"]);
});
