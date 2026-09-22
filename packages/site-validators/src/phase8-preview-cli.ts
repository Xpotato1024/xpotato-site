import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const temp = process.env.XPOTATO_PHASE8_TEMP_ROOT;
if (!temp || !isAbsolute(temp)) throw new Error("XPOTATO_PHASE8_TEMP_ROOT must be an absolute task temp directory");
const require = createRequire(join(root, "apps/site/package.json"));
const astro = join(dirname(require.resolve("astro/package.json")), "bin/astro.mjs");
const child = spawn(process.execPath, [astro, "build"], {
  cwd: join(root, "apps/site"), stdio: "inherit", windowsHide: true,
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", XPOTATO_PHASE8_PREVIEW_OUTPUT: join(temp, "preview") },
});
child.on("error", (error) => { throw error; });
const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
if (code !== 0) throw new Error(`Private held-Blog fixture build failed: ${code}`);
