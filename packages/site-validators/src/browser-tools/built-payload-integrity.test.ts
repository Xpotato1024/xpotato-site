import {describe,it,expect} from 'vitest';
import {stringLiteralHashes,assertPayloadHashes} from './built-payload-integrity.js';
describe('host bundling preserves reviewed embedded bytes without executing algorithms',()=>{
 it('accepts renamed bindings and equivalent JS escapes',()=>{
  const expected=stringLiteralHashes('export const ECM_WORKER_SOURCE="line\\ncode";',true);
  expect(()=>assertPayloadHashes(expected,stringLiteralHashes('const a=`line\ncode`;'))).not.toThrow();
 });
 it('rejects changed/dropped payloads and comment-only lookalikes',()=>{
  const expected=stringLiteralHashes('const WORKER_SOURCE="fixed";',true);
  for(const source of ['const a="changed";','// "fixed"','const a="fi"+"xed";']){
   expect(()=>assertPayloadHashes(expected,stringLiteralHashes(source))).toThrow(/changed or dropped/);
  }
 });
 it('does not execute modules and rejects composed or syntactically invalid sources',()=>{
  expect(stringLiteralHashes('throw Error("must not run"); const WORKER_SOURCE="fixed";',true).size).toBe(1);
  expect(()=>stringLiteralHashes('const WORKER_SOURCE=makeSource();',true)).toThrow(/fixed literal/);
  expect(()=>stringLiteralHashes('const = ;')).toThrow(/must parse/);
 });
});

// The previous rollback exception stays exact; it is not a generic bypass for
// future composed payloads, other artifacts, paths, or changed module bytes.
import {permitsHistoricalWorker} from './historical-runtime.js';
it('historical composed Worker allowance rejects every changed binding',()=>{
 const artifact='3bc767d94141cf362f184c41f0a55215f5f38ba17aa723a61101ecd6a639d90c';
 const moduleHash='6a734a1b0c573394a61df8da57ac199b86a6344680cd642839b561d5e71d1e67';
 expect(permitsHistoricalWorker(artifact,artifact,'src/routing/ecm-source.mjs','ECM_WORKER_SOURCE',moduleHash)).toBe(true);
 for(const args of [
  ['0'.repeat(64),artifact,'src/routing/ecm-source.mjs','ECM_WORKER_SOURCE',moduleHash],
  [artifact,'0'.repeat(64),'src/routing/ecm-source.mjs','ECM_WORKER_SOURCE',moduleHash],
  [artifact,artifact,'other.mjs','ECM_WORKER_SOURCE',moduleHash],
  [artifact,artifact,'src/routing/ecm-source.mjs','OTHER_WORKER_SOURCE',moduleHash],
  [artifact,artifact,'src/routing/ecm-source.mjs','ECM_WORKER_SOURCE','0'.repeat(64)],
 ] as [string,string,string,string,string][]){expect(permitsHistoricalWorker(...args)).toBe(false);}
});
