import { parse, type DefaultTreeAdapterTypes as Tree } from "parse5";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import * as ts from "typescript";
import { sha256 } from "@xpotato/content-contracts/canonical";

export const contactIssuesPath = "/scripts/contact-issues.js";
export const contactIssuesBudget = { raw: 2000, gzip: 900 } as const;
const attr = (n: Tree.Element, key: string) => n.attrs.find(a => a.name === key)?.value;
export function inspectContactIssuesMarkup(html: string, route: string) {
  const nodes: Tree.Element[] = []; let duplicate = false;
  const visit = (n: Tree.Node) => { if ("tagName" in n) nodes.push(n); if ("childNodes" in n) n.childNodes.forEach(visit); };
  visit(parse(html, { sourceCodeLocationInfo: true, onParseError: e => { if (e.code === "duplicate-attribute") duplicate = true; } }));
  const scripts = nodes.filter(n => n.tagName === "script" && attr(n, "src") === contactIssuesPath);
  const roots = nodes.filter(n => attr(n, "data-contact-issues") !== undefined);
  if (!scripts.length && !roots.length) return { htmlWithoutContactIssues: html, script: false };
  const script = scripts[0], position = script?.sourceCodeLocation;
  if (duplicate || !["/contact/", "/contact/index.html", "contact/index.html"].includes(route) || roots.length !== 1 || scripts.length !== 1 || !script || !position
    || script.attrs.length !== 2 || attr(script, "type") !== "module" || script.childNodes.length
    || !nodes.some(n => n.tagName === "select" && attr(n, "id") === "issue-target")
    || !nodes.some(n => n.tagName === "details" && attr(n, "data-issue-fallback") !== undefined)) throw Error("Contact picker requires its one contact-only local module and static fallback");
  return { htmlWithoutContactIssues: html.slice(0, position.startOffset) + html.slice(position.endOffset), script: true };
}
export function validateContactIssuesSource(sourceText: string) {
  if (!sourceText.length || Buffer.byteLength(sourceText) > contactIssuesBudget.raw || gzipSync(sourceText).length > contactIssuesBudget.gzip) throw Error("Contact picker exceeds its isolated budget");
  const source = ts.createSourceFile(contactIssuesPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const inspect = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isImportEqualsDeclaration(n) || ts.isExportDeclaration(n)
      || (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && ["Function", "Worker", "SharedWorker", "WebSocket", "XMLHttpRequest"].includes(n.expression.text))
      || (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && ["require", "eval", "Function", "fetch", "importScripts"].includes(n.expression.text)) || (ts.isPropertyAccessExpression(n.expression) && ["fetch", "sendBeacon", "open"].includes(n.expression.name.text))))
      || (ts.isIdentifier(n) && ["location", "localStorage", "sessionStorage", "indexedDB"].includes(n.text))) throw Error("Contact picker dependencies, network, navigation, storage and dynamic code are forbidden");
    ts.forEachChild(n, inspect);
  }; inspect(source);
}
export async function measureContactIssuesRuntime(dist: string, html: string, route: string) {
  const markup = inspectContactIssuesMarkup(html, route);
  if (!markup.script) return { ...markup, contactIssuesAssets: [] };
  const bytes = await readFile(join(dist, contactIssuesPath.slice(1)));
  const source = await readFile(new URL("../../../../apps/site/public/scripts/contact-issues.js", import.meta.url));
  if (!bytes.equals(source)) throw Error("Contact picker differs from reviewed source");
  validateContactIssuesSource(bytes.toString("utf8"));
  return { ...markup, contactIssuesAssets: [{ path: contactIssuesPath, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: sha256(bytes) }] };
}
