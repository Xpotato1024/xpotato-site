import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { inspectImpact } from "./ci-impact.mjs";

const shaPattern = /^[a-f0-9]{40}$/u;
const prRefPattern = /^refs\/pull\/[1-9][0-9]*\/merge$/u;
const repository = "Xpotato1024/xpotato-site";

export function articlePrDecision({ impact, env, actualHead, sourceMode } = {}) {
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
    impact?.comparisonAvailable !== true
  )
    return unavailable("non-PR, identity or ancestry mismatch");
  if (impact.candidate !== "article-impact-candidate" || impact.reasons.length)
    return unavailable("not an article-only A/M change");
  if (!impact.affectedArticleSources.length) return unavailable("no changed article");
  for (const path of impact.affectedArticleSources) {
    // Reject symlinks and executable files, including new A entries.
    if (sourceMode(path) !== "100644") return unavailable("non-regular article source");
  }
  return { article: true, reason: "article-only PR; full main CI still required" };
}

export function inspectArticlePrDecision({ cwd = process.cwd(), env = process.env } = {}) {
  let actualHead = null;
  try {
    actualHead = execFileSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], {
      cwd,
      encoding: "utf8",
    }).trim();
  } catch {
    return { article: false, reason: "unavailable HEAD" };
  }
  const impact = inspectImpact({ cwd, base: env.DIFF_BASE });
  const sourceMode = (path) => {
    try {
      const rows = execFileSync("git", ["ls-tree", "HEAD", "--", path], {
        cwd,
        encoding: "utf8",
      });
      const match = /^([0-7]{6}) blob [a-f0-9]{40}\t([^\n]+)\n?$/u.exec(rows);
      return match?.[2] === path ? match[1] : null;
    } catch {
      return null;
    }
  };
  return articlePrDecision({ impact, env, actualHead, sourceMode });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const decision = inspectArticlePrDecision();
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, "article=" + decision.article + "\n");
  console.log(JSON.stringify(decision));
}
