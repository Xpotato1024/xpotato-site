// The published 0.1.0 runtime artifact is immutable. Its missing musl notice is
// an explicit, separately reviewed supplement from that exact source tree.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync} from 'node:fs';
import {join,resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
const sourceCommit='d1c0e57bcb01873d892d00fc94057376dcf5f76c';
const sourceTreeSha256='5565729324c032cdc144bf3c53c643f18c7dfe6c70b615d6c3fd763509040b9a';
export function verifyPrimeLicenseSupplement(root,identity){
 assert.equal(identity.sourceCommit,sourceCommit);assert.equal(identity.sourceTreeSha256,sourceTreeSha256);
 const base=join(root,'vendor/browser-tool-license-supplements/prime-factorizer-v0-1-0');
 for(const target of [join(base,'supplement.json'),join(base,'MUSL-COPYRIGHT.txt')]){
  const suffix=relative(resolve(root),resolve(target));assert.ok(!suffix.startsWith('..'+sep));
  let current=resolve(root);for(const part of suffix.split(sep)){current=join(current,part);const s=lstatSync(current);assert.ok(!s.isSymbolicLink());if(current===resolve(target))assert.ok(s.isFile()&&s.nlink===1);}
 }
 const meta=JSON.parse(readFileSync(join(base,'supplement.json'),'utf8'));
 assert.deepEqual(meta,{schemaVersion:1,toolId:'prime-factorizer',releaseId:'v0-1-0',sourceCommit,sourceTreeSha256,sourcePath:'vendor/emscripten/MUSL-COPYRIGHT.txt',file:'MUSL-COPYRIGHT.txt',bytes:6204,sha256:'f9bc4423732350eb0b3f7ed7e91d530298476f8fec0c6c427a1c04ade22655af'});
 const bytes=readFileSync(join(base,meta.file));assert.equal(bytes.length,meta.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);
 const publicBytes=readFileSync(join(root,'apps/site/public/tool-licenses/prime-factorizer-v0.1.0/MUSL-COPYRIGHT.txt'));assert.deepEqual(publicBytes,bytes);
 return meta;
}
