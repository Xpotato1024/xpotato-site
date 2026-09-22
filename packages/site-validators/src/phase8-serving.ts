import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { applicationRedirects, redirectArtifact } from "../../../apps/site/src/content-registry/redirects.js";

export const measureLocalServing = async () => {
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const tempRoot = process.env.XPOTATO_PHASE8_TEMP_ROOT;
if (!tempRoot || !isAbsolute(tempRoot)) throw new Error("XPOTATO_PHASE8_TEMP_ROOT must be an absolute task temp directory");
await mkdir(tempRoot, { recursive: true });
const dist = join(root, "apps/site/dist");
assert.equal(await readFile(join(dist, "_redirects"), "utf8"), redirectArtifact());
const socket = createServer();
await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
const address = socket.address();
if (!address || typeof address === "string") throw new Error("No loopback port");
const port = address.port;
await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
const child = spawn(process.execPath, [join(root, "node_modules/wrangler/bin/wrangler.js"), "dev", "--local", "--ip", "127.0.0.1", "--port", String(port), "--config", join(root, "apps/site/wrangler.jsonc"), "--persist-to", join(tempRoot, "wrangler-state")], {
  cwd: tempRoot,
  env: { ...process.env, CI: "true", XDG_CONFIG_HOME: join(tempRoot, "config"), XDG_CACHE_HOME: join(tempRoot, "cache"), WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: join(tempRoot, "wrangler.log") },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let log = "";
child.stdout.on("data", (data: Buffer) => { log += data.toString(); });
child.stderr.on("data", (data: Buffer) => { log += data.toString(); });
const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
const origin = `http://127.0.0.1:${port}`;
try {
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`Local static-assets server exited: ${log}`);
    try { if ((await fetch(`${origin}/`, { signal: AbortSignal.timeout(500) })).ok) break; } catch { /* Wait for local readiness only. */ }
    if (Date.now() > deadline) throw new Error(`Local static-assets server did not become ready: ${log}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const record of applicationRedirects) {
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(`${origin}${record.sourcePath}`, { method, redirect: "manual" });
      assert.equal(response.status, 301, record.id);
      assert.equal(new URL(response.headers.get("location")!, origin).pathname, record.targetPath, record.id);
      assert.equal(await response.text(), "", `${record.id} must not serve duplicate content`);
    }
    assert.equal((await fetch(`${origin}${record.targetPath}`, { redirect: "manual" })).status, 200);
  }
  for (const route of ["/phase8-definitely-not-a-route/", "/blog/page/99999/", "/notes/page/99999/", "/blog/page/1/"]) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    assert.equal(response.status, 404, route);
    const html = await response.text();
    assert.match(html, /name="robots" content="noindex"/u);
    assert.match(html, /rel="canonical" href="https:\/\/xpotato.net\/404.html"/u);
  }
  // Query requirements must not be accidentally activated by the path artifact.
  for (const id of ["34", "693", "811"]) assert.equal((await fetch(`${origin}/?p=${id}`, { redirect: "manual" })).status, 200);
  return { mode: "local_workers_static_assets", redirects: applicationRedirects.map((r) => ({ source: r.sourcePath, target: r.targetPath, getStatus: 301, headStatus: 301, targetStatus: 200, oldBodyBytes: 0 })), notFoundStatus: 404, queryRequirementsActivated: false, productionReadBack: "NOT_RUN" };
} finally {
  if (process.platform === "win32" && child.pid && child.exitCode === null) {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    await new Promise((resolve) => killer.once("exit", resolve));
  } else child.kill();
  await exited;
}

};
