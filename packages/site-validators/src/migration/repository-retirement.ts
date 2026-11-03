import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {LEGACY_COMMIT,LEGACY_TAG} from './legacy-inventory.js';
import {FROZEN_LEGACY_BASELINE} from "../git-media.js";
import {readSourceBlobs} from "../browser-tools/browser-tool-source-blobs.js";

/** Exact reproducible text copies only; never a cutover, media restore or rollback receipt. */
export function readFrozenLegacyTextCopies(root:string):ReadonlyMap<string,Buffer>{
 const options={cwd:root,maxBuffer:1000000,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'}};
 const git=(...args:string[])=>execFileSync('git',['-c','core.fsmonitor=false',...args],options);
 const accepted=JSON.parse(readFileSync(join(root,'tests/fixtures/migration/legacy-freeze-baseline.json'),'utf8'));
 if(accepted.tag!==LEGACY_TAG||accepted.commitSha!==LEGACY_COMMIT||!/^[a-f0-9]{40}$/u.test(accepted.tagObjectSha)
  ||git('rev-parse','refs/tags/'+LEGACY_TAG).toString().trim()!==accepted.tagObjectSha
  ||git('cat-file','-t','refs/tags/'+LEGACY_TAG).toString().trim()!=='tag'||git('rev-parse','refs/tags/'+LEGACY_TAG+'^{}').toString().trim()!==LEGACY_COMMIT)throw Error('Legacy retirement requires the exact annotated frozen tag');
 const list=(ref:string)=>git('ls-tree','-rlz',ref,'--','src','public','astro.config.mjs','tailwind.config.mjs','wrangler.jsonc').toString('utf8').split('\0').filter(Boolean).map(line=>{
  const tab=line.indexOf('\t'),[mode,type,oid,size]=line.slice(0,tab).trim().split(/\s+/u);
  return{path:line.slice(tab+1),mode,type,oid:oid!,size:Number(size)};
 });
 const snapshot=list(LEGACY_COMMIT),baseline=new Map(list(FROZEN_LEGACY_BASELINE).map(r=>[r.path,r]));
 const allowed=snapshot.filter(r=>r.path.startsWith('src/')||['astro.config.mjs','tailwind.config.mjs','wrangler.jsonc','public/robots.txt'].includes(r.path)||r.path.startsWith('public/')&&r.path.endsWith('.svg'));
 if(allowed.length!==124||allowed.some(r=>r.mode!=='100644'||r.type!=='blob'||baseline.get(r.path)?.oid!==r.oid))throw Error('Frozen legacy text retirement exact set/preimage mismatch');
 const blobs=readSourceBlobs(allowed,(input,maxBuffer)=>execFileSync('git',['-c','core.fsmonitor=false','cat-file','--batch'],{...options,input,maxBuffer}));
 for(const r of allowed)new TextDecoder('utf-8',{fatal:true}).decode(blobs.get(r.oid)!);
 return new Map(allowed.map(r=>[r.path,blobs.get(r.oid)!]));
}
export const verifiedLegacyTextRetirement=(root:string):ReadonlySet<string>=>new Set(readFrozenLegacyTextCopies(root).keys());
