import { parse, type DefaultTreeAdapterTypes as Tree } from 'parse5';
import { readFile, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as ts from 'typescript';
import { sha256 } from '@xpotato/content-contracts/canonical';

export const homeHeaderPath = '/scripts/home-header.js' as const;
export const homeHeaderBudget = { raw: 2048, gzip: 1024 } as const;
export function inspectHomeHeaderMarkup(html: string, route: string) {
  const nodes: Tree.Element[] = []; let duplicate = false;
  const visit = (node: Tree.Node) => { if ('tagName' in node) nodes.push(node); if ('childNodes' in node) node.childNodes.forEach(visit); };
  visit(parse(html, { sourceCodeLocationInfo: true, onParseError: error => { if (error.code === 'duplicate-attribute') duplicate = true; } }));
  const attr = (node: Tree.Element, key: string) => node.attrs.find(a => a.name === key)?.value;
  const hasClass = (node: Tree.Element, name: string) => (attr(node, 'class') ?? '').split(/\s+/u).includes(name);
  const scripts = nodes.filter(node => node.tagName === 'script' && /home-header/u.test(attr(node, 'src') ?? ''));
  const roots = nodes.filter(node => hasClass(node, 'home-header-layout'));
  if (!scripts.length && !roots.length) return { htmlWithoutHomeHeader: html, script: undefined };
  const root = roots[0], script = scripts[0], location = script?.sourceCodeLocation;
  const bands = nodes.filter(node => hasClass(node, 'header-band') && node.parentNode === root && node.childNodes.some(child => 'tagName' in child && child.tagName === 'header' && hasClass(child, 'site-header')));
  if (duplicate || !['/', 'index.html', '/index.html'].includes(route) || roots.length !== 1 || root?.tagName !== 'body' || bands.length !== 1
    || scripts.length !== 1 || !script || !location || attr(script, 'src') !== homeHeaderPath || attr(script, 'defer') === undefined || script.attrs.length !== 2 || script.childNodes.length) {
    throw Error('Home header requires one homepage body/header and its single deferred classic script');
  }
  return { htmlWithoutHomeHeader: html.slice(0, location.startOffset) + html.slice(location.endOffset), script: homeHeaderPath };
}
export function validateHomeHeaderSource(sourceText: string) {
  if (!sourceText.includes('.home-header-layout .header-band') || Buffer.byteLength(sourceText) > homeHeaderBudget.raw || gzipSync(sourceText).length > homeHeaderBudget.gzip) throw Error('Home header source exceeds its isolated budget or is missing');
  const source = ts.createSourceFile('home-header.js', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const forbidden = new Set(['fetch', 'sendBeacon', 'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker', 'importScripts', 'require', 'eval', 'Function', 'localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'location', 'open', 'innerHTML', 'outerHTML', 'write', 'createElement']);
  const inspect = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) || (ts.isExportDeclaration(node) && node.moduleSpecifier)
      || (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
      || ((ts.isIdentifier(node) || ts.isStringLiteral(node)) && forbidden.has(node.text))) throw Error('Home header dependencies, network, navigation, storage and dynamic code are forbidden');
    ts.forEachChild(node, inspect);
  };
  inspect(source);
}
export async function measureHomeHeaderRuntime(dist: string, html: string, route: string) {
  const markup = inspectHomeHeaderMarkup(html, route);
  if (!markup.script) return { ...markup, homeHeaderAssets: [] };
  const root = await realpath(dist), path = await realpath(join(root, markup.script.slice(1)));
  if (!path.startsWith(root + sep)) throw Error('Home header runtime escaped dist');
  const bytes = await readFile(path); validateHomeHeaderSource(bytes.toString('utf8'));
  return { ...markup, homeHeaderAssets: [{ path: markup.script, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: sha256(bytes) }] };
}
