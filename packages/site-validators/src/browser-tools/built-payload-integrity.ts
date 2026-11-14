import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import ts from 'typescript';
import {sha256} from '@xpotato/content-contracts/canonical';
import {permitsHistoricalWorker} from './historical-runtime.js';
import {measureRouteRuntime} from '../migration/phase8-runtime.js';

// Validate inert string data, never execute a vendored module or an algorithm.
// Generated variable names/escaping may change, but embedded Worker bytes may not.
export function stringLiteralHashes(source:string, workersOnly=false) {
 const ast=ts.createSourceFile('payload.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 assert.equal((ast as unknown as {parseDiagnostics:unknown[]}).parseDiagnostics.length,0,'Payload module must parse');
 const hashes=new Set<string>();
 const visit=(node:ts.Node):void=>{
  if(workersOnly){
   if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&/^(?:.*WORKER_SOURCE|STAGED_SOURCE)$/u.test(node.name.text)){
    assert.ok(node.initializer&&ts.isStringLiteralLike(node.initializer),'Reviewed Worker must be a fixed literal');
    hashes.add(sha256(node.initializer.text));
   }
  }else if(ts.isStringLiteralLike(node)) hashes.add(sha256(node.text));
  ts.forEachChild(node,visit);
 };
 visit(ast);return hashes;
}
export function assertPayloadHashes(expected:Iterable<string>,actual:ReadonlySet<string>){
 for(const hash of expected) assert.ok(actual.has(hash),'Host bundle changed or dropped reviewed Worker payload: '+hash);
}
export async function checkBuiltPayloadIntegrity({dist,route,html,artifactRoot,modules,artifactSha256}:{dist:string;route:string;html:string;artifactRoot:string;modules:readonly string[];artifactSha256:string}){
 if(!modules.length)return [];
 const expected=[];
 for(const module of modules){
  assert.ok(/^[a-zA-Z0-9_./-]+\.m?js$/u.test(module)&&!module.split('/').includes('..')&&!module.startsWith('/'),'Safe embedded module');
  const source=await readFile(join(artifactRoot,module),'utf8');
  // Existing exact historical rollback exception only. Those old releases did
  // not promise literal payload preservation; do not silently broaden it.
  if(permitsHistoricalWorker(artifactSha256,artifactSha256,module,'ECM_WORKER_SOURCE',sha256(source))){
   expected.push({module,sha256:[],historicalComposed:true});continue;
  }
  const hashes=stringLiteralHashes(source,true);
  assert.ok(hashes.size,'Declared embedded Worker module must contain a fixed payload');
  expected.push({module,sha256:[...hashes]});
 }
 const graph=await measureRouteRuntime(dist,route,html),actual=new Set<string>();
 for(const asset of graph.assets){
  for(const hash of stringLiteralHashes(await readFile(join(dist,asset.path.slice(1)),'utf8')))actual.add(hash);
 }
 assertPayloadHashes(expected.flatMap(record=>record.sha256),actual);
 return expected;
}
