import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import * as ts from "typescript";

interface RuntimeAsset {
  path: string;
  bytes: number;
  gzipBytes: number;
}
/** The full runtime graph is validated first; this subset measures eager module loading. */
export async function measureEditorInitialRuntime<T extends RuntimeAsset>(
  dist: string,
  html: string,
  graph: readonly T[],
): Promise<T[]> {
  const allowed = new Map(graph.map((asset) => [asset.path, asset]));
  const pending: string[] = [];
  function visit(node: DefaultTreeAdapterTypes.Node): void {
    if ("tagName" in node) {
      const attrs = Object.fromEntries(
        node.attrs.map((attribute) => [attribute.name, attribute.value]),
      );
      if (node.tagName === "script" && attrs.src) pending.push(attrs.src);
      if (node.tagName === "link" && attrs.rel === "modulepreload" && attrs.href)
        pending.push(attrs.href);
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  visit(parse(html));
  const measured = new Map<string, T>();
  while (pending.length) {
    const path = pending.shift()!;
    if (measured.has(path)) continue;
    const asset = allowed.get(path);
    if (!asset || !/^\/editor\/assets\/[a-zA-Z0-9_-]+\.m?js$/u.test(path))
      throw Error("EDITOR_INITIAL_ASSET_OUTSIDE_GRAPH: " + path);
    measured.set(path, asset);
    const source = await readFile(join(dist, path.slice(1)), "utf8");
    const module = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    for (const statement of module.statements) {
      if (
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier
      ) {
        if (!ts.isStringLiteral(statement.moduleSpecifier))
          throw Error("EDITOR_INITIAL_IMPORT_NOT_LITERAL");
        const target = new URL(statement.moduleSpecifier.text, "https://editor.invalid" + path);
        if (target.origin !== "https://editor.invalid" || target.search || target.hash)
          throw Error("EDITOR_INITIAL_IMPORT_OUTSIDE_ROUTE");
        pending.push(target.pathname);
      }
    }
  }
  return [...measured.values()].sort((left, right) => left.path.localeCompare(right.path));
}
