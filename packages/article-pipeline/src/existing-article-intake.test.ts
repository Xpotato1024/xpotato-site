import {mkdtemp,mkdir,writeFile,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
import {fingerprint,sha256} from './canonical.js';
import {existingArticleInputSchema,stageExistingArticleInput,readExistingArticleInput} from './existing-article-intake.js';
const id='e7562440-e0bf-42a9-8a90-d66f4e1a4eb8';
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'existing-intake-')),source=join(root,'.local','existing-article-sources');await mkdir(source,{recursive:true});
 const data=[{id:'body',role:'manuscript',path:'body.md',origin:'ai_generated',lineageIds:['history'],bytes:Buffer.from('既成の本文\n')},
  {id:'cover',role:'hero',path:'hero.jpg',origin:'ai_generated',lineageIds:['history'],bytes:Buffer.from([255,216,255,217])},
  {id:'history',role:'lineage',path:'history.json',origin:'user_supplied',lineageIds:[],bytes:Buffer.from('{"observation":"existing generation and adoption history"}\n')}];
 for(const a of data)await writeFile(join(source,a.path),a.bytes);
 const input={schemaVersion:1,protocol:'xpotato-existing-article-input-v1',contentId:id,baseCommit:'4b492c50c253bfed9eac313bda6cfbae6eed60eb',
  artifacts:data.map(({bytes,...a})=>({...a,sha256:sha256(bytes),sizeBytes:bytes.length}))};
 return {root,source,input,data};
}
describe('immutable existing AI article input before formal job admission',()=>{
 it('stages exact existing bytes idempotently, retaining AI origin and denying every authority claim',async()=>{
  const f=await fixture(),r=await stageExistingArticleInput(f.root,f.source,f.input);
  expect(await stageExistingArticleInput(f.root,f.source,f.input)).toEqual(r);
  expect(r.artifacts[0]!.origin).toBe('ai_generated');
  expect(Object.values(r.authority)).toEqual([false,false,false,false,false]);
  for(const a of f.data)expect(await readFile(join(r.directory,'objects',sha256(a.bytes)))).toEqual(a.bytes);
 });
 it('rejects edited source bytes and size mismatch before intake can be committed',async()=>{
  const f=await fixture();await writeFile(join(f.source,'body.md'),'changed');
  await expect(stageExistingArticleInput(f.root,f.source,f.input)).rejects.toThrow('BYTES_MISMATCH');
 });
 it('rejects object tampering and another content identity on readback',async()=>{
  const f=await fixture(),r=await stageExistingArticleInput(f.root,f.source,f.input);
  await expect(readExistingArticleInput(r.directory,'bca48f98-c89a-457f-84d8-168f941fe469',r.inputSha256)).rejects.toThrow('BINDING_INVALID');
  await writeFile(join(r.directory,'objects',f.input.artifacts[0]!.sha256),'changed');
  await expect(readExistingArticleInput(r.directory,id,r.inputSha256)).rejects.toThrow('BYTES_MISMATCH');
  await expect(stageExistingArticleInput(f.root,f.source,f.input)).rejects.toThrow();
 });
 it('does not accept authority, a human producer, missing lineage, or duplicate identities',async()=>{
  const {input}=await fixture();
  for(const value of [{...input,humanApproval:true},{...input,artifacts:input.artifacts.map(a=>({...a,producer:'human'}))},
   {...input,artifacts:input.artifacts.map(a=>({...a,lineageIds:[]}))},
   {...input,artifacts:[...input.artifacts,input.artifacts[0]]}])expect(()=>existingArticleInputSchema.parse(value)).toThrow();
 });
 it('rejects invalid lineage links, excessive declared bytes, and path escapes',async()=>{
  const {input}=await fixture();
  for(const artifacts of [input.artifacts.map(a=>({...a,lineageIds:['body']})),input.artifacts.map(a=>({...a,sizeBytes:9*1024*1024})),
   input.artifacts.map(a=>({...a,path:'../escape'}))])expect(()=>existingArticleInputSchema.parse({...input,artifacts})).toThrow();
 });
 it('rejects linked input files without following them',async()=>{
  const f=await fixture();await symlink(join(f.source,'body.md'),join(f.source,'linked.md'));
  f.input.artifacts[0]!.path='linked.md';
  await expect(stageExistingArticleInput(f.root,f.source,f.input)).rejects.toThrow('SYMLINK_PATH_DENIED');
 });
 it('restricts sourceRoot to the dedicated local intake source area',async()=>{
  const f=await fixture();
  for(const root of [f.root,join(f.root,'.aws'),join(f.root,'.local')])
   await expect(stageExistingArticleInput(f.root,root,f.input)).rejects.toThrow('SOURCE_ROOT_DENIED');
 });
 it.each(['.aws/input.json','.ssh/input.json','.codex/input.json','.git/input.json','.env.local','credentials.json','secrets.json'])('rejects credential path class %s before reading it',async path=>{
  const f=await fixture();f.input.artifacts[0]!.path=path;
  await expect(stageExistingArticleInput(f.root,f.source,f.input)).rejects.toThrow('PATH_DENIED');
 });
 it.each(['OPENAI_API_KEY=sk-'+'x'.repeat(32),'AWS_SECRET_ACCESS_KEY='+'x'.repeat(40),'GITHUB_TOKEN=ghp_'+'x'.repeat(36),'https://example.invalid/?X-Amz-Signature=fixture',
  '{"AWS_SECRET_ACCESS_KEY":"benign-fixture"}','{"AWS_SESSION_TOKEN":"benign-fixture"}',"'CLOUDFLARE_API_TOKEN': 'benign-fixture'"])('rejects known credential/capability forms with matching hash: %s',async text=>{
  const f=await fixture(),bytes=Buffer.from(text);await writeFile(join(f.source,'body.md'),bytes);
  f.input.artifacts[0]!.sha256=sha256(bytes);f.input.artifacts[0]!.sizeBytes=bytes.length;
  await expect(stageExistingArticleInput(f.root,f.source,f.input)).rejects.toThrow('SECRET_DENIED');
 });
 it.each(['AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN'])('rejects JSON %s on readback even with self-consistent forged hashes',async key=>{
  const f=await fixture(),r=await stageExistingArticleInput(f.root,f.source,f.input),bytes=Buffer.from(JSON.stringify({[key]:'benign-fixture'}));
  const record=JSON.parse(await readFile(join(r.directory,'intake.json'),'utf8'));
  record.input.artifacts[0].sha256=sha256(bytes);record.input.artifacts[0].sizeBytes=bytes.length;
  record.inputSha256=fingerprint(record.input);
  await writeFile(join(r.directory,'objects',sha256(bytes)),bytes);
  await writeFile(join(r.directory,'intake.json'),JSON.stringify(record));
  await expect(readExistingArticleInput(r.directory,id,record.inputSha256)).rejects.toThrow('SECRET_DENIED');
 });
 it('refuses actual secret bytes even when hashes match the declared manifest',async()=>{
  const f=await fixture(),bytes=Buffer.from('-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----');
  await writeFile(join(f.source,'body.md'),bytes);f.input.artifacts[0]!.sha256=sha256(bytes);f.input.artifacts[0]!.sizeBytes=bytes.length;
  await expect(stageExistingArticleInput(f.root,f.source,f.input)).rejects.toThrow('SECRET_DENIED');
 });
});
