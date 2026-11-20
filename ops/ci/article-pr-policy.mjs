import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { inspectImpact } from "./ci-impact.mjs";
import { classify } from "./ci-scope.mjs";

const shaPattern = /^[a-f0-9]{40}$/u;
const prRefPattern = /^refs\/pull\/[1-9][0-9]*\/merge$/u;
const articlePattern = /^content\/articles\/[^/]+\.mdx?$/u;
const indexPath = "content/registry/editor-content-index.json";
const repository = "Xpotato1024/xpotato-site";
const indexFields = new Set(["contentId", "path", "title", "collection", "draft", "education"]);

function indexRecords(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "documents,schemaVersion" ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.documents)
  )
    return null;
  const entries = new Map(),
    ids = new Set();
  for (const row of value.documents) {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      Object.keys(row).some((field) => !indexFields.has(field)) ||
      typeof row.path !== "string" ||
      typeof row.contentId !== "string" ||
      typeof row.title !== "string" ||
      typeof row.collection !== "string" ||
      (row.draft !== undefined && typeof row.draft !== "boolean") ||
      (row.education !== undefined && typeof row.education !== "boolean") ||
      entries.has(row.path) ||
      ids.has(row.contentId)
    )
      return null;
    entries.set(row.path, row);
    ids.add(row.contentId);
  }
  return entries;
}

/**
 * The CMS updates a content index in the SAME commit as the draft document.
 * Admit that index only if it preserves every unrelated record byte-for-byte
 * at the JSON-record level. Other registry changes must use the full CI.
 */
export function indexChangeIsScoped(before, after, articlePaths) {
  const oldRecords = indexRecords(before),
    newRecords = indexRecords(after);
  if (!oldRecords || !newRecords || newRecords.size < oldRecords.size) return false;
  for (const [path, row] of oldRecords) {
    const current = newRecords.get(path);
    if (!current || current.contentId !== row.contentId) return false;
    if (!articlePaths.has(path) && JSON.stringify(current) !== JSON.stringify(row)) return false;
  }
  for (const [path, row] of newRecords) {
    if (!oldRecords.has(path) && (!articlePaths.has(path) || row.collection !== "blog"))
      return false;
  }
  for (const path of articlePaths) {
    if (!newRecords.has(path) || newRecords.get(path).collection !== "blog") return false;
  }
  return true;
}

export function articlePrDecision({
  impact,
  env,
  actualHead,
  sourceMode,
  indexBefore = null,
  indexAfter = null,
} = {}) {
  const unavailable = (reason) => ({ article: false, reason });
  if (
    env?.GITHUB_EVENT_NAME !== "pull_request" ||
    env?.GITHUB_REPOSITORY !== repository ||
    !prRefPattern.test(env?.GITHUB_REF ?? "") ||
    !shaPattern.test(env?.EXPECTED_HEAD ?? "") ||
    !shaPattern.test(env?.DIFF_BASE ?? "") ||
    !shaPattern.test(actualHead ?? "") ||
    env.EXPECTED_HEAD !== actualHead ||
    impact?.head !== actualHead ||
    impact?.base !== env.DIFF_BASE ||
    impact?.comparisonAvailable !== true ||
    !Array.isArray(impact.changes)
  )
    return unavailable("non-PR, identity or ancestry mismatch");

  const paths = [];
  for (const change of impact.changes) {
    if (!["A", "M"].includes(change.status) || change.paths?.length !== 1)
      return unavailable("delete, rename, type-change or malformed diff");
    const path = change.paths[0];
    if (
      typeof path !== "string" ||
      !path ||
      /[\x00-\x1f\x7f\\]/u.test(path) ||
      path.startsWith("/") ||
      path.split("/").some((part) => !part || part === "." || part === "..") ||
      !(articlePattern.test(path) || path === indexPath || !classify([path]).core)
    )
      return unavailable("shared code, registry, media or unknown input");
    if (sourceMode?.(path) !== "100644") return unavailable("non-regular changed source");
    paths.push(path);
  }
  const articles = new Set(paths.filter((path) => articlePattern.test(path)));
  if (!articles.size) return unavailable("no changed blog article");
  if (paths.includes(indexPath) && !indexChangeIsScoped(indexBefore, indexAfter, articles))
    return unavailable("editor content index changes unrelated records");
  return { article: true, reason: "article-only PR with scoped CMS index; full main CI required" };
}

export function inspectArticlePrDecision({ cwd = process.cwd(), env = process.env } = {}) {
  let actualHead;
  try {
    actualHead = execFileSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], {
      cwd,
      encoding: "utf8",
    }).trim();
  } catch {
    return { article: false, reason: "unavailable HEAD" };
  }
  const impact = inspectImpact({ cwd, base: env.DIFF_BASE });
  const git = (args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  const sourceMode = (path) => {
    try {
      const match = /^([0-7]{6}) blob [a-f0-9]{40}\t([^\n]+)\n?$/u.exec(
        git(["ls-tree", "HEAD", "--", path]),
      );
      return match?.[2] === path ? match[1] : null;
    } catch {
      return null;
    }
  };
  let indexBefore = null,
    indexAfter = null;
  if (impact.changes?.some((change) => change.paths?.includes(indexPath))) {
    try {
      indexBefore = JSON.parse(git(["show", env.DIFF_BASE + ":" + indexPath]));
      indexAfter = JSON.parse(git(["show", "HEAD:" + indexPath]));
    } catch {
      return { article: false, reason: "editor index comparison unavailable" };
    }
  }
  return articlePrDecision({
    impact,
    env,
    actualHead,
    sourceMode,
    indexBefore,
    indexAfter,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const decision = inspectArticlePrDecision();
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, "article=" + decision.article + "\n");
  console.log(JSON.stringify(decision));
}
