import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { boundContentDraftContext, articleSourceCollection } from "./article-pr-policy.mjs";
import {
  changedBranchPaths,
  planDraftBranch,
  branchManifestPath,
  DraftBranchConflictError,
  type BranchFile,
  type DraftBranchPlan,
  type DraftBranchRevision,
} from "@xpotato/editor-core/draft-branch";
import { parseDraft } from "@xpotato/editor-core/draft";
import { taxonomyRegistryPath, seriesRegistryPath } from "@xpotato/editor-core/registry";
import { blockTree, type BlockNode } from "@xpotato/editor-core/blocks";

export interface BoundDraftPlan {
  ancestor: string;
  base: string;
  head: string;
  path: string;
  contentId: string;
  publishedBaseline: boolean;
  requiresProjection: boolean;
  markdownImages: boolean;
  plan: DraftBranchPlan;
}
const sha = /^[a-f0-9]{40}$/u;
export function gitAt(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
export function localRevision(cwd: string, commit: string): DraftBranchRevision {
  assert.match(commit, sha);
  const raw = gitAt(cwd, ["ls-tree", "-r", "-z", commit]);
  assert.ok(!raw || raw.endsWith("\0"), "DRAFT_TREE_INCOMPLETE");
  const tree = new Map<string, BranchFile>();
  for (const row of raw.split("\0").filter(Boolean)) {
    const match = /^([0-7]{6}) (blob|commit) ([a-f0-9]{40})\t([\s\S]+)$/u.exec(row);
    assert.ok(match, "DRAFT_TREE_INVALID");
    assert.ok(!tree.has(match[4]!), "DRAFT_TREE_DUPLICATE");
    tree.set(match[4]!, { mode: match[1]!, type: match[2]!, sha: match[3]! });
  }
  return {
    tree,
    read: async (path) => {
      const f = tree.get(path);
      assert.ok(f && f.type === "blob" && f.mode === "100644", "DRAFT_SOURCE_INVALID");
      return gitAt(cwd, ["cat-file", "blob", f.sha]);
    },
  };
}
function hasMarkdownImage(node: BlockNode): boolean {
  return (
    node.type === "image" ||
    node.type === "imageReference" ||
    (node.children?.some(hasMarkdownImage) ?? false)
  );
}
export async function inspectBoundDraftPlan({
  cwd = process.cwd(),
  env = process.env,
}: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<BoundDraftPlan | null | undefined> {
  cwd = resolve(cwd);
  const head = gitAt(cwd, ["rev-parse", "HEAD^{commit}"]).trim();
  if (!boundContentDraftContext(env, head)) return undefined;
  assert.equal(
    gitAt(cwd, ["status", "--porcelain", "--untracked-files=normal"]),
    "",
    "DRAFT_SOURCE_DIRTY",
  );
  const base = env.DIFF_BASE!;
  const ancestors = gitAt(cwd, ["merge-base", "--all", base, head]).trim().split("\n");
  assert.equal(ancestors.length, 1, "DRAFT_MERGE_BASE_AMBIGUOUS");
  const ancestor = ancestors[0]!;
  const a = localRevision(cwd, ancestor),
    h = localRevision(cwd, head),
    m = base === ancestor ? a : localRevision(cwd, base);
  const changed = changedBranchPaths(a.tree, h.tree);
  const articles = changed.filter((p) => articleSourceCollection(p) !== null);
  if (!articles.length) {
    // Registry management has its own existing full CI lane, not article admission.
    const registryOnly = new Set([taxonomyRegistryPath, seriesRegistryPath, branchManifestPath]);
    assert.ok(
      changed.every((p) => registryOnly.has(p)),
      "DRAFT_SCOPE: content branch contains non-article changes",
    );
    return null;
  }
  assert.equal(articles.length, 1, "DRAFT_SCOPE: one article per work branch");
  const path = articles[0]!;
  assert.ok(h.tree.has(path), "DRAFT_SCOPE: article deletion or move");
  const candidate = await h.read(path),
    parsed = parseDraft(candidate);
  assert.equal(parsed.data.draft, true, "DRAFT_SCOPE: publication is a separate operation");
  const input = { branch: env.PR_HEAD_REF!, expectedHead: head, path, contentId: parsed.data.id };
  let plan: DraftBranchPlan;
  try {
    plan = await planDraftBranch(input, a, h, m);
  } catch (error) {
    if (error instanceof DraftBranchConflictError)
      throw Error(
        "DRAFT_MAIN_CONFLICT: " +
          error.conflicts.map((c) => c.path + " (" + c.reason + ")").join("; ") +
          "; preserve this branch and resolve via editor:branch:sync.",
      );
    throw error;
  }
  const baseline = m.tree.has(path) ? parseDraft(await m.read(path)) : null;
  const markdownImages =
    hasMarkdownImage(blockTree(parsed.body)) ||
    Boolean(baseline && hasMarkdownImage(blockTree(baseline.body)));
  return {
    ancestor,
    base,
    head,
    path,
    contentId: parsed.data.id,
    publishedBaseline: baseline?.data.draft === false,
    requiresProjection: base !== ancestor,
    markdownImages,
    plan,
  };
}
