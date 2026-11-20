import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEditorSetup, requireMergedSources, writeEditorConfig } from "./editor-setup/config.js";
import { registerGitHubApp } from "./editor-setup/github-app.js";
import { cloudflareToken, requireWrangler, wrangler } from "./editor-setup/wrangler.js";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "server-root": { type: "string" } },
});
const mode = positionals[0] ?? "check";
const requiredSecrets = [
  "GITHUB_APP_ID",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "SESSION_SECRET",
  "GITHUB_WEBHOOK_SECRET",
];

async function publicReadiness(origin: string) {
  const check = async (path: string, kind: "shell" | "api") => {
    try {
      const response = await fetch(origin + path, {
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      // A protected editor legitimately redirects unauthenticated readers to Cloudflare Access.
      // This confirms the security boundary, not an authenticated shell load.
      if (kind === "shell" && [302, 303, 307].includes(response.status)) {
        const destination = new URL(response.headers.get("location") ?? "/", origin);
        if (
          destination.protocol === "https:" &&
          destination.hostname.endsWith(".cloudflareaccess.com") &&
          destination.pathname.startsWith("/cdn-cgi/access/login/")
        ) {
          return { ready: true, status: response.status, accessProtected: true };
        }
      }
      if (response.status !== 200) {
        return { ready: false, status: response.status };
      }
      if (kind === "shell") {
        const html = await response.text();
        return {
          ready: html.includes('id="root"') && html.includes("/editor/assets/"),
          status: response.status,
        };
      }
      const data = (await response.json()) as { configured?: boolean; authenticated?: boolean };
      return {
        ready: data.configured === true && data.authenticated === false,
        status: response.status,
      };
    } catch {
      return { ready: false, status: null };
    }
  };
  return {
    editor: await check("/editor/", "shell"),
    api: await check("/editor-api/session", "api"),
    ownerLoginVerified: false,
  };
}

async function main() {
  if (
    !["check", "connect", "verify"].includes(mode) ||
    positionals.length > 1 ||
    !values["server-root"]
  ) {
    throw Error(
      "USAGE: npm run editor:connect -- check|connect|verify --server-root <Xpotato-Server>",
    );
  }
  const serverRoot = resolve(values["server-root"]);
  if (mode === "connect") {
    for (const cwd of [siteRoot, serverRoot]) {
      execFileSync("git", ["fetch", "origin", "main"], { cwd, stdio: "ignore" });
    }
  }
  const setup = await loadEditorSetup(siteRoot, serverRoot);
  const config = await writeEditorConfig(setup);
  const report: Record<string, unknown> = {
    siteRevision: setup.site.head,
    serverRevision: setup.server.head,
    sourceIsMerged:
      setup.site.clean && setup.server.clean && setup.site.merged && setup.server.merged,
    target: {
      origin: setup.target.origin,
      worker: setup.target.worker,
      bucket: setup.target.bucket,
      route: setup.target.route,
    },
    providerMutated: false,
    accountUsageVerified: false,
  };
  let token = await cloudflareToken(siteRoot),
    ownedLogin = false;
  try {
    if (mode === "connect") {
      requireMergedSources(setup);
      if (
        process.version.slice(1) !==
        (await readFile(join(siteRoot, ".node-version"), "utf8")).trim()
      ) {
        throw Error("PINNED_NODE_REQUIRED");
      }
      await requireWrangler(siteRoot, ["deploy", "--config", config, "--dry-run"]);
      if (!token) {
        console.log("Cloudflareの端末認証URLと短いコードを表示します。別端末でも承認できます。");
        // ブラウザが別端末でも戻れるよう、localhost:8976のOAuth callbackは使わない。
        const result = await wrangler(
          siteRoot,
          ["login", "--device", "--browser=false"],
          undefined,
          true,
        );
        if (result.code !== 0) {
          throw Error("CLOUDFLARE_LOGIN_REQUIRED");
        }
        ownedLogin = true;
        token = await cloudflareToken(siteRoot);
      }
    }
    if (!token) {
      report.cloudflare = "login-required";
    } else {
      const provider = setup.provider.cloudflareClient(token);
      let observed = await setup.provider.inspectEditor(setup.target, provider);
      report.cloudflare = "authenticated";
      report.resources = {
        bucketExists: observed.bucketExists,
        privateBucket: observed.privateBucket,
        workerExists: observed.workerExists,
        routeExists: observed.routeExists,
        githubSecretsPresent: requiredSecrets.every((name) => observed.secretNames.includes(name)),
      };
      if (mode === "connect") {
        const present = requiredSecrets.filter((name) => observed.secretNames.includes(name));
        if (present.length > 0 && present.length < requiredSecrets.length) {
          throw Error("PARTIAL_GITHUB_SETUP_REQUIRES_OWNER_REPAIR");
        }
        const originalBindings = JSON.stringify(observed.publicSiteBindings);
        observed = await setup.provider.createDraftBucket(setup.target, provider);
        report.providerMutated = true;
        console.log("非公開Draft bucketを確認しました。CMS専用APIだけを配備します。");
        await requireWrangler(siteRoot, ["deploy", "--config", config]);
        observed = await setup.provider.inspectEditor(setup.target, provider);
        if (
          !observed.routeExists ||
          originalBindings !== JSON.stringify(observed.publicSiteBindings)
        ) {
          throw Error("PROVIDER_READBACK_MISMATCH");
        }
        if (present.length === 0) {
          const app = await registerGitHubApp(setup.target, async (registration, sessionSecret) => {
            const secrets = {
              GITHUB_APP_ID: String(registration.id),
              GITHUB_CLIENT_ID: registration.client_id,
              GITHUB_CLIENT_SECRET: registration.client_secret,
              GITHUB_WEBHOOK_SECRET: registration.webhook_secret,
              SESSION_SECRET: sessionSecret,
            };
            await requireWrangler(
              siteRoot,
              ["secret", "bulk", "--config", config],
              JSON.stringify(secrets),
            );
          });
          await writeFile(
            join(siteRoot, ".local/editor-setup/github-app.json"),
            JSON.stringify(
              { id: app.id, slug: app.slug, repository: setup.target.repository },
              null,
              2,
            ) + "\n",
          );
          console.log(
            "GitHub Appのインストール先は " + setup.target.repository + " だけを選択してください。",
          );
        }
        observed = await setup.provider.inspectEditor(setup.target, provider);
        report.resources = {
          bucketExists: observed.bucketExists,
          privateBucket: observed.privateBucket,
          workerExists: observed.workerExists,
          routeExists: observed.routeExists,
          githubSecretsPresent: requiredSecrets.every((name) =>
            observed.secretNames.includes(name),
          ),
        };
        if (originalBindings !== JSON.stringify(observed.publicSiteBindings)) {
          throw Error("PUBLIC_SITE_BINDING_CHANGED");
        }
      }
    }
    const publicStatus = await publicReadiness(setup.target.origin);
    report.public = publicStatus;
    const resources = report.resources as Record<string, boolean> | undefined;
    report.connectionConfigured =
      token !== null &&
      publicStatus.editor.ready &&
      publicStatus.api.ready &&
      [
        "bucketExists",
        "privateBucket",
        "workerExists",
        "routeExists",
        "githubSecretsPresent",
      ].every((key) => resources?.[key] === true);
    if (mode !== "check" && !report.connectionConfigured) {
      process.exitCode = 2;
    }
    report.garbageCollectionEnabled = false;
    await writeFile(
      join(siteRoot, ".local/editor-setup/status.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
    console.log(
      "静的 /editor/ が未配信の場合は、既存のsite-production承認付き配信を先に完了してください。このコマンドは公開サイト全体を配備しません。",
    );
    console.log(
      "アカウント全体のR2使用量とWorker実CPU時間は別の実測です。接続設定の成功を無料枠内・実機受入れ完了とは扱いません。",
    );
  } finally {
    token = null;
    if (ownedLogin) {
      const loggedOut = await wrangler(siteRoot, ["logout"]);
      if (loggedOut.code !== 0) {
        console.error(
          "この設定操作で開始したWranglerログインの終了確認が必要です。wrangler logoutを実行してください。",
        );
      }
    }
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error && /^[A-Z][A-Z0-9_: <>|/.-]*$/u.test(error.message)
      ? error.message
      : "EDITOR_SETUP_FAILED",
  );
  process.exitCode = 1;
});
