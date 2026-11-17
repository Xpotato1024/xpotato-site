import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  publicationFixtureMode,
  publicationFixtureUpdateKinds,
} from "../qa/publication-fixture-isolation.ts";

test("publication preparation is full unless the one explicit bounded mode is selected", () => {
  for (const args of [[], ["--prepare"]]) {
    const mode = publicationFixtureMode(args);
    assert.equal(mode, "prepare");
    assert.deepEqual(publicationFixtureUpdateKinds(mode), [
      "body",
      "title",
      "hero",
      "category",
      "tags",
    ]);
  }
  assert.equal(publicationFixtureMode(["--prepare-isolation-only"]), "prepare-isolation-only");
  assert.deepEqual(publicationFixtureUpdateKinds("prepare-isolation-only"), []);
  assert.equal(publicationFixtureMode(["--check"]), "check");
  assert.throws(() => publicationFixtureUpdateKinds("check"), /cannot prepare/);
});

test("unknown, conflicting, repeated and environment-style selectors cannot weaken preparation", () => {
  for (const args of [
    ["--fast"],
    ["--prepare-isolation"],
    ["--prepare-isolation-only=true"],
    ["--prepare", "--prepare-isolation-only"],
    ["--check", "--prepare-isolation-only"],
    ["--prepare-isolation-only", "--prepare-isolation-only"],
    ["--prepare", "extra"],
  ])
    assert.throws(() => publicationFixtureMode(args), /Expected --prepare/);
});

test("bounded preparation rejoins all base lifecycle assertions and writes the same leak-check receipt", async () => {
  const source = await readFile(
    new URL("../qa/article-publication-isolation.ts", import.meta.url),
    "utf8",
  );
  // This wiring check runs before npm ci; the lifecycle itself is exercised by its independent job.
  const prepare = /async\s+function\s+prepare\s*\(/u.exec(source);
  const loop = /for\s*\(\s*const\s+kind\s+of\s+publicationFixtureUpdateKinds\(mode\)\s*\)/u.exec(
    source,
  );
  const context = /const\s+context\s*=\s*await\s+publicationCandidate/u.exec(source);
  assert.ok(prepare && loop && context && prepare.index < loop.index && loop.index < context.index);
  const before = source.slice(prepare.index, loop.index);
  const after = source.slice(context.index);
  for (const name of [
    "buildArticleCandidate",
    "approveMockCandidate",
    "persistMockMedia",
    "exportMockCandidate",
    "renderMockExportAfterJobRemoval",
    "readMockExportData",
  ]) {
    assert.match(before, new RegExp(name + "\\s*\\("), name);
  }
  assert.match(before, /assert\.rejects\s*\(/u);
  assert.match(before, /persistMockMedia\([\s\S]*?["']protected["']/u);
  assert.match(after, /validateMockReceipts\s*\(/u);
  assert.match(after, /assert\.equal\(\s*head\.state,\s*["']EXPORTED["']/u);
  assert.match(after, /article-publication-isolation\/receipt\.json/u);
  assert.match(after, /preparation:\s*mode/u);
  assert.doesNotMatch(before, /\breturn\s*;|process\.exit\s*\(/u);
  assert.doesNotMatch(source, /process\.env\.[A-Z_]*(?:FAST|SKIP|ISOLATION_ONLY)/u);
});
