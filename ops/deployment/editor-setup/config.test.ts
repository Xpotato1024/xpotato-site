import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadEditorSetup, requireMergedSources } from "./config.js";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

function fixture(pin: "accepted" | "missing" | "different" | "duplicate" = "accepted") {
  const root = mkdtempSync(join(tmpdir(), "xpotato-editor-provider-"));
  temporaryRoots.push(root);
  const siteRoot = join(root, "site");
  const serverRoot = join(root, "server");
  const hooks = join(root, "empty-hooks");
  mkdirSync(hooks);
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", ["-c", "core.hooksPath=" + hooks, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const write = (cwd: string, file: string, content: string) => {
    const target = join(cwd, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  const commit = (cwd: string, message: string) => {
    git(cwd, "add", ".");
    git(cwd, "commit", "--no-gpg-sign", "-m", message);
    return git(cwd, "rev-parse", "HEAD");
  };
  for (const [cwd, repository] of [
    [siteRoot, "xpotato-site"],
    [serverRoot, "Xpotato-Server"],
  ]) {
    mkdirSync(cwd!);
    git(cwd!, "init", "--initial-branch=main", "--template=" + hooks);
    git(cwd!, "config", "user.name", "CMS boundary fixture");
    git(cwd!, "config", "user.email", "cms-fixture@example.invalid");
    git(cwd!, "config", "core.autocrlf", "false");
    git(cwd!, "remote", "add", "origin", "https://github.com/Xpotato1024/" + repository);
  }
  write(
    serverRoot,
    "tools/website_editor.mjs",
    `import { writeFileSync } from "node:fs";

writeFileSync(new URL("../../provider-imported", import.meta.url), "executed");
export function editorTarget(editor, current, website) {
  return { ...editor, accountId: current.accountId, siteWorker: website.worker };
}
`,
  );
  write(serverRoot, "inventory/desired/website-editor.json", '{"bucket":"private-draft"}');
  write(serverRoot, "inventory/current/cloudflare.yaml", "accountId: fixture-account\n");
  write(serverRoot, "inventory/desired/cloudflare.yaml", "website:\n  worker: public-site\n");
  const serverRevision = commit(serverRoot, "Accepted provider");
  git(serverRoot, "update-ref", "refs/remotes/origin/main", serverRevision);
  const handoffPath = "docs/architecture/infrastructure-handoff.md";
  const handoff = "cms_server_revision: " + serverRevision + "\n";
  write(
    siteRoot,
    handoffPath,
    pin === "missing"
      ? "# No CMS provider adopted\n"
      : pin === "different"
        ? "cms_server_revision: " + "0".repeat(40) + "\n"
        : pin === "duplicate"
          ? handoff + handoff
          : handoff,
  );
  git(siteRoot, "update-ref", "refs/remotes/origin/main", commit(siteRoot, "Adopt provider"));
  return {
    siteRoot,
    serverRoot,
    serverRevision,
    handoffPath,
    marker: join(root, "provider-imported"),
    git,
    write,
    commit,
  };
}

describe("CMS provider adoption boundary", () => {
  it.each(["missing", "different", "duplicate"] as const)(
    "does not execute a provider when the adopted revision is %s",
    async (pin) => {
      const setup = fixture(pin);
      await expect(loadEditorSetup(setup.siteRoot, setup.serverRoot)).rejects.toThrow(
        "CMS_SERVER_REVISION_MISMATCH",
      );
      expect(existsSync(setup.marker)).toBe(false);
    },
  );

  it("does not execute uncommitted provider changes even at the adopted revision", async () => {
    const setup = fixture();
    const provider = "tools/website_editor.mjs";
    setup.write(
      setup.serverRoot,
      provider,
      readFileSync(join(setup.serverRoot, provider), "utf8") + "export const unreviewed = true;\n",
    );
    await expect(loadEditorSetup(setup.siteRoot, setup.serverRoot)).rejects.toThrow(
      "CLEAN_MERGED_SERVER_REQUIRED",
    );
    expect(existsSync(setup.marker)).toBe(false);
  });

  it("does not execute a pinned provider commit that has not reached main", async () => {
    const setup = fixture();
    setup.git(setup.serverRoot, "checkout", "-b", "candidate");
    setup.write(setup.serverRoot, "candidate.md", "Unmerged provider candidate\n");
    const candidate = setup.commit(setup.serverRoot, "Unmerged candidate");
    setup.write(setup.siteRoot, setup.handoffPath, "cms_server_revision: " + candidate + "\n");
    const siteRevision = setup.commit(setup.siteRoot, "Pin candidate");
    setup.git(setup.siteRoot, "update-ref", "refs/remotes/origin/main", siteRevision);
    await expect(loadEditorSetup(setup.siteRoot, setup.serverRoot)).rejects.toThrow(
      "CLEAN_MERGED_SERVER_REQUIRED",
    );
    expect(existsSync(setup.marker)).toBe(false);
  });

  it("loads the adopted provider after main advances with unrelated changes", async () => {
    const setup = fixture();
    setup.write(setup.serverRoot, "unrelated.md", "Later unrelated infrastructure work\n");
    const main = setup.commit(setup.serverRoot, "Unrelated change");
    setup.git(setup.serverRoot, "update-ref", "refs/remotes/origin/main", main);
    setup.git(setup.serverRoot, "checkout", "--detach", setup.serverRevision);

    const loaded = await loadEditorSetup(setup.siteRoot, setup.serverRoot);

    expect(loaded.server).toEqual({
      head: setup.serverRevision,
      main,
      merged: true,
      clean: true,
    });
    expect(loaded.target).toEqual({
      bucket: "private-draft",
      accountId: "fixture-account",
      siteWorker: "public-site",
    });
    expect(existsSync(setup.marker)).toBe(true);
    expect(() => requireMergedSources(loaded)).not.toThrow();
  });
});
