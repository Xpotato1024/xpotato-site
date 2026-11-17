import ts from "typescript";
import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";

it("disables Zod compilation before importing any browser schemas", async () => {
  const main = ts.createSourceFile(
    "main.tsx",
    await readFile("apps/editor/src/main.tsx", "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imports = main.statements.filter(ts.isImportDeclaration);
  expect(imports[0]?.moduleSpecifier.getText(main).slice(1, -1)).toBe("./csp-bootstrap.js");
  const setup = ts.createSourceFile(
    "bootstrap.ts",
    await readFile("apps/editor/src/csp-bootstrap.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  expect(setup.statements.filter(ts.isImportDeclaration)).toEqual([]);
  const jitless: boolean[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(setup) === "jitless") {
      jitless.push(node.initializer.kind === ts.SyntaxKind.TrueKeyword);
    }
    ts.forEachChild(node, visit);
  };
  visit(setup);
  expect(jitless).toEqual([true]);
});
it("allows only origin retention for private Blob resources, never script execution", async () => {
  const source = await readFile("apps/editor/src/components/AstroReview.tsx", "utf8");
  expect(source).toContain('sandbox="allow-same-origin"');
  expect(source).not.toContain("allow-scripts");
  const preview = await readFile("apps/editor/src/data/astro-review.ts", "utf8");
  expect(preview).toContain("default-src 'none'");
  expect(preview).not.toMatch(/unsafe-eval|unsafe-inline/u);
});
