import {mkdtemp,mkdir,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import {articleCli} from './cli.js';
import {sha256} from './canonical.js';
import type {DraftRepository} from './draft-job.js';
const roots:string[]=[];
const id='e7562440-e0bf-42a9-8a90-d66f4e1a4eb8',commit='4b492c50c253bfed9eac313bda6cfbae6eed60eb';
afterEach(async()=>{await Promise.all(roots.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'intake-cli-'));roots.push(root);
 const source=join(root,'.local','existing-article-sources','task');await mkdir(source,{recursive:true});
 const artifacts=[{id:'body',role:'manuscript',path:'article.md',origin:'ai_generated',lineageIds:['history'],bytes:Buffer.from('Synthetic AI draft; no approval')},
  {id:'hero',role:'hero',path:'hero.txt',origin:'deterministic',lineageIds:[],bytes:Buffer.from('Synthetic bytes; not an image audit')},
  {id:'history',role:'lineage',path:'history.txt',origin:'source_snapshot',lineageIds:[],bytes:Buffer.from('Synthetic observed generation history; not an execution receipt')}];
 for(const a of artifacts)await writeFile(join(source,a.path),a.bytes);
 const input={schemaVersion:1,protocol:'xpotato-existing-article-input-v1',contentId:id,baseCommit:commit,
  artifacts:artifacts.map(({bytes,...item})=>({...item,sha256:sha256(bytes),sizeBytes:bytes.length}))};
 const manifest=join(source,'intake.json');await writeFile(manifest,JSON.stringify(input));
 const result:unknown[]=[];const repo={commit} as DraftRepository;
 const run=(args:string[])=>articleCli(['article','existing-input','stage',...args],root,async()=>repo,value=>result.push(value));
 return {root,source,manifest,input,result,run};
}
describe('common existing-AI immutable intake CLI',()=>{
 it('stages through the existing implementation without creating a human job or approval',async()=>{
  const f=await fixture();expect(await f.run(['--from',f.manifest,'--source-root',f.source])).toBe(0);
  const result=f.result[0] as {artifacts:{origin:string}[];authority:Record<string,boolean>};
  expect(result.artifacts[0]!.origin).toBe('ai_generated');expect(Object.values(result.authority)).toEqual([false,false,false,false,false]);
  expect(await f.run(['--from',f.manifest,'--source-root',f.source])).toBe(0);expect(f.result[1]).toEqual(f.result[0]);
 });
 it('rejects side-effect or authorship flags rather than silently interpreting them',async()=>{
  const f=await fixture();for(const args of [['--authoring','human'],['--intent','publish'],['--network','enabled'],['--mock'],['--existing-login-audit']]){
   expect(await f.run(['--from',f.manifest,'--source-root',f.source,...args])).not.toBe(0);
  }
  await expect(access(join(f.root,'.local','article-jobs'))).rejects.toThrow();
 });
 it('rejects an outside manifest and stale repository pin before persisting input',async()=>{
  const f=await fixture();expect(await f.run(['--from',join(f.root,'intake.json'),'--source-root',f.source])).not.toBe(0);
  await writeFile(f.manifest,JSON.stringify({...f.input,baseCommit:'a'.repeat(40)}));
  expect(await f.run(['--from',f.manifest,'--source-root',f.source])).toBe(3);
  await expect(access(join(f.root,'.local','article-jobs'))).rejects.toThrow();
 });
 it('keeps exact bytes and source-root restrictions of the canonical intake',async()=>{
  const f=await fixture();await writeFile(join(f.source,'article.md'),'changed');
  expect(await f.run(['--from',f.manifest,'--source-root',f.source])).not.toBe(0);
  expect(await f.run(['--from',f.manifest,'--source-root',f.root])).not.toBe(0);
 });
});
