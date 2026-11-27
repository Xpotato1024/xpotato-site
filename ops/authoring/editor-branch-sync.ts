import { execFileSync } from "node:child_process";
import {
  createGitHubTransport,
  defaultRepository,
  GitRepository,
  assertWorkingBranch,
} from "@xpotato/editor-core/git";
import { assertEditablePath, parseDraft } from "@xpotato/editor-core/draft";
import type { DraftBranchIdentity } from "@xpotato/editor-core/draft-branch";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export async function runBranchSync(args: string[]) {
  const allowed = new Set(["--branch", "--path", "--expected-head", "--apply", "--content-id"]);
  const values = new Map<string, string>();
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    const key = args[i]!;
    if (!allowed.has(key) || values.has(key) || (key === "--apply" && apply))
      throw Error(
        "USAGE: editor:branch:sync -- --branch content/... --path content/...mdx [--expected-head SHA] [--content-id UUID] [--apply]",
      );
    if (key === "--apply") {
      apply = true;
      continue;
    }
    const value = args[++i];
    if (!value || value.startsWith("--")) throw Error("BRANCH_SYNC_INPUT_INVALID");
    values.set(key, value);
  }
  const branch = values.get("--branch") ?? "",
    path = values.get("--path") ?? "";
  assertWorkingBranch(branch);
  assertEditablePath(path);
  // Reuse the existing CLI identity. Never print or persist the token.
  const token = execFileSync("gh", ["auth", "token", "--hostname", "github.com"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!token) throw Error("GITHUB_AUTH_REQUIRED");
  const user = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "User-Agent": "Xpotato-Editor-CLI",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  if (!user.ok) throw Error("GITHUB_AUTH_REQUIRED");
  const identity = (await user.json()) as { login: string };
  if (identity.login.toLowerCase() !== defaultRepository.split("/")[0]!.toLowerCase())
    throw Error("OWNER_REQUIRED");
  const repository = new GitRepository(createGitHubTransport(token));
  const snapshot = await repository.snapshot(branch);
  const expectedHead = values.get("--expected-head") ?? snapshot.commit;
  if (expectedHead !== snapshot.commit) throw Error("GIT_CONFLICT");
  const contentId =
    values.get("--content-id") ??
    parseDraft((await repository.read(snapshot, path)).source).data.id;
  const input: DraftBranchIdentity = { branch, expectedHead, path, contentId };
  const result = await repository.followDraftMain(input, apply);
  // Output only revision identities and conflict descriptors; private media/reviews stay in Draft.
  const { manifest: _manifest, ...receipt } = result;
  console.log(
    JSON.stringify(
      {
        protocol: "xpotato-draft-main-sync-v1",
        ...receipt,
        path,
        contentId,
        productionEligible: false,
      },
      null,
      2,
    ),
  );
  if (result.status === "conflict") process.exitCode = 2;
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await runBranchSync(process.argv.slice(2));
