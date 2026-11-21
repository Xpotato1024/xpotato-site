import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, appendFile, mkdir, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { isolatedChromeEnvironment } from "../qa/chrome-page-ready.mjs";
import { copyChromeFontCache } from "../qa/chrome-font-cache.mjs";
import {
  closeOwnedGroup,
  hasLiveLinuxGroup,
  waitForOwnedGroupExit,
} from "../qa/parallel-browser-suites.mjs";

const absolutePath = (value) =>
  typeof value === "string" && isAbsolute(value) && !/[\r\n\0]/u.test(value);

/** One sandboxed setup invocation; browser tests retain their own startup deadlines. */
export async function prepareChromeFontCache({
  root,
  executable,
  env = process.env,
  timeoutMs = 120000,
  launch = spawn,
}) {
  if (process.platform !== "linux") {
    throw Error("Chrome font cache preparation requires Linux");
  }
  if (!absolutePath(root) || !absolutePath(executable)) {
    throw Error("Absolute preparation root and Chrome executable required");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    throw Error("Bounded setup timeout required");
  }
  await access(executable, constants.X_OK);
  await mkdir(root, { mode: 0o700 });
  const started = performance.now(),
    profile = join(root, "profile"),
    cache = join(root, "fontconfig");
  let child,
    timer,
    stdout = "",
    stderr = "",
    cleanupVerified = false;
  try {
    const environment = { ...env };
    delete environment.XPOTATO_CHROME_FONT_CACHE;
    const chromeEnv = await isolatedChromeEnvironment(profile, { env: environment });
    let outcome;
    try {
      child = launch(
        executable,
        [
          "--headless=new",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-extensions",
          "--disable-component-update",
          "--user-data-dir=" + profile,
          "--dump-dom",
          "about:blank",
        ],
        { env: chromeEnv, stdio: ["ignore", "pipe", "pipe"], detached: true },
      );
      child.stdout?.on("data", (chunk) => {
        stdout = (stdout + String(chunk)).slice(-4096);
      });
      child.stderr?.on("data", (chunk) => {
        stderr = (stderr + String(chunk)).slice(-4096);
      });
      const exited = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
      outcome = await Promise.race([
        exited,
        new Promise((resolve) => {
          timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      if (child?.pid) {
        if (hasLiveLinuxGroup(child.pid)) {
          await closeOwnedGroup(child);
        }
        await waitForOwnedGroupExit(child.pid);
      }
      cleanupVerified = true;
    }
    if (outcome.timedOut) {
      throw Error(`Chrome font cache setup exceeded ${timeoutMs}ms`);
    }
    if (outcome.code !== 0 || outcome.signal !== null) {
      throw Error(`Chrome font cache setup failed (${outcome.signal ?? outcome.code})`);
    }
    if (!/<html[\s>]/iu.test(stdout) || !/<body[\s>]/iu.test(stdout)) {
      throw Error("Chrome font cache setup did not render its blank document");
    }
    const result = await copyChromeFontCache(join(profile, "xdg-cache", "fontconfig"), cache, {
      generated: true,
    });
    await rm(profile, { recursive: true });
    return { ...result, cache, executable, elapsedMs: Math.round(performance.now() - started) };
  } catch (error) {
    // Unconfirmed process cleanup retains its owned files for diagnosis.
    if (cleanupVerified || !child) {
      await rm(root, { recursive: true, force: true });
    }
    throw Error(error.message + (stderr ? "; Chrome stderr: " + stderr : ""), { cause: error });
  }
}

async function main() {
  if (!absolutePath(process.env.RUNNER_TEMP) || !absolutePath(process.env.GITHUB_ENV)) {
    throw Error("GitHub runner temporary directory and environment file required");
  }
  const result = await prepareChromeFontCache({
    root: join(process.env.RUNNER_TEMP, "chrome-font-cache"),
    executable: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  });
  await appendFile(
    process.env.GITHUB_ENV,
    `CHROME_PATH=${result.executable}\nXPOTATO_CHROME_FONT_CACHE=${result.cache}\n`,
  );
  console.log("Chrome font cache prepared: " + JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
