import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { inspectImpact } from "./ci-impact.mjs";
import { classify } from "./ci-scope.mjs";

const shaPattern = /^[a-f0-9]{40}$/u;
const prRefPattern = /^refs\/pull\/[1-9][0-9]*\/merge$/u;
const sourcePattern =
  /^content\/(articles|notes|projects|tools|pages)\/[a-z0-9][a-z0-9_-]*\.mdx?$/u;
export const articleIndexPath = "content/registry/editor-content-index.json";
const repository = "Xpotato1024/xpotato-site";

export function articleSourceCollection(path) {
  const directory = sourcePattern.exec(path)?.[1];
  return directory === "articles" ? "blog" : (directory ?? null);
}

// This dependency-free check selects candidates only. It cannot authorize skipping
// browser checks until article-pr-admission has validated both source revisions.
export function articlePrDecision({ impact, env, actualHead, sourceMode } = {}) {
  const unavailable = (reason) => ({ article: false, reason, sources: [] });
  if (env?.CI_FORCE_FULL === "true") return unavailable("full CI explicitly requested");
  if (
    env?.GITHUB_EVENT_NAME !== "pull_request" ||
    env?.GITHUB_REPOSITORY !== repository ||
    env?.PR_HEAD_REPOSITORY !== repository ||
    env?.PR_BASE_REPOSITORY !== repository ||
    env?.PR_BASE_REF !== "main" ||
    !prRefPattern.test(env?.GITHUB_REF ?? "") ||
    !shaPattern.test(env?.EXPECTED_HEAD ?? "") ||
    !shaPattern.test(env?.DIFF_BASE ?? "") ||
    !shaPattern.test(actualHead ?? "") ||
    env.EXPECTED_HEAD !== actualHead ||
    impact?.head !== actualHead ||
    impact?.base !== env.DIFF_BASE ||
    impact?.comparisonAvailable !== true ||
    !Array.isArray(impact.changes)
  ) {
    return unavailable("non-PR, identity or ancestry mismatch");
  }

  const sources = [];
  for (const change of impact.changes) {
    if (!["A", "M"].includes(change.status) || change.paths?.length !== 1) {
      return unavailable("delete, rename, type-change or malformed diff");
    }
    const path = change.paths[0];
    if (
      typeof path !== "string" ||
      !path ||
      /[\x00-\x1f\x7f\\]/u.test(path) ||
      path.startsWith("/") ||
      path.split("/").some((part) => !part || part === "." || part === "..") ||
      !(articleSourceCollection(path) || path === articleIndexPath || !classify([path]).core)
    ) {
      return unavailable("shared code, registry, media or unknown input");
    }
    if (
      sourceMode?.(path, actualHead) !== "100644" ||
      (change.status === "M" && sourceMode?.(path, env.DIFF_BASE) !== "100644")
    ) {
      return unavailable("non-regular changed source");
    }
    if (articleSourceCollection(path)) sources.push({ path, status: change.status });
  }
  if (!sources.length) return unavailable("no changed CMS source");
  if (
    sourceMode?.(articleIndexPath, env.DIFF_BASE) !== "100644" ||
    sourceMode?.(articleIndexPath, actualHead) !== "100644"
  ) {
    return unavailable("regular base and head CMS indexes required");
  }
  return { article: true, reason: "CMS source candidate; semantic admission required", sources };
}

export function inspectArticlePrDecision({ cwd = process.cwd(), env = process.env } = {}) {
  const git = (args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  try {
    const actualHead = git(["rev-parse", "--verify", "HEAD^{commit}"]).trim();
    if (git(["status", "--porcelain", "-z", "--untracked-files=normal"])) {
      return { article: false, reason: "uncommitted source", sources: [] };
    }
    const impact = inspectImpact({ cwd, base: env.DIFF_BASE });
    const sourceMode = (path, revision) => {
      const match = /^([0-7]{6}) blob [a-f0-9]{40}\t([^\0]+)\0$/u.exec(
        git(["ls-tree", "-z", revision, "--", path]),
      );
      return match?.[2] === path ? match[1] : null;
    };
    return articlePrDecision({ impact, env, actualHead, sourceMode });
  } catch {
    return { article: false, reason: "source comparison unavailable", sources: [] };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const decision = inspectArticlePrDecision();
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, "article=" + decision.article + "\n");
  }
  console.log(JSON.stringify(decision));
}
