import ts from "typescript";
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
  const ast = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true);
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const prepare = nodes.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "prepare",
  );
  assert.ok(prepare?.body);
  const loop = nodes.find(
    (node) =>
      ts.isForOfStatement(node) &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.getText(ast) === "publicationFixtureUpdateKinds",
  );
  assert.ok(loop && loop.getStart(ast) > prepare.getStart(ast));
  const callName = (node) => (ts.isCallExpression(node) ? node.expression.getText(ast) : undefined);
  const before = nodes.filter(
    (node) => node.getStart(ast) >= prepare.body.getStart(ast) && node.end <= loop.getStart(ast),
  );
  const after = nodes.filter((node) => node.getStart(ast) >= loop.end && node.end <= prepare.end);
  for (const name of [
    "buildArticleCandidate",
    "approveMockCandidate",
    "persistMockMedia",
    "exportMockCandidate",
    "renderMockExportAfterJobRemoval",
    "assert.rejects",
    "readMockExportData",
  ]) {
    assert.ok(
      before.some((node) => callName(node) === name),
      name,
    );
  }
  assert.ok(
    before.some(
      (node) =>
        callName(node) === "persistMockMedia" &&
        node.arguments.some((arg) => ts.isStringLiteral(arg) && arg.text === "protected"),
    ),
  );
  assert.ok(after.some((node) => callName(node) === "validateMockReceipts"));
  assert.ok(
    after.some(
      (node) =>
        callName(node) === "assert.equal" &&
        node.arguments[0]?.getText(ast) === "head.state" &&
        node.arguments[1]?.text === "EXPORTED",
    ),
  );
  assert.ok(
    after.some(
      (node) =>
        ts.isStringLiteral(node) &&
        node.text.includes("article-publication-isolation/receipt.json"),
    ),
  );
  assert.ok(
    after.some(
      (node) =>
        ts.isPropertyAssignment(node) &&
        node.name.getText(ast) === "preparation" &&
        node.initializer.getText(ast) === "mode",
    ),
  );
  const inPrepare = (node) => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isFunctionLike(parent)) return parent === prepare;
    }
    return false;
  };
  assert.ok(!before.some((node) => ts.isReturnStatement(node) && inPrepare(node)));
  assert.ok(!before.some((node) => callName(node) === "process.exit"));
  assert.doesNotMatch(source, /process\.env\.[A-Z_]*(?:FAST|SKIP|ISOLATION_ONLY)/u);
});
