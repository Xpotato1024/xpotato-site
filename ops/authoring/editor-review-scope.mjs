import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const run = promisify(execFile);
const shaPattern = /^[a-f0-9]{40}$/u;
const candidatePath = /^content\/(articles|notes|projects|tools|pages)\/[^/]+\.mdx?$/u;
const editablePath = /^content\/(articles|notes|projects|tools|pages)\/[a-z0-9][a-z0-9_-]*\.mdx?$/u;

export function selectEditorReviewEntries(diff, commit) {
  if (typeof commit !== "string" || !shaPattern.test(commit) || /^0+$/u.test(commit)) {
    throw Error("REVIEW_PR_REVISION_REQUIRED");
  }
  if (typeof diff !== "string" || (diff && !diff.endsWith("\0"))) {
    throw Error("REVIEW_DIFF_INVALID");
  }
  const paths = diff ? diff.slice(0, -1).split("\0") : [];
  if (paths.some((path) => !path || /[\x00-\x1f\x7f\\]/u.test(path))) {
    throw Error("REVIEW_DIFF_INVALID");
  }
  const selected = paths.filter((path) => candidatePath.test(path));
  if (selected.some((path) => !editablePath.test(path))) {
    throw Error("CONTENT_PATH_NOT_ALLOWED");
  }
  if (new Set(selected).size !== selected.length) {
    throw Error("REVIEW_DIFF_INVALID");
  }
  if (selected.length > 8) {
    throw Error("REVIEW_BATCH_LIMIT: split changes into at most eight articles per PR");
  }
  // ContentId and MDX are validated by the renderer before its artifact name is
  // emitted. Selecting paths does not need the renderer's installed dependencies.
  return selected.map((path) => ({ path, commit }));
}

export async function inspectEditorReviewScope({ event, cwd = process.cwd() }) {
  const base = event?.pull_request?.base?.sha;
  const head = event?.pull_request?.head?.sha;
  if (
    typeof base !== "string" ||
    typeof head !== "string" ||
    !shaPattern.test(base) ||
    !shaPattern.test(head) ||
    /^0+$/u.test(base) ||
    /^0+$/u.test(head)
  ) {
    throw Error("REVIEW_PR_REVISION_REQUIRED");
  }
  const git = async (args) =>
    (await run("git", args, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 })).stdout;
  const actual = (await git(["rev-parse", "HEAD"])).trim();
  if (actual !== head) {
    throw Error("REVIEW_CHECKOUT_MISMATCH");
  }
  await git(["fetch", "--no-tags", "--depth=1", "origin", base]);
  const diff = await git(["diff", "--name-only", "--diff-filter=AM", "-z", base, head]);
  return { head, entries: selectEditorReviewEntries(diff, head) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const { head, entries } = await inspectEditorReviewScope({ event });
  await appendFile(
    process.env.GITHUB_OUTPUT,
    "matrix=" + JSON.stringify({ include: entries }) + "\ncount=" + entries.length + "\n",
  );
  console.log(
    JSON.stringify({ sourceCommit: head, articles: entries.length, containsPrivateMedia: false }),
  );
}
