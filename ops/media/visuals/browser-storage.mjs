import { mkdtemp, mkdir, writeFile, readFile, lstat, rm } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { isolatedChromeEnvironment } from "../../qa/chrome-page-ready.mjs";

/** Linux Chrome creates Unix sockets below TMPDIR; repository paths can exceed sun_path. */
export async function prepareBrowserStorage(
  runtime,
  { platform = process.platform, env = process.env } = {},
) {
  if (!isAbsolute(runtime)) throw Error("Absolute browser runtime required");
  const temporary = platform === "linux",
    root = temporary ? await mkdtemp("/tmp/xp-tv-") : runtime;
  const token = randomUUID(),
    profile = join(root, "browser-profile");
  try {
    if (temporary)
      await writeFile(join(root, "owner.json"), JSON.stringify({ token, runtime }), {
        flag: "wx",
        mode: 0o600,
      });
    await mkdir(profile, { mode: 0o700 });
    const environment = await isolatedChromeEnvironment(profile, {
      platform,
      env: { ...env, TEMP: root, TMP: root, TMPDIR: root },
    });
    return { root, profile, temporary, token, runtime, environment };
  } catch (error) {
    if (temporary) await rm(root, { recursive: true, force: true });
    throw error;
  }
}

/** Remove only the per-invocation Linux directory with the matching private ownership marker. */
export async function cleanupBrowserStorage(storage) {
  if (!storage?.temporary) return;
  if (!/^\/tmp\/xp-tv-[A-Za-z0-9]{6}$/u.test(storage.root) || !isAbsolute(storage.runtime))
    throw Error("Invalid browser storage binding");
  let info;
  try {
    info = await lstat(storage.root);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error("Unsafe browser storage");
  const marker = join(storage.root, "owner.json"),
    stat = await lstat(marker);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4096)
    throw Error("Unsafe browser storage owner");
  const owner = JSON.parse(await readFile(marker, "utf8"));
  if (owner.token !== storage.token || owner.runtime !== storage.runtime)
    throw Error("Browser storage owner mismatch");
  await rm(storage.root, { recursive: true });
}
