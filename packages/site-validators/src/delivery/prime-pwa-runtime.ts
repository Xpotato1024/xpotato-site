import * as ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export const primePwaPath = '/scripts/prime-pwa.js';
export const primePwaRoute = '/tools/prime-factorizer/';
export const primePwaBudget = {raw:6500,gzip:3000} as const;
export function inspectPrimePwaMarkup(html:string,path:string) {
  const matches=[...html.matchAll(/<script\b[^>]*src=["']\/scripts\/prime-pwa\.js["'][^>]*>[\s\S]*?<\/script>/gu)];
  const present=html.includes('data-prime-offline');
  if(!matches.length&&!present)return {htmlWithoutPrimePwa:html,script:false};
  if(path.replace(/^\//u,'').replace(/index\.html$/u,'')!==primePwaRoute.slice(1)
    ||matches.length!==1||!present||!/^<script src="\/scripts\/prime-pwa\.js" defer><\/script>$/u.test(matches[0]![0]))throw Error('Prime offline shell must be exact and route-local');
  return {htmlWithoutPrimePwa:html.replace(matches[0]![0],''),script:true};
}
export function validatePrimePwaSource(source:string) {
  if(!source.startsWith('// xpotato-prime-offline-v1:')||Buffer.byteLength(source)>primePwaBudget.raw)throw Error('Prime shell source/budget invalid');
  const tree=ts.createSourceFile(primePwaPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const forbidden=new Set(['fetch','XMLHttpRequest','WebSocket','EventSource','sendBeacon','localStorage','sessionStorage','indexedDB','eval','Function','require']);
  const visit=(node:ts.Node):void=>{
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)||ts.isImportEqualsDeclaration(node)
      ||ts.isIdentifier(node)&&forbidden.has(node.text)
      ||ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword
      ||ts.isPropertyAccessExpression(node)&&['value','innerHTML','outerHTML'].includes(node.name.text))throw Error('Prime shell must not read inputs, persist user data, or fetch');
    ts.forEachChild(node,visit);
  };visit(tree);
}
export async function measurePrimePwaRuntime(dist:string,html:string,route:string) {
  const inspected=inspectPrimePwaMarkup(html,route);
  if(!inspected.script)return {...inspected,primePwaAssets:[]};
  const bytes=await readFile(join(dist,primePwaPath.slice(1)));validatePrimePwaSource(bytes.toString('utf8'));
  const gzipBytes=gzipSync(bytes).length;if(gzipBytes>primePwaBudget.gzip)throw Error('Prime shell compressed budget');
  return {...inspected,primePwaAssets:[{path:primePwaPath,bytes:bytes.length,gzipBytes,sha256:createHash('sha256').update(bytes).digest('hex')}]};
}
