import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const body = workflow.split("  result:\n")[1].split("        run: |\n")[1];
const script = body.replace(/^ {10}/gm, "");
const fullKeys = [
  "ARTICLE_REGRESSION_RESULT",
  "SOURCE_RESULT",
  "FIXTURES_RESULT",
  "COMMON_TOOL_RESULT",
  "PRODUCER_RESULT",
  "CONSUMER_RESULT",
];
const full = {
  SCOPE_RESULT: "success",
  POLICY_RESULT: "success",
  CORE: "true",
  ARTICLE: "false",
  ARTICLE_RESULT: "skipped",
  ARTICLE_ELIGIBLE: "",
  ...Object.fromEntries(fullKeys.map((key) => [key, "success"])),
};
const draft = {
  ...full,
  ARTICLE: "true",
  ARTICLE_RESULT: "success",
  ARTICLE_ELIGIBLE: "true",
  ...Object.fromEntries(fullKeys.map((key) => [key, "skipped"])),
};
const fallback = { ...full, ARTICLE: "true", ARTICLE_RESULT: "success", ARTICLE_ELIGIBLE: "false" };
const prose = {
  ...draft,
  CORE: "false",
  ARTICLE: "false",
  ARTICLE_RESULT: "skipped",
  ARTICLE_ELIGIBLE: "",
  REASON: "NOT_APPLICABLE: prose-only",
};

// The actual stable-result body is a Linux Bash contract, not a Windows command.
const linuxOnly = { skip: process.platform === "win32" ? "Hosted Ubuntu Bash gate" : false };
function run(env) {
  const temp = mkdtempSync(join(tmpdir(), "ci-result-"));
  try {
    return spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, ...env, GITHUB_STEP_SUMMARY: join(temp, "summary.md") },
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test(
  "stable result accepts only complete prose, draft, full and semantic fallback paths",
  linuxOnly,
  () => {
    for (const env of [prose, draft, full, fallback]) {
      const result = run(env);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  },
);

test(
  "a failed, cancelled or skipped mandatory check cannot become a successful PR",
  linuxOnly,
  () => {
    for (const [env, keys] of [
      [full, ["SCOPE_RESULT", "POLICY_RESULT", ...fullKeys]],
      [fallback, ["SCOPE_RESULT", "POLICY_RESULT", "ARTICLE_RESULT", ...fullKeys]],
      [draft, ["SCOPE_RESULT", "POLICY_RESULT", "ARTICLE_RESULT"]],
    ]) {
      for (const key of keys) {
        for (const value of ["failure", "cancelled", "skipped", ""]) {
          const result = run({ ...env, [key]: value });
          assert.equal(result.status, 1, `${key}=${value}: ${result.stdout + result.stderr}`);
        }
      }
    }
  },
);

test(
  "missing eligibility, an unexpected full job or a forged lightweight selection fails",
  linuxOnly,
  () => {
    const invalid = [
      { ...full, CORE: "" },
      { ...full, ARTICLE: "" },
      { ...full, ARTICLE_ELIGIBLE: "true" },
      { ...full, ARTICLE_RESULT: "success" },
      { ...draft, ARTICLE_ELIGIBLE: "" },
      { ...fallback, ARTICLE_ELIGIBLE: "" },
      { ...draft, ARTICLE_ELIGIBLE: "false" },
      ...fullKeys.map((key) => ({ ...draft, [key]: "success" })),
      ...fullKeys.map((key) => ({ ...prose, [key]: "success" })),
    ];
    for (const env of invalid) assert.equal(run(env).status, 1, JSON.stringify(env));
  },
);
