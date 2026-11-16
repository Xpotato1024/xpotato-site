import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const root=process.cwd(),runbook='docs/operations/ai-content-execution.md';
const read=(p:string)=>readFile(resolve(root,p),'utf8');
// Structural/routing regression only: not live-provider success, editorial quality or formal approval.
describe('model-independent content execution references',()=>{
 it('all local references resolve to existing sources',async()=>{
  for(const file of [runbook,'.agents/skills/japanese-technical-blog/SKILL.md','.agents/skills/create-browser-tool/SKILL.md']){
   for(const match of (await read(file)).matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/gu)){
    const path=match[1]!;if(/^[a-z]+:/iu.test(path))continue;
    expect((await readFile(resolve(root,dirname(file),path),'utf8')).trim().length,file+' -> '+path).toBeGreaterThan(0);
   }
  }
 });
 it('connects the same execution contract to both entrypoints and repository routing',async()=>{
  for(const f of ['.agents/skills/japanese-technical-blog/SKILL.md','.agents/skills/create-browser-tool/SKILL.md','.agents/README.md','AGENTS.md','docs/operations/content-production.md'])expect(await read(f),f).toContain('ai-content-execution.md');
 });
 it('preserves bounded independent responsibilities without a new authority',async()=>{
  const text=await read(runbook);
  for(const term of ['第三の利用者入口ではない','逐次実行でよい','writerを一人だけ','最初の未完了工程','readonly照合','secret','terminal status','readback','進捗返信','数学的保証ではない'])expect(text).toContain(term);
  expect(text).not.toMatch(/GPT-6|Claude|Gemini|C:\\Users\\|max_tokens|temperature\s*=/u);
 });
 it('keeps paired scenarios without pretending to evaluate an agent',async()=>{
  const corpus=JSON.parse(await read('.agents/skills/japanese-technical-blog/evals/ai-content-execution.json'));
  expect(corpus.schema_version).toBe(1);expect(corpus.purpose).toContain('not semantic');
  const seen=new Set<string>();
  for(const c of corpus.cases){expect(typeof c.accept).toBe('boolean');expect(c.context.length).toBeGreaterThan(0);expect(c.candidate.length).toBeGreaterThan(0);expect(seen.has(c.id)).toBe(false);seen.add(c.id);}
  for(const topic of ['sequential','writer','dependency','missing-output','local-remote','timeout','denied-ui','resume','private-scope','model-portability','closure']){
   const a=corpus.cases.find((c:any)=>c.id===topic+'-accept'),b=corpus.cases.find((c:any)=>c.id===topic+'-reject');
   expect(a.accept).toBe(true);expect(b.accept).toBe(false);expect(a.context).toBe(b.context);
  }
 });
});