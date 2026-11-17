import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, appendFile } from "node:fs/promises";
import { parseDraft, assertEditablePath } from "@xpotato/editor-core/draft";
const run = promisify(execFile),
  event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH!, "utf8"));
const base = event.pull_request?.base?.sha,
  head = event.pull_request?.head?.sha;
if (!/^[a-f0-9]{40}$/u.test(base) || !/^[a-f0-9]{40}$/u.test(head))
  throw Error("REVIEW_PR_REVISION_REQUIRED");
const actual = (await run("git", ["rev-parse", "HEAD"])).stdout.trim();
if (actual !== head) throw Error("REVIEW_CHECKOUT_MISMATCH");
await run("git", ["fetch", "--no-tags", "--depth=1", "origin", base], { timeout: 30000 });
const paths = (
  await run("git", ["diff", "--name-only", "--diff-filter=AM", "-z", base, head])
).stdout
  .split("\0")
  .filter(Boolean)
  .filter((p) => /^content\/(articles|notes|projects|tools|pages)\/[^/]+\.mdx?$/u.test(p));
if (paths.length > 8)
  throw Error("REVIEW_BATCH_LIMIT: split changes into at most eight articles per PR");
const entries = [];
for (const file of paths) {
  assertEditablePath(file);
  const source = (await run("git", ["show", head + ":" + file])).stdout;
  const parsed = parseDraft(source);
  entries.push({ path: file, contentId: parsed.data.id, commit: head });
}
await appendFile(
  process.env.GITHUB_OUTPUT!,
  "matrix=" + JSON.stringify({ include: entries }) + "\ncount=" + entries.length + "\n",
);
console.log(
  JSON.stringify({ sourceCommit: head, articles: entries.length, containsPrivateMedia: false }),
);
