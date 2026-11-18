import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import type { EditorTarget } from "./config.js";
import { editorGitHubPermissions } from "../../../apps/editor-api/src/github-access.js";

export interface AppRegistration {
  id: number;
  slug: string;
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  owner: { id: number };
  permissions: Record<string, string>;
  events: string[];
}
export function appManifest(target: EditorTarget, redirectUrl: string) {
  return {
    name: "Xpotato site editor",
    url: target.origin + "/editor/",
    description: "所有者専用の記事編集・Draft PR・非公開画像同期",
    redirect_url: redirectUrl,
    callback_urls: [target.origin + "/editor-api/auth/callback"],
    setup_url: target.origin + "/editor-api/auth/start",
    public: false,
    request_oauth_on_install: false,
    hook_attributes: { url: target.origin + "/editor-api/github/activity", active: true },
    default_permissions: editorGitHubPermissions,
    default_events: ["push"],
  };
}
export function validateRegistration(value: AppRegistration, target: EditorTarget) {
  if (
    !Number.isSafeInteger(value.id) ||
    value.id <= 0 ||
    String(value.owner?.id) !== target.ownerGitHubId ||
    !/^[a-z0-9-]+$/u.test(value.slug) ||
    !value.client_id ||
    !value.client_secret ||
    !value.webhook_secret ||
    value.events?.length !== 1 ||
    value.events[0] !== "push" ||
    Object.keys(value.permissions ?? {}).length !== Object.keys(editorGitHubPermissions).length ||
    Object.entries(editorGitHubPermissions).some(
      ([key, expected]) => value.permissions[key] !== expected,
    )
  ) {
    throw Error("GITHUB_APP_REGISTRATION_MISMATCH");
  }
}
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function openBrowser(url: string) {
  const command =
    process.platform === "win32"
      ? "rundll32.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
  child.on("error", () =>
    console.error("ブラウザを開けません。表示されたローカルURLを開いてください。"),
  );
  child.unref();
}
export async function registerGitHubApp(
  target: EditorTarget,
  persist: (registration: AppRegistration, sessionSecret: string) => Promise<void>,
  options: { fetcher?: typeof fetch; open?: (url: string) => void; timeoutMs?: number } = {},
): Promise<{ id: number; slug: string }> {
  const state = randomBytes(32).toString("hex");
  const equal = (value: string | null) =>
    value !== null &&
    /^[a-f0-9]{64}$/u.test(value) &&
    timingSafeEqual(Buffer.from(value), Buffer.from(state));
  let pending = false,
    origin = "";
  let completed!: (value: { id: number; slug: string }) => void;
  let failed!: (error: Error) => void;
  const done = new Promise<{ id: number; slug: string }>((resolve, reject) => {
    completed = resolve;
    failed = reject;
  });
  const server = createServer((request, response) => {
    void (async () => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; form-action https://github.com; frame-ancestors 'none'; base-uri 'none'",
      );
      const url = new URL(request.url ?? "/", origin);
      if (request.headers.host !== new URL(origin).host || request.method !== "GET") {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      if (url.pathname === "/") {
        response.setHeader(
          "Set-Cookie",
          "editor-setup=" + state + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=900",
        );
        const manifest = appManifest(target, origin + "/callback");
        response.end(
          '<!doctype html><html lang="ja"><meta charset="utf-8"><title>CMSのGitHub接続</title><h1>所有者専用GitHub Appを登録</h1><p>次の画面で作成し、インストール先は ' +
            escapeHtml(target.repository) +
            ' だけを選択してください。</p><form method="post" action="https://github.com/settings/apps/new?state=' +
            state +
            '"><input type="hidden" name="manifest" value="' +
            escapeHtml(JSON.stringify(manifest)) +
            '"><button>GitHubで登録する</button></form></html>',
        );
        return;
      }
      const cookie = (request.headers.cookie ?? "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("editor-setup="))
        ?.slice(13);
      if (
        url.pathname !== "/callback" ||
        !equal(url.searchParams.get("state")) ||
        !equal(cookie ?? null) ||
        pending
      ) {
        response.writeHead(403);
        response.end("State verification failed");
        return;
      }
      const code = url.searchParams.get("code");
      if (!code || !/^[A-Za-z0-9_-]{1,512}$/u.test(code)) {
        response.writeHead(400);
        response.end("Code missing");
        return;
      }
      pending = true;
      const exchanged = await (options.fetcher ?? fetch)(
        "https://api.github.com/app-manifests/" + encodeURIComponent(code) + "/conversions",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Xpotato-Editor-Setup",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      if (!exchanged.ok) {
        throw Error("GITHUB_APP_EXCHANGE_FAILED");
      }
      const registration = (await exchanged.json()) as AppRegistration;
      validateRegistration(registration, target);
      // 秘密値はファイル・ブラウザ・ログに保存せず、そのままWorkerのSecretsへ渡す。
      await persist(registration, randomBytes(32).toString("base64url"));
      const install = "https://github.com/apps/" + registration.slug + "/installations/new";
      const complete = () => completed({ id: registration.id, slug: registration.slug });
      // Secrets保存後のブラウザ切断で再登録を促すと、Appが重複してしまう。
      if (response.destroyed) {
        complete();
        return;
      }
      response.once("finish", complete);
      response.once("close", complete);
      response.end(
        '<!doctype html><html lang="ja"><meta charset="utf-8"><h1>接続情報を保存しました</h1><p>インストールは対象repositoryだけを選択してください。</p><a href="' +
          escapeHtml(install) +
          '">GitHub Appをインストール</a></html>',
      );
    })().catch(() => {
      if (!response.headersSent) {
        response.writeHead(502);
      }
      response.end(
        "設定を完了できませんでした。秘密値は表示していません。端末の状態表示を確認してください。",
      );
      failed(Error("GITHUB_SETUP_FAILED"));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw Error("SETUP_LISTEN_FAILED");
  }
  origin = "http://127.0.0.1:" + address.port;
  console.log("GitHub App登録: " + origin);
  (options.open ?? openBrowser)(origin);
  const timer = setTimeout(
    () => failed(Error("GITHUB_SETUP_EXPIRED")),
    options.timeoutMs ?? 15 * 60 * 1000,
  );
  try {
    return await done;
  } finally {
    clearTimeout(timer);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
    });
  }
}
