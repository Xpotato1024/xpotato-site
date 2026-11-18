import { spawn } from "node:child_process";
import { join, dirname } from "node:path";

export function wrangler(siteRoot: string, args: string[], input?: string, interactive = false) {
  return new Promise<{ code: number; stdout: string }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(siteRoot, "node_modules/wrangler/bin/wrangler.js"), ...args],
      {
        cwd: siteRoot,
        windowsHide: !interactive,
        env: {
          ...process.env,
          PATH:
            dirname(process.execPath) +
            (process.platform === "win32" ? ";" : ":") +
            process.env.PATH,
          WRANGLER_SEND_METRICS: "false",
          WRANGLER_LOG_SANITIZE: "true",
          NO_COLOR: "1",
        },
        stdio: interactive ? "inherit" : ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "",
      size = 0;
    const timeout = setTimeout(() => child.kill(), interactive ? 15 * 60_000 : 5 * 60_000);
    if (!interactive) {
      child.stdout!.on("data", (chunk) => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) {
          child.kill();
        } else {
          stdout += chunk.toString();
        }
      });
      // エラー出力にプロバイダー応答や入力が含まれても、秘密値を上位へ返さない。
      child.stderr!.resume();
      child.stdin!.end(input);
    }
    child.once("error", () => {
      clearTimeout(timeout);
      reject(Error("WRANGLER_START_FAILED"));
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      resolve({ code: code ?? 1, stdout });
    });
  });
}
export async function cloudflareToken(siteRoot: string): Promise<string | null> {
  const result = await wrangler(siteRoot, ["auth", "token", "--json"]);
  if (result.code !== 0) {
    return null;
  }
  try {
    const data = JSON.parse(result.stdout) as { type: string; token?: string };
    if (!["api_token", "oauth"].includes(data.type) || !data.token || /\s/u.test(data.token)) {
      return null;
    }
    return data.token;
  } catch {
    return null;
  }
}
export async function requireWrangler(siteRoot: string, args: string[], input?: string) {
  const result = await wrangler(siteRoot, args, input);
  if (result.code !== 0) {
    throw Error("WRANGLER_" + args[0]!.toUpperCase() + "_EXIT_" + result.code);
  }
  return result.stdout;
}
