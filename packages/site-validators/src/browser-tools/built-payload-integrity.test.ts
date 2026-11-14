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
