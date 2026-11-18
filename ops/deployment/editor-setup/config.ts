import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

export interface EditorTarget {
  origin: string;
  repository: string;
  ownerGitHubId: string;
  worker: string;
  route: string;
  bucket: string;
  accountId: string;
  zoneId: string;
  storageClass: "Standard";
  siteWorker: string;
  garbageCollection: false;
}

export function sourceIdentity(root: string, repository: string) {
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const remote = git("remote", "get-url", "origin").replace(/\.git$/u, "");
  if (!["https://github.com/" + repository, "git@github.com:" + repository].includes(remote)) {
    throw Error("REPOSITORY_IDENTITY_MISMATCH");
  }
  const head = git("rev-parse", "HEAD");
  const main = git("rev-parse", "origin/main");
  const merged =
    spawnSync("git", ["merge-base", "--is-ancestor", head, main], {
      cwd: root,
      stdio: "ignore",
    }).status === 0;
  return { head, main, merged, clean: git("status", "--porcelain") === "" };
}

export async function loadEditorSetup(siteRoot: string, serverRoot: string) {
  const site = sourceIdentity(siteRoot, "Xpotato1024/xpotato-site");
  const server = sourceIdentity(serverRoot, "Xpotato1024/Xpotato-Server");
  const handoff = await readFile(
    join(siteRoot, "docs/architecture/infrastructure-handoff.md"),
    "utf8",
  );
  const revisions = [...handoff.matchAll(/^cms_server_revision: ([a-f0-9]{40})\r?$/gmu)];
  if (revisions.length !== 1 || server.head !== revisions[0]![1]) {
    throw Error("CMS_SERVER_REVISION_MISMATCH");
  }
  // import自体が実行なので、採用済みの固定Server版を読む前に境界を確認する。
  if (!server.clean || !server.merged) {
    throw Error("CLEAN_MERGED_SERVER_REQUIRED");
  }
  const provider = await import(pathToFileURL(join(serverRoot, "tools/website_editor.mjs")).href);
  const [editor, current, desired] = await Promise.all([
    readFile(join(serverRoot, "inventory/desired/website-editor.json"), "utf8").then(JSON.parse),
    readFile(join(serverRoot, "inventory/current/cloudflare.yaml"), "utf8").then(parse),
    readFile(join(serverRoot, "inventory/desired/cloudflare.yaml"), "utf8").then(parse),
  ]);
  const target = provider.editorTarget(editor, current, desired.website) as EditorTarget;
  return { siteRoot, serverRoot, site, server, target, provider };
}

export function requireMergedSources(setup: Awaited<ReturnType<typeof loadEditorSetup>>) {
  for (const source of [setup.site, setup.server]) {
    if (!source.clean || !source.merged) {
      throw Error("CLEAN_MERGED_MAIN_REQUIRED");
    }
  }
}

export async function writeEditorConfig(setup: Awaited<ReturnType<typeof loadEditorSetup>>) {
  const { siteRoot, target } = setup;
  const template = JSON.parse(
    await readFile(join(siteRoot, "apps/editor-api/wrangler.jsonc"), "utf8"),
  );
  const output = join(siteRoot, ".local/editor-setup");
  await mkdir(output, { recursive: true });
  // Provider名はServerのdesiredからだけ解決する。公開siteのconfigを使い回さない。
  const config = {
    name: target.worker,
    main: resolve(siteRoot, "apps/editor-api", template.main),
    account_id: target.accountId,
    compatibility_date: template.compatibility_date,
    workers_dev: false,
    preview_urls: false,
    keep_vars: true,
    vars: {
      EDITOR_ORIGIN: target.origin,
      EDITOR_REPOSITORY: target.repository,
      OWNER_GITHUB_ID: target.ownerGitHubId,
      GC_ENABLED: "false",
    },
    r2_buckets: [{ binding: "DRAFT_MEDIA", bucket_name: target.bucket }],
    routes: [{ pattern: target.route, zone_id: target.zoneId }],
    triggers: { crons: [] },
    observability: { enabled: false },
  };
  const filename = join(output, "wrangler.json");
  await writeFile(filename, JSON.stringify(config, null, 2) + "\n");
  return filename;
}
